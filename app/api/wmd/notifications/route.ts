/**
 * @file app/api/wmd/notifications/route.ts
 * @created 2025-10-22
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview WMD Notifications API Endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

function mapNotificationRow(row: Record<string, any>): Record<string, any> {
  const meta = row.data || {};
  return {
    notificationId: row.id,
    eventType: row.notification_type,
    priority: meta.priority || meta.severity || 'normal',
    sourceName: meta.sourceName || meta.launcherId || meta.sender || 'System',
    targetName: meta.targetName || meta.targetId || undefined,
    title: row.title,
    message: row.message,
    read: row.is_read || false,
    createdAt: row.created_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'Username parameter required' }, { status: 400 });
    
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const supabase = createServiceClient();
    const { data: rawNotifications } = await supabase
      .from('wmd_notifications')
      .select('*')
        .eq('player_id', username)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    const notifications = (rawNotifications || []).map(mapNotificationRow);
    
    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { notificationIds, readAll, username } = body;
    if (!username) return NextResponse.json({ error: 'Username required' }, { status: 400 });
    
    const supabase = createServiceClient();
    
    if (readAll) {
      await supabase
        .from('wmd_notifications')
        .update({ is_read: true })
      .eq('player_id', username)
        .eq('is_read', false);
    } else if (notificationIds && notificationIds.length > 0) {
      await supabase
        .from('wmd_notifications')
        .update({ is_read: true })
        .in('id', notificationIds);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const username = searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'Username parameter required' }, { status: 400 });
    
    const clearAll = searchParams.get('clearAll') === 'true';
    const olderThan = searchParams.get('olderThan');
    
    const supabase = createServiceClient();
    
    let query = supabase.from('wmd_notifications').delete().eq('player_id', username);
    
    if (!clearAll && olderThan) {
      query = query.lt('created_at', olderThan);
    }
    
    await query;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return NextResponse.json({ error: 'Failed to clear notifications' }, { status: 500 });
  }
}
