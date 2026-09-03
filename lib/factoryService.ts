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

import { db } from '@/lib/db';
import { factories, players } from '@/lib/db/schema';
import { eq, and, sql, count, desc } from 'drizzle-orm';
import { Factory, AttackResult, Unit, Position, UnitType } from '@/types';
import { randomUUID } from 'node:crypto';
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
export function calculateFactoryIncome(factory: Factory): {
  metal: number;
  energy: number;
  hoursElapsed: number;
} {
  // If no lastResourceGeneration, initialize to now (no retroactive income)
  if (!factory.lastResourceGeneration) {
    return { metal: 0, energy: 0, hoursElapsed: 0 };
  }

  // Calculate time elapsed since last collection
  const now = new Date();
  const lastCollection = new Date(factory.lastResourceGeneration);
  const msElapsed = now.getTime() - lastCollection.getTime();
  const hoursElapsed = msElapsed / (1000 * 60 * 60); // Convert ms to hours

  // No income if less than 1 minute elapsed (prevents spam)
  if (hoursElapsed < 0.0167) { // 1 minute = 0.0167 hours
    return { metal: 0, energy: 0, hoursElapsed: 0 };
  }

  // Calculate income based on factory level and time elapsed
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
  // Get all factories owned by player
  const factoriesList = await db.select().from(factories).where(eq(factories.owner, username));

  if (factoriesList.length === 0) {
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

  // Calculate income for each factory
  for (const factory of factoriesList) {
    const income = calculateFactoryIncome(factory as unknown as Factory);
    
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

      // Update factory's lastResourceGeneration timestamp
      await db.update(factories)
        .set({ lastResourceGeneration: new Date() })
        .where(and(eq(factories.x, factory.x), eq(factories.y, factory.y)));
    }
  }

  // Award resources to player
  if (totalMetal > 0 || totalEnergy > 0) {
    const player = await db.select().from(players).where(eq(players.username, username)).limit(1);
    if (player.length > 0) {
      const newMetal = BigInt(player[0].resourcesMetal || 0) + BigInt(totalMetal);
      const newEnergy = BigInt(player[0].resourcesEnergy || 0) + BigInt(totalEnergy);

      await db.update(players)
        .set({ resourcesMetal: Number(newMetal), resourcesEnergy: Number(newEnergy) })
        .where(eq(players.username, username));

      console.log(`💰 ${username} collected passive income: ${totalMetal.toLocaleString()} Metal, ${totalEnergy.toLocaleString()} Energy from ${factoryDetails.length} factories`);
    }
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
  const player = await db.select().from(players).where(eq(players.username, username)).limit(1);
  
  if (player.length === 0) return BASE_PLAYER_POWER;
  
  const p = player[0];
  
  // Base power
  let power = BASE_PLAYER_POWER;
  
  // Add power from rank/level (10 power per rank)
  power += (p.rank || 1) * 10;
  
  // Add power from player's total military strength (PRIMARY POWER SOURCE)
  // totalStrength comes from all units' STR stats combined
  if (p.totalStrength) {
    power += p.totalStrength;
  }
  
  // Add power from units in inventory (secondary bonus)
  if (p.inventoryItems) {
    let inventory: any[] = [];
    try {
      inventory = typeof p.inventoryItems === 'string' ? JSON.parse(p.inventoryItems) : p.inventoryItems;
    } catch {}
    const units = inventory.filter((item: any) => item.type === 'UNIT');
    power += units.length * 50; // Each unit adds 50 power
  }
  
  return power;
}

/**
 * Get or create factory data for a tile
 */
export async function getFactoryData(x: number, y: number): Promise<Factory | null> {
  const factoryRow = await db.select().from(factories).where(and(eq(factories.x, x), eq(factories.y, y))).limit(1);
  
  // Create factory if it doesn't exist
  if (factoryRow.length === 0) {
    const level = 1; // All new factories start at Level 1
    const newFactory: Factory = {
      x,
      y,
      owner: null,
      defense: getFactoryDefense(level), // Level 1: 1,000 defense (exponential scaling)
      level: level,
      slots: getMaxSlots(level), // Level 1: 5,000 slots
      usedSlots: 0,
      productionRate: 1, // 1 unit per hour
      lastSlotRegen: new Date(), // Initialize with current time
      lastResourceGeneration: new Date(), // NEW: Initialize passive income tracking
      lastAttackedBy: null,
      lastAttackTime: null
    };
    
    await db.insert(factories).values(newFactory as any);
    return newFactory;
  }
  
  return factoryRow[0] as unknown as Factory;
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
  // Get factory data
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
  
  // Check if already owned by player
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
  // If the player already controls the maximum allowed number of factories,
  // block the capture and return a clear message. This ensures balance and
  // prevents exceeding the strategic cap.
  const ownedCountResult = await db.select({ count: sql`count(*)` }).from(factories).where(eq(factories.owner, username));
  const ownedCount = Number(ownedCountResult[0].count);
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
  if (factory.lastAttackedBy === username && factory.lastAttackTime) {
    const timeSinceLastAttack = Date.now() - new Date(factory.lastAttackTime).getTime();
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
  
  // Calculate power
  const playerPower = await calculatePlayerPower(username);
  
  // Attack calculation: (player power / factory defense) with RNG
  const successChance = Math.min(0.9, playerPower / factory.defense); // Max 90% chance
  const attackRoll = Math.random();
  const success = attackRoll < successChance;
  
  // Update factory
  if (success) {
    await db.update(factories)
      .set({
        lastAttackedBy: username,
        lastAttackTime: new Date(),
        owner: username,
        usedSlots: 0,
        lastResourceGeneration: new Date() // NEW: Initialize passive income on capture
      })
      .where(and(eq(factories.x, x), eq(factories.y, y)));
  } else {
    await db.update(factories)
      .set({
        lastAttackedBy: username,
        lastAttackTime: new Date()
      })
      .where(and(eq(factories.x, x), eq(factories.y, y)));
  }
  
  if (success) {
    console.log(`✅ ${username} captured factory at (${x}, ${y})! Power: ${playerPower} vs Defense: ${factory.defense}`);
    
    // Award XP for factory capture
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
  // Get factory
  const factory = await getFactoryData(x, y);
  if (!factory) {
    return { success: false, message: 'Factory not found' };
  }
  
  // Check ownership
  if (factory.owner !== username) {
    return { success: false, message: 'You do not control this factory' };
  }
  
  // Check slots
  if (factory.usedSlots >= factory.slots) {
    return { success: false, message: 'Factory is at maximum capacity' };
  }
  
  // Get player
  const playerResult = await db.select().from(players).where(eq(players.username, username)).limit(1);
  if (playerResult.length === 0) {
    return { success: false, message: 'Player not found' };
  }
  
  const player = playerResult[0];
  
  // Check resources
  if ((player.resourcesMetal || 0) < UNIT_COST_METAL || (player.resourcesEnergy || 0) < UNIT_COST_ENERGY) {
    return {
      success: false,
      message: `Insufficient resources. Need ${UNIT_COST_METAL} Metal and ${UNIT_COST_ENERGY} Energy`
    };
  }
  
  // Create unit
  const unit: Unit = {
    id: randomUUID(),
    type: UnitType.T1_Rifleman, // Default Tier 1 unit
    strength: 5, // T1_Rifleman STR
    defense: 0,  // T1_Rifleman is STR unit, no DEF
    producedAt: { x, y },
    producedDate: new Date(),
    owner: username
  };
  
  // Update player: deduct resources, add unit to inventory
  let inventory: any[] = [];
  if (player.inventoryItems) {
    try {
      inventory = typeof player.inventoryItems === 'string' ? JSON.parse(player.inventoryItems) : player.inventoryItems;
    } catch {}
  }
  inventory.push(unit);

  const newMetal = BigInt(player.resourcesMetal || 0) - BigInt(UNIT_COST_METAL);
  const newEnergy = BigInt(player.resourcesEnergy || 0) - BigInt(UNIT_COST_ENERGY);

  await db.update(players)
    .set({
      resourcesMetal: Number(newMetal),
      resourcesEnergy: Number(newEnergy),
      inventoryItems: inventory as any
    })
    .where(eq(players.username, username));
  
  // Update factory: increment used slots (read current, then set new value)
  const factoryRow = await db.select().from(factories).where(and(eq(factories.x, x), eq(factories.y, y))).limit(1);
  const currentUsedSlots = factoryRow.length > 0 ? factoryRow[0].usedSlots : 0;

  await db.update(factories)
    .set({ usedSlots: currentUsedSlots + 1 })
    .where(and(eq(factories.x, x), eq(factories.y, y)));
  
  console.log(`🏭 ${username} produced unit at factory (${x}, ${y})`);
  
  return {
    success: true,
    message: `Unit produced successfully!\n\nCost: ${UNIT_COST_METAL} Metal + ${UNIT_COST_ENERGY} Energy\nSlots used: ${currentUsedSlots + 1}/${factory.slots}`,
    unit
  };
}

/**
 * Get all factories controlled by a player
 */
export async function getPlayerFactories(username: string): Promise<Factory[]> {
  const factoriesList = await db.select().from(factories).where(eq(factories.owner, username));
  
  return factoriesList as unknown as Factory[];
}

/**
 * Get total unit count for a player
 */
export async function getPlayerUnitCount(username: string): Promise<number> {
  const playerResult = await db.select().from(players).where(eq(players.username, username)).limit(1);
  if (playerResult.length === 0) return 0;
  
  const player = playerResult[0];
  if (!player.inventoryItems) return 0;
  
  let inventory: any[] = [];
  try {
    inventory = typeof player.inventoryItems === 'string' ? JSON.parse(player.inventoryItems) : player.inventoryItems;
  } catch {}
  
  const units = inventory.filter((item: any) => item.type === 'UNIT');
  return units.length;
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
