// @ts-nocheck
/**
 * @file app/api/admin/active-sessions/route.ts
 * @created 2025-10-18
 * @updated 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * @overview Get all currently active player sessions
 * 
 * OVERVIEW:
 * Returns list of all active sessions across all players for real-time
 * monitoring. Shows who's currently playing, how long they've been on,
 * and their activity levels. Used by admin dashboard for live player count.
 * 
 * Access: Admin only (rank >= 5)
 * Rate Limited: 500 req/min (admin analytics)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { PlayerSession } from '@/types';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { detectSessionAbuse } from '@/lib/antiCheatDetector';
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
 * GET /api/admin/active-sessions
 * 
 * Get all currently active player sessions
 * 
 * Query params: None
 * 
 * Returns:
 * - sessions: Array of active PlayerSession records
 * - totalActive: Number of players currently online
 * - longestSession: Duration of longest active session (seconds)
 * - totalActions: Sum of actions across all active sessions
 * - averageDuration: Average current session duration (seconds)
 * 
 * @example
 * GET /api/admin/active-sessions
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminActiveSessionsAPI');
  const endTimer = log.time('fetch-active-sessions');

  try {
    const user = await getAuthenticatedUser();

    if (!user || (user.rank ?? 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    const sessionCollection = await getCollection<PlayerSession>('playerSessions');

    // Get all active sessions (no endTime)
    const sessions = await sessionCollection
      .find({ endTime: { $exists: false } })
      .sort({ startTime: -1 })
      .toArray();

    // Calculate current durations and metrics
    const now = Date.now();
    const sessionsWithDuration = sessions.map((session: any) => {
      const currentDuration = Math.floor((now - session.startTime.getTime()) / 1000);
      return {
        ...session,
        currentDuration,
      };
    });

    const totalActive = sessions.length;
    const longestSession = sessionsWithDuration.length > 0
      ? Math.max(...sessionsWithDuration.map((s: any) => s.currentDuration))
      : 0;
    const totalActions = sessions.reduce((sum, s) => sum + s.actionsCount, 0);
    const averageDuration = sessionsWithDuration.length > 0
      ? Math.floor(sessionsWithDuration.reduce((sum, s) => sum + s.currentDuration, 0) / sessionsWithDuration.length)
      : 0;

    // Identify potential session abuse (>14 hours continuous)
    const abusiveSessions = sessionsWithDuration.filter((s: any) => s.currentDuration > 14 * 60 * 60);
    
    // Anti-cheat: Flag excessive sessions
    for (const session of abusiveSessions) {
      const abuseCheck = await detectSessionAbuse(
        session.userId,
        session.currentDuration * 1000 // Convert to milliseconds
      );
      
      if (abuseCheck.suspicious) {
        console.warn(`⚠️ Session abuse detected for ${session.userId}:`, abuseCheck.evidence);
      }
    }

    log.info('Active sessions fetched successfully', {
      totalActive,
      longestSessionHours: Math.floor(longestSession / 3600),
      abusiveCount: abusiveSessions.length,
      adminUser: user.username,
    });

    return NextResponse.json({
      success: true,
      sessions: sessionsWithDuration,
      totalActive,
      longestSession,
      totalActions,
      averageDuration,
      abusiveSessions: abusiveSessions.map((s: any) => ({
        userId: s.userId,
        duration: s.currentDuration,
        hours: Math.floor(s.currentDuration / 3600),
      })),
    });
  } catch (error) {
    log.error('Failed to fetch active sessions', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Admin only access (rank >= 5)
// - Returns real-time online player count
// - Calculates current session durations on-the-fly
// - Identifies sessions >14 hours (potential abuse)
// - Used by admin dashboard for live monitoring
// - Helps detect idle sessions and session abuse
// - Sorted by start time (most recent first)
// ============================================================
