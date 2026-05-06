/**
 * app/api/shrine/boost-all/route.ts
 * Created: 2025-01-15
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * API endpoint for activating all 4 shrine boosts simultaneously.
 * Convenience endpoint that activates spade, heart, diamond, and club boosts
 * with the same item count per boost. Validates total item requirement (itemCount × 4).
 * Uses same rarity-based duration calculation as individual activation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import type { Tables, TablesInsert } from '@/types/database';
import { ItemRarity } from '@/types';
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

type InventoryRow = Tables<'player_inventory'>;
type ShrineBoostRow = Tables<'player_shrine_boosts'>;

const ALL_TIERS = ['spade', 'heart', 'diamond', 'club'] as const;

const BOOST_CONFIGS: Record<string, { yieldBonus: number }> = {
  spade: { yieldBonus: 0.25 },
  heart: { yieldBonus: 0.25 },
  diamond: { yieldBonus: 0.25 },
  club: { yieldBonus: 0.25 },
};

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.SHRINE_SACRIFICE);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('ShrineBoostAllAPI');
  const endTimer = log.time('shrineBoostAll');

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const body = await request.json();
    const { itemCount } = body;

    if (!itemCount || itemCount <= 0 || !Number.isInteger(itemCount)) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Item count must be a positive integer' });
    }

    const totalItemsNeeded = itemCount * 4;
    const supabase = createServiceClient();

    // Get player
    const { data: player } = await supabase
      .from('players')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      return createErrorResponse(ErrorCode.AUTH_USER_NOT_FOUND, { message: 'Player not found' });
    }

    // Get tradeable items from inventory
    const { data: tradeableItems } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_username', username)
      .eq('item_type', 'TRADEABLE_ITEM');

    const items = tradeableItems || [];

    if (items.length < totalItemsNeeded) {
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        message: `Not enough items. You have ${items.length}, need ${totalItemsNeeded}.`
      });
    }

    // Get existing boosts
    const { data: existingBoosts } = await supabase
      .from('player_shrine_boosts')
      .select('*')
      .eq('player_username', username);

    const results = [];
    const consumedIds: string[] = [];
    const now = new Date();

    for (let tierIdx = 0; tierIdx < ALL_TIERS.length; tierIdx++) {
      const tier = ALL_TIERS[tierIdx];
      const itemsForThisTier = items.slice(tierIdx * itemCount, (tierIdx + 1) * itemCount);

      const durationMinutes = calculateDuration(itemsForThisTier.map(i => ({
        rarity: i.rarity as unknown as ItemRarity,
        type: i.item_type,
        id: i.item_id,
        name: i.name,
      })));
      const durationMs = durationMinutes * 60 * 1000;
      const expiresAt = new Date(now.getTime() + durationMs);

      const existingBoost = (existingBoosts || []).find(b => b.boost_tier === tier);
      let finalExpiresAt = expiresAt;

      if (existingBoost) {
        const currentExpiry = new Date(existingBoost.expires_at);
        const timeRemaining = Math.max(0, currentExpiry.getTime() - now.getTime());
        const newDuration = timeRemaining + durationMs;
        const MAX_DURATION_MS = 8 * 60 * 60 * 1000;
        const finalDuration = Math.min(newDuration, MAX_DURATION_MS);
        finalExpiresAt = new Date(now.getTime() + finalDuration);

        await supabase
          .from('player_shrine_boosts')
          .update({ expires_at: finalExpiresAt.toISOString(), yield_bonus: BOOST_CONFIGS[tier].yieldBonus })
          .eq('id', existingBoost.id);
      } else {
        await supabase
          .from('player_shrine_boosts')
          .insert({
            player_username: username,
            boost_tier: tier as TablesInsert<'player_shrine_boosts'>['boost_tier'],
            yield_bonus: BOOST_CONFIGS[tier].yieldBonus,
            expires_at: finalExpiresAt.toISOString(),
          });
      }

      results.push({ tier, durationMinutes, expiresAt: finalExpiresAt });
      consumedIds.push(...itemsForThisTier.map(i => i.id));
    }

    // Remove all consumed items from inventory
    if (consumedIds.length > 0) {
      await supabase
        .from('player_inventory')
        .delete()
        .in('id', consumedIds);
    }

    endTimer();
    log.info(`${username} activated all 4 boosts with ${itemCount} items each`);

    return NextResponse.json({
      success: true,
      message: `✅ All 4 boosts activated!`,
      itemsConsumed: totalItemsNeeded,
      results,
    });

  } catch (error) {
    endTimer();
    log.error('Error activating all shrine boosts:', error as Error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, createErrorFromException(error as Error));
  }
}));
