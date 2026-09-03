/**
 * @file app/api/inventory/route.ts
 * @created 2025-10-16
 * @modified 2025-10-23 - Phase 3.1: Applied request logging and performance tracking
 * @overview Player inventory API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { Player } from '@/types';
import { withRequestLogging, createRouteLogger } from '@/lib';

/**
 * GET /api/inventory?username=<username>
 * 
 * Retrieve player's inventory, gathering bonuses, and active boosts
 * 
 * Response:
 * {
 *   success: boolean,
 *   inventory: PlayerInventory,
 *   gatheringBonus: GatheringBonus,
 *   activeBoosts: ActiveBoosts
 * }
 */
export const GET = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('InventoryAPI');
  const endTimer = log.time('inventoryFetch');
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');
    
    if (!username) {
      log.warn('Inventory request missing username');
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }
    
    log.debug('Fetching inventory', { username });
    
    // Get player
    const playersCollection = await getCollection<Player>('players');
    const player = await playersCollection.findOne({ username });
    
    if (!player) {
      log.warn('Player not found for inventory fetch', { username });
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }
    
    const itemCount = player.inventory?.items?.length || 0;
    log.info('Inventory fetched successfully', { username, itemCount });
    
    return NextResponse.json({
      success: true,
      inventory: player.inventory,
      gatheringBonus: player.gatheringBonus,
      activeBoosts: player.activeBoosts
    });
    
  } catch (error) {
    log.error('Inventory API error', error as Error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch inventory',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    endTimer();
  }
});

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Returns full inventory data including items array
// - Includes gathering bonuses and active temporary boosts
// - Used by InventoryPanel component to display items
// ============================================================
// END OF FILE
// ============================================================
