import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { withRequestLogging, createRouteLogger, createRateLimiter, ENDPOINT_RATE_LIMITS, createErrorResponse, ErrorCode } from '@/lib';

const SACRIFICE_CAP = 100; // 100% max bonus per type

export const POST = withRequestLogging(createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD)(async (request: NextRequest) => {
  const log = createRouteLogger('SacrificeDigger');
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const body = await request.json();
    const { itemId } = body as { itemId?: string };
    if (!itemId) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'itemId is required');

    const supabase = createServiceClient();

    // Get the item from inventory
    const { data: item } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_username', username)
      .eq('item_id', itemId)
      .maybeSingle();

    if (!item) return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Item not found in inventory');

    // Only diggers can be sacrificed
    const validTypes = ['METAL_DIGGER', 'ENERGY_DIGGER', 'UNIVERSAL_DIGGER'];
    if (!validTypes.includes(String(item.item_type))) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Only diggers can be sacrificed');
    }

    // Get current sacrificed bonus (handle both old and new schema)
    const { data: player } = await supabase
      .from('players')
      .select('sacrificed_metal_bonus, sacrificed_energy_bonus, sacrificed_digger_count')
      .eq('username', username)
      .maybeSingle();

    if (!player) return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');

    // Calculate sacrifice values based on rarity
    const rarity = String(item.rarity || 'COMMON').toUpperCase();
    let metalBonus = 0;
    let energyBonus = 0;
    switch (rarity) {
      case 'COMMON': metalBonus = 0.5; energyBonus = 0.5; break;
      case 'UNCOMMON': metalBonus = 1.5; energyBonus = 1.5; break;
      case 'RARE': metalBonus = 4.0; energyBonus = 4.0; break;
      case 'EPIC': metalBonus = 10.0; energyBonus = 10.0; break;
      case 'LEGENDARY': metalBonus = 25.0; energyBonus = 25.0; break;
    }

    // Apply type-specific bonuses
    const itemType = String(item.item_type);
    if (itemType === 'METAL_DIGGER') { energyBonus = 0; }
    else if (itemType === 'ENERGY_DIGGER') { metalBonus = 0; }
    else if (itemType === 'UNIVERSAL_DIGGER') {
      metalBonus /= 2;
      energyBonus /= 2;
    }

    // Apply cap
    const currentMetal = Number(player.sacrificed_metal_bonus) || 0;
    const currentEnergy = Number(player.sacrificed_energy_bonus) || 0;
    const newMetal = Math.min(SACRIFICE_CAP, currentMetal + metalBonus);
    const newEnergy = Math.min(SACRIFICE_CAP, currentEnergy + energyBonus);
    const actualMetalAdded = newMetal - currentMetal;
    const actualEnergyAdded = newEnergy - currentEnergy;

    // Remove item from inventory
    await supabase.from('player_inventory').delete().eq('player_username', username).eq('item_id', itemId);

    // Update player's sacrificed bonus
    await supabase.from('players').update({
      sacrificed_metal_bonus: newMetal,
      sacrificed_energy_bonus: newEnergy,
      sacrificed_digger_count: (player.sacrificed_digger_count || 0) + 1,
    }).eq('username', username);

    log.info('Digger sacrificed', { username, item: item.name, rarity, metalAdded: actualMetalAdded, energyAdded: actualEnergyAdded });

    return NextResponse.json({
      success: true,
      data: {
        metalBonusAdded: actualMetalAdded,
        energyBonusAdded: actualEnergyAdded,
        totalMetalBonus: newMetal,
        totalEnergyBonus: newEnergy,
        diggersSacrificed: (player.sacrificed_digger_count || 0) + 1,
        capped: newMetal >= SACRIFICE_CAP || newEnergy >= SACRIFICE_CAP,
      },
    });
  } catch (error) {
    log.error('Sacrifice failed', error as Error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Sacrifice failed');
  }
}));
