/**
 * @file app/api/player/profile/route.ts
 * @created 2025-10-18
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Player profile data API endpoint
 * 
 * OVERVIEW:
 * Returns comprehensive player profile data including stats, achievements, and base info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/player/profile
 * Get player's full profile data
 */
export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get('username');
    if (!username) return NextResponse.json({ success: false, error: 'Username parameter required' }, { status: 400 });
    const supabase = createServiceClient();

    const { data: player } = await supabase
      .from('players')
      .select('username, level, rank, resources_metal, resources_energy, base_x, base_y, base_greeting, created_at, battle_base_initiated, battle_base_won, battle_base_lost, battle_infantry_initiated, battle_infantry_won, battle_infantry_lost, battle_base_defense_total, battle_base_defense_won, battle_base_defense_lost')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const { data: achievements } = await supabase
      .from('player_achievements')
      .select('*')
      .eq('player_username', username);

    const profileData = {
      username: player.username,
      level: player.level || 1,
      rank: player.rank || 1,
      resources: {
        metal: player.resources_metal || 0,
        energy: player.resources_energy || 0
      },
      base: {
        x: player.base_x,
        y: player.base_y,
        greeting: player.base_greeting || ''
      },
      battleStats: {
        infantryAttacks: {
          initiated: player.battle_infantry_initiated || 0,
          won: player.battle_infantry_won || 0,
          lost: player.battle_infantry_lost || 0
        },
        baseAttacks: {
          initiated: player.battle_base_initiated || 0,
          won: player.battle_base_won || 0,
          lost: player.battle_base_lost || 0
        },
        baseDefenses: {
          total: player.battle_base_defense_total || 0,
          won: player.battle_base_defense_won || 0,
          lost: player.battle_base_defense_lost || 0
        }
      },
      achievements: achievements || [],
      joinedAt: player.created_at || new Date().toISOString()
    };

    return NextResponse.json({ success: true, data: profileData });

  } catch (error) {
    console.error('Error loading profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }
}
