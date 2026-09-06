/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 🎯 OVERVIEW:
 * Session Trends Analytics Endpoint
 * 
 * Provides session duration distribution data for player engagement analysis.
 * Categorizes sessions into duration buckets for bar chart visualization.
 * Used by session distribution chart on admin dashboard.
 * 
 * GET /api/admin/analytics/session-trends
 * - Admin-only access (isAdmin flag)
 * - Rate Limited: 500 req/min (admin analytics)
 * - Query params: period (24h, 7d, 30d)
 * - Returns: Session duration buckets with player counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { playerSessions } from '@/lib/db/schema';
import {  desc, isNull, gt } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authService';
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
  const log = createRouteLogger('AdminSessionTrendsAPI');
  const endTimer = log.time('fetch-session-trends');

  try {
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

    const authenticatedUser = user;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';

    const now = new Date();
    const periodHours: Record<string, number> = {
      '24h': 24,
      '7d': 168,
      '30d': 720
    };

    const hoursBack = periodHours[period] || 168;
    const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    const buckets = [
      { label: '0-1h', min: 0, max: 3600000, color: '#22c55e' },
      { label: '1-2h', min: 3600000, max: 7200000, color: '#84cc16' },
      { label: '2-4h', min: 7200000, max: 14400000, color: '#eab308' },
      { label: '4-8h', min: 14400000, max: 28800000, color: '#f97316' },
      { label: '8-14h', min: 28800000, max: 50400000, color: '#ef4444' },
      { label: '14h+', min: 50400000, max: Infinity, color: '#dc2626' }
    ];

    const allSessions = await db.select()
      .from(playerSessions)
      .where(gt(playerSessions.startTime, startTime));

    const sessionsWithDuration = allSessions.map((session) => {
      const start = new Date(session.createdAt).getTime();
      const end = session.expiresAt 
        ? new Date(session.expiresAt).getTime()
        : now.getTime();
      const duration = end - start;
      
      return {
        userId: session.userId,
        duration,
        startTime: session.createdAt,
        endTime: session.expiresAt
      };
    });

    const bucketData = buckets.map(bucket => {
      const sessionsInBucket = sessionsWithDuration.filter(
        s => s.duration >= bucket.min && s.duration < bucket.max
      );

      const uniquePlayers = new Set(sessionsInBucket.map(s => s.userId));

      return {
        label: bucket.label,
        range: bucket.label,
        count: sessionsInBucket.length,
        uniquePlayers: uniquePlayers.size,
        color: bucket.color,
        avgDuration: sessionsInBucket.length > 0
          ? sessionsInBucket.reduce((sum, s) => sum + s.duration, 0) / sessionsInBucket.length
          : 0
      };
    });

    const totalSessions = sessionsWithDuration.length;
    const activeSessions = allSessions.filter((s) => !s.endTime).length;
    const completedSessions = totalSessions - activeSessions;
    
    const avgDuration = totalSessions > 0
      ? sessionsWithDuration.reduce((sum, s) => sum + s.duration, 0) / totalSessions
      : 0;
    
    const longestSession = Math.max(
      ...sessionsWithDuration.map(s => s.duration),
      0
    );

    const uniquePlayers = new Set(allSessions.map((s) => s.userId));

    const activePlayersList = await db.select()
      .from(playerSessions)
      .where(isNull(playerSessions.endTime))
      .orderBy(desc(playerSessions.startTime))
      .limit(10);

    log.info('Session trends fetched successfully', {
      period,
      totalSessions,
      activeSessions,
      uniquePlayers: uniquePlayers.size,
      adminUser: authenticatedUser.username,
    });

    return NextResponse.json({
      success: true,
      period,
      buckets: bucketData,
      activePlayers: activePlayersList.map((s) => ({
        username: s.userId,
        startTime: s.startTime,
        duration: now.getTime() - new Date(s.startTime as Date | string).getTime(),
        actionsPerformed: 0
      })),
      stats: {
        totalSessions,
        activeSessions,
        completedSessions,
        uniquePlayers: uniquePlayers.size,
        avgDuration: Math.round(avgDuration),
        avgDurationHours: (avgDuration / 3600000).toFixed(2),
        longestSession: Math.round(longestSession),
        longestSessionHours: (longestSession / 3600000).toFixed(2)
      }
    });

  } catch (error) {
    log.error('Failed to fetch session trends', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Categorizes sessions into 6 duration buckets
 * - Color-coded from green (short) to red (long)
 * - Tracks both active and completed sessions
 * - Provides recent active players list
 * - Returns duration in milliseconds and hours
 * 
 * 🔐 SECURITY:
 * - Admin-only access (rank >= 5)
 * - No sensitive data exposure
 * - Efficient in-memory bucketing
 * 
 * 📊 QUERY PARAMS:
 * - period: '24h' | '7d' | '30d' (default: 7d)
 * 
 * 📈 RESPONSE STRUCTURE:
 * {
 *   buckets: [{ label, count, uniquePlayers, color, avgDuration }],
 *   activePlayers: [{ username, startTime, duration, actions }],
 *   stats: { totalSessions, activeSessions, avgDuration, longestSession }
 * }
 * 
 * 🎨 BUCKET COLORS:
 * - 0-1h: Green (#22c55e) - Normal engagement
 * - 1-2h: Lime (#84cc16) - Good engagement
 * - 2-4h: Yellow (#eab308) - High engagement
 * - 4-8h: Orange (#f97316) - Very high engagement
 * - 8-14h: Red (#ef4444) - Excessive (monitor)
 * - 14h+: Dark Red (#dc2626) - Critical (potential bot)
 */
