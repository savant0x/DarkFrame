import Redis from 'ioredis';
import { logger } from '@/lib/logger/productionLogger';

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_ENABLED = !!REDIS_URL && REDIS_URL !== 'disabled';

if (!REDIS_ENABLED) {
  console.warn('[Redis] No REDIS_URL or UPSTASH_REDIS_REST_URL set — Redis disabled, falling back to memory rate limiter');
}

let redisClient: Redis | null = null;
let connectionAttempted = false;

export async function getRedisClient(): Promise<Redis | null> {
  if (!REDIS_ENABLED) {
    return null;
  }

  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  if (connectionAttempted && !redisClient) {
    return null;
  }

  try {
    connectionAttempted = true;

    redisClient = new Redis(REDIS_URL!, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ECONNRESET'];
        return targetErrors.some((targetError) =>
          err.message.includes(targetError)
        );
      },
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Client ready');
    });

    redisClient.on('close', () => {
      console.warn('[Redis] Connection closed');
    });

    return redisClient;
  } catch (error: unknown) {
    console.error('[Redis] Failed to initialize client:', error);
    redisClient = null;
    return null;
  }
}

export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.status === 'ready';
}

export async function checkRedisHealth(): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch (error: unknown) {
    logger.debug('Redis ping failed', { error });
    return false;
  }
}

export async function getRedisInfo() {
  const client = await getRedisClient();
  if (!client) {
    return {
      version: 'unavailable',
      uptime: '0',
      connectedClients: '0',
    };
  }

  try {
    const info = await client.info('server');
    const lines = info.split('\r\n');
    const data: Record<string, string> = {};

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          data[key] = value;
        }
      }
    }

    return {
      version: data.redis_version || 'unknown',
      uptime: data.uptime_in_seconds || '0',
      connectedClients: data.connected_clients || '0',
    };
  } catch (error: unknown) {
    console.error('[Redis] Failed to get info:', error);
    return {
      version: 'error',
      uptime: '0',
      connectedClients: '0',
    };
  }
}

export async function getRedisMemoryStats() {
  const client = await getRedisClient();
  if (!client) {
    return {
      used: '0',
      peak: '0',
      fragmentation: '0',
    };
  }

  try {
    const info = await client.info('memory');
    const lines = info.split('\r\n');
    const data: Record<string, string> = {};

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          data[key] = value;
        }
      }
    }

    return {
      used: data.used_memory_human || '0',
      peak: data.used_memory_peak_human || '0',
      fragmentation: data.mem_fragmentation_ratio || '0',
    };
  } catch (error: unknown) {
    console.error('[Redis] Failed to get memory stats:', error);
    return {
      used: '0',
      peak: '0',
      fragmentation: '0',
    };
  }
}

/**
 * Health check status for a single subsystem
 */
export interface HealthCheckStatus {
  status: 'ok' | 'degraded' | 'error';
  message: string;
  responseTime?: number;
  mode?: string;
  version?: string;
  connections?: number;
}

/**
 * Overall system health status returned by the /api/health endpoint
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    api: HealthCheckStatus;
    database: HealthCheckStatus;
    redis: HealthCheckStatus;
    websocket: HealthCheckStatus;
  };
  environment: string;
  version: string;
}

export interface RateLimiterConfig {
  keyPrefix: string;
  maxRequests: number;
  windowSeconds: number;
  fallbackToMemory?: boolean;
}

class MemoryRateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>();

  check(key: string, maxRequests: number, windowSeconds: number): boolean {
    const now = Date.now();
    const data = this.store.get(key);

    if (!data || now > data.resetAt) {
      this.store.set(key, {
        count: 1,
        resetAt: now + windowSeconds * 1000,
      });
      return true;
    }

    if (data.count >= maxRequests) {
      return false;
    }

    data.count++;
    this.store.set(key, data);
    return true;
  }

  getRemainingTime(key: string): number {
    const data = this.store.get(key);
    if (!data) return 0;

    const now = Date.now();
    if (now > data.resetAt) return 0;

    return Math.ceil((data.resetAt - now) / 1000);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.store.entries()) {
      if (now > data.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

const memoryLimiter = new MemoryRateLimiter();

setInterval(() => memoryLimiter.cleanup(), 5 * 60 * 1000);

export function createRateLimiter(config: RateLimiterConfig) {
  const { keyPrefix, maxRequests, windowSeconds, fallbackToMemory = true } = config;

  async function check(identifier: string): Promise<boolean> {
    const key = `${keyPrefix}:${identifier}`;
    const client = await getRedisClient();

    if (!client && fallbackToMemory) {
      return memoryLimiter.check(key, maxRequests, windowSeconds);
    }

    if (!client) {
      return true;
    }

    try {
      const current = await client.incr(key);

      if (current === 1) {
        await client.expire(key, windowSeconds);
      }

      return current <= maxRequests;
    } catch (error: unknown) {
      console.error('[RateLimiter] Check failed:', error);

      if (fallbackToMemory) {
        return memoryLimiter.check(key, maxRequests, windowSeconds);
      }

      return true;
    }
  }

  async function getRemainingTime(identifier: string): Promise<number> {
    const key = `${keyPrefix}:${identifier}`;
    const client = await getRedisClient();

    if (!client && fallbackToMemory) {
      return memoryLimiter.getRemainingTime(key);
    }

    if (!client) {
      return 0;
    }

    try {
      const ttl = await client.ttl(key);
      return ttl > 0 ? ttl : 0;
    } catch (error: unknown) {
      console.error('[RateLimiter] Get remaining time failed:', error);

      if (fallbackToMemory) {
        return memoryLimiter.getRemainingTime(key);
      }

      return 0;
    }
  }

  async function record(identifier: string): Promise<void> {
    const key = `${keyPrefix}:${identifier}`;
    const client = await getRedisClient();

    if (!client) return;

    try {
      await client.setex(key, windowSeconds, '1');
    } catch (error: unknown) {
      console.error('[RateLimiter] Record failed:', error);
    }
  }

  return {
    check,
    getRemainingTime,
    record,
  };
}
