/**
 * @file app/api/player/profile/route.ts
 * @created 2025-10-18
 * @overview Player profile data API endpoint
 * 
 * OVERVIEW:
 * Returns comprehensive player profile data including stats, achievements, and base info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { Player } from '@/types';

/**
 * GET /api/player/profile
 * 
 * Get current player's full profile data
 * Uses cookie authentication
 */
export async function GET(request: NextRequest) {
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

    // Get player data
    const playersCollection = await getCollection<Player>('players');
    const player = await playersCollection.findOne({ username });

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
      battleStats: player.battleStats || {
        infantryAttacks: { initiated: 0, won: 0, lost: 0 },
        baseAttacks: { initiated: 0, won: 0, lost: 0 },
        baseDefenses: { total: 0, won: 0, lost: 0 }
      },
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
