import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { normalizeItemRow } from '@/lib/itemUtils';
import { withRequestLogging, createRouteLogger } from '@/lib';
import type { InventoryPayload } from '@/types/api-responses';

export const GET = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('PlayerInventory');
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const supabase = createServiceClient();

    const { data: player } = await supabase
      .from('players')
      .select('inventory_capacity, sacrificed_metal_bonus, sacrificed_energy_bonus, sacrificed_digger_count, gathering_metal_bonus, gathering_energy_bonus')
      .eq('username', username)
      .maybeSingle();

    if (!player) return NextResponse.json({ success: false as const, error: 'Player not found' }, { status: 404 });

    const { data: inventoryItems } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_username', username);

    const items = (inventoryItems || []).map((item: Record<string, unknown>) => {
      const normalized = normalizeItemRow(item);
      const rawType = String(item.item_type || '');
      const isDigger = rawType.includes('DIGGER');
      // Calculate sacrifice value from rarity
      const rarity = String(item.rarity || 'COMMON').toUpperCase();
      let sacrificeMetal = 0;
      let sacrificeEnergy = 0;
      if (isDigger) {
        const val = getSacrificeValue(rarity);
        if (rawType === 'METAL_DIGGER') { sacrificeMetal = val; }
        else if (rawType === 'ENERGY_DIGGER') { sacrificeEnergy = val; }
        else if (rawType === 'UNIVERSAL_DIGGER') { sacrificeMetal = val / 2; sacrificeEnergy = val / 2; }
      }
      return {
        id: String(item.id || ''),
        name: normalized.name,
        type: rawType,
        category: normalized.category,
        rarity,
        description: normalized.description,
        quantity: Number(item.quantity) || 1,
        gatheringBonus: sacrificeMetal + sacrificeEnergy,
        bonusType: rawType === 'METAL_DIGGER' ? 'metal' as const
          : rawType === 'ENERGY_DIGGER' ? 'energy' as const
          : rawType === 'UNIVERSAL_DIGGER' ? 'universal' as const
          : 'none' as const,
        foundAt: (item.found_at_x != null && item.found_at_y != null)
          ? { x: Number(item.found_at_x), y: Number(item.found_at_y) }
          : null,
        foundDate: String(item.found_date || ''),
      };
    });

    const diggers = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    (inventoryItems || []).forEach((row: Record<string, unknown>) => {
      if (String(row.item_type || '').includes('DIGGER')) {
        const rarity = String(row.rarity || 'Common').toLowerCase() as keyof typeof diggers;
        if (rarity in diggers) diggers[rarity]++;
      }
    });

    const activeShrineBoosts: InventoryPayload['activeShrineBoosts'] = [];
    try {
      const { data: boosts } = await supabase
        .from('player_shrine_boosts')
        .select('*')
        .eq('player_username', username)
        .gt('expires_at', new Date().toISOString());
      if (boosts) {
        for (const b of boosts) {
          const row = b as Record<string, unknown>;
          activeShrineBoosts.push({
            tier: String(row.boost_tier || row.tier || ''),
            expiresAt: String(row.expires_at || ''),
            yieldBonus: Number(row.yield_bonus) || 0,
          });
        }
      }
    } catch { /* non-critical */ }

    const data: InventoryPayload = {
      items,
      capacity: player.inventory_capacity || 2000,
      used: (inventoryItems || []).length,
      gatheringBonus: {
        metalBonus: Number(player.sacrificed_metal_bonus ?? player.gathering_metal_bonus ?? 0),
        energyBonus: Number(player.sacrificed_energy_bonus ?? player.gathering_energy_bonus ?? 0),
      },
      diggers,
      activeShrineBoosts,
    };

    return NextResponse.json({ success: true as const, data });
  } catch (error) {
    log.error('Failed to fetch inventory', error as Error);
    return NextResponse.json({ success: false as const, error: 'Failed to fetch inventory' }, { status: 500 });
  }
});

function getSacrificeValue(rarity: string): number {
  switch (rarity) {
    case 'COMMON': return 0.5;
    case 'UNCOMMON': return 1.5;
    case 'RARE': return 4.0;
    case 'EPIC': return 10.0;
    case 'LEGENDARY': return 25.0;
    default: return 0.5;
  }
}
