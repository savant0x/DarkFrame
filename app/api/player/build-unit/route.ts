/**
 * @file app/api/player/build-unit/route.ts
 * @created 2025-10-17
 * @updated 2026-05-03 (FID-20260503-SUPABASE: Supabase backend, snake_case properties)
 * @overview API endpoint for building units from the unit factory
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { getPlayer } from '@/lib/playerService';
import { getMaxSlots } from '@/lib/factoryUpgradeService';
import { UNIT_BLUEPRINTS, UnitBlueprint, UnitCategory } from '@/types/units.types';
import { UNIT_CONFIGS, UnitType } from '@/types/game.types';
import type { Tables, Enums } from '@/types/database';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  BuildUnitSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode,
} from '@/lib';
import { ZodError } from 'zod';

type PlayerRow = Tables<'players'>;
type FactoryRow = Tables<'factories'>;
type UnitTypeEnum = NonNullable<Enums<'unit_type'>>;

/** Maps unit blueprint IDs to Supabase unit_type enum values */
const BLUEPRINT_TO_DB: Record<string, UnitTypeEnum> = {
  infantry: 'T1_RIFLEMAN',
  scout: 'T1_SCOUT',
  militia: 'T1_RIFLEMAN',
  rifleman: 'T1_RIFLEMAN',
  marksman: 'T1_SNIPER',
  cavalry: 'T1_RIFLEMAN',
  grenadier: 'T1_GRENADIER',
  saboteur: 'T1_SCOUT',
  sniper: 'T1_SNIPER',
  commando: 'T2_COMMANDO',
  artillery: 'T2_CANNON',
  bombardier: 'T2_DEMOLISHER',
  tank: 'T2_COMMANDO',
  bomber: 'T2_DEMOLISHER',
  juggernaut: 'T3_STRIKER',
  gunship: 'T3_RAIDER',
  titan: 'T4_TITAN',
  warlord: 'T3_WARLORD',
  dreadnought: 'T4_DREADNOUGHT',
  annihilator: 'T4_ANNIHILATOR',
  barricade: 'T1_BARRIER',
  watchman: 'T1_BARRIER',
  palisade: 'T1_BUNKER',
  trench: 'T1_BUNKER',
  wall: 'T1_BUNKER',
  guardian: 'T3_GUARDIAN',
  turret: 'T1_TURRET',
  rampart: 'T2_BARRICADE',
  bunker: 'T1_BUNKER',
  fortress: 'T2_FORTRESS',
  sentinel: 'T2_SENTINEL',
  pillbox: 'T1_TURRET',
  citadel: 'T3_CITADEL',
  aegis: 'T1_SHIELD',
  stronghold: 'T4_STRONGHOLD',
  guardian_array: 'T3_GUARDIAN',
  bastion: 'T5_BASTION',
  colossus: 'T4_COLOSSUS',
  sentinel_prime: 'T2_SENTINEL',
  invincible: 'T5_IMMORTAL',
  basic_training: 'T1_RIFLEMAN',
  advanced_weapons: 'T2_COMMANDO',
  elite_forces: 'T3_STRIKER',
  heavy_artillery: 'T3_ARTILLERY',
  mechanized_warfare: 'T4_TITAN',
  titan_project: 'T5_OVERLORD',
  fortification: 'T1_BUNKER',
  defensive_positions: 'T2_FORTRESS',
  automated_defense: 'T3_CITADEL',
  hardened_structures: 'T4_STRONGHOLD',
  fortress_engineering: 'T5_BASTION',
  advanced_defense: 'T5_MONOLITH',
  bastion_protocol: 'T5_IMMORTAL',
} as const;

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.buildUnit);

export const GET = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('PlayerBuildUnitAPI');
  const endTimer = log.time('fetchUnitData');

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const player = await getPlayer(username);
    if (!player) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const playerLevel = player.level || 1;
    const playerRP = player.research_points || 0;

    const supabase = createServiceClient();
    const { data: playerUnits } = await supabase
      .from('player_units')
      .select('unit_type, quantity')
      .eq('player_username', username);

    const unitsWithStatus = Object.values(UNIT_BLUEPRINTS).map(unit => {
      const isUnlocked = !unit.unlockRequirement || (
        playerRP >= unit.unlockRequirement.researchPoints &&
        (!unit.unlockRequirement.level || playerLevel >= unit.unlockRequirement.level)
      );

      const dbType = BLUEPRINT_TO_DB[unit.id];
      const owned = dbType
        ? playerUnits?.find((u: { unit_type: string; quantity: number }) => u.unit_type === dbType)
        : undefined;
      const slotCost = dbType ? (UNIT_CONFIGS[dbType as UnitType]?.slotCost || 1) : 1;

      return {
        ...unit,
        isUnlocked,
        playerOwned: owned?.quantity || 0,
        slotCost,
      };
    });

    const { data: factories } = await supabase
      .from('factories')
      .select('*')
      .eq('owner', username);

    const factoryBuildSlots = (factories ?? []).reduce((total: number, f: FactoryRow) => {
      const capacity = getMaxSlots(f.level || 1);
      const available = Math.max(0, capacity - (f.used_slots || 0));
      return total + available;
    }, 0);

    const factoryUsedSlots = (factories ?? []).reduce((total: number, f: FactoryRow) => {
      return total + (f.used_slots || 0);
    }, 0);

    return NextResponse.json({
      success: true,
      units: unitsWithStatus,
      playerStats: {
        level: playerLevel,
        researchPoints: playerRP,
        resources: {
          metal: player.resources_metal || 0,
          energy: player.resources_energy || 0,
        },
        totalStrength: player.total_strength || 0,
        totalDefense: player.total_defense || 0,
        availableSlots: factoryBuildSlots,
        usedSlots: factoryUsedSlots,
        factoryBuildSlots,
        factoryCount: factories?.length || 0,
      },
    });
  } catch (error) {
    log.error('Failed to fetch unit data', error as Error);
    return NextResponse.json({ success: false, error: 'Failed to fetch unit data' }, { status: 500 });
  } finally {
    endTimer();
  }
});

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('PlayerBuildUnitAPI');
  const endTimer = log.time('buildUnit');

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const validated = BuildUnitSchema.parse(body);

    const unitBlueprint = UNIT_BLUEPRINTS[validated.unitTypeId];
    const isNewUnit = !unitBlueprint && !!UNIT_CONFIGS[validated.unitTypeId];
    if (!unitBlueprint && !isNewUnit) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Invalid unit type' });
    }

    const newUnitCfg = isNewUnit ? UNIT_CONFIGS[validated.unitTypeId] : null;

    const player = await getPlayer(auth.playerId);
    if (!player) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Player not found' });
    }

    const playerLevel = player.level || 1;
    const playerRP = player.research_points || 0;

    // Check unlock requirements (support both old and new unit types)
    if (isNewUnit && newUnitCfg) {
      if (playerRP < newUnitCfg.rpRequired) {
        return createErrorResponse(ErrorCode.INSUFFICIENT_RP, { required: newUnitCfg.rpRequired, have: playerRP });
      }
      if (playerLevel < newUnitCfg.levelRequired) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: `Requires level ${newUnitCfg.levelRequired} (you are level ${playerLevel})`,
        });
      }
    } else if (unitBlueprint?.unlockRequirement) {
      const rpRequired = unitBlueprint.unlockRequirement.researchPoints;
      const levelRequired = unitBlueprint.unlockRequirement.level || 0;

      if (playerRP < rpRequired) {
        return createErrorResponse(ErrorCode.INSUFFICIENT_RP, { required: rpRequired, have: playerRP });
      }
      if (playerLevel < levelRequired) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: `Requires level ${levelRequired} (you are level ${playerLevel})`,
        });
      }
    }

    const supabase = createServiceClient();
    const { data: factories } = await supabase
      .from('factories')
      .select('*')
      .eq('owner', auth.playerId)
      .order('x', { ascending: true })
      .order('y', { ascending: true });

    if (!factories || factories.length === 0) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'You must own at least one factory to build units' });
    }

    const totalFactoryBuildSlots = factories.reduce((total: number, f: FactoryRow) => {
      return total + Math.max(0, getMaxSlots(f.level || 1) - (f.used_slots || 0));
    }, 0);

    if (validated.quantity > totalFactoryBuildSlots) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: `Insufficient factory slots (${totalFactoryBuildSlots} available, ${validated.quantity} needed)`,
      });
    }

    const totalMetalCost = isNewUnit && newUnitCfg
      ? newUnitCfg.metalCost * validated.quantity
      : unitBlueprint!.metalCost * validated.quantity;
    const totalEnergyCost = isNewUnit && newUnitCfg
      ? newUnitCfg.energyCost * validated.quantity
      : unitBlueprint!.energyCost * validated.quantity;

    const playerMetal = player.resources_metal || 0;
    const playerEnergy = player.resources_energy || 0;

    if (playerMetal < totalMetalCost) {
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, { resourceType: 'metal', needed: totalMetalCost, have: playerMetal });
    }
    if (playerEnergy < totalEnergyCost) {
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, { resourceType: 'energy', needed: totalEnergyCost, have: playerEnergy });
    }

    const dbUnitType: string = isNewUnit ? validated.unitTypeId : BLUEPRINT_TO_DB[validated.unitTypeId];
    if (!dbUnitType) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: `Unknown unit type: ${validated.unitTypeId}` });
    }

    const slotCostPerUnit = newUnitCfg?.slotCost || (UNIT_CONFIGS[dbUnitType as UnitType]?.slotCost) || 1;

    let remainingUnits = validated.quantity;

    for (const factory of factories) {
      if (remainingUnits <= 0) break;

      const capacity = getMaxSlots(factory.level || 1);
      const available = Math.max(0, capacity - (factory.used_slots || 0));
      const maxUnitsForFactory = Math.floor(available / slotCostPerUnit);
      const unitsToAssign = Math.min(remainingUnits, maxUnitsForFactory);

      if (unitsToAssign > 0) {
        const slotsNeeded = unitsToAssign * slotCostPerUnit;
        await supabase
          .from('factories')
          .update({
            used_slots: (factory.used_slots || 0) + slotsNeeded,
            last_slot_regen: new Date().toISOString(),
          })
          .eq('id', factory.id);

        remainingUnits -= unitsToAssign;
      }
    }

    const cfg = isNewUnit ? newUnitCfg : (dbUnitType ? UNIT_CONFIGS[dbUnitType as UnitType] : null);
    const unitStrength = cfg?.strength ?? unitBlueprint?.strength ?? 0;
    const unitDefense = cfg?.defense ?? unitBlueprint?.defense ?? 0;

    const strengthGained = unitStrength * validated.quantity;
    const defenseGained = unitDefense * validated.quantity;

    const newTotalStrength = (player.total_strength || 0) + strengthGained;
    const newTotalDefense = (player.total_defense || 0) + defenseGained;

    await supabase
      .from('players')
      .update({
        resources_metal: playerMetal - totalMetalCost,
        resources_energy: playerEnergy - totalEnergyCost,
        total_strength: newTotalStrength,
        total_defense: newTotalDefense,
        stat_total_units_built: (player.stat_total_units_built || 0) + validated.quantity,
      })
      .eq('username', auth.playerId);

    const { data: existingUnit } = await supabase
      .from('player_units')
      .select('id, quantity, strength, defense')
      .eq('player_username', auth.playerId)
      .eq('unit_type', dbUnitType as UnitTypeEnum)
      .maybeSingle();

    if (existingUnit) {
      await supabase
        .from('player_units')
        .update({
          quantity: existingUnit.quantity + validated.quantity,
          strength: unitStrength,
          defense: unitDefense,
        })
        .eq('id', existingUnit.id);
    } else {
      await supabase
        .from('player_units')
        .insert({
          player_username: auth.playerId,
          unit_type: dbUnitType as UnitTypeEnum,
          quantity: validated.quantity,
          strength: unitStrength,
          defense: unitDefense,
        });
    }

    const { data: updatedUnits } = await supabase
      .from('player_units')
      .select('quantity')
      .eq('player_username', auth.playerId);
    const newUsedSlots = updatedUnits?.reduce((sum: number, u: { quantity: number }) => sum + u.quantity, 0) || 0;

    return NextResponse.json({
      success: true,
      message: `Successfully built ${validated.quantity}x ${unitBlueprint.name}!`,
      unitsBuilt: Array(validated.quantity).fill({
        unitId: unitBlueprint.id,
        name: unitBlueprint.name,
        category: unitBlueprint.category,
        rarity: unitBlueprint.rarity,
        strength: unitBlueprint.strength,
        defense: unitBlueprint.defense,
      }),
      costPaid: { metal: totalMetalCost, energy: totalEnergyCost },
      newStats: {
        totalStrength: newTotalStrength,
        totalDefense: newTotalDefense,
        resources_metal: playerMetal - totalMetalCost,
        resources_energy: playerEnergy - totalEnergyCost,
        usedSlots: newUsedSlots,
        availableSlots: 100 + ((player.factory_count || 0) * 50),
        factoryBuildSlots: totalFactoryBuildSlots - validated.quantity,
      },
      statsGained: { strength: strengthGained, defense: defenseGained },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Unit build error', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
