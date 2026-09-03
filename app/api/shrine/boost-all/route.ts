/**
 * app/api/shrine/boost-all/route.ts
 * Created: 2025-01-15
 * 
 * OVERVIEW:
 * API endpoint for activating all 4 shrine boosts simultaneously.
 * Convenience endpoint that activates spade, heart, diamond, and club boosts
 * with the same item count per boost. Validates total item requirement (itemCount × 4).
 * Uses same rarity-based duration calculation as individual activation.
 */

import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { getCollection } from '@/lib/mongodb';
import type { Player, InventoryItem, ShrineBoost, ShrineBoostTier } from '@/types';
import { calculateDuration } from '@/utils/shrineHelpers';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode
} from '@/lib';

// All boost tiers
const ALL_TIERS: ShrineBoostTier[] = ['spade', 'heart', 'diamond', 'club'];

// Boost configuration
const BOOST_CONFIGS: Record<ShrineBoostTier, { yieldBonus: number }> = {
  spade: { yieldBonus: 0.25 },
  heart: { yieldBonus: 0.25 },
  diamond: { yieldBonus: 0.25 },
  club: { yieldBonus: 0.25 },
};

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.SHRINE_SACRIFICE);

/**
 * POST /api/shrine/boost-all
 * 
 * Activate all 4 shrine boosts simultaneously
 */
export const POST = withRequestLogging(rateLimiter(async (request: Request) => {
  const log = createRouteLogger('ShrineBoostAllAPI');
  const endTimer = log.time('shrineBoostAll');

  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      log.warn('Unauthenticated shrine boost-all attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required'
      });
    }

    const username = authResult.username;

    // Parse request body
    const { itemCount } = await request.json();

    // Validate inputs
    if (!itemCount || itemCount <= 0 || !Number.isInteger(itemCount)) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Item count must be a positive integer'
      });
    }

    const totalItemsNeeded = itemCount * 4;

    // Get database collections
    const playersCollection = await getCollection<Player>('players');
    const player = await playersCollection.findOne({ username });

    if (!player) {
      return createErrorResponse(ErrorCode.AUTH_USER_NOT_FOUND, {
        message: 'Player not found'
      });
    }

    // Get tradeable items from inventory
    const tradeableItems = (player.inventory?.items || []).filter(
      (i: InventoryItem) => i.type === 'TRADEABLE_ITEM'
    );

    // Check if player has enough items
    if (tradeableItems.length < totalItemsNeeded) {
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        message: `Not enough items. You have ${tradeableItems.length}, need ${totalItemsNeeded}.`
      });
    }

    // Process each boost tier
    const results = [];
    let itemsConsumedTotal = 0;
    const existingBoosts = player.shrineBoosts || [];
    const now = new Date();

    for (const tier of ALL_TIERS) {
      // Get next batch of items for this tier
      const itemsForThisTier = tradeableItems.slice(itemsConsumedTotal, itemsConsumedTotal + itemCount);
      
      // Calculate duration based on item rarities
      const durationMinutes = calculateDuration(itemsForThisTier);
      const durationMs = durationMinutes * 60 * 1000;
      
      // Calculate expiration time
      const expiresAt = new Date(now.getTime() + durationMs);

      // Check if boost already exists
      const existingBoostIndex = existingBoosts.findIndex(
        (b: ShrineBoost) => b.tier === tier
      );

      let finalExpiresAt = expiresAt;

      if (existingBoostIndex >= 0) {
        // Replace/extend existing boost
        const existingBoost = existingBoosts[existingBoostIndex];
        const currentExpiry = new Date(existingBoost.expiresAt);
        const timeRemaining = Math.max(0, currentExpiry.getTime() - now.getTime());
        const newDuration = timeRemaining + durationMs;
        
        // Cap at 8 hours (480 minutes)
        const MAX_DURATION_MS = 8 * 60 * 60 * 1000;
        const finalDuration = Math.min(newDuration, MAX_DURATION_MS);
        finalExpiresAt = new Date(now.getTime() + finalDuration);

        existingBoosts[existingBoostIndex] = {
          ...existingBoost,
          expiresAt: finalExpiresAt
        };
      } else {
        // Create new boost
        existingBoosts.push({
          tier,
          yieldBonus: BOOST_CONFIGS[tier].yieldBonus,
          expiresAt: finalExpiresAt
        });
      }

      results.push({
        tier,
        durationMinutes,
        expiresAt: finalExpiresAt,
      });

      itemsConsumedTotal += itemCount;
    }

    // Remove all consumed items from inventory
    const itemsToConsume = tradeableItems.slice(0, totalItemsNeeded);
    const remainingItems = (player.inventory?.items || []).filter(
      (item: InventoryItem) => !itemsToConsume.some((consumed: InventoryItem) => consumed.id === item.id)
    );

    // Update player in database
    await playersCollection.updateOne(
      { username },
      {
        $set: {
          'inventory.items': remainingItems,
          shrineBoosts: existingBoosts
        }
      }
    );

    endTimer();
    log.info(`${username} activated all 4 boosts with ${itemCount} items each`);

    // Return success response
    return NextResponse.json({
      success: true,
      message: `✅ All 4 boosts activated!`,
      itemsConsumed: totalItemsNeeded,
      results,
    });

  } catch (error) {
    endTimer();
    log.error('Error activating all shrine boosts:', error as Error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      createErrorFromException(error as Error)
    );
  }
}));
