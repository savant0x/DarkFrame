/**
 * @file app/api/admin/player-tracking/sessions/route.ts
 * @created 2026-09-04
 * @overview Per-player session history for the admin PlayerDetailModal (SCOPE #22).
 *
 * Rebuild of the Mongo-pivot-era endpoint. Backed by the `player_sessions` table
 * (written by lib/sessionTracker on login/logout).
 *
 * GET /api/admin/player-tracking/sessions?username=<u>&limit=20
 * Admin-only (rank >= 5, same gate as /api/admin/players/[username]).
 *
 * Response shape is fixed by components/admin/PlayerDetailModal.tsx:
 * { success, sessions: [{ startTime, endTime?, duration, actionsPerformed }],
 *   stats: { totalSessions, avgDuration, totalPlayTime } }
 * duration is in milliseconds (the modal formats it with formatDuration(ms)).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { playerSessions } from '@/lib/db/schema';
import { eq, desc, isNotNull, sql } from 'drizzle-orm';
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
  const log = createRouteLogger('AdminPlayerTrackingSessionsAPI');
  const endTimer = log.time('player-tracking-sessions');

  try {
    const user = await getAuthenticatedUser();
    if (!user || !user.rank || user.rank < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    const url = new URL(request.url);
    const username = url.searchParams.get('username')?.trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 200);

    if (!username) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'username query parameter is required',
      });
    }

    const sessions = await db
      .select({
        startTime: playerSessions.startTime,
        endTime: playerSessions.endTime,
        // duration is stored in seconds (sessionTracker); the modal formats ms.
        durationSeconds: playerSessions.duration,
        actionsCount: playerSessions.actionsCount,
      })
      .from(playerSessions)
      .where(eq(playerSessions.userId, username))
      .orderBy(desc(playerSessions.startTime))
      .limit(limit);

    const mapped = sessions.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime ?? undefined,
      duration: (s.durationSeconds ?? 0) * 1000,
      actionsPerformed: s.actionsCount ?? 0,
    }));

    const [totals] = await db
      .select({
        totalSessions: sql<number>`count(*)::int`,
        totalPlaySeconds: sql<number>`coalesce(sum(${playerSessions.duration}), 0)::int`,
        avgDurationSeconds: sql<number>`coalesce(avg(${playerSessions.duration}), 0)::int`,
      })
      .from(playerSessions)
      .where(eq(playerSessions.userId, username));

    // Stats over completed sessions only (duration is null while a session is open).
    const [completed] = await db
      .select({
        completedCount: sql<number>`count(*)::int`,
        totalCompletedSeconds: sql<number>`coalesce(sum(${playerSessions.duration}), 0)::int`,
      })
      .from(playerSessions)
      .where(sql`${playerSessions.userId} = ${username} and ${playerSessions.duration} is not null`);

    void completed; // kept for symmetry with totals query plan debugging if needed
    void isNotNull;

    return NextResponse.json({
      success: true,
      sessions: mapped,
      stats: {
        totalSessions: totals?.totalSessions ?? 0,
        avgDuration: (completed ? Math.round((completed.totalCompletedSeconds ?? 0) / Math.max(completed.completedCount, 1)) : 0) * 1000,
        totalPlayTime: (totals?.totalPlaySeconds ?? 0) * 1000,
      },
    });
  } catch (error) {
    log.error('Failed to fetch player sessions', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
