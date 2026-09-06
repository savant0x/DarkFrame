/**
 * @file app/api/player/build-unit/route.ts
 * @created 2025-10-17
 * @overview API endpoint for building units from the unit factory
 * 
 * OVERVIEW:
 * Handles unit building requests from the unit factory interface.
 * Validates resources, unlock status, and slot capacity before creating units.
 * Updates player's unit array and total STR/DEF stats.
 * 
 * Endpoints:
 * - POST: Build unit(s) by spending resources
 * - GET: Fetch available units and player unlock status
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise, { type DocumentValue } from '@/lib/mongodb';
import { getPlayer } from '@/lib/playerService';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { getBonusStack, assertHolderMayTransact } from '@/lib/flagBonusService';
import { UNIT_BLUEPRINTS } from '@/types/units.types';
import { UNIT_CONFIGS, UnitType } from '@/types/game.types';
import type { Player, Factory } from '@/types/game.types';
import { 
  withRequestLogging, 
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  BuildUnitSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.buildUnit);

/**
 * GET /api/player/build-unit
 * Fetches available units and player's unlock status
 */
export const GET = withRequestLogging(async (_request: NextRequest) => {
  const log = createRouteLogger('PlayerBuildUnitAPI');
  const endTimer = log.time('fetchUnitData');
  
  try {
    // FID-20260904-005 §5.1: session identity — query username ignored (unit data is
    // per-player; the session user sees their own).
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    const username = authUser.username;

    // FID-20260906-001 §5.5: bearer restriction — the Flag Bearer cannot do this while holding.
    const flagStack = await getBonusStack(username);
    const flagGate = assertHolderMayTransact(flagStack, 'build-unit');
    if (!flagGate.ok) {
      return NextResponse.json({ success: false, error: flagGate.reason }, { status: 403 });
    }

    log.debug('Fetching unit data', { username });

    const player = await getPlayer(username);
    if (!player) {
      log.warn('Player not found', { username });
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Calculate which units are unlocked
    const playerLevel = player.level || 1;
    const playerRP = player.researchPoints || 0;

    const unitsWithStatus = Object.values(UNIT_BLUEPRINTS).map(unit => {
      const isUnlocked = !unit.unlockRequirement || (
        playerRP >= unit.unlockRequirement.researchPoints &&
        (!unit.unlockRequirement.level || playerLevel >= unit.unlockRequirement.level)
      );

      return {
        ...unit,
        isUnlocked,
        playerOwned: player.units?.filter((u) => u.unitId === unit.id).length || 0
      };
    });

    // Calculate unit slots: 100 base + (factoryCount * 50) additional slots (total unit capacity)
    const baseSlots = 100;
    const factoryBonus = (player.factoryCount || 0) * 50;
    const totalSlots = baseSlots + factoryBonus;
    const usedSlots = player.units?.length || 0;

    // Calculate factory build slots: Sum of available slots across all owned factories
    const client = await clientPromise;
    const db = client.db('darkframe');
    const factories = await db.collection<Factory>('factories')
      .find({ owner: username })
      .toArray();
    
    const factoryBuildSlots = factories.reduce((total: number, factory: { slots?: number; usedSlots?: number }) => {
      const availableInFactory = Math.max(0, (factory.slots || 20) - (factory.usedSlots || 0));
      return total + availableInFactory;
    }, 0);

    log.info('Unit data fetched', { 
      username, 
      unitsCount: unitsWithStatus.length, 
      usedSlots, 
      totalSlots,
      factoryBuildSlots,
      factoryCount: factories.length
    });

    return NextResponse.json({
      success: true,
      units: unitsWithStatus,
      playerStats: {
        level: playerLevel,
        researchPoints: playerRP,
        resources: player.resources,
        totalStrength: player.totalStrength || 0,
        totalDefense: player.totalDefense || 0,
        availableSlots: totalSlots,
        usedSlots: usedSlots,
        factoryBuildSlots: factoryBuildSlots // NEW: Total available building slots across all factories
      }
    });
  } catch (error) {
    log.error('Failed to fetch unit data', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch unit data' },
      { status: 500 }
    );
  } finally {
    endTimer();
  }
});

/**
 * POST /api/player/build-unit
 * Builds unit(s) by spending resources
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('PlayerBuildUnitAPI');
  const endTimer = log.time('buildUnit');
  
  try {
    // FID-20260904-005 §5.1: session identity — body username ignored.
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const body = await request.json();
    const validated = BuildUnitSchema.parse(body);
    const username = authUser.username;

    // FID-20260906-001 §5.5: bearer restriction — the Flag Bearer cannot build
    // units while holding (doc anti-exploit rule).
    const flagStack = await getBonusStack(username);
    const flagGate = assertHolderMayTransact(flagStack, 'build-unit');
    if (!flagGate.ok) {
      return NextResponse.json({ success: false, error: flagGate.reason }, { status: 403 });
    }

    log.debug('Unit build request', { 
      username,
      unitTypeId: validated.unitTypeId, 
      quantity: validated.quantity 
    });

    // Get unit blueprint
    const unitBlueprint = UNIT_BLUEPRINTS[validated.unitTypeId];
    if (!unitBlueprint) {
      log.warn('Invalid unit type', { 
        username: username, 
        unitTypeId: validated.unitTypeId 
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Invalid unit type'
      });
    }

    // Get player data with factory count
    const player = await getPlayer(username);
    if (!player) {
      log.warn('Player not found for unit build', { username: username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Player not found'
      });
    }

    // Check unlock status
    const playerLevel = player.level || 1;
    const playerRP = player.researchPoints || 0;

    if (unitBlueprint.unlockRequirement) {
      const rpRequired = unitBlueprint.unlockRequirement.researchPoints;
      const levelRequired = unitBlueprint.unlockRequirement.level || 0;

      if (playerRP < rpRequired) {
        log.warn('Insufficient research points', { 
          username: username, 
          required: rpRequired, 
          have: playerRP 
        });
        return createErrorResponse(ErrorCode.INSUFFICIENT_RP, {
          required: rpRequired,
          have: playerRP
        });
      }

      if (playerLevel < levelRequired) {
        log.warn('Insufficient level', { 
          username: username, 
          required: levelRequired, 
          have: playerLevel 
        });
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: `Requires level ${levelRequired} (you are level ${playerLevel})`
        });
      }
    }

    // Get all player factories for sequential slot consumption
    const client = await clientPromise;
    const factoriesDb = client.db('darkframe');
    const factories = await factoriesDb.collection<Factory>('factories')
      .find({ owner: username })
      .sort({ x: 1, y: 1 }) // Sort by coordinates for consistent ordering
      .toArray();

    if (factories.length === 0) {
      log.warn('No factories owned', { username: username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'You must own at least one factory to build units'
      });
    }

    // Calculate total available factory build slots
    const totalFactoryBuildSlots = factories.reduce((total: number, factory: { slots?: number; usedSlots?: number }) => {
      const availableInFactory = Math.max(0, (factory.slots || 20) - (factory.usedSlots || 0));
      return total + availableInFactory;
    }, 0);

    if (validated.quantity > totalFactoryBuildSlots) {
      log.warn('Insufficient factory build slots', { 
        username: username, 
        available: totalFactoryBuildSlots, 
        needed: validated.quantity 
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: `Insufficient factory slots (${totalFactoryBuildSlots} available, ${validated.quantity} needed)`
      });
    }

    // Calculate total cost
    const totalMetalCost = unitBlueprint.metalCost * validated.quantity;
    const totalEnergyCost = unitBlueprint.energyCost * validated.quantity;

    const playerMetal = player.resources?.metal || 0;
    const playerEnergy = player.resources?.energy || 0;

    // Check resources
    if (playerMetal < totalMetalCost) {
      log.warn('Insufficient metal', { 
        username: username, 
        needed: totalMetalCost, 
        have: playerMetal 
      });
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        resourceType: 'metal',
        needed: totalMetalCost,
        have: playerMetal
      });
    }

    if (playerEnergy < totalEnergyCost) {
      log.warn('Insufficient energy', { 
        username: username, 
        needed: totalEnergyCost, 
        have: playerEnergy 
      });
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        resourceType: 'energy',
        needed: totalEnergyCost,
        have: playerEnergy
      });
    }

    // Sequential factory slot consumption logic
    const newUnits = [];
    let remainingUnits = validated.quantity;
    const factoryUpdates: Array<{ factoryId: string; slotsUsed: number; newUsedSlots: number }> = []; // Track factory slot updates

    // Get slotCost from UNIT_CONFIGS for exponential slot cost system
    const unitType = unitBlueprint.id as UnitType;
    const unitConfig = UNIT_CONFIGS[unitType];
    const slotCostPerUnit = unitConfig?.slotCost || 1; // Fallback to 1 if not found

    for (const factory of factories) {
      if (remainingUnits <= 0) break;

      const availableInFactory = Math.max(0, (factory.slots || 20) - (factory.usedSlots || 0));
      const unitsToAssignHere = Math.min(remainingUnits, availableInFactory);

      if (unitsToAssignHere > 0) {
        // Create units for this factory
        for (let i = 0; i < unitsToAssignHere; i++) {
          newUnits.push({
            unitId: unitBlueprint.id,
            name: unitBlueprint.name,
            category: unitBlueprint.category,
            rarity: unitBlueprint.rarity,
            strength: unitBlueprint.strength,
            defense: unitBlueprint.defense,
            createdAt: new Date()
          });
        }

        // Calculate slots needed using exponential slot cost
        const slotsNeeded = unitsToAssignHere * slotCostPerUnit;

        // Track factory slot update
        factoryUpdates.push({
          factoryId: (factory as Factory & { _id?: string })._id ?? `${factory.x},${factory.y}`,
          slotsUsed: slotsNeeded,
          newUsedSlots: (factory.usedSlots || 0) + slotsNeeded
        });

        remainingUnits -= unitsToAssignHere;
      }
    }

    // Calculate new totals
    const strengthGained = unitBlueprint.strength * validated.quantity;
    const defenseGained = unitBlueprint.defense * validated.quantity;

    const newTotalStrength = (player.totalStrength || 0) + strengthGained;
    const newTotalDefense = (player.totalDefense || 0) + defenseGained;

    // Get database collections for update
    const playersDb = client.db('darkframe');
    const playersCollection = playersDb.collection<Player>('players');
    const factoriesCollection = factoriesDb.collection<Factory>('factories');

    // Update player in database
    const updateResult = await playersCollection.updateOne(
      { username: username },
      {
        $push: { units: { $each: newUnits } } as unknown as Record<string, DocumentValue>,
        $inc: {
          'resources.metal': -totalMetalCost,
          'resources.energy': -totalEnergyCost
        },
        $set: {
          totalStrength: newTotalStrength,
          totalDefense: newTotalDefense
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      log.error('Failed to update player for unit build', new Error('Database update failed'), { 
        username: username 
      });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Failed to build units'
      });
    }

    // Update factory slots sequentially
    for (const update of factoryUpdates) {
      await factoriesCollection.updateOne(
        { _id: update.factoryId },
        { $set: { usedSlots: update.newUsedSlots } }
      );
    }

    log.info('Units built successfully', { 
      username: username, 
      unitType: unitBlueprint.name, 
      quantity: validated.quantity, 
      strengthGained, 
      defenseGained,
      factoriesUsed: factoryUpdates.length
    });

    // Calculate new factory build slots after updates
    const newFactoryBuildSlots = totalFactoryBuildSlots - validated.quantity;

    // Return success with updated data
    return NextResponse.json({
      success: true,
      message: `Successfully built ${validated.quantity}x ${unitBlueprint.name}!`,
      unitsBuilt: newUnits,
      costPaid: {
        metal: totalMetalCost,
        energy: totalEnergyCost
      },
      newStats: {
        totalStrength: newTotalStrength,
        totalDefense: newTotalDefense,
        resources: {
          metal: playerMetal - totalMetalCost,
          energy: playerEnergy - totalEnergyCost
        },
        usedSlots: (player.units?.length || 0) + validated.quantity,
        availableSlots: (100 + ((player.factoryCount || 0) * 50)),
        factoryBuildSlots: newFactoryBuildSlots
      },
      statsGained: {
        strength: strengthGained,
        defense: defenseGained
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Unit build validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Unit build error', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// Implementation Notes:
// - Validates unlock requirements (RP + level)
// - Checks resource availability and slot capacity
// - Creates multiple unit instances for quantity > 1
// - Updates totalStrength/totalDefense immediately
// - Returns detailed success response with new stats
// ============================================================
