/**
 * Discoveries route
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;
    const supabase = createServiceClient();
    const { data } = await supabase.from('player_discoveries').select('*').eq('player_username', username);
    const { data: player } = await supabase.from('players').select('unlocked_techs').eq('username', username).single();
    return NextResponse.json({ success: true, discoveries: data || [], unlockedTechs: player?.unlocked_techs || [] });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
