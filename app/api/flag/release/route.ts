/**
 * @file app/api/flag/release/route.ts
 * @created 2026-05-06
 * @overview Flag release API endpoint.
 * Allows the current flag bearer to voluntarily release the flag.
 * The flag becomes available for anyone to claim.
 * Resets bearer session earnings and updates player stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { FLAG_CONFIG } from '@/types/flag.types';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const supabase = createServiceClient();

    // Get current flag state
    const { data: rawFlag } = await supabase.from('flags').select('*').single();
    const f = rawFlag as Record<string, unknown> | null;

    if (!f?.bearer_username) {
      return NextResponse.json(
        { success: false, error: 'No flag bearer' },
        { status: 404 }
      );
    }

    // Verify the requesting user IS the bearer
    if (f.bearer_username !== username) {
      return NextResponse.json(
        { success: false, error: 'You are not the flag bearer' },
        { status: 403 }
      );
    }

    // Get bearer's session earnings before releasing
    const { data: rawBearer } = await supabase
      .from('players')
      .select('flag_session_metal, flag_session_energy, flag_times_held')
      .eq('username', username)
      .single();
    const bearer = rawBearer as Record<string, unknown> | null;

    const sessionMetal = (f.session_metal_earned as number) || 0;
    const sessionEnergy = (f.session_energy_earned as number) || 0;
    const timesHeld = ((bearer?.flag_times_held as number) || 0);

    // Release the flag — clear bearer but keep flag available for claim
    await supabase.from('flags').update({
      bearer_id: null,
      bearer_username: null,
      is_bot: false,
      claimed_at: null,
      position_x: null,
      position_y: null,
      current_hp: 0,
      max_hp: 0,
      session_metal_earned: 0,
      session_energy_earned: 0,
      flee_count: 0,
      grace_until: null,
      max_hold_expires_at: null,
      challenge_active: false,
      challenge_challenger_id: null,
      challenge_started_at: null,
      challenge_expires_at: null,
      challenge_lock_expires_at: null,
      respawn_at: null,
    } as never).eq('id', f.id as string);

    // Update player stats
    if (bearer) {
      await supabase.from('players').update({
        flag_session_started_at: null,
        flag_session_metal: 0,
        flag_session_energy: 0,
        flag_flee_count: 0,
        flag_grace_until: null,
        flag_times_held: timesHeld,
      } as never).eq('username', username);
    }

    return NextResponse.json({
      success: true,
      message: 'Flag released successfully',
      data: {
        sessionEarnings: { metal: sessionMetal, energy: sessionEnergy },
        timesHeld,
      },
    });
  } catch (error) {
    console.error('Flag release error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to release flag' },
      { status: 500 }
    );
  }
}
