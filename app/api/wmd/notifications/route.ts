/**
 * @file app/api/wmd/notifications/route.ts
 * @created 2025-10-22
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
 * Authentication: JWT tokens via HttpOnly cookies
 * Dependencies: notificationService.ts, apiHelpers.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/wmd/apiHelpers';
import { getDatabase } from '@/lib/mongodb';

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
    
    // Fetch notifications for this player
    const db = await getDatabase();
    const collection = db.collection('wmd_notifications');
    const notifications = await collection
      .find({ targetId: auth.playerId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    
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
    
    const db = await getDatabase();
    const collection = db.collection('wmd_notifications');

    // The pivot schema models "read" as viewedBy[] + viewCount (no read/readAt columns).
    // $addToSet appends the viewer without duplicates; $inc bumps the view counter.
    const markRead = async (filter: Parameters<typeof collection.updateMany>[0]) => {
      await collection.updateMany(filter, {
        $addToSet: { viewedBy: auth.playerId },
        $inc: { viewCount: 1 },
      });
    };

    // Mark all as read
    if (notificationIds === 'all') {
      await markRead({ targetId: auth.playerId });
      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
      });
    }

    // Mark specific notifications as read
    if (Array.isArray(notificationIds)) {
      await markRead({ notificationId: { $in: notificationIds }, targetId: auth.playerId });
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
    
    const db = await getDatabase();
    const collection = db.collection('wmd_notifications');
    const result = await collection.deleteMany({
      targetId: auth.playerId,
      createdAt: { $lt: cutoffDate },
      read: true,
    });
    
    return NextResponse.json({
      success: true,
      message: `Cleared ${result.deletedCount} old notifications`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
