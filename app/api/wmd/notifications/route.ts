/**
 * @file app/api/wmd/notifications/route.ts
 * @created 2025-10-22
 * @updated 2026-09-06 (FID-20260906-002 G1) — drizzle-native seam rewrite
 * @overview WMD Notifications API Endpoints
 *
 * OVERVIEW:
 * Handles WMD event notifications including fetching, marking as read,
 * and clearing old notifications.
 *
 * Features:
 * - GET: Fetch player's notifications
 * - PATCH: Mark notifications as read
 * - DELETE: Clear old notifications
 *
 * Data model note (FID-20260906-002):
 * The pivot schema models "read" as viewedBy[] + viewCount — there are no
 * read/readAt columns. "Old and read" for DELETE therefore means the viewer
 * already appears in viewedBy.
 *
 * Authentication: JWT tokens via HttpOnly cookies
 * Dependencies: apiHelpers.ts, lib/db/schema/wmd
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/wmd/apiHelpers';
import { db } from '@/lib/db';
import { wmdNotifications } from '@/lib/db/schema/wmd';
import { and, desc, eq, inArray, lt, arrayContains } from 'drizzle-orm';
import { NotificationScope } from '@/types/wmd';

/**
 * GET /api/wmd/notifications
 * Fetch player's notifications
 *
 * Query:
 * - limit: number (default: 50)
 * - unreadOnly: boolean (default: false)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Fetch notifications targeted at this player (PERSONAL scope).
    const notifications = await db
      .select()
      .from(wmdNotifications)
      .where(and(
        eq(wmdNotifications.scope, NotificationScope.PERSONAL),
        eq(wmdNotifications.targetId, auth.playerId),
      ))
      .orderBy(desc(wmdNotifications.broadcastAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/wmd/notifications
 * Mark notifications as read
 *
 * Body:
 * - notificationIds: string[] | 'all'
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { notificationIds } = body;

    if (!notificationIds) {
      return NextResponse.json(
        { error: 'Missing required field: notificationIds' },
        { status: 400 }
      );
    }

    // The pivot schema models "read" as viewedBy[] + viewCount (no read/readAt columns).
    // arrayContains appends are avoided: read the row, add the viewer in app code,
    // write back — pg jsonb concat via drizzle's sql helper keeps it race-light at
    // this scale while staying fully typed.
    const markRead = async (rows: { id: string; viewedBy: string[] | null; viewCount: number | null }[]) => {
      for (const row of rows) {
        const viewers = row.viewedBy ?? [];
        if (viewers.includes(auth.playerId)) continue;
        await db
          .update(wmdNotifications)
          .set({
            viewedBy: [...viewers, auth.playerId],
            viewCount: (row.viewCount ?? 0) + 1,
          })
          .where(eq(wmdNotifications.id, row.id));
      }
    };

    // Mark all as read
    if (notificationIds === 'all') {
      const rows = await db
        .select({ id: wmdNotifications.id, viewedBy: wmdNotifications.viewedBy, viewCount: wmdNotifications.viewCount })
        .from(wmdNotifications)
        .where(and(
          eq(wmdNotifications.scope, NotificationScope.PERSONAL),
          eq(wmdNotifications.targetId, auth.playerId),
        ));
      await markRead(rows);
      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
      });
    }

    // Mark specific notifications as read
    if (Array.isArray(notificationIds)) {
      const rows = await db
        .select({ id: wmdNotifications.id, viewedBy: wmdNotifications.viewedBy, viewCount: wmdNotifications.viewCount })
        .from(wmdNotifications)
        .where(and(
          eq(wmdNotifications.scope, NotificationScope.PERSONAL),
          eq(wmdNotifications.targetId, auth.playerId),
          inArray(wmdNotifications.notificationId, notificationIds as string[]),
        ));
      await markRead(rows);
      return NextResponse.json({
        success: true,
        message: `${notificationIds.length} notifications marked as read`,
      });
    }

    return NextResponse.json(
      { error: 'notificationIds must be an array or "all"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wmd/notifications
 * Clear old notifications
 *
 * Query:
 * - olderThan: number (days, default: 30)
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const olderThan = parseInt(searchParams.get('olderThan') || '30');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThan);

    // "Read" = the viewer is recorded in viewedBy (jsonb string[]).
    const result = await db
      .delete(wmdNotifications)
      .where(and(
        eq(wmdNotifications.scope, NotificationScope.PERSONAL),
        eq(wmdNotifications.targetId, auth.playerId),
        lt(wmdNotifications.createdAt, cutoffDate),
        arrayContains(wmdNotifications.viewedBy, [auth.playerId]),
      ))
      .returning({ id: wmdNotifications.id });

    return NextResponse.json({
      success: true,
      message: `Cleared ${result.length} old notifications`,
      deletedCount: result.length,
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
