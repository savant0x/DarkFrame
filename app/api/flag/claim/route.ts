/**
 * @file app/api/flag/claim/route.ts
 * @created 2026-05-05
 * @overview Claim an unclaimed flag by being within range of its last known position
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { FLAG_CONFIG } from '@/types/flag.types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = body.username;
    const position = body.position as { x: number; y: number } | undefined;

    if (!username) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });
    if (!position?.x || !position?.y) return NextResponse.json({ success: false, error: 'Position required' }, { status: 400 });

    const supabase = createServiceClient();

    // Check flag state
    const { data: flag } = await supabase.from('flags').select('id, bearer_username, position_x, position_y, respawn_at').limit(1).maybeSingle();
    if (!flag) return NextResponse.json({ success: false, error: 'No flag exists' }, { status: 404 });
    if (flag.bearer_username) return NextResponse.json({ success: false, error: 'Flag is already held' }, { status: 400 });

    // Must be within range of last known position or any tile (if no position recorded)
    if (flag.position_x != null && flag.position_y != null) {
      const dx = Math.abs(position.x - flag.position_x);
      const dy = Math.abs(position.y - flag.position_y);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > FLAG_CONFIG.CHALLENGE_RANGE) {
        return NextResponse.json({ success: false, error: 'Out of range to claim flag' }, { status: 400 });
      }
    }

    // If respawn timer hasn't expired yet, block claim
    if (flag.respawn_at && new Date(flag.respawn_at) > new Date()) {
      return NextResponse.json({ success: false, error: 'Flag will respawn soon' }, { status: 400 });
    }

    // Look up player for HP
    const { data: player } = await supabase.from('players').select('current_hp, max_hp').eq('username', username).single();
    if (!player) return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });

    const now = new Date();
    await supabase.from('flags').update({
      is_bot: false,
      bearer_id: username,
      bearer_username: username,
      position_x: position.x,
      position_y: position.y,
      claimed_at: now.toISOString(),
      current_hp: player.max_hp || 1000,
      max_hp: player.max_hp || 1000,
      session_metal_earned: 0,
      session_energy_earned: 0,
      flee_count: 0,
      grace_until: new Date(now.getTime() + FLAG_CONFIG.GRACE_PERIOD_MS).toISOString(),
      max_hold_expires_at: new Date(now.getTime() + FLAG_CONFIG.MAX_HOLD_HOURS * 60 * 60 * 1000).toISOString(),
      challenge_active: false,
      challenge_challenger_id: null,
      challenge_started_at: null,
      challenge_expires_at: null,
      challenge_lock_expires_at: null,
      respawn_at: null,
    } as never).eq('id', flag.id);

    return NextResponse.json({ success: true, message: 'Flag claimed!' });
  } catch (err) {
    console.error('[Flag Claim] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
