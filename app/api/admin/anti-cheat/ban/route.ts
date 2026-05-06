/**
 * Admin Ban Player API
 * Tracks ban via admin_logs. Full ban system requires `is_banned` column migration (Phase 7).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = body.username;
    if (!username) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { reason } = body;
    await supabase.from('admin_logs').insert({
      admin_username: username,
      action: 'ban_player',
      target: username,
      details: { reason: reason || 'Admin ban' },
    });

    return NextResponse.json({ success: true, message: `${username} ban recorded` });
  } catch (error) {
    console.error('Ban error:', error);
    return NextResponse.json({ success: false, error: 'Failed to ban player' }, { status: 500 });
  }
}
