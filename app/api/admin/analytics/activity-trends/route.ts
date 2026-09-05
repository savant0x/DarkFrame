/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 🎯 OVERVIEW:
 * Activity Trends Analytics Endpoint
 * 
 * Provides time-series data for player activity over configurable periods.
 * Returns aggregated action counts per hour/day for graphing.
 * Used by activity timeline chart on admin dashboard.
 * 
 * GET /api/admin/analytics/activity-trends
 * - Admin-only access (isAdmin flag)
 * - Rate Limited: 500 req/min (admin analytics)
 * - Query params: period (24h, 7d, 30d), actionType (optional filter)
 * - Returns: Time-series data with timestamps and action counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { db, playerActivity } from '@/lib/db';
import { and, eq, gte, count, countDistinct, desc, sql } from 'drizzle-orm';
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
  const log = createRouteLogger('AdminActivityTrendsAPI');
  const endTimer = log.time('fetch-activity-trends');

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
    const actionType = searchParams.get('actionType'); // Optional filter

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

    // Time-bucket expression (epoch ms floored to the interval boundary).
    // The interval MUST be inlined (sql.raw): drizzle re-binds a templated param
    // separately in select/groupBy/orderBy, and Postgres matches GROUP BY
    // expressions syntactically — `$1` vs `$4` would break the match (42803).
    // intervalMs is a fixed number from the periodHours map, never user input.
    const bucketExpr = sql<number>`FLOOR(EXTRACT(EPOCH FROM ${playerActivity.timestamp}) * 1000 / ${sql.raw(String(intervalMs))}) * ${sql.raw(String(intervalMs))}`;

    const conditions = [gte(playerActivity.timestamp, startTime)];
    if (actionType) {
      conditions.push(eq(playerActivity.action, actionType));
    }
    const whereClause = and(...conditions);

    // Grouped counts per interval (real SQL aggregation; the Mongo seam ignored pipelines)
    interface ActivityBucketRow {
      bucket: number | string;
      count: number;
      uniquePlayers: number;
    }
    const bucketRows: ActivityBucketRow[] = await db
      .select({
        bucket: bucketExpr,
        count: count(),
        uniquePlayers: countDistinct(playerActivity.playerId),
      })
      .from(playerActivity)
      .where(whereClause)
      .groupBy(bucketExpr)
      .orderBy(bucketExpr);

    const results = bucketRows.map((r) => ({
      timestamp: Number(r.bucket),
      count: Number(r.count),
      uniquePlayers: Number(r.uniquePlayers),
    }));

    // Fill in gaps with zero counts for smooth chart
    const filledData: Array<{ timestamp: number; date: string; count: number; uniquePlayers: number }> = [];
    const currentTime = startTime.getTime();
    const endTime = now.getTime();

    for (let t = currentTime; t <= endTime; t += intervalMs) {
      const existing = results.find((r) => r.timestamp === t);
      filledData.push({
        timestamp: t,
        date: new Date(t).toISOString(),
        count: existing?.count ?? 0,
        uniquePlayers: existing?.uniquePlayers ?? 0
      });
    }

    // Get breakdown by action type
    const breakdownRows = await db
      .select({
        actionType: playerActivity.action,
        count: count(),
      })
      .from(playerActivity)
      .where(whereClause)
      .groupBy(playerActivity.action)
      .orderBy(desc(count()));

    const typeBreakdown = breakdownRows.map((t) => ({
      actionType: t.actionType,
      count: Number(t.count),
    }));

    // Calculate statistics
    const totalActions = typeBreakdown.reduce((sum, r) => sum + r.count, 0);
    const avgActionsPerInterval = filledData.length > 0 ? totalActions / filledData.length : 0;
    const peakActivity = Math.max(...filledData.map((d) => d.count), 0);

    log.info('Activity trends fetched successfully', {
      period,
      totalActions,
      peakActivity,
      dataPoints: filledData.length,
      adminUser: user.username,
    });

    return NextResponse.json({
      success: true,
      period,
      intervalType: isHourly ? 'hourly' : 'daily',
      data: filledData,
      breakdown: typeBreakdown,
      stats: {
        totalActions,
        avgActionsPerInterval: Math.round(avgActionsPerInterval),
        peakActivity,
        dataPoints: filledData.length
      }
    });

  } catch (error) {
    log.error('Failed to fetch activity trends', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Aggregates activity by hour (24h) or day (7d, 30d)
 * - Fills gaps with zero counts for smooth charts
 * - Provides breakdown by action type
 * - Counts unique players per interval
 * - Returns statistics for dashboard summary
 * 
 * 🔐 SECURITY:
 * - Admin-only access (rank >= 5)
 * - No sensitive data exposure
 * - Efficient MongoDB aggregation
 * 
 * 📊 QUERY PARAMS:
 * - period: '24h' | '7d' | '30d' (default: 7d)
 * - actionType: Optional filter for specific action type
 * 
 * 📈 RESPONSE STRUCTURE:
 * {
 *   data: [{ timestamp, date, count, uniquePlayers }],
 *   breakdown: [{ actionType, count }],
 *   stats: { totalActions, avgActionsPerInterval, peakActivity }
 * }
 */
