/**
 * @file app/api/health/route.ts
 * @created 2025-10-23
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview System health check endpoint for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  checkRedisHealth,
  getRedisInfo,
  isRedisAvailable,
} from '@/lib/redis';
import { getIO } from '@/lib/websocket/server';
import { withRequestLogging, createRouteLogger } from '@/lib';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    api: { status: 'ok' | 'error'; message: string };
    database: { status: 'ok' | 'error'; message: string; responseTime?: number };
    redis: { status: 'ok' | 'degraded' | 'error'; message: string; mode: 'redis' | 'in-memory-fallback' | 'unavailable'; responseTime?: number; version?: string };
    websocket: { status: 'ok' | 'degraded' | 'error'; message: string; connections?: number };
  };
  environment: string;
  version: string;
}

export const GET = withRequestLogging(async (_request: NextRequest) => {
  const log = createRouteLogger('Health');
  const startTime = performance.now();
  
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      api: { status: 'ok', message: 'API is operational' },
      database: { status: 'ok', message: 'Not checked' },
      redis: { status: 'ok', message: 'Not checked', mode: 'unavailable' },
      websocket: { status: 'ok', message: 'Not checked' }
    },
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0'
  };

  // Check Supabase database connectivity
  try {
    const dbStartTime = performance.now();
    const supabase = createServiceClient();
    await supabase.from('players').select('username', { count: 'exact', head: true });
    const dbResponseTime = Math.round(performance.now() - dbStartTime);
    
    health.checks.database = { status: 'ok', message: 'Connected', responseTime: dbResponseTime };
    log.debug('Database health check passed', { responseTime: dbResponseTime });
  } catch (error) {
    health.checks.database = { status: 'error', message: error instanceof Error ? error.message : 'Connection failed' };
    health.status = 'degraded';
    log.warn('Database health check failed', { error: error instanceof Error ? error.message : String(error) });
  }

  // Check Redis connectivity
  try {
    const redisStartTime = performance.now();
    const isAvailable = isRedisAvailable();
    
    if (!isAvailable) {
      health.checks.redis = { status: 'degraded', message: 'Using in-memory fallback', mode: 'in-memory-fallback' };
      log.debug('Redis unavailable, using in-memory fallback');
    } else {
      const pingSuccess = await checkRedisHealth();
      const redisResponseTime = Math.round(performance.now() - redisStartTime);
      
      if (pingSuccess) {
        const info = await getRedisInfo();
        health.checks.redis = { status: 'ok', message: 'Connected', mode: 'redis', responseTime: redisResponseTime, version: info.version };
        log.debug('Redis health check passed', { responseTime: redisResponseTime });
      } else {
        health.checks.redis = { status: 'degraded', message: 'PING failed, using fallback', mode: 'in-memory-fallback', responseTime: redisResponseTime };
        log.warn('Redis PING failed');
      }
    }
  } catch (error) {
    health.checks.redis = { status: 'degraded', message: error instanceof Error ? error.message : 'Check failed', mode: 'in-memory-fallback' };
    log.warn('Redis health check error', { error: error instanceof Error ? error.message : String(error) });
  }

  // Check WebSocket server status
  try {
    const io = getIO();
    
    if (!io) {
      health.checks.websocket = { status: 'degraded', message: 'Server not initialized (will start on first connection)', connections: 0 };
      log.debug('WebSocket server not initialized');
    } else {
      const connectionCount = io.sockets.sockets.size;
      health.checks.websocket = { status: 'ok', message: 'Server running', connections: connectionCount };
      log.debug('WebSocket health check passed', { connections: connectionCount });
    }
  } catch (error) {
    health.checks.websocket = { status: 'error', message: error instanceof Error ? error.message : 'Status check failed' };
    log.warn('WebSocket health check error', { error: error instanceof Error ? error.message : String(error) });
  }

  if (health.checks.database.status === 'error') {
    health.status = 'unhealthy';
  } else if (health.checks.websocket.status === 'error') {
    health.status = 'degraded';
  }

  const totalTime = Math.round(performance.now() - startTime);
  log.info('Health check completed', { status: health.status, duration: totalTime });

  const statusCode = health.status === 'healthy' ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
});
