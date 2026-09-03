/**
 * @file app/api/shrine/status/route.ts
 * @created 2025-10-25
 * @overview Shrine status endpoint - returns active buffs and available items
 * 
 * OVERVIEW:
 * GET endpoint that returns:
 * - Active shrine buffs (not expired)
 * - Available sacrificeable items from player inventory
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Player } from '@/types/game.types';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode
} from '@/lib';

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
    // Get username from query params
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username parameter is required');
    }

    const db = await connectToDatabase();
    
    // Get player
    const player = await db.collection<Player>('players').findOne({ username });
    
    if (!player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    // Filter active buffs (expiresAt > now)
    const now = new Date();
    const activeBuffs = (player.shrineBoosts || []).filter((buff: any) => {
      if (!buff.expiresAt) return false;
      const expiresAt = new Date(buff.expiresAt);
      return expiresAt > now;
    });

    // Get available items from inventory that can be sacrificed
    // Items with categories like 'consumable', 'offering', or specific shrine-sacrificeable items
    const inventoryItems = player.inventory?.items || [];
    const availableItems = inventoryItems.filter((item: any) => {
      // Allow consumables and items that can be sacrificed
      // You can adjust this logic based on your game's item categories
      const sacrificeableCategories = ['consumable', 'offering', 'treasure', 'relic'];
      return item.category && sacrificeableCategories.includes(item.category.toLowerCase());
    });

    // If no specific categories exist, allow all inventory items
    // (You can make this more restrictive based on your game design)
    const itemsToReturn = availableItems.length > 0 ? availableItems : inventoryItems;

    log.info('Shrine status retrieved', { 
      username, 
      activeBuffs: activeBuffs.length,
      availableItems: itemsToReturn.length 
    });

    return NextResponse.json({
      success: true,
      activeBuffs,
      availableItems: itemsToReturn
    });

  } catch (error) {
    log.error('Failed to get shrine status', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// ============================================================
