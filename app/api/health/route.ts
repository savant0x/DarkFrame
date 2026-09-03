/**
 * @file app/api/health/route.ts
 * @created 2025-10-23 (FID-20251023-004: Health Check Endpoint)
 * @updated 2025-10-25 (FID-20251025-104: Added Redis & WebSocket monitoring)
 * @overview System health check endpoint for monitoring
 * 
 * OVERVIEW:
 * Provides health status of application components:
 * - API availability
 * - Database connectivity (MongoDB)
 * - Redis connectivity and mode
 * - WebSocket server status
 * - System uptime
 * - Environment information
 * 
 * Used for:
 * - Load balancer health checks
 * - Monitoring system integration
 * - Quick status verification
 * - Debugging deployment issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { sql } from 'drizzle-orm';
import {
  checkRedisHealth,
  getRedisInfo,
  isRedisAvailable,
} from '@/lib/redis';
import { getIO } from '@/lib/websocket/server';
import { withRequestLogging, createRouteLogger } from '@/lib';

/**
 * System health status
 */
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    api: {
      status: 'ok' | 'error';
      message: string;
    };
    database: {
      status: 'ok' | 'error';
      message: string;
      responseTime?: number;
    };
    redis: {
      status: 'ok' | 'degraded' | 'error';
      message: string;
      mode: 'redis' | 'in-memory-fallback' | 'unavailable';
      responseTime?: number;
      version?: string;
    };
    websocket: {
      status: 'ok' | 'degraded' | 'error';
      message: string;
      connections?: number;
    };
  };
  environment: string;
  version: string;
}

/**
 * GET /api/health
 * Returns health status of the application
 * 
 * @returns HealthStatus object
 * @example
 * Response: {
 *   status: "healthy",
 *   timestamp: "2025-10-23T12:00:00.000Z",
 *   uptime: 86400,
 *   checks: {
 *     api: { status: "ok", message: "API is operational" },
 *     database: { status: "ok", message: "Connected", responseTime: 15 }
 *   },
 *   environment: "production",
 *   version: "0.1.0"
 * }
 */
export const GET = withRequestLogging(async (_request: NextRequest) => {
  const log = createRouteLogger('Health');
  const startTime = performance.now();
  
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      api: {
        status: 'ok',
        message: 'API is operational'
      },
      database: {
        status: 'ok',
        message: 'Not checked'
      },
      redis: {
        status: 'ok',
        message: 'Not checked',
        mode: 'unavailable'
      },
      websocket: {
        status: 'ok',
        message: 'Not checked'
      }
    },
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0'
  };

  // Check database connectivity
  try {
    const dbStartTime = performance.now();
    const db = await getDatabase();
    await db.execute(sql`SELECT 1`);
    const dbResponseTime = Math.round(performance.now() - dbStartTime);
    
    health.checks.database = {
      status: 'ok',
      message: 'Connected',
      responseTime: dbResponseTime
    };
    
    log.debug('Database health check passed', { responseTime: dbResponseTime });
  } catch (error) {
    health.checks.database = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed'
    };
    health.status = 'degraded';
    
    log.warn('Database health check failed', { error: error instanceof Error ? error.message : String(error) });
  }

  // Check Redis connectivity
  try {
    const redisStartTime = performance.now();
    const isAvailable = isRedisAvailable();
    
    if (!isAvailable) {
      health.checks.redis = {
        status: 'degraded',
        message: 'Using in-memory fallback',
        mode: 'in-memory-fallback'
      };
      log.debug('Redis unavailable, using in-memory fallback');
    } else {
      const pingSuccess = await checkRedisHealth();
      const redisResponseTime = Math.round(performance.now() - redisStartTime);
      
      if (pingSuccess) {
        const info = await getRedisInfo();
        health.checks.redis = {
          status: 'ok',
          message: 'Connected',
          mode: 'redis',
          responseTime: redisResponseTime,
          version: info.version
        };
        log.debug('Redis health check passed', { responseTime: redisResponseTime });
      } else {
        health.checks.redis = {
          status: 'degraded',
          message: 'PING failed, using fallback',
          mode: 'in-memory-fallback',
          responseTime: redisResponseTime
        };
        log.warn('Redis PING failed');
      }
    }
  } catch (error) {
    health.checks.redis = {
      status: 'degraded',
      message: error instanceof Error ? error.message : 'Check failed',
      mode: 'in-memory-fallback'
    };
    log.warn('Redis health check error', { error: error instanceof Error ? error.message : String(error) });
  }

  // Check WebSocket server status
  try {
    const io = getIO();
    
    if (!io) {
      health.checks.websocket = {
        status: 'degraded',
        message: 'Server not initialized (will start on first connection)',
        connections: 0
      };
      log.debug('WebSocket server not initialized');
    } else {
      const connectionCount = io.sockets.sockets.size;
      health.checks.websocket = {
        status: 'ok',
        message: 'Server running',
        connections: connectionCount
      };
      log.debug('WebSocket health check passed', { connections: connectionCount });
    }
  } catch (error) {
    health.checks.websocket = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Status check failed'
    };
    log.warn('WebSocket health check error', { error: error instanceof Error ? error.message : String(error) });
  }

  // Determine overall status
  if (health.checks.database.status === 'error') {
    health.status = 'unhealthy'; // MongoDB is critical
  } else if (health.checks.websocket.status === 'error') {
    health.status = 'degraded';
  }
  // Note: Redis degraded is acceptable (has in-memory fallback)

  const totalTime = Math.round(performance.now() - startTime);
  log.info('Health check completed', { 
    status: health.status, 
    duration: totalTime,
    dbResponseTime: health.checks.database.responseTime,
    redisMode: health.checks.redis.mode,
    wsConnections: health.checks.websocket.connections
  });

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
});

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
//
// Usage:
// - Load Balancer: Configure to check /api/health every 30s
// - Monitoring: Set up alerts when status !== 'healthy'
// - CI/CD: Verify health after deployments
//
// Response Codes:
// - 200: All systems operational
// - 503: Service degraded or unavailable
//
// Health States:
// - healthy: All checks passing
// - degraded: Some non-critical components failing (Redis, WebSocket)
// - unhealthy: Critical components failing (MongoDB)
//
// Service Priority:
// - MongoDB: CRITICAL - unhealthy if down
// - WebSocket: NON-CRITICAL - degraded if down
// - Redis: NON-CRITICAL - degraded is OK (has in-memory fallback)
//
// Redis Modes:
// - redis: Connected to Redis server
// - in-memory-fallback: Using local memory for rate limiting
// - unavailable: Redis not configured
//
// Future Enhancements:
// - Custom health check rules (configurable thresholds)
// - Historical health data (track degradation over time)
// - Disk space monitoring
// - Memory usage reporting
// - Request queue depth
// - Average response times
// - Integration with monitoring tools (Datadog, New Relic)
//
// ============================================================================
