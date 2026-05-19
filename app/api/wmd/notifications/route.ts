import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { createRateLimiter, ENDPOINT_RATE_LIMITS, logger } from '@/lib';

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

const getRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const patchRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const deleteRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = getRateLimiter(async (req: NextRequest) => {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const username = auth.username;

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
    logger.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
});

export const PATCH = patchRateLimiter(async (req: NextRequest) => {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const username = auth.username;
    const body = await req.json();
    const { notificationIds, readAll } = body;

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
    logger.error('Error marking notifications as read:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
});

export const DELETE = deleteRateLimiter(async (req: NextRequest) => {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const username = auth.username;
    const { searchParams } = req.nextUrl;

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
    logger.error('Error clearing notifications:', error);
    return NextResponse.json({ error: 'Failed to clear notifications' }, { status: 500 });
  }
});
