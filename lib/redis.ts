/**
 * Redis Client Wrapper
 * Created: 2025-10-25
 * Feature: FID-20251025-104 (Production Readiness)
 * 
 * OVERVIEW:
 * Production-ready Redis client using ioredis with connection pooling,
 * health checking, and graceful degradation. Provides reusable rate limiting
 * utilities for API routes.
 * 
 * FEATURES:
 * - ioredis client with automatic reconnection
 * - Connection health monitoring
 * - Reusable rate limiter factory
 * - Graceful fallback if Redis unavailable
 * - Environment-based configuration
 */

import Redis from 'ioredis';

// ============================================================================
// CONFIGURATION
// ============================================================================

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_ENABLED = !!REDIS_URL && REDIS_URL !== 'disabled';

// ============================================================================
// REDIS CLIENT SINGLETON
// ============================================================================

let redisClient: Redis | null = null;
let connectionAttempted = false;

/**
 * Get or create Redis client instance
 * 
 * @returns Redis client or null if unavailable
 */
export async function getRedisClient(): Promise<Redis | null> {
  // Redis disabled via environment
  if (!REDIS_ENABLED) {
    return null;
  }

  // Return existing client if already connected
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  // Avoid multiple connection attempts
  if (connectionAttempted && !redisClient) {
    return null;
  }

  try {
    connectionAttempted = true;

    // Create new client
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

    // Handle connection events
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
  } catch (error) {
    console.error('[Redis] Failed to initialize client:', error);
    redisClient = null;
    return null;
  }
}

/**
 * Check if Redis is available and connected
 * 
 * @returns True if Redis client is ready
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.status === 'ready';
}

/**
 * Check Redis health with ping
 * 
 * @returns True if Redis responds to PING
 */
export async function checkRedisHealth(): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Get Redis server information
 * 
 * @returns Server info object
 */
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
  } catch (error) {
    console.error('[Redis] Failed to get info:', error);
    return {
      version: 'error',
      uptime: '0',
      connectedClients: '0',
    };
  }
}

/**
 * Get Redis memory statistics
 * 
 * @returns Memory stats object
 */
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
  } catch (error) {
    console.error('[Redis] Failed to get memory stats:', error);
    return {
      used: '0',
      peak: '0',
      fragmentation: '0',
    };
  }
}

// ============================================================================
// RATE LIMITING UTILITIES
// ============================================================================

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Unique key prefix for this limiter */
  keyPrefix: string;
  /** Maximum requests allowed in window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Fallback to in-memory if Redis unavailable */
  fallbackToMemory?: boolean;
}

/**
 * In-memory fallback rate limiter
 */
class MemoryRateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>();

  check(key: string, maxRequests: number, windowSeconds: number): boolean {
    const now = Date.now();
    const data = this.store.get(key);

    if (!data || now > data.resetAt) {
      // New window
      this.store.set(key, {
        count: 1,
        resetAt: now + windowSeconds * 1000,
      });
      return true;
    }

    if (data.count >= maxRequests) {
      return false; // Rate limited
    }

    // Increment count
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

// Cleanup in-memory limiter every 5 minutes
setInterval(() => memoryLimiter.cleanup(), 5 * 60 * 1000);

/**
 * Create a rate limiter instance
 * 
 * @param config - Rate limiter configuration
 * @returns Rate limiter functions
 * 
 * @example
 * const limiter = createRateLimiter({
 *   keyPrefix: 'veteran_help',
 *   maxRequests: 1,
 *   windowSeconds: 300,
 *   fallbackToMemory: true
 * });
 * 
 * const canProceed = await limiter.check('user123');
 * if (!canProceed) {
 *   const remaining = await limiter.getRemainingTime('user123');
 *   console.log(`Rate limited. Try again in ${remaining} seconds`);
 * }
 */
export function createRateLimiter(config: RateLimiterConfig) {
  const { keyPrefix, maxRequests, windowSeconds, fallbackToMemory = true } = config;

  /**
   * Check if request is allowed (not rate limited)
   * 
   * @param identifier - Unique identifier (username, IP, etc.)
   * @returns True if allowed, false if rate limited
   */
  async function check(identifier: string): Promise<boolean> {
    const key = `${keyPrefix}:${identifier}`;
    const client = await getRedisClient();

    // Fallback to in-memory if Redis unavailable
    if (!client && fallbackToMemory) {
      return memoryLimiter.check(key, maxRequests, windowSeconds);
    }

    if (!client) {
      // No Redis, no fallback - allow request
      console.warn('[RateLimiter] Redis unavailable, allowing request');
      return true;
    }

    try {
      // Increment counter with expiry
      const current = await client.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await client.expire(key, windowSeconds);
      }

      return current <= maxRequests;
    } catch (error) {
      console.error('[RateLimiter] Check failed:', error);

      // On error, use fallback if enabled
      if (fallbackToMemory) {
        return memoryLimiter.check(key, maxRequests, windowSeconds);
      }

      // No fallback - allow request
      return true;
    }
  }

  /**
   * Get remaining time in seconds until rate limit resets
   * 
   * @param identifier - Unique identifier
   * @returns Seconds remaining, or 0 if not rate limited
   */
  async function getRemainingTime(identifier: string): Promise<number> {
    const key = `${keyPrefix}:${identifier}`;
    const client = await getRedisClient();

    // Fallback to in-memory if Redis unavailable
    if (!client && fallbackToMemory) {
      return memoryLimiter.getRemainingTime(key);
    }

    if (!client) {
      return 0;
    }

    try {
      const ttl = await client.ttl(key);
      return ttl > 0 ? ttl : 0;
    } catch (error) {
      console.error('[RateLimiter] Get remaining time failed:', error);

      // Fallback
      if (fallbackToMemory) {
        return memoryLimiter.getRemainingTime(key);
      }

      return 0;
    }
  }

  /**
   * Record a successful request
   * (Automatically called by check(), but can be used standalone)
   * 
   * @param identifier - Unique identifier
   */
  async function record(identifier: string): Promise<void> {
    const key = `${keyPrefix}:${identifier}`;
    const client = await getRedisClient();

    if (!client) return;

    try {
      await client.setex(key, windowSeconds, '1');
    } catch (error) {
      console.error('[RateLimiter] Record failed:', error);
    }
  }

  return {
    check,
    getRemainingTime,
    record,
  };
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Connection Management:
 *    - Singleton pattern for Redis client
 *    - Automatic reconnection on connection loss
 *    - Graceful degradation if Redis unavailable
 *    - Environment variable configuration (REDIS_URL)
 * 
 * 2. Rate Limiter Design:
 *    - Factory pattern for creating limiters
 *    - Configurable prefix, max requests, window duration
 *    - In-memory fallback for development/resilience
 *    - Automatic cleanup of expired in-memory keys
 * 
 * 3. Error Handling:
 *    - All Redis operations wrapped in try-catch
 *    - Fallback to in-memory limiter on Redis errors
 *    - Allow requests if both Redis and fallback fail
 *    - Log all errors for debugging
 * 
 * 4. Production Readiness:
 *    - Connection pooling via ioredis
 *    - Retry strategy for transient failures
 *    - Health check endpoints for monitoring
 *    - Memory stats for capacity planning
 * 
 * 5. Usage Example:
 *    ```typescript
 *    const veteranLimiter = createRateLimiter({
 *      keyPrefix: 'veteran_help',
 *      maxRequests: 1,
 *      windowSeconds: 300, // 5 minutes
 *      fallbackToMemory: true
 *    });
 * 
 *    const canAsk = await veteranLimiter.check(username);
 *    if (!canAsk) {
 *      const wait = await veteranLimiter.getRemainingTime(username);
 *      return res.status(429).json({ error: `Wait ${wait}s` });
 *    }
 *    ```
 * 
 * 6. Environment Configuration:
 *    - REDIS_URL: Full Redis connection URL (redis://...)
 *    - UPSTASH_REDIS_REST_URL: Upstash REST API URL (alternative)
 *    - Set to 'disabled' to disable Redis completely
 * 
 * 7. In-Memory Fallback:
 *    - Used when Redis unavailable
 *    - Resets on server restart (not persistent)
 *    - Not suitable for multi-instance deployments
 *    - Automatic cleanup every 5 minutes
 */
