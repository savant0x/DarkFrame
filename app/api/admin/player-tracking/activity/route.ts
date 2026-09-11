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
 * Response shape (consumed by components/admin/PlayerDetailModal.tsx):
 * { success, activities: [{ actionType, timestamp, details }],
 *   stats: { totalActions, mostCommonAction },
 *   perAction: [{ action, count, lastSeen }] }
 *
 * FID-20260909-032 §2-A: the previous `mode() within (group by action)`
 * aggregate was invalid Postgres (ordered-set aggregates need `WITHIN GROUP
 * (ORDER BY …)`, and that form also fails on this build) — the route 500ed on
 * every call and the modal rendered an empty tab. Most-common-action now comes
 * from a grouped top-1 subquery, and the response carries an honest per-action
 * breakdown so the tab shows real tracking coverage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { playerActivity } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
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

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminPlayerTrackingActivityAPI');
  const endTimer = log.time('player-tracking-activity');

  try {
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }

    const url = new URL(request.url);
    const username = url.searchParams.get('username')?.trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 500);

    if (!username) {
      // FID-20260909-032 §2-A: a missing query parameter is a client error —
      // VALIDATION_MISSING_FIELD, not the player-lookup 404 this previously sent.
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, {
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
        mostCommonAction: sql<string>`coalesce((
          SELECT action FROM (
            SELECT ${playerActivity.action} AS action, count(*) AS n
            FROM ${playerActivity}
            WHERE ${playerActivity.playerId} = ${username}
            GROUP BY ${playerActivity.action}
            ORDER BY n DESC
            LIMIT 1
          ) t
        ), '')`,
      })
      .from(playerActivity)
      .where(eq(playerActivity.playerId, username));

    // Per-action breakdown — what the Activity tab actually needs to show
    // tracking coverage (action, volume, last-seen) at a glance.
    const perActionRows = await db
      .select({
        action: playerActivity.action,
        count: sql<number>`count(*)::int`,
        lastSeen: sql<Date>`max(${playerActivity.timestamp})`,
      })
      .from(playerActivity)
      .where(eq(playerActivity.playerId, username))
      .groupBy(playerActivity.action)
      .orderBy(desc(sql`count(*)`));

    return NextResponse.json({
      success: true,
      activities,
      stats: {
        totalActions: totals?.totalActions ?? 0,
        mostCommonAction: totals?.mostCommonAction ?? '',
      },
      perAction: perActionRows.map((r) => ({
        action: r.action,
        count: Number(r.count),
        lastSeen: r.lastSeen instanceof Date ? r.lastSeen.toISOString() : String(r.lastSeen),
      })),
    });
  } catch (error) {
    log.error('Failed to fetch player activity', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
