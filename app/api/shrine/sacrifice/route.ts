/**
 * @file app/api/shrine/sacrifice/route.ts
 * @created 2025-10-17
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Shrine sacrifice API for activating resource yield boosts
 * 
 * OVERVIEW:
 * Handles item sacrifice at Shrine of Remembrance to activate resource gathering
 * yield boosts. Players can have up to 4 simultaneous boosts active (one per tier).
 * Each boost adds +25% resource yield. All boosts increase QUANTITY gathered, not speed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import type { Tables, TablesInsert } from '@/types/database';
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

type PlayerRow = Tables<'players'>;
type InventoryRow = Tables<'player_inventory'>;
type ShrineBoostRow = Tables<'player_shrine_boosts'>;
type TileRow = Tables<'tiles'>;

const BOOST_TIERS: Record<string, { itemCost: number; duration: number; yieldBonus: number }> = {
  spade: { itemCost: 3, duration: 1 * 60 * 60 * 1000, yieldBonus: 0.25 },
  heart: { itemCost: 10, duration: 1 * 60 * 60 * 1000, yieldBonus: 0.25 },
  diamond: { itemCost: 30, duration: 4 * 60 * 60 * 1000, yieldBonus: 0.25 },
  club: { itemCost: 60, duration: 8 * 60 * 60 * 1000, yieldBonus: 0.25 },
};

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.SHRINE_SACRIFICE);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('ShrineSacrificeAPI');
  const endTimer = log.time('shrineSacrifice');

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const body = await request.json();
    const validated = ShrineSacrificeSchema.parse(body);

    log.debug('Shrine sacrifice request', { username, tier: validated.tier });

    const boostConfig = BOOST_TIERS[validated.tier];
    if (!boostConfig) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Invalid boost tier' });
    }

    const supabase = createServiceClient();

    // Get player
    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Player not found' });
    }

    // Check if player is at the Shrine
    const { data: currentTile } = await supabase
      .from('tiles')
      .select('terrain')
      .eq('x', player.current_x)
      .eq('y', player.current_y)
      .maybeSingle();

    if (!currentTile || currentTile.terrain !== 'Shrine') {
      log.debug('Player not at shrine', { username, position: { x: player.current_x, y: player.current_y } });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'You must be at the Shrine of Remembrance (1,1) to activate boosts'
      });
    }

    // Count tradeable items
    const { data: tradeableItems } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_username', username)
      .eq('item_type', 'TRADEABLE_ITEM');

    const items = tradeableItems || [];

    if (items.length < boostConfig.itemCost) {
      log.debug('Insufficient items for sacrifice', { username, required: boostConfig.itemCost, available: items.length });
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        message: `Insufficient items. Need ${boostConfig.itemCost} tradeable items, have ${items.length}`
      });
    }

    // Check if this tier boost is already active
    const { data: activeBoosts } = await supabase
      .from('player_shrine_boosts')
      .select('*')
      .eq('player_username', username);

    const existingBoost = (activeBoosts || []).find(b => b.boost_tier === validated.tier);
    if (existingBoost) {
      log.debug('Boost already active', { username, tier: validated.tier });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: `${validated.tier.charAt(0).toUpperCase() + validated.tier.slice(1)} Tier boost is already active. Use /api/shrine/extend to extend its duration.`
      });
    }

    // Consume items (delete the first N tradeable items)
    const itemsToConsume = items.slice(0, boostConfig.itemCost);
    const consumedIds = itemsToConsume.map(i => i.id);
    await supabase
      .from('player_inventory')
      .delete()
      .in('id', consumedIds);

    // Create new boost
    await supabase
      .from('player_shrine_boosts')
      .insert({
        player_username: username,
        boost_tier: validated.tier as TablesInsert<'player_shrine_boosts'>['boost_tier'],
        expires_at: new Date(Date.now() + boostConfig.duration).toISOString(),
        yield_bonus: boostConfig.yieldBonus,
      });

    // Calculate total yield bonus
    const updatedBoosts = await supabase
      .from('player_shrine_boosts')
      .select('yield_bonus')
      .eq('player_username', username);

    const totalYieldBonus = (updatedBoosts?.data || []).reduce((sum: number, b) => sum + (b.yield_bonus || 0), 0);

    const tierName = validated.tier.charAt(0).toUpperCase() + validated.tier.slice(1);
    const durationHours = boostConfig.duration / (60 * 60 * 1000);

    // Track shrine trade for achievements
    await trackShrineTrade(username);

    // Award XP for shrine sacrifice
    const xpResult = await awardXP(username, XPAction.SHRINE_SACRIFICE);

    log.info('Shrine boost activated', { username, tier: validated.tier, duration: durationHours, itemsConsumed: boostConfig.itemCost, xpAwarded: xpResult.xpAwarded });

    return NextResponse.json({
      success: true,
      message: `Activated ${tierName} Tier boost! +25% resource yield for ${durationHours} hour${durationHours > 1 ? 's' : ''}`,
      shrineBoosts: updatedBoosts?.data || [],
      totalYieldBonus,
      totalYieldMultiplier: 1.0 + totalYieldBonus,
      itemsRemaining: items.length - boostConfig.itemCost,
      activeBoostsCount: (updatedBoosts?.data || []).length,
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
