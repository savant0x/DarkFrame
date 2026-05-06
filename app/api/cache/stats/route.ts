/**
 * Cache Statistics API Endpoint
 * 
 * Provides real-time metrics for Redis cache performance monitoring
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-041 (Redis Caching Layer)
 * 
 * OVERVIEW:
 * This endpoint exposes cache performance metrics for monitoring dashboards
 * and operational insights. It provides hit rate, memory usage, key counts,
 * and performance statistics.
 * 
 * Metrics Provided:
 * - Cache hit rate (hits / total requests)
 * - Memory usage (used bytes, percentage)
 * - Key counts by pattern
 * - Request statistics (hits, misses, errors)
 * - Redis server info
 * 
 * Access Control:
 * - Development: Open access
 * - Production: Requires admin authentication (TODO)
 */

import { NextResponse } from 'next/server';
import { isRedisAvailable, getRedisInfo, getRedisMemoryStats, getRedisClient } from '@/lib/redis';
import { getCacheStats } from '@/lib/cacheService';
import { CachePrefix } from '@/lib/cacheKeys';

/**
 * Cache statistics response structure
 */
interface CacheStatsResponse {
  available: boolean;
  performance: {
    hits: number;
    misses: number;
    errors: number;
    total: number;
    hitRate: string;
  };
  memory: {
    usedBytes: number;
    usedMB: number;
    peakBytes: number;
    peakMB: number;
    percentage: number;
  };
  keys: {
    total: number;
    byCategory: Record<string, number>;
  };
  server: {
    version: string;
    uptime: number;
    connectedClients: number;
  };
  timestamp: string;
}

/**
 * GET /api/cache/stats
 * 
 * Returns comprehensive cache statistics
 * 
 * @returns Cache metrics and performance data
 * 
 * @example
 * // Fetch cache stats
 * const response = await fetch('/api/cache/stats');
 * const stats = await response.json();
 * console.log(`Hit rate: ${stats.performance.hitRate}`);
 */
export async function GET(): Promise<NextResponse<CacheStatsResponse | { error: string }>> {
  try {
    // Check if Redis is available
    if (!isRedisAvailable()) {
      return NextResponse.json(
        {
          available: false,
          performance: {
            hits: 0,
            misses: 0,
            errors: 0,
            total: 0,
            hitRate: '0.00%',
          },
          memory: {
            usedBytes: 0,
            usedMB: 0,
            peakBytes: 0,
            peakMB: 0,
            percentage: 0,
          },
          keys: {
            total: 0,
            byCategory: {},
          },
          server: {
            version: 'unknown',
            uptime: 0,
            connectedClients: 0,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    // Get performance stats from cache service
    const perfStats = getCacheStats();
    const total = perfStats.hits + perfStats.misses;

    // Get memory stats from Redis
    const memoryStats = await getRedisMemoryStats();

    // Get server info
    const serverInfo = await getRedisInfo();

    // Count keys by category
    const redis = await getRedisClient();
    const keysByCategory: Record<string, number> = {};
    let totalKeys = 0;

    // Count keys for each cache prefix (if Redis client available)
    if (redis) {
      for (const prefix of Object.values(CachePrefix)) {
        const pattern = `${prefix}:*`;
        const keys = await redis.keys(pattern);
        keysByCategory[prefix] = keys.length;
        totalKeys += keys.length;
      }
    }

    // Parse memory stats (returned as strings from Redis INFO)
    const usedBytes = memoryStats ? parseInt(memoryStats.used, 10) : 0;
    const peakBytes = memoryStats ? parseInt(memoryStats.peak, 10) : 0;

    // Parse server info (returned as strings from Redis INFO)
    const version = serverInfo?.version || 'unknown';
    const uptime = serverInfo ? parseInt(serverInfo.uptime, 10) : 0;
    const connectedClients = serverInfo ? parseInt(serverInfo.connectedClients, 10) : 0;

    // Build response
    const response: CacheStatsResponse = {
      available: true,
      performance: {
        hits: perfStats.hits,
        misses: perfStats.misses,
        errors: perfStats.errors,
        total: total,
        hitRate: total > 0 ? `${((perfStats.hits / total) * 100).toFixed(2)}%` : '0.00%',
      },
      memory: {
        usedBytes: usedBytes,
        usedMB: Math.round(usedBytes / 1024 / 1024 * 100) / 100,
        peakBytes: peakBytes,
        peakMB: Math.round(peakBytes / 1024 / 1024 * 100) / 100,
        percentage: memoryStats ? parseFloat(memoryStats.fragmentation) : 0,
      },
      keys: {
        total: totalKeys,
        byCategory: keysByCategory,
      },
      server: {
        version: version,
        uptime: uptime,
        connectedClients: connectedClients,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('❌ Error fetching cache stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cache statistics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cache/stats/reset
 * 
 * Resets cache performance statistics (dev only)
 * Does NOT flush cache data, only resets counters
 * 
 * @returns Success message
 */
export async function POST(): Promise<NextResponse<{ success: boolean; message: string }>> {
  try {
    // TODO: Add admin authentication in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, message: 'Stats reset disabled in production' },
        { status: 403 }
      );
    }

    // Reset stats (imported from cacheService)
    const { resetCacheStats } = await import('@/lib/cacheService');
    resetCacheStats();

    return NextResponse.json(
      { success: true, message: 'Cache statistics reset successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error resetting cache stats:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to reset cache statistics' },
      { status: 500 }
    );
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - GET returns comprehensive cache metrics
// - POST resets statistics (dev only)
// - Graceful fallback if Redis unavailable
// - Uses KEYS command (safe in development, consider SCAN for production)
// - Memory stats in both bytes and MB for convenience
// - Hit rate calculated as percentage string
// - Server uptime and client count for monitoring
// - TODO: Add admin authentication for production
// - TODO: Consider SCAN instead of KEYS for large deployments
// ============================================================
// END OF FILE
// ============================================================
