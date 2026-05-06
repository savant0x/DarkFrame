/**
 * Clan search route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  try {
    const supabase = createServiceClient();
    const { data: clans, error } = await supabase
      .from('clans')
      .select('id, name, tag, description, clan_level, leader_id, max_members, clan_settings, total_power, total_territories, wars_won, wars_lost, created_at')
      .ilike('name', `%${q}%`)
      .limit(20);

    if (error || !clans) {
      return NextResponse.json({ success: true, clans: [] });
    }

    const clanIds = clans.map(c => c.id);
    const { data: memberCounts } = await supabase
      .from('clan_members')
      .select('clan_id')
      .in('clan_id', clanIds);

    const countMap: Record<string, number> = {};
    (memberCounts || []).forEach(m => {
      countMap[m.clan_id] = (countMap[m.clan_id] || 0) + 1;
    });

    const enriched = clans.map(clan => ({
      id: clan.id,
      name: clan.name,
      tag: clan.tag,
      description: clan.description || '',
      level: clan.clan_level || 1,
      leaderId: clan.leader_id,
      maxMembers: clan.max_members || 20,
      settings: clan.clan_settings || {},
      memberCount: countMap[clan.id] || 0,
      territories: clan.total_territories || 0,
      totalPower: clan.total_power || 0,
      warsWon: clan.wars_won || 0,
      warsLost: clan.wars_lost || 0,
      createdAt: clan.created_at,
    }));

    return NextResponse.json({ success: true, clans: enriched });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
