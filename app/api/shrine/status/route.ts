/**
 * @file app/api/shrine/status/route.ts
 * @created 2025-10-25
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Shrine status endpoint - returns active buffs and available items
 * 
 * OVERVIEW:
 * GET endpoint that returns:
 * - Active shrine buffs (not expired)
 * - Available sacrificeable items from player inventory
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import type { Tables } from '@/types/database';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode
} from '@/lib';

type PlayerRow = Tables<'players'>;
type ShrineBoostRow = Tables<'player_shrine_boosts'>;
type InventoryRow = Tables<'player_inventory'>;

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/shrine/status?username=Commander42
 * 
 * Get shrine status: active buffs and available items for sacrifice
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('shrine-status');
  const endTimer = log.time('shrine-status');

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const supabase = createServiceClient();
    
    // Get player
    const { data: player } = await supabase
      .from('players')
      .select('username')
      .eq('username', username)
      .maybeSingle();
    
    if (!player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    // Filter active buffs (expires_at > now)
    const now = new Date().toISOString();
    const { data: activeBuffs } = await supabase
      .from('player_shrine_boosts')
      .select('*')
      .eq('player_username', username)
      .gt('expires_at', now);

    // Get available items from inventory that can be sacrificed
    const sacrificeableTypes = ['TRADEABLE_ITEM'];
    const { data: inventoryItems } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_username', username);

    const availableItems = (inventoryItems || []).filter(
      (item: InventoryRow) => sacrificeableTypes.includes(item.item_type)
    );

    log.info('Shrine status retrieved', { 
      username, 
      activeBuffs: activeBuffs?.length || 0,
      availableItems: availableItems.length 
    });

    return NextResponse.json({
      success: true,
      activeBuffs: activeBuffs || [],
      availableItems
    });

  } catch (error) {
    log.error('Failed to get shrine status', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
