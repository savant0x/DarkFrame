/**
 * @file lib/factoryService.ts
 * @created 2025-10-17
 * @updated 2025-11-04 - Phase 5: Added passive income system (hourly resource generation)
 * @overview Factory attack, control, unit production, and passive income business logic
 * 
 * PASSIVE INCOME SYSTEM (NEW):
 * - Hourly resource generation for factory owners
 * - Metal/hour: factoryLevel × 1,000 (Level 1: 1K, Level 10: 10K)
 * - Energy/hour: factoryLevel × 500 (Level 1: 500, Level 10: 5K)
 * - Collection: collectAllFactoryIncome() calculates and awards accumulated resources
 * - Tracking: lastResourceGeneration timestamp prevents retroactive income
 * - Minimum interval: 1 minute (prevents spam collection)
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Tables, TablesInsert, Database } from '@/types/database';
import { Factory, AttackResult, Unit, Position, UnitType } from '@/types';
import { awardXP, XPAction } from './xpService';
import { FACTORY_UPGRADE, getMaxSlots, getFactoryDefense } from './factoryUpgradeService';

const ATTACK_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between attacks
const UNIT_COST_METAL = 100;
const UNIT_COST_ENERGY = 50;
const BASE_PLAYER_POWER = 100; // Base power for new players

// PASSIVE INCOME CONSTANTS (NEW: Phase 5 - Factory Passive Income)
const PASSIVE_INCOME_METAL_PER_LEVEL = 1000; // Level 1: 1K/hr, Level 10: 10K/hr
const PASSIVE_INCOME_ENERGY_PER_LEVEL = 500;  // Level 1: 500/hr, Level 10: 5K/hr

/**
 * Calculate hourly passive income rate for a factory
 * 
 * @param factoryLevel - Current factory level (1-10)
 * @returns Object with metal and energy per hour
 * 
 * @example
 * getFactoryIncomeRate(1);  // Returns { metal: 1000, energy: 500 }
 * getFactoryIncomeRate(10); // Returns { metal: 10000, energy: 5000 }
 * 
 * NEW: Phase 5 - Passive income rewards factory ownership
 */
export function getFactoryIncomeRate(factoryLevel: number): { metal: number; energy: number } {
  return {
    metal: factoryLevel * PASSIVE_INCOME_METAL_PER_LEVEL,
    energy: factoryLevel * PASSIVE_INCOME_ENERGY_PER_LEVEL
  };
}

/**
 * Collect accumulated passive income from a factory
 * Calculates resources generated since last collection based on factory level
 * 
 * @param factory - Factory to collect income from
 * @returns Object with collected resources and updated timestamp
 * 
 * @example
 * // Level 10 factory, 2 hours since last collection
 * collectFactoryIncome(factory);
 * // Returns: { metal: 20000, energy: 10000, hoursElapsed: 2 }
 * 
 * NEW: Phase 5 - Hourly resource generation for factory owners
 */
export function calculateFactoryIncome(factory: Tables<'factories'>): {
  metal: number;
  energy: number;
  hoursElapsed: number;
} {
  if (!factory.last_resource_generation) {
    return { metal: 0, energy: 0, hoursElapsed: 0 };
  }

  const now = new Date();
  const lastCollection = new Date(factory.last_resource_generation);
  const msElapsed = now.getTime() - lastCollection.getTime();
  const hoursElapsed = msElapsed / (1000 * 60 * 60);

  if (hoursElapsed < 0.0167) { // 1 minute = 0.0167 hours
    return { metal: 0, energy: 0, hoursElapsed: 0 };
  }

  const hourlyRate = getFactoryIncomeRate(factory.level);
  const metal = Math.floor(hourlyRate.metal * hoursElapsed);
  const energy = Math.floor(hourlyRate.energy * hoursElapsed);

  return { metal, energy, hoursElapsed };
}

/**
 * Collect passive income from all player-owned factories
 * Updates player resources and factory lastResourceGeneration timestamps
 * 
 * @param username - Player username
 * @returns Object with total collected resources and factory count
 * 
 * @example
 * await collectAllFactoryIncome('Player1');
 * // Returns: { totalMetal: 25000, totalEnergy: 12500, factoriesCollected: 3 }
 * 
 * NEW: Phase 5 - Batch collection for all owned factories
 */
export async function collectAllFactoryIncome(username: string): Promise<{
  totalMetal: number;
  totalEnergy: number;
  factoriesCollected: number;
  factories: Array<{
    position: { x: number; y: number };
    level: number;
    metal: number;
    energy: number;
    hoursElapsed: number;
  }>;
}> {
  const supabase = createServiceClient();

  const { data: factories, error } = await supabase
    .from('factories')
    .select('*')
    .eq('owner', username);

  if (error) throw new Error(error.message);

  if (!factories || factories.length === 0) {
    return {
      totalMetal: 0,
      totalEnergy: 0,
      factoriesCollected: 0,
      factories: []
    };
  }

  let totalMetal = 0;
  let totalEnergy = 0;
  const factoryDetails = [];

  for (const factory of factories) {
    const income = calculateFactoryIncome(factory);
    
    if (income.metal > 0 || income.energy > 0) {
      totalMetal += income.metal;
      totalEnergy += income.energy;

      factoryDetails.push({
        position: { x: factory.x, y: factory.y },
        level: factory.level,
        metal: income.metal,
        energy: income.energy,
        hoursElapsed: income.hoursElapsed
      });

      await supabase
        .from('factories')
        .update({ last_resource_generation: new Date().toISOString() })
        .eq('x', factory.x)
        .eq('y', factory.y);
    }
  }

  if (totalMetal > 0 || totalEnergy > 0) {
    const { data: player } = await supabase
      .from('players')
      .select('resources_metal, resources_energy')
      .eq('username', username)
      .single();

    if (player) {
      await supabase
        .from('players')
        .update({
          resources_metal: player.resources_metal + totalMetal,
          resources_energy: player.resources_energy + totalEnergy
        })
        .eq('username', username);
    }

    console.log(`💰 ${username} collected passive income: ${totalMetal.toLocaleString()} Metal, ${totalEnergy.toLocaleString()} Energy from ${factoryDetails.length} factories`);
  }

  return {
    totalMetal,
    totalEnergy,
    factoriesCollected: factoryDetails.length,
    factories: factoryDetails
  };
}

/**
 * Calculate player's total power for attack
 * Based on: base power + (units owned * unit power) + level bonuses
 */
export async function calculatePlayerPower(username: string): Promise<number> {
  const supabase = createServiceClient();
  const { data: player, error } = await supabase
    .from('players')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !player) return BASE_PLAYER_POWER;
  
  let power = BASE_PLAYER_POWER;
  
  // Add power from rank/level (10 power per rank)
  power += (player.rank || 1) * 10;
  
  // Add power from player's total military strength (PRIMARY POWER SOURCE)
  if (player.total_strength) {
    power += player.total_strength;
  }
  
  // Inventory units no longer accessible as a flat column — use unit count
  // Units are stored separately; total_strength already covers this
  // Add a base bonus per unit if available
  if (player.factory_count) {
    power += player.factory_count * 50;
  }
  
  return power;
}

/**
 * Get or create factory data for a tile
 */
export async function getFactoryData(x: number, y: number): Promise<Tables<'factories'> | null> {
  const supabase = createServiceClient();
  
  const { data: factory, error } = await supabase
    .from('factories')
    .select('*')
    .eq('x', x)
    .eq('y', y)
    .single();

  if (!factory || error) {
    const level = 1;
    const now = new Date().toISOString();
    const insert: TablesInsert<'factories'> = {
      x,
      y,
      owner: null,
      defense: getFactoryDefense(level),
      level,
      slots: getMaxSlots(level),
      used_slots: 0,
      production_rate: 1,
      last_slot_regen: now,
      last_resource_generation: now,
      last_attacked_by: null,
      last_attack_time: null
    };
    
    const { data: newFactory, error: insertError } = await supabase
      .from('factories')
      .insert(insert)
      .select('*')
      .single();

    if (insertError) throw new Error(insertError.message);
    return newFactory;
  }
  
  return factory;
}

/**
 * Attack a factory
 * Success chance based on player power vs factory defense
 */
export async function attackFactory(
  username: string,
  x: number,
  y: number
): Promise<AttackResult> {
  const supabase = createServiceClient();
  
  const factory = await getFactoryData(x, y);
  if (!factory) {
    return {
      success: false,
      message: 'Factory not found',
      playerPower: 0,
      factoryDefense: 0,
      captured: false
    };
  }
  
  if (factory.owner === username) {
    return {
      success: false,
      message: 'You already control this factory!',
      playerPower: 0,
      factoryDefense: factory.defense,
      captured: false
    };
  }
  
  // Enforce max factories per player before capture attempt
  const { count, error: countError } = await supabase
    .from('factories')
    .select('*', { count: 'exact', head: true })
    .eq('owner', username);

  if (countError) throw new Error(countError.message);
  const ownedCount = count || 0;

  if (ownedCount >= FACTORY_UPGRADE.MAX_FACTORIES_PER_PLAYER) {
    return {
      success: false,
      message: `You already control ${ownedCount} factories (max ${FACTORY_UPGRADE.MAX_FACTORIES_PER_PLAYER}). Abandon one to capture another.`,
      playerPower: 0,
      factoryDefense: factory.defense,
      captured: false
    };
  }
  
  // Check cooldown
  if (factory.last_attacked_by === username && factory.last_attack_time) {
    const timeSinceLastAttack = Date.now() - new Date(factory.last_attack_time).getTime();
    if (timeSinceLastAttack < ATTACK_COOLDOWN_MS) {
      const minutesLeft = Math.ceil((ATTACK_COOLDOWN_MS - timeSinceLastAttack) / 60000);
      return {
        success: false,
        message: `You must wait ${minutesLeft} minutes before attacking this factory again`,
        playerPower: 0,
        factoryDefense: factory.defense,
        captured: false
      };
    }
  }
  
  const playerPower = await calculatePlayerPower(username);
  
  const successChance = Math.min(0.9, playerPower / factory.defense);
  const attackRoll = Math.random();
  const success = attackRoll < successChance;
  
  const now = new Date().toISOString();
  
  // Update factory
  const updateData: Record<string, any> = {
    last_attacked_by: username,
    last_attack_time: now
  };
  
  if (success) {
    updateData.owner = username;
    updateData.used_slots = 0;
    updateData.slots = getMaxSlots(factory.level || 1);
    updateData.last_resource_generation = now;
  }
  
  const { error: updateError } = await supabase
    .from('factories')
    .update(updateData as Database['public']['Tables']['factories']['Update'])
    .eq('x', x)
    .eq('y', y);

  if (updateError) throw new Error(updateError.message);
  
  if (success) {
    console.log(`✅ ${username} captured factory at (${x}, ${y})! Power: ${playerPower} vs Defense: ${factory.defense}`);
    
    const xpResult = await awardXP(username, XPAction.FACTORY_CAPTURE);
    
    return {
      success: true,
      message: `Victory! You have captured the factory!\n\nYour Power: ${playerPower.toLocaleString()}\nFactory Defense: ${factory.defense.toLocaleString()}\n\nThe factory is now producing units for you.`,
      playerPower,
      factoryDefense: factory.defense,
      captured: true,
      xpAwarded: xpResult.xpAwarded,
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel
    };
  } else {
    console.log(`❌ ${username} failed to capture factory at (${x}, ${y}). Power: ${playerPower} vs Defense: ${factory.defense}`);
    return {
      success: false,
      message: `Attack failed!\n\nYour Power: ${playerPower.toLocaleString()}\nFactory Defense: ${factory.defense.toLocaleString()}\n\nYou need more units or a higher rank to capture this factory.`,
      playerPower,
      factoryDefense: factory.defense,
      captured: false
    };
  }
}

/**
 * Produce units at a controlled factory
 * Costs resources and adds unit to player inventory
 */
export async function produceUnit(
  username: string,
  x: number,
  y: number
): Promise<{ success: boolean; message: string; unit?: Unit }> {
  const supabase = createServiceClient();
  
  const factory = await getFactoryData(x, y);
  if (!factory) {
    return { success: false, message: 'Factory not found' };
  }
  
  if (factory.owner !== username) {
    return { success: false, message: 'You do not control this factory' };
  }
  
  const capacity = getMaxSlots(factory.level || 1);
  if (factory.used_slots >= capacity) {
    return { success: false, message: 'Factory is at maximum capacity' };
  }
  
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('username', username)
    .single();

  if (playerError || !player) {
    return { success: false, message: 'Player not found' };
  }
  
  if (player.resources_metal < UNIT_COST_METAL || player.resources_energy < UNIT_COST_ENERGY) {
    return {
      success: false,
      message: `Insufficient resources. Need ${UNIT_COST_METAL} Metal and ${UNIT_COST_ENERGY} Energy`
    };
  }
  
  const unit: Unit = {
    id: crypto.randomUUID(),
    type: UnitType.T1_Rifleman,
    strength: 5,
    defense: 0,
    producedAt: { x, y },
    producedDate: new Date(),
    owner: username
  };
  
  // Deduct resources
  const { error: resourceError } = await supabase
    .from('players')
    .update({
      resources_metal: player.resources_metal - UNIT_COST_METAL,
      resources_energy: player.resources_energy - UNIT_COST_ENERGY
    })
    .eq('username', username);

  if (resourceError) throw new Error(resourceError.message);
  
  // Update factory: increment used slots
  const { error: factoryError } = await supabase
    .from('factories')
    .update({ used_slots: factory.used_slots + 1 })
    .eq('x', x)
    .eq('y', y);

  if (factoryError) throw new Error(factoryError.message);
  
  console.log(`🏭 ${username} produced unit at factory (${x}, ${y})`);
  
  return {
    success: true,
    message: `Unit produced successfully!\n\nCost: ${UNIT_COST_METAL} Metal + ${UNIT_COST_ENERGY} Energy\nSlots used: ${factory.used_slots + 1}/${getMaxSlots(factory.level || 1)}`,
    unit
  };
}

/**
 * Get all factories controlled by a player
 */
export async function getPlayerFactories(username: string): Promise<Tables<'factories'>[]> {
  const supabase = createServiceClient();
  
  const { data: factories, error } = await supabase
    .from('factories')
    .select('*')
    .eq('owner', username);

  if (error) throw new Error(error.message);
  
  return factories || [];
}

/**
 * Get total unit count for a player
 */
export async function getPlayerUnitCount(username: string): Promise<number> {
  const supabase = createServiceClient();
  
  const { data: player, error } = await supabase
    .from('players')
    .select('stat_total_units_built')
    .eq('username', username)
    .single();

  if (error || !player) return 0;
  
  return player.stat_total_units_built || 0;
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Attack cooldown prevents spam (5 minutes)
// - Power calculation: base + rank bonus + totalStrength + unit bonus
// - Success chance capped at 90% for balance
// - Unit production costs 100 Metal + 50 Energy
// - Factories have exponential defense scaling:
//   * Level 1: 1,000 defense (accessible)
//   * Level 2+: (level-1)² × 50,000 (exponential)
//   * Level 10: 4,050,000 defense (end-game challenge)
// - PASSIVE INCOME SYSTEM (NEW: Phase 5):
//   * Hourly generation: Level × 1,000 Metal, Level × 500 Energy
//   * Level 1 factory: 1K metal/hr, 500 energy/hr
//   * Level 10 factory: 10K metal/hr, 5K energy/hr
//   * Collection: Automatic via collectAllFactoryIncome()
//   * Tracking: lastResourceGeneration timestamp per factory
//   * Minimum collection interval: 1 minute (prevents spam)
// ============================================================
// END OF FILE
// ============================================================
