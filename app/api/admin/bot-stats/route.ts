/**
 * Admin Bot Stats API — Supabase backend
 * Fully implemented with live database queries
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const supabase = createServiceClient();

    const [
      { count: totalBots },
      { count: beerBaseBots },
      { count: roamingBots },
    ] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_bot', true),
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_bot', true).eq('is_special_base', true),
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_bot', true).eq('is_special_base', false),
    ]);

    // Count bots by specialization
    const { data: specCounts } = await supabase
      .from('players')
      .select('spec_doctrine')
      .eq('is_bot', true);

    const bySpecialization: Record<string, number> = { Hoarder: 0, Fortress: 0, Raider: 0, Balanced: 0, Ghost: 0 };
    (specCounts || []).forEach(bot => {
      const spec = bot.spec_doctrine || 'balanced';
      const key = spec.charAt(0).toUpperCase() + spec.slice(1);
      bySpecialization[key] = (bySpecialization[key] || 0) + 1;
    });

    // Active beer bases (attacked in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: activeBeerBases } = await supabase
      .from('players')
      .select('username')
      .eq('is_bot', true)
      .eq('is_special_base', true)
      .gte('last_attacked', oneHourAgo)
      .limit(100);

    return NextResponse.json({
      success: true,
      data: {
        totalBots: totalBots || 0,
        activeBots: roamingBots || 0,
        beerBaseBots: beerBaseBots || 0,
        roamingBots: roamingBots || 0,
        activeBeerBases: activeBeerBases?.length || 0,
        nests: 0,
        bySpecialization,
        spawnRateMin: 5,
        spawnRateMax: 10,
        regenInterval: 3600,
        maxBots: 500,
      },
    });
  } catch (error) {
    console.error('Bot stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load bot stats' }, { status: 500 });
  }
}
