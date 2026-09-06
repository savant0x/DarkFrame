/**
 * @file app/api/shrine/extend/route.ts
 * @created 2025-10-17
 * @overview Shrine boost extension API for adding time to active boosts
 * 
 * OVERVIEW:
 * Allows players to donate items to extend the duration of active shrine boosts.
 * Maximum duration per boost: 8 hours. Item values vary by rarity.
 */

import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { getCollection } from '@/lib/mongodb';
import { Player, Tile, TerrainType,  ItemType, ItemRarity } from '@/types';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS
} from '@/lib';

const MAX_BOOST_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

/**
 * Item time extension values by rarity
 */
const ITEM_VALUES = {
  [ItemRarity.Common]: 15 * 60 * 1000, // 15 minutes
  [ItemRarity.Uncommon]: 30 * 60 * 1000, // 30 minutes  
  [ItemRarity.Rare]: 30 * 60 * 1000, // 30 minutes
  [ItemRarity.Epic]: 60 * 60 * 1000, // 1 hour
  [ItemRarity.Legendary]: 2 * 60 * 60 * 1000 // 2 hours
};

const _logger = createRouteLogger('shrine/extend');
const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.SHRINE_SACRIFICE);

/**
 * POST /api/shrine/extend
 * 
 * Extend the duration of an active boost by donating items
 * 
 * Request body:
 * ```json
 * {
 *   "tier": "speed" | "heart" | "diamond" | "club",
 *   "itemCount": number
 * }
 * ```
 * 
 * Success Response:
 * ```json
 * {
 *   "success": true,
 *   "message": "Extended Heart Tier boost by 30 minutes",
 *   "shrineBoosts": [...],
 *   "newDuration": "2h 15m remaining",
 *   "itemsUsed": 2,
 *   "itemsRemaining": 45
 * }
 * ```
 */
export const POST = withRequestLogging(rateLimiter(async (request: Request) => {
  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { tier, itemCount } = await request.json();
    const username = authResult.username;

    // Validate inputs
    if (!tier || !['speed', 'heart', 'diamond', 'club'].includes(tier)) {
      return NextResponse.json(
        { success: false, message: 'Invalid boost tier' },
        { status: 400 }
      );
    }

    if (typeof itemCount !== 'number' || itemCount <= 0 || !Number.isInteger(itemCount)) {
      return NextResponse.json(
        { success: false, message: 'Item count must be a positive integer' },
        { status: 400 }
      );
    }

    // Get player
    const playersCollection = await getCollection<Player>('players');
    const player = await playersCollection.findOne({ username });

    if (!player) {
      return NextResponse.json(
        { success: false, message: 'Player not found' },
        { status: 404 }
      );
    }

    // Check if player is at the Shrine
    const tilesCollection = await getCollection<Tile>('tiles');
    const currentTile = await tilesCollection.findOne({
      x: player.currentPosition.x,
      y: player.currentPosition.y
    });

    if (!currentTile || currentTile.terrain !== TerrainType.Shrine) {
      return NextResponse.json(
        { success: false, message: 'You must be at the Shrine of Remembrance (1,1) to extend boosts' },
        { status: 400 }
      );
    }

    // Check if boost exists
    if (!player.shrineBoosts || player.shrineBoosts.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No active boosts to extend' },
        { status: 400 }
      );
    }

    const boostIndex = player.shrineBoosts.findIndex((b) => b.tier === tier);
    if (boostIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          message: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier boost is not active`
        },
        { status: 400 }
      );
    }

    // Count tradeable items
    const tradeableItems = player.inventory.items.filter((item) => item.type === ItemType.TradeableItem
    );

    if (tradeableItems.length < itemCount) {
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient items. Need ${itemCount}, have ${tradeableItems.length}`
        },
        { status: 400 }
      );
    }

    // Calculate time extension based on item rarities
    const itemsToSacrifice = tradeableItems.slice(0, itemCount);
    let totalTimeAdded = 0;

    itemsToSacrifice.forEach((item) => {
      const timeValue = (ITEM_VALUES as unknown as Record<string, number>)[item.rarity] || ITEM_VALUES[ItemRarity.Common];
      totalTimeAdded += timeValue;
    });

    // Get current boost
    const currentBoost = player.shrineBoosts[boostIndex];
    const currentExpiry = new Date(currentBoost.expiresAt).getTime();
    const now = Date.now();

    // Calculate remaining time
    const _remainingTime = Math.max(0, currentExpiry - now);

    // Calculate new duration (capped at 8 hours from current time)
    const maxAllowedExpiry = now + MAX_BOOST_DURATION;
    const newExpiry = Math.min(currentExpiry + totalTimeAdded, maxAllowedExpiry);
    const actualTimeAdded = newExpiry - currentExpiry;

    if (actualTimeAdded <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier boost is already at maximum duration (8 hours)`
        },
        { status: 400 }
      );
    }

    // Remove sacrificed items
    const remainingItems = player.inventory.items.filter((item) => item.type !== ItemType.TradeableItem
    );
    const itemsToKeep = tradeableItems.slice(itemCount);
    const newInventory = [...remainingItems, ...itemsToKeep];

    // Update boost expiry
    const updatedBoosts = [...player.shrineBoosts];
    updatedBoosts[boostIndex] = {
      ...currentBoost,
      expiresAt: new Date(newExpiry)
    };

    // Update player
    await playersCollection.updateOne(
      { username },
      {
        $set: {
          'inventory.items': newInventory,
          shrineBoosts: updatedBoosts
        }
      }
    );

    // Format duration display
    const newRemainingMs = newExpiry - now;
    const hoursRemaining = Math.floor(newRemainingMs / (60 * 60 * 1000));
    const minutes = Math.floor((newRemainingMs % (60 * 60 * 1000)) / (60 * 1000));
    const durationDisplay = `${hoursRemaining}h ${minutes}m`;

    const timeAddedMinutes = Math.floor(actualTimeAdded / (60 * 1000));
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);

    return NextResponse.json({
      success: true,
      message: `Extended ${tierName} Tier boost by ${timeAddedMinutes} minutes`,
      shrineBoosts: updatedBoosts,
      newDuration: durationDisplay,
      itemsUsed: itemCount,
      itemsRemaining: newInventory.length
    });

  } catch (error) {
    console.error('Shrine extend error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to extend boost' },
      { status: 500 }
    );
  }
}));
