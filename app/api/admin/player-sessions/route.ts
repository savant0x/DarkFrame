/**
 * @file app/api/admin/player-sessions/route.ts
 * @created 2025-10-18
 * @overview Get session history for a specific player
 * 
 * OVERVIEW:
 * Returns detailed session records including start/end times, durations,
 * activity counts, and resource gains per session. Used by admin dashboard
 * to analyze player engagement patterns and detect session abuse.
 * 
 * Access: Admin only (rank >= 5)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { playerSessions } from '@/lib/db/schema';
import { eq, desc, gte, sql, isNotNull, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/authMiddleware';
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

/**
 * GET /api/admin/player-sessions?userId=PlayerOne&limit=20&includeActive=true
 * 
 * Get session history for a specific player
 * 
 * Query params:
 * - userId: Player username (required)
 * - limit: Number of sessions to return (default: 20, max: 100)
 * - includeActive: Include ongoing sessions (default: true)
 * - hoursAgo: Only get sessions from last X hours (optional)
 * 
 * Returns:
 * - sessions: Array of PlayerSession records
 * - totalSessions: Total sessions found
 * - activeSessions: Number of currently active sessions
 * - totalPlayTime: Sum of all session durations (seconds)
 * - averageDuration: Average session length (seconds)
 * 
 * @example
 * GET /api/admin/player-sessions?userId=PlayerOne&limit=20
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/player-sessions');
  const endTimer = log.time('get-player-sessions');

  try {
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limitStr = searchParams.get('limit') || '20';
    const includeActiveStr = searchParams.get('includeActive') || 'true';
    const hoursAgoStr = searchParams.get('hoursAgo');

    if (!userId) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'userId parameter required');
    }

    const limit = Math.min(parseInt(limitStr), 100);
    const includeActive = includeActiveStr === 'true';

    // Build where conditions
    const conditions = [eq(playerSessions.userId, userId)];

    if (!includeActive) {
      conditions.push(isNotNull(playerSessions.endTime));
    }

    if (hoursAgoStr) {
      const hoursAgo = parseInt(hoursAgoStr);
      const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      conditions.push(gte(playerSessions.startTime, cutoffTime));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Get sessions
    const sessions = await db
      .select()
      .from(playerSessions)
      .where(whereClause)
      .orderBy(desc(playerSessions.startTime))
      .limit(limit);

    // Count active sessions
    const activeSessions = sessions.filter(s => !s.endTime).length;

    // Calculate total play time and average
    const completedSessions = sessions.filter(s => s.duration !== undefined);
    const totalPlayTime = completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const averageDuration = completedSessions.length > 0 
      ? Math.floor(totalPlayTime / completedSessions.length) 
      : 0;

    // Get total session count (not limited)
    const totalSessionsResult = await db.select({ count: sql`count(*)` }).from(playerSessions).where(whereClause);
    const totalSessions = Number(totalSessionsResult[0]?.count) || 0;

    log.info('Player sessions retrieved', {
      userId,
      totalSessions,
      activeSessions,
      averageDuration,
    });

    return NextResponse.json({
      success: true,
      sessions,
      totalSessions,
      activeSessions,
      totalPlayTime,
      averageDuration,
    });
  } catch (error) {
    log.error('Failed to fetch player sessions', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Admin only access (rank >= 5)
// - Returns both completed and active sessions by default
// - Includes aggregated metrics for quick analysis
// - Sorted by start time descending (newest first)
// - Can filter by time period for recent analysis
// - Used by admin dashboard to monitor engagement patterns
// - Helps detect session abuse (>14 hour continuous play)
// ============================================================
