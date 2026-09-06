// ============================================================
// FILE: app/api/player/stats/route.ts
// CREATED: 2025-01-23 (FID-20250123-001)
// UPDATED: 2025-10-23 (Phase 3.1: Enhanced logging with request tracking)
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
import { getDatabase } from '@/lib/mongodb';
import type { Player } from '@/types/game.types';
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

    // Connect to database
    const db = await getDatabase();
    const playersCollection = db.collection<Player>('players');

    // Fetch player's stats
    const player = await playersCollection.findOne(
      { username },
      { 
        projection: { 
          stats: 1, 
          username: 1, 
          level: 1,
          totalStrength: 1,
          totalDefense: 1,
          resources: 1
        } 
      }
    );

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
// - Returns PlayerStats with safe defaults (?? 0)
// - Includes player context (username, level, power, resources)
// - Resources: metal and energy ONLY (no gold - ECHO compliance)
// - All fields use optional chaining for safety
// - Same auth pattern as other API routes (bot-magnet, admin, etc.)
// ============================================================
// END OF FILE
// ============================================================
