/**
 * @file app/api/admin/player-tracking/activity/route.ts
 * @created 2026-09-04
 * @overview Per-player activity history for the admin PlayerDetailModal (SCOPE #22).
 *
 * Rebuild of the Mongo-pivot-era endpoint. Backed by the `player_activity` table
 * (written by lib/activityLogger on every tracked action).
 *
 * GET /api/admin/player-tracking/activity?username=<u>&limit=50
 * Admin-only (rank >= 5, same gate as /api/admin/players/[username]).
 *
 * Response shape is fixed by components/admin/PlayerDetailModal.tsx:
 * { success, activities: [{ actionType, timestamp, details }], stats: { totalActions, mostCommonAction } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { playerActivity } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
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
  const log = createRouteLogger('AdminPlayerTrackingActivityAPI');
  const endTimer = log.time('player-tracking-activity');

  try {
    const user = await getAuthenticatedUser();
    if (!user || !user.rank || user.rank < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    const url = new URL(request.url);
    const username = url.searchParams.get('username')?.trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 500);

    if (!username) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'username query parameter is required',
      });
    }

    const activities = await db
      .select({
        actionType: playerActivity.action,
        timestamp: playerActivity.timestamp,
        details: playerActivity.metadata,
      })
      .from(playerActivity)
      .where(eq(playerActivity.playerId, username))
      .orderBy(desc(playerActivity.timestamp))
      .limit(limit);

    const [totals] = await db
      .select({
        totalActions: sql<number>`count(*)::int`,
        mostCommonAction: sql<string>`coalesce(mode() within (group by ${playerActivity.action}), '')`,
      })
      .from(playerActivity)
      .where(eq(playerActivity.playerId, username));

    return NextResponse.json({
      success: true,
      activities,
      stats: {
        totalActions: totals?.totalActions ?? 0,
        mostCommonAction: totals?.mostCommonAction ?? '',
      },
    });
  } catch (error) {
    log.error('Failed to fetch player activity', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
