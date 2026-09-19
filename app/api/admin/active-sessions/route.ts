/**
 * @file app/api/admin/active-sessions/route.ts
 * @created 2025-10-18
 * @updated 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * @rewritten 2026-09-18 (FID-20260917-017 slice 4: Mongo shim → direct drizzle/pg)
 * @overview Get all currently active player sessions
 *
 * OVERVIEW:
 * Returns list of all active sessions across all players for real-time
 * monitoring. Shows who's currently playing, how long they've been on,
 * and their activity levels. Used by admin dashboard for live player count.
 *
 * Access: Admin only (isAdmin JWT flag)
 * Rate Limited: 500 req/min (admin analytics)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { playerSessions } from '@/lib/db/schema';
import { isNull, desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/authMiddleware';
import { detectSessionAbuse } from '@/lib/antiCheatDetector';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,

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
 * - sessions: Array of active session records (with currentDuration seconds)
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
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }
    const user = adminAuth;

    // Active sessions = rows with no endTime (the shim's { endTime: { $exists: false } }).
    // Legacy auth-token rows have NULL startTime (sessionTracker populates it) —
    // they cannot carry a meaningful duration, so only started rows are sessions.
    const rows = await db
      .select()
      .from(playerSessions)
      .where(isNull(playerSessions.endTime))
      .orderBy(desc(playerSessions.startTime));

    const sessions = rows
      .filter((r) => r.startTime !== null)
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        sessionId: r.sessionId,
        startTime: r.startTime as Date,
        endTime: null,
        duration: r.duration,
        actionsCount: r.actionsCount ?? 0,
        resourcesGainedMetal: r.resourcesGainedMetal ?? 0,
        resourcesGainedEnergy: r.resourcesGainedEnergy ?? 0,
        ipAddress: r.ipAddress,
        currentDuration: Math.floor((Date.now() - (r.startTime as Date).getTime()) / 1000),
      }));

    const totalActive = sessions.length;
    const longestSession = sessions.length > 0
      ? Math.max(...sessions.map((s) => s.currentDuration))
      : 0;
    const totalActions = sessions.reduce((sum, s) => sum + s.actionsCount, 0);
    const averageDuration = sessions.length > 0
      ? Math.floor(sessions.reduce((sum, s) => sum + s.currentDuration, 0) / sessions.length)
      : 0;

    // Identify potential session abuse (>14 hours continuous)
    const abusiveSessions = sessions.filter((s) => s.currentDuration > 14 * 60 * 60);

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
      sessions,
      totalActive,
      longestSession,
      totalActions,
      averageDuration,
      abusiveSessions: abusiveSessions.map((s) => ({
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
// - Admin only access (requireAdmin, isAdmin JWT flag)
// - One indexed select; durations computed on-the-fly
// - Identifies sessions >14 hours (potential abuse, anti-cheat hook)
// - Sorted by start time (most recent first)
// ============================================================
