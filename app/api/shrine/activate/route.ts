/**
 * app/api/shrine/activate/route.ts
 * Created: 2025-01-15
 * 
 * OVERVIEW:
 * API endpoint for activating individual shrine boosts with direct time purchase system.
 * Players sacrifice tradeable items to purchase buff duration based on item rarity.
 * Duration calculated from item rarity values (Common=15min, Legendary=2hr), capped at 8hr max.
 * Replaces old activation/extension model with direct purchase model.
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

// Boost configuration (matches client-side BOOST_CONFIGS)
const BOOST_CONFIGS: Record<ShrineBoostTier, { yieldBonus: number }> = {
  spade: { yieldBonus: 0.25 },
  heart: { yieldBonus: 0.25 },
  diamond: { yieldBonus: 0.25 },
  club: { yieldBonus: 0.25 },
};

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.SHRINE_SACRIFICE);

/**
 * POST /api/shrine/activate
 * 
 * Activate individual shrine boost with direct time purchase
 */
export const POST = withRequestLogging(rateLimiter(async (request: Request) => {
  const log = createRouteLogger('ShrineActivateAPI');
  const endTimer = log.time('shrineActivate');

  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      log.warn('Unauthenticated shrine activate attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required'
      });
    }

    const username = authResult.username;

    // Parse request body
    const { tier, itemCount } = await request.json();

    // Validate inputs
    if (!tier || !BOOST_CONFIGS[tier as ShrineBoostTier]) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Invalid boost tier'
      });
    }

    if (!itemCount || itemCount <= 0 || !Number.isInteger(itemCount)) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Item count must be a positive integer'
      });
    }

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
    if (tradeableItems.length < itemCount) {
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        message: `Not enough items. You have ${tradeableItems.length}, need ${itemCount}.`
      });
    }

    // Calculate duration based on item rarities
    const itemsToConsume = tradeableItems.slice(0, itemCount);
    const durationMinutes = calculateDuration(itemsToConsume);
    const durationMs = durationMinutes * 60 * 1000;
    
    // Calculate expiration time
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMs);

    // Check if boost already exists
    const existingBoosts = player.shrineBoosts || [];
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
        tier: tier as ShrineBoostTier,
        yieldBonus: BOOST_CONFIGS[tier as ShrineBoostTier].yieldBonus,
        expiresAt: finalExpiresAt
      });
    }

    // Remove consumed items from inventory
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
    log.info(`${username} ${existingBoostIndex >= 0 ? 'extended' : 'activated'} ${tier} boost with ${itemCount} items`);

    // Return success response
    return NextResponse.json({
      success: true,
      message: `✅ ${tier} boost ${existingBoostIndex >= 0 ? 'extended' : 'activated'}!`,
      itemsConsumed: itemCount,
      durationMinutes,
      expiresAt: finalExpiresAt,
    });

  } catch (error) {
    endTimer();
    log.error('Error activating shrine boost:', error as Error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      createErrorFromException(error as Error)
    );
  }
}));

/**
 * IMPLEMENTATION NOTES:
 * - Uses shrineHelpers.calculateDuration() for rarity-based time calculation
 * - Automatically caps total duration at 8 hours (480 minutes)
 * - Extends existing boosts by adding new duration to remaining time
 * - Consumes items immediately upon activation (no refunds)
 * - Returns detailed response with duration and expiration info
 * 
 * FUTURE CONSIDERATIONS:
 * - Add transaction logging for item consumption tracking
 * - Consider adding cooldowns or rate limiting
 * - Potentially add achievement tracking for shrine usage
 */
