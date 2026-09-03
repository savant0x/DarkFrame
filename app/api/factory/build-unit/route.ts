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
import { connectToDatabase } from '@/lib/mongodb';
import type { Player } from '@/types/game.types';
import { UnitType, UNIT_CONFIGS, Factory } from '@/types';
import { applySlotRegeneration, hasEnoughSlots, consumeSlots } from '@/lib/slotRegenService';
import { awardXP, XPAction } from '@/lib/xpService';
import { trackUnitBuilt } from '@/lib/statTrackingService';
import { withRequestLogging, createRouteLogger } from '@/lib';

interface BuildUnitRequest {
  factoryX: number;
  factoryY: number;
  unitType: UnitType;
  quantity?: number; // Number of units to build (default: 1)
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
    if (!factoryX || !factoryY || !unitType) {
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
    const db = await connectToDatabase();

    // 6. Get factory data
    const factoriesCollection = db.collection<Factory>('factories');
    const factory = await factoriesCollection.findOne({ x: factoryX, y: factoryY });

    if (!factory) {
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

    // 8. Apply slot regeneration
    const regeneratedFactory = applySlotRegeneration(factory);

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
    const playersCollection = db.collection<Player>('players');
    const player = await playersCollection.findOne({ username });

    if (!player) {
      log.warn('Player not found for factory build', { username });
      return NextResponse.json(
        { success: false, message: 'Player not found' },
        { status: 404 }
      );
    }

    // 11. Check resource availability
    if (player.resources.metal < totalMetalCost || player.resources.energy < totalEnergyCost) {
      log.warn('Insufficient resources for factory build', { 
        username, 
        metalNeeded: totalMetalCost, 
        metalHave: player.resources.metal,
        energyNeeded: totalEnergyCost,
        energyHave: player.resources.energy
      });
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient resources. Need ${totalMetalCost} metal and ${totalEnergyCost} energy`,
          required: { metal: totalMetalCost, energy: totalEnergyCost },
          available: { metal: player.resources.metal, energy: player.resources.energy }
        },
        { status: 400 }
      );
    }

    // 12. Create units
    const newUnits = [];
    for (let i = 0; i < quantity; i++) {
      newUnits.push({
        id: `${username}-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
        type: unitType,
        strength: unitConfig.strength,
        defense: unitConfig.defense,
        producedAt: { x: factoryX, y: factoryY },
        producedDate: new Date(),
        owner: username
      });
    }

    // 13. Calculate new totals
    const strGained = unitConfig.strength * quantity;
    const defGained = unitConfig.defense * quantity;
    const newTotalStrength = (player.totalStrength || 0) + strGained;
    const newTotalDefense = (player.totalDefense || 0) + defGained;

    // 14. Update player (deduct resources, add units, update totals)
    await playersCollection.updateOne(
      { username },
      {
        $inc: {
          'resources.metal': -totalMetalCost,
          'resources.energy': -totalEnergyCost
        },
        $push: {
          units: { $each: newUnits }
        } as any,
        $set: {
          totalStrength: newTotalStrength,
          totalDefense: newTotalDefense
        }
      }
    );

    // 15. Update factory (consume slots, update last regen time)
    const updatedFactory = consumeSlots(regeneratedFactory, totalSlotCost);
    await factoriesCollection.updateOne(
      { x: factoryX, y: factoryY },
      {
        $set: {
          usedSlots: updatedFactory.usedSlots,
          lastSlotRegen: updatedFactory.lastSlotRegen
        }
      }
    );

    // 16. Track units built for achievements
    await trackUnitBuilt(username, quantity);

    // 17. Award XP for unit building (5 XP per unit)
    const xpResult = await awardXP(username, XPAction.UNIT_BUILD, quantity);

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
        unitCount: (player.units?.length || 0) + quantity
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
 *     - Add units to player.units array
 *     - Update player.totalStrength and totalDefense
 *     - Consume factory slots
 *     - Update factory lastSlotRegen timestamp
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
