/**
 * @file app/api/shrine/sacrifice/route.ts
 * @created 2025-10-17
 * @overview Shrine sacrifice API for activating resource yield boosts
 * 
 * OVERVIEW:
 * Handles item sacrifice at Shrine of Remembrance to activate resource gathering
 * yield boosts. Players can have up to 4 simultaneous boosts active (one per tier).
 * Each boost adds +25% resource yield. All boosts increase QUANTITY gathered, not speed.
 */

import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { getCollection } from '@/lib/mongodb';
import { Player, Tile, TerrainType, ShrineBoost, ShrineBoostTier, ItemType } from '@/types';
import { awardXP, XPAction } from '@/lib/xpService';
import { trackShrineTrade } from '@/lib/statTrackingService';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  ShrineSacrificeSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

/**
 * Boost tier configurations
 * All boosts provide +25% resource yield
 * Differences are in cost and duration only
 */
const BOOST_TIERS = {
  spade: {
    itemCost: 3,
    duration: 1 * 60 * 60 * 1000, // 1 hour in milliseconds
    yieldBonus: 0.25 // +25%
  },
  heart: {
    itemCost: 10,
    duration: 1 * 60 * 60 * 1000, // 1 hour in milliseconds
    yieldBonus: 0.25 // +25%
  },
  diamond: {
    itemCost: 30,
    duration: 4 * 60 * 60 * 1000, // 4 hours in milliseconds
    yieldBonus: 0.25 // +25%
  },
  club: {
    itemCost: 60,
    duration: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
    yieldBonus: 0.25 // +25%
  }
};

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.SHRINE_SACRIFICE);

/**
 * POST /api/shrine/sacrifice
 * 
 * Sacrifice items to activate a shrine boost
 */
export const POST = withRequestLogging(rateLimiter(async (request: Request) => {
  const log = createRouteLogger('ShrineSacrificeAPI');
  const endTimer = log.time('shrineSacrifice');

  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      log.warn('Unauthenticated shrine sacrifice attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required'
      });
    }

    const username = authResult.username;

    // Parse and validate request body
    const body = await request.json();
    const validated = ShrineSacrificeSchema.parse(body);

    log.debug('Shrine sacrifice request', { username, tier: validated.tier });

    const boostConfig = BOOST_TIERS[validated.tier as ShrineBoostTier];

    // Get player
    const playersCollection = await getCollection<Player>('players');
    const player = await playersCollection.findOne({ username });

    if (!player) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Player not found'
      });
    }

    // Check if player is at the Shrine
    const tilesCollection = await getCollection<Tile>('tiles');
    const currentTile = await tilesCollection.findOne({
      x: player.currentPosition.x,
      y: player.currentPosition.y
    });

    if (!currentTile || currentTile.terrain !== TerrainType.Shrine) {
      log.debug('Player not at shrine', { 
        username, 
        position: player.currentPosition 
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'You must be at the Shrine of Remembrance (1,1) to activate boosts'
      });
    }

    // Count tradeable items (any cave items except diggers can be sacrificed)
    const tradeableItems = player.inventory.items.filter((item) => item.type === ItemType.TradeableItem
    );

    if (tradeableItems.length < boostConfig.itemCost) {
      log.debug('Insufficient items for sacrifice', { 
        username, 
        required: boostConfig.itemCost, 
        available: tradeableItems.length 
      });
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        message: `Insufficient items. Need ${boostConfig.itemCost} tradeable items, have ${tradeableItems.length}`
      });
    }

    // Initialize shrineBoosts if it doesn't exist
    if (!player.shrineBoosts) {
      player.shrineBoosts = [];
    }

    // Check if this tier boost is already active
    const existingBoostIndex = player.shrineBoosts.findIndex((b) => b.tier === validated.tier);
    if (existingBoostIndex !== -1) {
      log.debug('Boost already active', { username, tier: validated.tier });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: `${validated.tier.charAt(0).toUpperCase() + validated.tier.slice(1)} Tier boost is already active. Use /api/shrine/extend to extend its duration.`
      });
    }

    // Remove the required number of items (consume them)
    const remainingItems = player.inventory.items.filter((item) => item.type !== ItemType.TradeableItem
    );
    const itemsToKeep = tradeableItems.slice(boostConfig.itemCost);
    const newInventory = [...remainingItems, ...itemsToKeep];

    // Create new boost
    const newBoost: ShrineBoost = {
      tier: validated.tier as ShrineBoostTier,
      expiresAt: new Date(Date.now() + boostConfig.duration),
      yieldBonus: boostConfig.yieldBonus
    };

    // Add boost to player's active boosts
    const updatedBoosts = [...player.shrineBoosts, newBoost];

    // Calculate total yield bonus
    const totalYieldBonus = updatedBoosts.reduce((sum, boost) => sum + boost.yieldBonus, 0);

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

    const tierName = validated.tier.charAt(0).toUpperCase() + validated.tier.slice(1);
    const durationHours = boostConfig.duration / (60 * 60 * 1000);

    // Track shrine trade for achievements
    await trackShrineTrade(username);

    // Award XP for shrine sacrifice
    const xpResult = await awardXP(username, XPAction.SHRINE_SACRIFICE);

    log.info('Shrine boost activated', { 
      username, 
      tier: validated.tier, 
      duration: durationHours,
      itemsConsumed: boostConfig.itemCost,
      xpAwarded: xpResult.xpAwarded
    });

    return NextResponse.json({
      success: true,
      message: `Activated ${tierName} Tier boost! +25% resource yield for ${durationHours} hour${durationHours > 1 ? 's' : ''}`,
      shrineBoosts: updatedBoosts,
      totalYieldBonus,
      totalYieldMultiplier: 1.0 + totalYieldBonus,
      itemsRemaining: newInventory.length,
      activeBoostsCount: updatedBoosts.length,
      xpAwarded: xpResult.xpAwarded,
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel
    });

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Shrine sacrifice validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Shrine sacrifice error', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
