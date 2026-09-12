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
import { eq, and, sql, isNull, gte, lte } from 'drizzle-orm';
import { Factory, AttackResult, Unit, UnitType, InventoryItem, TutorialInventoryItem } from '@/types';
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
/**
 * Recount a player's factory_count column from the factories table.
 *
 * players.factory_count is a denormalized counter consumed by the player mapper,
 * the sanitized client projection (StatsPanel "Factories" readout), unit-slot
 * capacity (100 + count × 50), and battleService — but no ownership transition
 * maintained it, so it stayed at its default 0 forever (FID-20260908-004). A
 * single-statement recount (instead of read-modify-write ±1) is atomic,
 * self-healing against any drift, and inherently idempotent.
 */
export async function recountPlayerFactoryCount(username: string): Promise<number> {
  const result = await db
    .update(players)
    .set({
      factoryCount: sql`(SELECT count(*) FROM ${factories} WHERE ${factories.owner} = ${username})`,
    })
    .where(eq(players.username, username))
    .returning({ factoryCount: players.factoryCount });
  return result[0]?.factoryCount ?? 0;
}

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
 * JSON parse boundary for players.inventoryItems. The column physically holds
 * THREE entry shapes (see the schema annotation): harvested/found InventoryItem,
 * tutorial-granted TutorialInventoryItem, and full Unit objects pushed by
 * produceUnit since the Mongo era. Malformed jsonb is logged and treated as
 * empty — never fabricated.
 */
function parseInventory(
  raw: Array<InventoryItem | TutorialInventoryItem | Unit> | string | null
): Array<InventoryItem | TutorialInventoryItem | Unit> {
  if (!raw) return [];
  if (typeof raw !== 'string') return raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Array<InventoryItem | TutorialInventoryItem | Unit>;
    console.warn('[factoryService] inventoryItems jsonb parsed to a non-array — treating as empty');
    return [];
  } catch (error) {
    console.warn('[factoryService] malformed inventoryItems jsonb — treating as empty', error);
    return [];
  }
}

/**
 * Discriminator for Unit entries inside the mixed inventoryItems jsonb.
 * The legacy `type === 'UNIT'` filter could never match (Unit.type is a
 * UnitType value like 'T1_RIFLEMAN', and InventoryItem.type is an ItemType) —
 * Unit entries are identified by their producedAt/strength shape instead.
 */
function isUnitEntry(item: InventoryItem | TutorialInventoryItem | Unit): item is Unit {
  return 'producedAt' in item && 'strength' in item;
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
  
  // Add power from units held in inventoryItems (secondary bonus)
  const inventory = parseInventory(p.inventoryItems);
  const inventoryUnits = inventory.filter(isUnitEntry);
  power += inventoryUnits.length * 50; // Each unit adds 50 power
  
  return power;
}

/**
 * Get or create factory data for a tile
 */
/**
 * Nearest owner-less factory to a coordinate within `radius` (Chebyshev),
 * lowest-level first on ties. FID-073: used by the bot factory-raid phase to
 * pick contest targets. Returns null when the district has no wild factories.
 */
export async function findNearestWildFactory(
  x: number,
  y: number,
  radius: number
): Promise<Factory | null> {
  const candidates = await db
    .select()
    .from(factories)
    .where(
      and(
        isNull(factories.owner),
        gte(factories.x, x - radius),
        lte(factories.x, x + radius),
        gte(factories.y, y - radius),
        lte(factories.y, y + radius)
      )
    );

  let best: Factory | null = null;
  let bestDist = Infinity;
  for (const row of candidates) {
    const dist = Math.max(Math.abs(row.x - x), Math.abs(row.y - y));
    if (dist > radius) continue;
    if (dist < bestDist || (dist === bestDist && (row.level ?? 1) < (best?.level ?? 99))) {
      best = row as unknown as Factory;
      bestDist = dist;
    }
  }
  return best;
}

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
    
    // pg numeric arrives as string — map the domain number explicitly (no cast)
    await db.insert(factories).values({
      ...newFactory,
      productionRate: String(newFactory.productionRate),
    });
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

    // Maintain the denormalized ownership counter (FID-20260908-004)
    await recountPlayerFactoryCount(username);
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

    // FID-20260912-076 War Engine v2: capturing a factory owned by a warring
    // clan scores for the captor's clan (non-fatal on any lookup failure).
    try {
      if (factory.owner) {
        const { recordWarFactoryCapture } = await import('@/lib/clanWarfareService');
        const { getPlayer } = await import('@/lib/playerService');
        const [attacker, defender] = await Promise.all([
          getPlayer(username).catch(() => null),
          getPlayer(factory.owner).catch(() => null),
        ]);
        if (attacker?.clanId && defender?.clanId && attacker.clanId !== defender.clanId) {
          await recordWarFactoryCapture(attacker.clanId, defender.clanId, username, x, y);
        }
      }
    } catch (warErr) {
      console.error('⚠️ War capture scoring failed (non-fatal):', warErr);
    }
    
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
  const inventory = parseInventory(player.inventoryItems);
  inventory.push(unit);

  const newMetal = BigInt(player.resourcesMetal || 0) - BigInt(UNIT_COST_METAL);
  const newEnergy = BigInt(player.resourcesEnergy || 0) - BigInt(UNIT_COST_ENERGY);

  await db.update(players)
    .set({
      resourcesMetal: Number(newMetal),
      resourcesEnergy: Number(newEnergy),
      inventoryItems: inventory,
      // Maintain the aggregate combat totals (FID-20260908-003 addendum):
      // factory-produced units are part of the army and must raise
      // totalStrength/totalDefense like build-unit does, or Military Power
      // never reflects them.
      totalStrength: (player.totalStrength || 0) + unit.strength,
      totalDefense: (player.totalDefense || 0) + unit.defense,
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
  
  const inventory = parseInventory(player.inventoryItems);
  return inventory.filter(isUnitEntry).length;
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
