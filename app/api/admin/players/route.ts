/**
 * Admin Player List API — Supabase backend
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  try {
    const supabase = createServiceClient();

    const { data: players } = await supabase
      .from('players')
      .select('username, level, rank, total_strength, total_defense, resources_metal, resources_energy, research_points, is_admin, is_bot, is_vip, clan_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    return NextResponse.json({
      success: true,
      data: (players || []).map(p => ({
        username: p.username,
        level: p.level || 1,
        rank: p.rank || 1,
        totalStrength: p.total_strength || 0,
        totalDefense: p.total_defense || 0,
        resources: { metal: p.resources_metal || 0, energy: p.resources_energy || 0 },
        researchPoints: p.research_points || 0,
        isAdmin: Boolean(p.is_admin),
        isBot: Boolean(p.is_bot),
        isVip: Boolean(p.is_vip),
        clanId: p.clan_id,
        createdAt: p.created_at,
      })),
    });
  } catch (error) {
    console.error('Admin players error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load players' }, { status: 500 });
  }
}
