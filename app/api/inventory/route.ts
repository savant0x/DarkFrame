/**
 * @file app/api/inventory/route.ts
 * @created 2025-10-16
 * @updated 2026-05-05 — normalizeItemRow, digger breakdown by rarity, category fields
 * @overview Player inventory API endpoint
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { normalizeItemRow } from '@/lib/itemUtils';
import { withRequestLogging, createRouteLogger } from '@/lib';

export const GET = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('InventoryAPI');
  const endTimer = log.time('inventoryFetch');

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    log.debug('Fetching inventory', { username });

    const supabase = createServiceClient();

    const { data: player } = await supabase
      .from('players')
      .select('gathering_energy_bonus, gathering_metal_bonus, inventory_capacity')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      log.warn('Player not found for inventory fetch', { username });
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const { data: inventory } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_username', username);

    const { data: activeBoosts } = await supabase
      .from('player_shrine_boosts')
      .select('*')
      .eq('player_username', username);

    const rawItems = inventory || [];
    const items = rawItems.map(row => normalizeItemRow(row));

    const diggers = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    rawItems.forEach(row => {
      if (String(row.item_type || '').includes('DIGGER')) {
        const rarity = (String(row.rarity || 'Common')).toLowerCase() as keyof typeof diggers;
        if (rarity in diggers) diggers[rarity]++;
      }
    });

    const itemCount = items.length;
    log.info('Inventory fetched successfully', { username, itemCount });

    return NextResponse.json({
      success: true,
      inventory: {
        items,
        capacity: player.inventory_capacity || 2000,
        usedSlots: itemCount,
        diggers,
      },
      gatheringBonus: {
        metal: player.gathering_metal_bonus || 0,
        energy: player.gathering_energy_bonus || 0,
      },
      activeBoosts: activeBoosts || [],
    });

  } catch (error) {
    log.error('Inventory API error', error as Error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch inventory',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    endTimer();
  }
});
