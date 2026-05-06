/**
 * @file app/api/factory/build-unit/route.ts
 * @created 2025-10-17
 * @overview API endpoint for building units at factories
 * 
 * OVERVIEW:
 * Allows players to build military units at factories they own. Validates resource costs,
 * applies slot regeneration, consumes factory slots, creates unit, and updates player
 * totals for STR/DEF tracking.
 * 
 * UNIT TYPES:
 * - Rifleman: 200M/100E, STR 5
 * - Scout: 150M/150E, STR 3
 * - Bunker: 200M/100E, DEF 5
 * - Barrier: 150M/150E, DEF 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { UnitType, UNIT_CONFIGS, Factory } from '@/types';
import { applySlotRegeneration, hasEnoughSlots, consumeSlots } from '@/lib/slotRegenService';
import { awardXP, XPAction } from '@/lib/xpService';
import { trackUnitBuilt } from '@/lib/statTrackingService';
import { withRequestLogging, createRouteLogger } from '@/lib';

interface BuildUnitRequest {
  factoryX: number;
  factoryY: number;
  unitType: UnitType;
  quantity?: number;
}

/**
 * POST /api/factory/build-unit
 * Build military units at a factory
 * 
 * @body factoryX - Factory X coordinate
 * @body factoryY - Factory Y coordinate
 * @body unitType - Type of unit to build (RIFLEMAN/SCOUT/BUNKER/BARRIER)
 * @body quantity - Number of units to build (optional, default: 1)
 */
export const POST = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('FactoryBuildUnitAPI');
  const endTimer = log.time('buildFactoryUnit');
  
  try {
    // 1. Verify authentication
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('darkframe_session');
    
    if (!sessionCookie) {
      log.warn('Unauthenticated factory build attempt');
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const username = sessionCookie.value;

    // 2. Parse request body
    const body: BuildUnitRequest = await request.json();
    const { factoryX, factoryY, unitType, quantity = 1 } = body;

    log.debug('Factory unit build request', { username, factoryX, factoryY, unitType, quantity });

    // 3. Validate inputs
    if (factoryX == null || factoryY == null || !unitType) {
      log.warn('Missing required fields', { username, factoryX, factoryY, unitType });
      return NextResponse.json(
        { success: false, message: 'Missing required fields: factoryX, factoryY, unitType' },
        { status: 400 }
      );
    }

    if (!Object.values(UnitType).includes(unitType)) {
      log.warn('Invalid unit type', { username, unitType });
      return NextResponse.json(
        { success: false, message: `Invalid unit type. Must be one of: ${Object.values(UnitType).join(', ')}` },
        { status: 400 }
      );
    }

    if (quantity < 1 || quantity > 100) {
      log.warn('Invalid quantity', { username, quantity });
      return NextResponse.json(
        { success: false, message: 'Quantity must be between 1 and 100' },
        { status: 400 }
      );
    }

    // 4. Get unit configuration
    const unitConfig = UNIT_CONFIGS[unitType];
    const totalMetalCost = unitConfig.metalCost * quantity;
    const totalEnergyCost = unitConfig.energyCost * quantity;
    const totalSlotCost = unitConfig.slotCost * quantity;

    // 5. Connect to database
    const supabase = createServiceClient();

    // 6. Get factory data
    const { data: factory, error: factoryError } = await supabase
      .from('factories')
      .select('*')
      .eq('x', factoryX)
      .eq('y', factoryY)
      .single();

    if (factoryError || !factory) {
      log.warn('Factory not found', { username, factoryX, factoryY });
      return NextResponse.json(
        { success: false, message: 'Factory not found at specified coordinates' },
        { status: 404 }
      );
    }

    // 7. Verify ownership
    if (factory.owner !== username) {
      log.warn('Factory ownership violation', { username, factoryOwner: factory.owner, factoryX, factoryY });
      return NextResponse.json(
        { success: false, message: 'You do not own this factory' },
        { status: 403 }
      );
    }

    // Map factory to expected format for slot regen functions
    const mappedFactory: Factory = {
      x: factory.x,
      y: factory.y,
      owner: factory.owner,
      defense: factory.defense,
      level: factory.level,
      slots: factory.slots,
      usedSlots: factory.used_slots,
      productionRate: factory.production_rate,
      lastSlotRegen: new Date(factory.last_slot_regen),
      lastResourceGeneration: new Date(factory.last_resource_generation || Date.now()),
      lastAttackedBy: factory.last_attacked_by,
      lastAttackTime: factory.last_attack_time ? new Date(factory.last_attack_time) : null,
    };

    // 8. Apply slot regeneration
    const regeneratedFactory = applySlotRegeneration(mappedFactory);

    // 9. Check slot availability
    if (!hasEnoughSlots(regeneratedFactory, totalSlotCost)) {
      const available = Math.max(0, regeneratedFactory.slots - regeneratedFactory.usedSlots);
      log.warn('Insufficient factory slots', { username, needed: totalSlotCost, available });
      return NextResponse.json(
        {
          success: false,
          message: `Not enough slots available. Need ${totalSlotCost}, have ${available}`,
          availableSlots: available
        },
        { status: 400 }
      );
    }

    // 10. Get player data
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (playerError || !player) {
      log.warn('Player not found for factory build', { username });
      return NextResponse.json(
        { success: false, message: 'Player not found' },
        { status: 404 }
      );
    }

    // 11. Check resource availability
    const playerMetal = player.resources_metal || 0;
    const playerEnergy = player.resources_energy || 0;

    if (playerMetal < totalMetalCost || playerEnergy < totalEnergyCost) {
      log.warn('Insufficient resources for factory build', { 
        username, 
        metalNeeded: totalMetalCost, 
        metalHave: playerMetal,
        energyNeeded: totalEnergyCost,
        energyHave: playerEnergy
      });
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient resources. Need ${totalMetalCost} metal and ${totalEnergyCost} energy`,
          required: { metal: totalMetalCost, energy: totalEnergyCost },
          available: { metal: playerMetal, energy: playerEnergy }
        },
        { status: 400 }
      );
    }

    // 12. Create units
    const newUnits = [];
    for (let i = 0; i < quantity; i++) {
      newUnits.push({
        id: `${username}-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
        unit_type: unitType as Database['public']['Enums']['unit_type'],
        strength: unitConfig.strength,
        defense: unitConfig.defense,
        produced_at_x: factoryX,
        produced_at_y: factoryY,
        produced_date: new Date().toISOString(),
        player_username: username,
      });
    }

    // 13. Calculate new totals
    const strGained = unitConfig.strength * quantity;
    const defGained = unitConfig.defense * quantity;
    const newTotalStrength = (player.total_strength || 0) + strGained;
    const newTotalDefense = (player.total_defense || 0) + defGained;

    // 14. Update player (deduct resources, update totals)
    const { error: playerUpdateError } = await supabase
      .from('players')
      .update({
        resources_metal: playerMetal - totalMetalCost,
        resources_energy: playerEnergy - totalEnergyCost,
        total_strength: newTotalStrength,
        total_defense: newTotalDefense
      })
      .eq('username', username);

    if (playerUpdateError) {
      log.error('Failed to update player', playerUpdateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update player resources' },
        { status: 500 }
      );
    }

    // Insert new units
    const { error: unitsInsertError } = await supabase
      .from('player_units')
      .insert(newUnits);

    if (unitsInsertError) {
      // Rollback player resources
      await supabase
        .from('players')
        .update({
          resources_metal: playerMetal,
          resources_energy: playerEnergy,
          total_strength: player.total_strength || 0,
          total_defense: player.total_defense || 0
        })
        .eq('username', username);

      log.error('Failed to insert units', unitsInsertError);
      return NextResponse.json(
        { success: false, message: 'Failed to create units' },
        { status: 500 }
      );
    }

    // 15. Update factory (consume slots, update last regen time)
    const updatedFactory = consumeSlots(regeneratedFactory, totalSlotCost);
    const { error: factoryUpdateError } = await supabase
      .from('factories')
      .update({
        used_slots: updatedFactory.usedSlots,
        last_slot_regen: updatedFactory.lastSlotRegen.toISOString()
      })
      .eq('x', factoryX)
      .eq('y', factoryY);

    if (factoryUpdateError) {
      log.error('Failed to update factory slots', factoryUpdateError);
    }

    // 16. Track units built for achievements
    await trackUnitBuilt(username, quantity);

    // 17. Award XP for unit building (5 XP per unit)
    const xpResult = await awardXP(username, XPAction.UNIT_BUILD, quantity);

    // Get updated player unit count
    const { count: unitCount } = await supabase
      .from('player_units')
      .select('*', { count: 'exact', head: true })
      .eq('player_username', username);

    log.info('Factory units built successfully', { 
      username, 
      unitType, 
      quantity, 
      strGained, 
      defGained,
      factoryLocation: { x: factoryX, y: factoryY }
    });

    // 18. Return success with updated data
    return NextResponse.json({
      success: true,
      message: `Successfully built ${quantity}x ${unitConfig.name}`,
      unitsBuilt: {
        type: unitType,
        name: unitConfig.name,
        quantity,
        strGained,
        defGained
      },
      resourcesSpent: {
        metal: totalMetalCost,
        energy: totalEnergyCost
      },
      slotsConsumed: totalSlotCost,
      playerTotals: {
        totalStrength: newTotalStrength,
        totalDefense: newTotalDefense,
        unitCount: unitCount || 0
      },
      factoryStatus: {
        availableSlots: updatedFactory.slots - updatedFactory.usedSlots,
        maxSlots: updatedFactory.slots,
        usedSlots: updatedFactory.usedSlots
      },
      xpAwarded: xpResult.xpAwarded,
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel
    });

  } catch (error) {
    log.error('Factory unit build error', error as Error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    endTimer();
  }
});

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * BUILD UNIT FLOW:
 * 
 * 1. Authenticate user via session cookie
 * 2. Validate request (coordinates, unit type, quantity)
 * 3. Get unit configuration (costs, STR/DEF values)
 * 4. Load factory and verify ownership
 * 5. Apply slot regeneration to factory
 * 6. Verify slot availability
 * 7. Load player and verify resource availability
 * 8. Create unit objects with unique IDs
 * 9. Calculate new STR/DEF totals
 * 10. Atomic database updates:
 *     - Deduct resources from player
 *     - Insert units into player_units table
 *     - Update player total_strength and total_defense
 *     - Consume factory slots
 *     - Update factory last_slot_regen timestamp
 * 11. Return success with comprehensive status
 * 
 * ERROR HANDLING:
 * - 401: Not authenticated
 * - 403: Not factory owner
 * - 404: Factory or player not found
 * - 400: Invalid inputs, insufficient resources/slots
 * - 500: Database or server errors
 * 
 * FUTURE ENHANCEMENTS:
 * - Build queue system
 * - Unit production time
 * - Factory level affecting production
 * - Bulk building discounts
 */

// ============================================================
// END OF FILE
// ============================================================
