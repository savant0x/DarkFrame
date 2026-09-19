/**
 * app/api/shrine/boost-all/route.ts
 * Created: 2025-01-15
 * Rewritten: 2026-09-18 (FID-20260917-017 slice 4: Mongo shim → direct drizzle/pg)
 *
 * OVERVIEW:
 * API endpoint for activating all 4 shrine boosts simultaneously.
 * Convenience endpoint that activates spade, heart, diamond, and club boosts
 * with the same item count per boost. Validates total item requirement (itemCount × 4).
 * Uses same rarity-based duration calculation as individual activation.
 */

import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { tradeableItems } from '@/lib/inventoryUtils';
import { db } from '@/lib/db/connection';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getPlayer } from '@/lib/playerService';
import type { ShrineBoost, ShrineBoostTier } from '@/types';
import { calculateDuration } from '@/utils/shrineHelpers';
import { assertAtShrine } from '@/lib/shrineServer';
import { awardXP, XPAction } from '@/lib/xpService';
import { trackShrineTrade } from '@/lib/statTrackingService';
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

    // Load the player through the pg domain loader
    const player = await getPlayer(username, { includePrivate: true });

    if (!player) {
      return createErrorResponse(ErrorCode.AUTH_USER_NOT_FOUND, {
        message: 'Player not found'
      });
    }

    // FID-20260917-002: server-side shrine presence — was enforced only by the
    // client's keyboard handler; the API accepted off-shrine calls.
    if (!(await assertAtShrine(player))) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'You must be at the Shrine of Remembrance (1,1) to activate boosts'
      });
    }

    // Get tradeable items from inventory (typed narrowing of the honest union)
    const tradeable = tradeableItems(player.inventory?.items || []);

    // Check if player has enough items
    if (tradeable.length < totalItemsNeeded) {
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        message: `Not enough items. You have ${tradeable.length}, need ${totalItemsNeeded}.`
      });
    }

    // Process each boost tier
    const results = [];
    let itemsConsumedTotal = 0;
    const existingBoosts: ShrineBoost[] = [...(player.shrineBoosts || [])];
    const now = new Date();

    for (const tier of ALL_TIERS) {
      // Get next batch of items for this tier
      const itemsForThisTier = tradeable.slice(itemsConsumedTotal, itemsConsumedTotal + itemCount);

      // Calculate duration based on item rarities
      const durationMinutes = calculateDuration(itemsForThisTier);
      // FID-20260909-028 §2.4 (same NaN conviction as activate): an unknown/legacy
      // rarity here must refuse the whole boost-all batch, not write Invalid Dates.
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: 'Sacrificed items have no valid rarity value. Your inventory contains legacy items that cannot be applied — please contact an admin.'
        });
      }
      const durationMs = durationMinutes * 60 * 1000;

      // Calculate expiration time
      const expiresAt = new Date(now.getTime() + durationMs);
      if (Number.isNaN(expiresAt.getTime())) {
        return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
          message: 'Failed to compute a valid boost expiry'
        });
      }

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
    const itemsToConsume = tradeable.slice(0, totalItemsNeeded);
    const remainingItems = (player.inventory?.items || []).filter(
      (item) => !itemsToConsume.some((consumed) => consumed.id === item.id)
    );

    // Update player in database (one honest UPDATE over the two jsonb columns)
    const updated = await db
      .update(players)
      .set({
        inventoryItems: remainingItems,
        shrineBoosts: existingBoosts,
      })
      .where(eq(players.username, username))
      .returning({ username: players.username });

    if (updated.length === 0) {
      return createErrorResponse(ErrorCode.AUTH_USER_NOT_FOUND, {
        message: 'Player not found'
      });
    }

    // FID-20260917-002: parity with the legacy economy — ONE trade counted and
    // ONE XP award per call (operator ruling, 2026-09-17: one transaction,
    // four suits — not four trades). Bookkeeping failures are logged, never
    // reported as transaction failures: the primary write has already committed.
    let xpAwarded: number | undefined;
    let levelUp = false;
    let newLevel: number | undefined;
    try {
      await trackShrineTrade(username);
      const xpResult = await awardXP(username, XPAction.SHRINE_SACRIFICE);
      xpAwarded = xpResult.xpAwarded;
      levelUp = xpResult.levelUp;
      newLevel = xpResult.newLevel;
    } catch (bookkeepingError) {
      log.warn(
        'Shrine trade bookkeeping failed (primary transaction committed)',
        bookkeepingError instanceof Error ? bookkeepingError : new Error(String(bookkeepingError))
      );
    }

    endTimer();
    log.info(`${username} activated all 4 boosts with ${itemCount} items each`);

    // Return success response
    return NextResponse.json({
      success: true,
      message: `✅ All 4 boosts activated!`,
      itemsConsumed: totalItemsNeeded,
      results,
      // FID-20260917-002: bookkeeping outcomes surfaced when available
      ...(xpAwarded !== undefined ? { xpAwarded, levelUp, newLevel } : {}),
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
