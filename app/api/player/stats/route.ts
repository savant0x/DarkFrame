/**
 * @file app/api/player/stats/route.ts
 * @created 2025-01-23
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Player personal statistics API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { withRequestLogging, createRouteLogger } from '@/lib';
import { calculateCombatPower } from '@/lib/combatPowerService';

export const GET = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('PlayerStats');
  const endTimer = log.time('fetchPlayerStats');
  
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    log.debug('Fetching stats', { username });

    const supabase = createServiceClient();

    const { data: player } = await supabase
      .from('players')
      .select('username, level, total_strength, total_defense, resources_metal, resources_energy, stat_battles_won, stat_total_units_built, stat_total_resources_gathered, stat_total_resources_banked, stat_shrine_trade_count, stat_caves_explored')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      log.warn('Player not found', { username });
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const { combatPower, breakdown } = await calculateCombatPower(username);

    const stats = {
      battlesWon: player.stat_battles_won ?? 0,
      totalUnitsBuilt: player.stat_total_units_built ?? 0,
      totalResourcesGathered: player.stat_total_resources_gathered ?? 0,
      totalResourcesBanked: player.stat_total_resources_banked ?? 0,
      shrineTradeCount: player.stat_shrine_trade_count ?? 0,
      cavesExplored: player.stat_caves_explored ?? 0,
    };

    log.debug('Stats fetched', { username, level: player.level ?? 1, combatPower });

    return NextResponse.json({
      success: true,
      stats,
      username: player.username,
      level: player.level ?? 1,
      combatPower,
      powerBreakdown: breakdown,
      resources: {
        metal: player.resources_metal ?? 0,
        energy: player.resources_energy ?? 0,
      }
    });

  } catch (error) {
    log.error('Player stats API error', error as Error);
    return NextResponse.json({ success: false, error: 'Failed to fetch player statistics' }, { status: 500 });
  } finally {
    endTimer();
  }
});
