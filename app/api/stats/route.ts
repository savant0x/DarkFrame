/**
 * @file app/api/stats/route.ts
 * @created 2025-01-18
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview API endpoint for retrieving game statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('stats-get');
  const endTimer = log.time('stats-get');
  try {
    const searchParams = request.nextUrl.searchParams;
    const sortBy = searchParams.get('sortBy') || 'power';

    const supabase = createServiceClient();

    // Determine sort field
    let sortField: string;
    switch (sortBy) {
      case 'level': sortField = 'level'; break;
      case 'metal': sortField = 'resources_metal'; break;
      case 'power':
      default: sortField = 'total_strength'; break;
    }

    // Fetch top 10 players
    const { data: topPlayersRaw } = await supabase
      .from('players')
      .select('username, level, total_strength, total_defense, resources_metal, resources_energy, rank')
      .order(sortField, { ascending: false })
      .limit(10);

    const topPlayers = (topPlayersRaw || []).map(player => ({
      username: player.username,
      level: player.level,
      totalPower: (player.total_strength || 0) + (player.total_defense || 0),
      totalStrength: player.total_strength,
      totalDefense: player.total_defense,
      metal: player.resources_metal || 0,
      energy: player.resources_energy || 0,
      rank: player.rank,
    }));

    // Calculate global statistics
    const { data: allPlayers, count: totalPlayers } = await supabase
      .from('players')
      .select('resources_metal, resources_energy, level, total_strength, total_defense, created_at', { count: 'exact' });

    let totalMetal = 0;
    let totalEnergy = 0;
    let totalPower = 0;
    let levelSum = 0;

    (allPlayers || []).forEach(p => {
      totalMetal += p.resources_metal || 0;
      totalEnergy += p.resources_energy || 0;
      totalPower += (p.total_strength || 0) + (p.total_defense || 0);
      levelSum += p.level || 0;
    });

    const gameStats = {
      totalPlayers: totalPlayers || 0,
      totalMetal,
      totalEnergy,
      totalPower,
      averageLevel: totalPlayers ? Math.round(levelSum / totalPlayers) : 0,
      totalBattles: 0,
      totalTerritories: 0,
    };

    log.info('Statistics retrieved', { topPlayerCount: topPlayers.length, totalPlayers: gameStats.totalPlayers, sortBy });
    return NextResponse.json({ success: true, topPlayers, gameStats, sortBy });
  } catch (error) {
    log.error('Failed to fetch statistics', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
