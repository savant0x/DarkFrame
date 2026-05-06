/**
 * @file app/api/chat/heartbeat/route.ts
 * @overview Player presence heartbeat — keeps player session alive and updates online status
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';

const SESSION_TIMEOUT_MS = 120000; // 2 minutes of inactivity = session expires

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const supabase = createServiceClient();
    const now = new Date().toISOString();
    const expiryCutoff = new Date(Date.now() - SESSION_TIMEOUT_MS).toISOString();

    // End any expired sessions first
    await supabase
      .from('player_sessions')
      .update({ ended_at: now })
      .eq('player_username', username)
      .is('ended_at', null)
      .lte('last_heartbeat', expiryCutoff);

    // Get active session or create one
    const { data: activeSession } = await supabase
      .from('player_sessions')
      .select('id')
      .eq('player_username', username)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSession) {
      // Refresh heartbeat
      const { error: updateErr } = await supabase
        .from('player_sessions')
        .update({ last_heartbeat: now })
        .eq('id', activeSession.id);
      if (updateErr) {
        console.error('[Heartbeat] Update error:', updateErr);
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
      }
    } else {
      // Create new session
      const { error: insertErr } = await supabase.from('player_sessions').insert({
        player_username: username,
        session_id: `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        started_at: now,
        last_heartbeat: now,
      });
      if (insertErr) {
        console.error('[Heartbeat] Insert error:', insertErr);
        return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
      }
    }

    // Also update last_login_date as a secondary online indicator
    await supabase
      .from('players')
      .update({ last_login_date: now.split('T')[0] })
      .eq('username', username);

    console.log(`[Heartbeat] ${username} last_heartbeat=${now}`);
    return NextResponse.json({ success: true, lastSeen: now });
  } catch (error) {
    console.error('[Heartbeat] Error:', error);
    return NextResponse.json({ success: false, error: 'Heartbeat failed' }, { status: 500 });
  }
}
