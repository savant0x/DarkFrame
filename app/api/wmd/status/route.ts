/**
 * @file app/api/wmd/status/route.ts
 * @created 2025-10-22
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview WMD Status Summary API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

  const supabase = createServiceClient();

    const { data: player } = await supabase
      .from('players')
      .select('username, research_points')
      .eq('username', username)
      .maybeSingle();
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const [
      { data: research },
      { data: missiles },
      { data: batteries },
      { data: spies },
      { count: pendingVotes },
      { count: alertCount },
    ] = await Promise.all([
      supabase.from('wmd_player_research').select('*').eq('player_id', username).maybeSingle(),
      supabase.from('wmd_missiles').select('*').eq('owner_id', username),
      supabase.from('wmd_defense_batteries').select('*').eq('owner_id', username),
      supabase.from('wmd_spies').select('*').eq('owner_id', username),
      supabase.from('wmd_clan_votes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('wmd_notifications').select('*', { count: 'exact', head: true }).eq('player_id', username).eq('is_read', false),
    ]);

    const missilesReady = (missiles || []).filter(m => m.status === 'preparing').length;
    const batteriesActive = (batteries || []).filter(b => b.status === 'active').length;
    const spiesAvailable = (spies || []).filter(s => s.status === 'idle').length;

    return NextResponse.json({
      success: true,
      status: {
        rp: player.research_points || 0,
        missilesReady,
        batteriesActive,
        spiesAvailable,
        pendingVotes: pendingVotes || 0,
        hasAlerts: (alertCount || 0) > 0,
      }
    });

  } catch (error) {
    console.error('Error fetching WMD status:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
