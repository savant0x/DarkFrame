/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 🎯 OVERVIEW:
 * Resource Trends Analytics Endpoint
 * 
 * Provides time-series data for resource accumulation across all players.
 * Tracks metal and energy gains over time for trend analysis.
 * Used by resource gains area chart on admin dashboard.
 * 
 * GET /api/admin/analytics/resource-trends
 * - Admin-only access (isAdmin flag)
 * - Rate Limited: 500 req/min (admin analytics)
 * - Query params: period (24h, 7d, 30d)
 * - Returns: Time-series data with metal/energy totals per interval
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { db, playerActivity } from '@/lib/db';
import { count, countDistinct, gte, sql } from 'drizzle-orm';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminResourceTrendsAPI');
  const endTimer = log.time('fetch-resource-trends');

  try {
    // Admin authentication check
    const user = await getAuthenticatedUser();
    if (!user) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    if (user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d'; // 24h, 7d, 30d

    // Calculate time range
    const now = new Date();
    const periodHours: Record<string, number> = {
      '24h': 24,
      '7d': 168,
      '30d': 720
    };

    const hoursBack = periodHours[period] || 168;
    const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    // Determine grouping interval (hourly for 24h, daily for longer)
    const isHourly = period === '24h';
    const intervalMs = isHourly ? 3600000 : 86400000; // 1 hour or 1 day

    // Time-bucket expression (epoch ms floored to the interval boundary)
    const bucketExpr = sql<number>`FLOOR(EXTRACT(EPOCH FROM ${playerActivity.timestamp}) * 1000 / ${intervalMs}) * ${intervalMs}`;
    // details jsonb -> numeric sums (harvest/attack actions carry resourcesGained)
    const metalExpr = sql<number>`COALESCE(SUM(COALESCE(((${playerActivity.details}->'resourcesGained'->>'metal'))::numeric, 0)), 0)`;
    const energyExpr = sql<number>`COALESCE(SUM(COALESCE(((${playerActivity.details}->'resourcesGained'->>'energy'))::numeric, 0)), 0)`;

    const whereClause = gte(playerActivity.timestamp, startTime);

    interface ResourceBucketRow {
      bucket: number | string;
      metal: string | number;
      energy: string | number;
      sessions: number;
      uniquePlayers: number;
    }
    const bucketRows: ResourceBucketRow[] = await db
      .select({
        bucket: bucketExpr,
        metal: metalExpr,
        energy: energyExpr,
        sessions: count(),
        uniquePlayers: countDistinct(playerActivity.playerId),
      })
      .from(playerActivity)
      .where(whereClause)
      .groupBy(bucketExpr)
      .orderBy(bucketExpr);

    const results = bucketRows.map((r) => ({
      timestamp: Number(r.bucket),
      metal: Number(r.metal),
      energy: Number(r.energy),
      sessions: Number(r.sessions),
      uniquePlayers: Number(r.uniquePlayers),
    }));

    // Fill in gaps with zero values for smooth chart
    const filledData: Array<{ timestamp: number; date: string; metal: number; energy: number; total: number; sessions: number; uniquePlayers: number }> = [];
    const currentTime = startTime.getTime();
    const endTime = now.getTime();

    for (let t = currentTime; t <= endTime; t += intervalMs) {
      const existing = results.find((r) => r.timestamp === t);
      const metal = existing?.metal ?? 0;
      const energy = existing?.energy ?? 0;
      filledData.push({
        timestamp: t,
        date: new Date(t).toISOString(),
        metal,
        energy,
        total: metal + energy,
        sessions: existing?.sessions ?? 0,
        uniquePlayers: existing?.uniquePlayers ?? 0
      });
    }

    // Calculate statistics
    const totalMetal = filledData.reduce((sum, d) => sum + d.metal, 0);
    const totalEnergy = filledData.reduce((sum, d) => sum + d.energy, 0);
    const totalResources = totalMetal + totalEnergy;
    const avgMetalPerInterval = filledData.length > 0 ? totalMetal / filledData.length : 0;
    const avgEnergyPerInterval = filledData.length > 0 ? totalEnergy / filledData.length : 0;
    const peakResources = Math.max(...filledData.map(d => d.total), 0);

    // Get top resource gatherers (per-player sums over activity details)
    const gathererRows = await db
      .select({
        username: playerActivity.playerId,
        totalMetal: sql<number>`COALESCE(SUM(COALESCE(((${playerActivity.details}->'resourcesGained'->>'metal'))::numeric, 0)), 0)`,
        totalEnergy: sql<number>`COALESCE(SUM(COALESCE(((${playerActivity.details}->'resourcesGained'->>'energy'))::numeric, 0)), 0)`,
        sessionCount: count(),
      })
      .from(playerActivity)
      .where(whereClause)
      .groupBy(playerActivity.playerId)
      .orderBy(sql`COALESCE(SUM(COALESCE(((${playerActivity.details}->'resourcesGained'->>'metal'))::numeric, 0)), 0) + COALESCE(SUM(COALESCE(((${playerActivity.details}->'resourcesGained'->>'energy'))::numeric, 0)), 0) DESC`)
      .limit(10);

    const topGatherers = gathererRows.map((g) => ({
      username: g.username,
      totalMetal: Number(g.totalMetal),
      totalEnergy: Number(g.totalEnergy),
      sessionCount: Number(g.sessionCount),
    }));

    log.info('Resource trends fetched successfully', {
      period,
      totalResources,
      peakResources,
      topGatherersCount: topGatherers.length,
      adminUser: user.username,
    });

    return NextResponse.json({
      success: true,
      period,
      intervalType: isHourly ? 'hourly' : 'daily',
      data: filledData,
      topGatherers: topGatherers.map((g) => ({
        username: g.username,
        metal: g.totalMetal,
        energy: g.totalEnergy,
        total: g.totalMetal + g.totalEnergy,
        sessions: g.sessionCount
      })),
      stats: {
        totalMetal,
        totalEnergy,
        totalResources,
        avgMetalPerInterval: Math.round(avgMetalPerInterval),
        avgEnergyPerInterval: Math.round(avgEnergyPerInterval),
        peakResources,
        dataPoints: filledData.length
      }
    });

  } catch (error) {
    log.error('Failed to fetch resource trends', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Aggregates resource gains from playerSessions collection
 * - Tracks both metal and energy separately
 * - Fills gaps with zero values for smooth area chart
 * - Provides top gatherers leaderboard
 * - Returns statistics for dashboard summary
 * 
 * 🔐 SECURITY:
 * - Admin-only access (rank >= 5)
 * - No sensitive data exposure
 * - Efficient MongoDB aggregation
 * 
 * 📊 QUERY PARAMS:
 * - period: '24h' | '7d' | '30d' (default: 7d)
 * 
 * 📈 RESPONSE STRUCTURE:
 * {
 *   data: [{ timestamp, date, metal, energy, total, sessions }],
 *   topGatherers: [{ username, metal, energy, total, sessions }],
 *   stats: { totalMetal, totalEnergy, avgPerInterval, peakResources }
 * }
 */
