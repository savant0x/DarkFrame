/**
 * Admin Stats API — Supabase backend
 * Fully implemented with live database queries
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { logger } from '@/lib';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.isAdmin) return NextResponse.json({ success: false, error: 'Admin required' }, { status: 403 });
    const username = auth.playerId;

    const supabase = createServiceClient();

    const [
      { count: playerCount },
      { count: factoryCount },
      { count: tileCount },
      { count: clanCount },
      { count: botCount },
    ] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_bot', false),
      supabase.from('tiles').select('*', { count: 'exact', head: true }).eq('terrain', 'Factory'),
      supabase.from('tiles').select('*', { count: 'exact', head: true }),
      supabase.from('clans').select('*', { count: 'exact', head: true }),
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_bot', true),
    ]);

    // Active players in last 24h (using last_login_date)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: activePlayers24h } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .gte('last_login_date', yesterday);

    // Cave count
    const { count: caveCount } = await supabase
      .from('tiles')
      .select('*', { count: 'exact', head: true })
      .eq('terrain', 'Cave');

    // Battle count
    const { count: battleCount } = await supabase
      .from('battle_logs')
      .select('*', { count: 'exact', head: true });

    // Resources gathered (sum across all players)
    const { data: resourceSums } = await supabase
      .from('players')
      .select('stat_total_resources_gathered')
      .gte('stat_total_resources_gathered', 0);
    const totalResourcesGathered = (resourceSums || []).reduce(
      (sum: number, p: { stat_total_resources_gathered: number | null }) => sum + (p.stat_total_resources_gathered || 0), 0
    );

    return NextResponse.json({
      success: true,
      data: {
        totalPlayers: playerCount || 0,
        totalFactories: factoryCount || 0,
        totalTiles: tileCount || 0,
        totalClans: clanCount || 0,
        totalBots: botCount || 0,
        totalCaves: caveCount || 0,
        activePlayers24h: activePlayers24h || 0,
        totalBattles: battleCount || 0,
        totalResourcesGathered,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Admin stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load statistics' }, { status: 500 });
  }
}
