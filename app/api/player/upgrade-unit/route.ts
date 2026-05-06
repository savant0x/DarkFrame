/**
 * @file app/api/player/upgrade-unit/route.ts
 * @created 2025-10-17
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview API endpoint for purchasing STR/DEF unit upgrades
 * 
 * OVERVIEW:
 * Allows players to spend resources (metal + energy) to permanently increase
 * their total strength or defense. Cost scales exponentially with current level.
 * 
 * Upgrade Costs:
 * - Base cost: 1000 metal + 1000 energy
 * - Cost multiplier: 1.15x per existing point
 * - Formula: baseCost * (1.15 ^ currentValue)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

function calculateUpgradeCost(currentValue: number): { metal: number; energy: number } {
  const baseCost = 1000;
  const multiplier = Math.pow(1.15, currentValue);
  const cost = Math.floor(baseCost * multiplier);
  return { metal: cost, energy: cost };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, type } = body;

    if (!username || !type) {
      return NextResponse.json({ error: 'Username and type are required' }, { status: 400 });
    }

    if (type !== 'strength' && type !== 'defense') {
      return NextResponse.json({ error: 'Type must be "strength" or "defense"' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: player } = await supabase
      .from('players')
      .select('total_strength, total_defense, resources_metal, resources_energy')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const currentValue = type === 'strength' ? (player.total_strength || 0) : (player.total_defense || 0);
    const cost = calculateUpgradeCost(currentValue);

    const playerMetal = player.resources_metal || 0;
    const playerEnergy = player.resources_energy || 0;
    
    if (playerMetal < cost.metal || playerEnergy < cost.energy) {
      return NextResponse.json({ 
        error: 'Insufficient resources',
        required: cost,
        available: { metal: playerMetal, energy: playerEnergy }
      }, { status: 400 });
    }

    const baseUpdate = {
      resources_metal: playerMetal - cost.metal,
      resources_energy: playerEnergy - cost.energy,
    };
    const statUpdate = type === 'strength'
      ? { total_strength: currentValue + 1 }
      : { total_defense: currentValue + 1 };

    const { error } = await supabase
      .from('players')
      .update({ ...baseUpdate, ...statUpdate })
      .eq('username', username);

    if (error) {
      return NextResponse.json({ error: 'Failed to upgrade' }, { status: 500 });
    }

    const nextCost = calculateUpgradeCost(currentValue + 1);

    return NextResponse.json({
      success: true,
      type,
      newValue: currentValue + 1,
      cost,
      nextCost,
      remainingResources: {
        metal: playerMetal - cost.metal,
        energy: playerEnergy - cost.energy
      }
    });

  } catch (error) {
    console.error('Error upgrading unit:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const type = searchParams.get('type');

    if (!username || !type) {
      return NextResponse.json({ error: 'Username and type are required' }, { status: 400 });
    }

    if (type !== 'strength' && type !== 'defense') {
      return NextResponse.json({ error: 'Type must be "strength" or "defense"' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: player } = await supabase
      .from('players')
      .select('total_strength, total_defense, resources_metal, resources_energy')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const currentValue = type === 'strength' ? (player.total_strength || 0) : (player.total_defense || 0);
    const cost = calculateUpgradeCost(currentValue);

    return NextResponse.json({
      type,
      currentValue,
      cost,
      canAfford: (player.resources_metal || 0) >= cost.metal && (player.resources_energy || 0) >= cost.energy,
      available: { metal: player.resources_metal || 0, energy: player.resources_energy || 0 }
    });

  } catch (error) {
    console.error('Error getting upgrade cost:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
