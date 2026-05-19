/**
 * @file app/api/shrine/extend/route.ts
 * @created 2025-10-17
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Shrine boost extension API for adding time to active boosts
 * 
 * OVERVIEW:
 * Allows players to donate items to extend the duration of active shrine boosts.
 * Maximum duration per boost: 8 hours. Item values vary by rarity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import type { Tables } from '@/types/database';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS
} from '@/lib';

type InventoryRow = Tables<'player_inventory'>;
type ShrineBoostRow = Tables<'player_shrine_boosts'>;
type TileRow = Tables<'tiles'>;

const MAX_BOOST_DURATION = 8 * 60 * 60 * 1000;

const ITEM_VALUES: Record<string, number> = {
  'COMMON': 15 * 60 * 1000,
  'UNCOMMON': 30 * 60 * 1000,
  'RARE': 30 * 60 * 1000,
  'EPIC': 60 * 60 * 1000,
  'LEGENDARY': 2 * 60 * 60 * 1000,
};

const logger = createRouteLogger('shrine/extend');
const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.SHRINE_SACRIFICE);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const body = await request.json();
    const { tier, itemCount } = body;

    if (!tier || !['spade', 'heart', 'diamond', 'club'].includes(tier)) {
      return NextResponse.json({ success: false, message: 'Invalid boost tier' }, { status: 400 });
    }

    if (typeof itemCount !== 'number' || itemCount <= 0 || !Number.isInteger(itemCount)) {
      return NextResponse.json({ success: false, message: 'Item count must be a positive integer' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get player
    const { data: player } = await supabase
      .from('players')
      .select('current_x, current_y')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ success: false, message: 'Player not found' }, { status: 404 });
    }

    // Check if player is at the Shrine
    const { data: currentTile } = await supabase
      .from('tiles')
      .select('terrain')
      .eq('x', player.current_x)
      .eq('y', player.current_y)
      .maybeSingle();

    if (!currentTile || currentTile.terrain !== 'Shrine') {
      return NextResponse.json({ success: false, message: 'You must be at the Shrine of Remembrance (1,1) to extend boosts' }, { status: 400 });
    }

    // Get active boosts
    const { data: activeBoosts } = await supabase
      .from('player_shrine_boosts')
      .select('*')
      .eq('player_username', username);

    if (!activeBoosts || activeBoosts.length === 0) {
      return NextResponse.json({ success: false, message: 'No active boosts to extend' }, { status: 400 });
    }

    const boost = activeBoosts.find(b => b.boost_tier === tier);
    if (!boost) {
      return NextResponse.json({
        success: false,
        message: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier boost is not active`
      }, { status: 400 });
    }

    // Count tradeable items
    const { data: tradeableItems } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_username', username)
      .eq('item_type', 'TRADEABLE_ITEM');

    const items = tradeableItems || [];

    if (items.length < itemCount) {
      return NextResponse.json({
        success: false,
        message: `Insufficient items. Need ${itemCount}, have ${items.length}`
      }, { status: 400 });
    }

    // Calculate time extension based on item rarities
    const itemsToSacrifice = items.slice(0, itemCount);
    let totalTimeAdded = 0;

    itemsToSacrifice.forEach(item => {
      const timeValue = ITEM_VALUES[item.rarity] || ITEM_VALUES['COMMON'];
      totalTimeAdded += timeValue;
    });

    const currentExpiry = new Date(boost.expires_at).getTime();
    const now = Date.now();
    const remainingTime = Math.max(0, currentExpiry - now);

    const maxAllowedExpiry = now + MAX_BOOST_DURATION;
    const newExpiry = Math.min(currentExpiry + totalTimeAdded, maxAllowedExpiry);
    const actualTimeAdded = newExpiry - currentExpiry;

    if (actualTimeAdded <= 0) {
      return NextResponse.json({
        success: false,
        message: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier boost is already at maximum duration (8 hours)`
      }, { status: 400 });
    }

    // Remove sacrificed items
    const consumedIds = itemsToSacrifice.map(i => i.id);
    await supabase
      .from('player_inventory')
      .delete()
      .in('id', consumedIds);

    // Update boost expiry
    await supabase
      .from('player_shrine_boosts')
      .update({ expires_at: new Date(newExpiry).toISOString() })
      .eq('id', boost.id);

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
      newDuration: durationDisplay,
      itemsUsed: itemCount,
      itemsRemaining: items.length - itemCount
    });

  } catch (error) {
    logger.error('Shrine extend error:', error);
    return NextResponse.json({ success: false, message: 'Failed to extend boost' }, { status: 500 });
  }
}));
