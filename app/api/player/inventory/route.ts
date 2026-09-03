/**
 * API Route: Player Inventory
 * Created: 2025-01-19
 * 
 * OVERVIEW:
 * Provides player inventory data including items, resources, and equipment.
 * Returns empty inventory structure if player not found or has no items.
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import type { Player } from '@/types/game.types';
import { withRequestLogging, createRouteLogger } from '@/lib';

/**
 * GET /api/player/inventory
 * Fetches the authenticated player's inventory
 */
export const GET = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('PlayerInventoryAPI');
  const endTimer = log.time('fetchPlayerInventory');
  
  try {
    const playerId = request.cookies.get('playerId')?.value;

    if (!playerId) {
      log.warn('Unauthenticated inventory request');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    log.debug('Fetching player inventory', { playerId });

    const client = await clientPromise;
    const db = client.db('darkframe');
    
    const player = await db.collection<Player>('players').findOne(
      { username: playerId },
      { projection: { inventory: 1 } }
    );

    if (!player) {
      log.warn('Player not found for inventory', { playerId });
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    // Return inventory or empty structure if none exists
    const inventory = player.inventory || {
      items: [],
      resources: [],
      equipment: {
        weapon: null,
        armor: null,
        accessory: null
      },
      capacity: 100,
      used: 0,
      gatheringBonus: {
        metalBonus: 0,
        energyBonus: 0
      },
      activeBoosts: {
        gatheringBoost: null,
        expiresAt: null
      },
      metalDiggerCount: 0,
      energyDiggerCount: 0
    };

    // Ensure gatheringBonus exists (for older player records)
    if (!inventory.gatheringBonus) {
      inventory.gatheringBonus = {
        metalBonus: 0,
        energyBonus: 0
      };
    }

    // Ensure activeBoosts exists (for older player records)
    if (!inventory.activeBoosts) {
      inventory.activeBoosts = {
        gatheringBoost: null,
        expiresAt: null
      };
    }

    // Ensure digger counts exist (for older player records)
    if (typeof inventory.metalDiggerCount === 'undefined') {
      inventory.metalDiggerCount = 0;
    }
    if (typeof inventory.energyDiggerCount === 'undefined') {
      inventory.energyDiggerCount = 0;
    }

    log.info('Player inventory fetched', { 
      playerId, 
      itemCount: inventory.items?.length || 0, 
      resourceCount: inventory.resources?.length || 0,
      usedCapacity: inventory.used || 0,
      totalCapacity: inventory.capacity || 100
    });

    return NextResponse.json(inventory);

  } catch (error) {
    log.error('Failed to fetch player inventory', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  } finally {
    endTimer();
  }
});

/**
 * IMPLEMENTATION NOTES:
 * - Returns structured inventory data with items, resources, and equipment
 * - Gracefully handles missing inventory by returning empty structure
 * - Authentication via playerId cookie
 * - TODO: Add inventory update endpoints (POST/PUT) when needed
 * - TODO: Add inventory capacity management
 */
