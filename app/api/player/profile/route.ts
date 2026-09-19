/**
 * @file app/api/player/profile/route.ts
 * @created 2025-10-18
 * @rewritten 2026-09-18 (FID-20260917-017 slice 3: Mongo shim → pg domain loader)
 * @overview Player profile data API endpoint
 *
 * OVERVIEW:
 * Returns comprehensive player profile data including stats, achievements, and base info.
 *
 * PERSISTENCE (PostgreSQL): one domain read via getPlayer(includePrivate) —
 * stats/achievements are real jsonb columns; base coordinates and greeting map
 * through the single row→domain mapper (mapRowToPlayer).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlayer } from '@/lib/playerService';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { computeBattleStats, toPanelBattleStats } from '@/lib/battleStatsService';

/**
 * GET /api/player/profile
 *
 * Get current player's full profile data
 * Uses cookie authentication
 */
export async function GET(_request: NextRequest) {
  try {
    // Authenticate user from cookie
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const username = user.username;

    // Get player data through the single pg domain loader
    const player = await getPlayer(username, { includePrivate: true });

    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Build profile response
    const profileData = {
      username: player.username,
      level: player.level || 1,
      rank: player.rank || 1,
      resources: {
        metal: player.resources?.metal || 0,
        energy: player.resources?.energy || 0
      },
      base: {
        x: player.base.x,
        y: player.base.y,
        greeting: player.baseGreeting || ''
      },
      // FID-20260914-007: computed live from battle_logs — the battle_stats
      // column had NO writer, so every profile showed zeros forever.
      battleStats: toPanelBattleStats(await computeBattleStats(username)),
      achievements: player.achievements || [],
      joinedAt: player.createdAt || new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      data: profileData
    });

  } catch (error) {
    console.error('❌ Error loading profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load profile' },
      { status: 500 }
    );
  }
}

// ============================================================
// END OF FILE
// ============================================================
