// ============================================================
// FILE: app/api/player/stats/route.ts
// CREATED: 2025-01-23 (FID-20250123-001)
// REWRITTEN: 2026-09-18 (FID-20260917-017 slice 3: Mongo shim → pg domain loader)
// ============================================================
// OVERVIEW:
// API endpoint for fetching authenticated player's personal statistics.
// Returns player.stats object containing:
// - battlesWon, totalUnitsBuilt, totalResourcesGathered
// - totalResourcesBanked, shrineTradeCount, cavesExplored
//
// Authentication: Uses Next.js middleware for player session
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getPlayer } from '@/lib/playerService';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { withRequestLogging, createRouteLogger } from '@/lib';
import { calculateCombatPower } from '@/lib/combatPowerService';

/**
 * GET /api/player/stats
 * Fetches personal statistics for the authenticated player
 *
 * @returns PlayerStats object with 6 metrics
 * @example
 * Response: {
 *   success: true,
 *   stats: {
 *     battlesWon: 5,
 *     totalUnitsBuilt: 120,
 *     totalResourcesGathered: 15000,
 *     totalResourcesBanked: 8000,
 *     shrineTradeCount: 3,
 *     cavesExplored: 7
 *   },
 *   username: "FAME",
 *   level: 4
 * }
 */
export const GET = withRequestLogging(async (_request: NextRequest) => {
  const log = createRouteLogger('PlayerStats');
  const endTimer = log.time('fetchPlayerStats');

  try {
    // Get authenticated user from cookie
    const user = await getAuthenticatedUser();

    if (!user) {
      log.warn('Unauthenticated stats request');
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const username = user.username;
    log.debug('Fetching stats', { username });

    // Fetch player's stats through the single pg domain loader
    // (stats is a real jsonb column on players; the loader maps it).
    const player = await getPlayer(username, { includePrivate: true });

    if (!player) {
      log.warn('Player not found', { username });
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Calculate combat power using comprehensive combat power service
    const { combatPower, breakdown } = await calculateCombatPower(username);

    // Return player stats with defaults if any fields are missing
    const stats = {
      battlesWon: player.stats?.battlesWon ?? 0,
      totalUnitsBuilt: player.stats?.totalUnitsBuilt ?? 0,
      totalResourcesGathered: player.stats?.totalResourcesGathered ?? 0,
      totalResourcesBanked: player.stats?.totalResourcesBanked ?? 0,
      shrineTradeCount: player.stats?.shrineTradeCount ?? 0,
      cavesExplored: player.stats?.cavesExplored ?? 0,
    };

    log.info('Stats fetched successfully', {
      username,
      level: player.level ?? 1,
      combatPower,
      balanceStatus: breakdown.balanceStatus
    });

    return NextResponse.json({
      success: true,
      stats,
      username: player.username,
      level: player.level ?? 1,
      combatPower,
      powerBreakdown: breakdown,
      resources: {
        metal: player.resources?.metal ?? 0,
        energy: player.resources?.energy ?? 0,
      }
    });

  } catch (error) {
    log.error('Player stats API error', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch player statistics' },
      { status: 500 }
    );
  } finally {
    endTimer();
  }
});

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Uses cookie-based authentication (getAuthenticatedUser)
// - Single domain read: getPlayer(includePrivate) on pg — the prior shim
//   findOne projected the same fields the loader maps
// - Returns PlayerStats with safe defaults (?? 0)
// - Includes player context (username, level, power, resources)
// - Resources: metal and energy ONLY (no gold - ECHO compliance)
// ============================================================
// END OF FILE
// ============================================================
