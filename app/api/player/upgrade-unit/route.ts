/**
 * @file app/api/player/upgrade-unit/route.ts
 * @created 2025-10-17
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
import { db } from '@/lib/db';
import { players } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authMiddleware';

/**
 * Calculate upgrade cost based on current stat value
 */
function calculateUpgradeCost(currentValue: number): { metal: number; energy: number } {
  const baseCost = 1000;
  const multiplier = Math.pow(1.15, currentValue);
  const cost = Math.floor(baseCost * multiplier);
  
  return {
    metal: cost,
    energy: cost
  };
}

/**
 * POST /api/player/upgrade-unit
 * Purchase a single point of STR or DEF
 * 
 * Body: {
 *   username: string,
 *   type: 'strength' | 'defense'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // FID-20260904-005 §5.1: session identity — body username ignored.
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const username = authUser.username;

    const body = await request.json();
    const { type } = body;

    // Validation
    if (!type) {
      return NextResponse.json(
        { error: 'Type is required' },
        { status: 400 }
      );
    }

    if (type !== 'strength' && type !== 'defense') {
      return NextResponse.json(
        { error: 'Type must be "strength" or "defense"' },
        { status: 400 }
      );
    }

    // Get player
    const [player] = await db.select().from(players).where(eq(players.username, username));
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    // Calculate cost
    const currentValue = type === 'strength' ? (player.totalStrength || 0) : (player.totalDefense || 0);
    const cost = calculateUpgradeCost(currentValue);

    // Check if player has enough resources
    const playerMetal = Number(Number(player.resourcesMetal) || 0);
    const playerEnergy = Number(Number(player.resourcesEnergy) || 0);
    
    if (playerMetal < cost.metal || playerEnergy < cost.energy) {
      return NextResponse.json(
        { 
          error: 'Insufficient resources',
          required: cost,
          available: { metal: playerMetal, energy: playerEnergy }
        },
        { status: 400 }
      );
    }

    // Perform upgrade
    const updateField = type === 'strength' ? 'totalStrength' : 'totalDefense';
    
    await db.update(players).set({
      [updateField]: currentValue + 1,
      resourcesMetal: Number(BigInt(playerMetal - cost.metal)),
      resourcesEnergy: Number(BigInt(playerEnergy - cost.energy)),
    }).where(eq(players.username, username));

    // Calculate next upgrade cost
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
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/player/upgrade-unit?username=X&type=strength
 * Get upgrade cost without purchasing
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const type = searchParams.get('type');

    if (!username || !type) {
      return NextResponse.json(
        { error: 'Username and type are required' },
        { status: 400 }
      );
    }

    if (type !== 'strength' && type !== 'defense') {
      return NextResponse.json(
        { error: 'Type must be "strength" or "defense"' },
        { status: 400 }
      );
    }

    const [player] = await db.select().from(players).where(eq(players.username, username));

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    const currentValue = type === 'strength' ? (player.totalStrength || 0) : (player.totalDefense || 0);
    const cost = calculateUpgradeCost(currentValue);

    return NextResponse.json({
      type,
      currentValue,
      cost,
      canAfford: Number(Number(player.resourcesMetal) || 0) >= cost.metal && Number(Number(player.resourcesEnergy) || 0) >= cost.energy,
      available: { metal: Number(Number(player.resourcesMetal) || 0), energy: Number(Number(player.resourcesEnergy) || 0) }
    });

  } catch (error) {
    console.error('Error getting upgrade cost:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
