/**
 * Admin Predictive Spawning Recalculation
 * Recomputes beer base spawn forecasts based on player activity data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    if (!auth.isAdmin) return NextResponse.json({ success: false, error: 'Admin required' }, { status: 403 });

    const supabase = createServiceClient();

    // Count active players in the last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: activePlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_bot', false)
      .gte('last_login_date', twentyFourHoursAgo);

    // Count existing beer bases
    const { count: existingBases } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_special_base', true);

    // Predict spawn count based on active player ratio (1 base per ~10 active players)
    const recommended = Math.max(10, Math.floor((activePlayers || 0) / 10));
    const deficit = Math.max(0, recommended - (existingBases || 0));

    await supabase.from('admin_logs').insert({
      admin_username: auth.username,
      action: 'recalculate_predictions',
      target: 'beer_bases',
      details: { activePlayers: activePlayers || 0, existingBases: existingBases || 0, recommended, deficit },
    });

    return NextResponse.json({
      success: true,
      data: {
        activePlayers: activePlayers || 0,
        existingBases: existingBases || 0,
        recommendedBases: recommended,
        spawnDeficit: deficit,
      },
    });
  } catch (error) {
    console.error('Predictive spawning error:', error);
    return NextResponse.json({ success: false, error: 'Recalculation failed' }, { status: 500 });
  }
}
