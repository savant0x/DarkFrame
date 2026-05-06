/**
 * API Route: Player Inventory
 * Created: 2025-01-19
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Provides player inventory data including items, resources, and equipment.
 * Returns empty inventory structure if player not found or has no items.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { mapCamelCase } from '@/lib/supabase/mapCamelCase';
import { normalizeItemRow } from '@/lib/itemUtils';
import { withRequestLogging, createRouteLogger } from '@/lib';

export const GET = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('PlayerInventoryAPI');
  const endTimer = log.time('fetchPlayerInventory');
  
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const playerId = auth.playerId;
    log.debug('Fetching player inventory', { playerId });

    const supabase = createServiceClient();
    
    const { data: player } = await supabase
      .from('players')
      .select('inventory_capacity, inventory_metal_digger_count, inventory_energy_digger_count, gathering_metal_bonus, gathering_energy_bonus')
      .eq('username', playerId)
      .maybeSingle();

    if (!player) {
      log.warn('Player not found for inventory', { playerId });
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const { data: inventoryItems } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_username', playerId);

    const mappedItems = inventoryItems?.map(item => {
      const normalized = normalizeItemRow(item);
      return {
        ...mapCamelCase(item),
        name: normalized.name,
        type: item.item_type,
        category: normalized.category,
        description: normalized.description,
        gatheringBonus: normalized.gatheringBonus,
      };
    }) || [];

    const diggers = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    (inventoryItems || []).forEach(row => {
      if (String(row.item_type || '').includes('DIGGER')) {
        const rarity = (String(row.rarity || 'Common')).toLowerCase() as keyof typeof diggers;
        if (rarity in diggers) diggers[rarity]++;
      }
    });

    const { data: activeBoosts } = await supabase
      .from('player_shrine_boosts')
      .select('*')
      .eq('player_username', playerId);

    const inventory = {
      items: mappedItems,
      resources: [],
      equipment: { weapon: null, armor: null, accessory: null },
      capacity: player.inventory_capacity || 100,
      used: (inventoryItems || []).length,
      diggers,
      gatheringBonus: {
        metalBonus: player.gathering_metal_bonus || 0,
        energyBonus: player.gathering_energy_bonus || 0
      },
      activeBoosts: {
        gatheringBoost: (activeBoosts || []).find(() => true) || null,
        expiresAt: null
      },
      metalDiggerCount: player.inventory_metal_digger_count || 0,
      energyDiggerCount: player.inventory_energy_digger_count || 0
    };

    log.debug('Player inventory fetched', { 
      playerId, 
      itemCount: inventory.items.length, 
      resourceCount: inventory.resources.length,
      usedCapacity: inventory.used,
      totalCapacity: inventory.capacity
    });

    return NextResponse.json(inventory);

  } catch (error) {
    log.error('Failed to fetch player inventory', error as Error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  } finally {
    endTimer();
  }
});
