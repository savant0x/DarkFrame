/**
 * Territory Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages clan territory control system with tile claiming, abandonment, and
 * defense bonus calculations. Validates adjacency requirements and territory limits.
 * Integrates with research/perk bonuses for reduced claiming costs.
 * 
 * Features:
 * - Territory claiming with cost (500 Metal + 500 Energy per tile, reduced by perks)
 * - Adjacency validation (new claims must be adjacent to existing territory)
 * - Defense bonus calculation (+10% per adjacent clan tile, max +50%)
 * - Territory abandonment with confirmation
 * - Territory lookup by coordinates
 * - Clan territory listing
 * - Territory limit enforcement
 * 
 * Integration:
 * - Drizzle ORM with MySQL database
 * - Perk system (territory cost reduction)
 * - Research bonuses (defense multipliers)
 * - Activity logging for claims/abandons
 * 
 * @module lib/territoryService
 */

import { eq, sql, and, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clans } from '@/lib/db/schema';
import { logClanActivity } from '@/lib/clanActivityService';
import { ClanActivityType, ClanBankTransactionType } from '@/types/clan.types';
import type { ClanBankTransaction, ClanTerritory } from '@/types/clan.types';

// Territory constants
export const TERRITORY_CONSTANTS = {
  BASE_CLAIM_COST_METAL: 500,
  BASE_CLAIM_COST_ENERGY: 500,
  DEFENSE_BONUS_PER_TILE: 10, // Percentage
  MAX_DEFENSE_BONUS: 50, // Percentage
  MAX_TERRITORIES: 100, // Default max territories per clan (deprecated - use level-based caps)
};

// Territory income constants (passive farming)
export const TERRITORY_INCOME_CONSTANTS = {
  BASE_INCOME_METAL: 1000,      // Base metal income per territory per day
  BASE_INCOME_ENERGY: 1000,     // Base energy income per territory per day
  SCALING_FACTOR: 0.1,          // 10% increase per clan level
  COLLECTION_HOUR: 0,           // UTC hour for daily collection (00:00)
};

// Territory limit scaling by clan level
export const TERRITORY_LEVEL_CAPS = [
  { minLevel: 1, maxTerritories: 25 },
  { minLevel: 6, maxTerritories: 50 },
  { minLevel: 11, maxTerritories: 100 },
  { minLevel: 16, maxTerritories: 200 },
  { minLevel: 21, maxTerritories: 400 },
  { minLevel: 26, maxTerritories: 700 },
  { minLevel: 31, maxTerritories: 1000 },
];

// Territory claiming cost tiers
export const TERRITORY_COST_TIERS = [
  { upTo: 10, costMetal: 2500, costEnergy: 2500 },
  { upTo: 25, costMetal: 3000, costEnergy: 3000 },
  { upTo: 50, costMetal: 3500, costEnergy: 3500 },
  { upTo: 100, costMetal: 4000, costEnergy: 4000 },
  { upTo: 250, costMetal: 5000, costEnergy: 5000 },
  { upTo: 500, costMetal: 6000, costEnergy: 6000 },
  { upTo: 750, costMetal: 7000, costEnergy: 7000 },
  { upTo: 1000, costMetal: 8000, costEnergy: 8000 },
];

export interface Territory {
  x: number;
  y: number;
  clanId: string;
  clanTag: string;
  claimedAt: Date;
  claimedBy: string; // Player username
}

// Row types come straight from the drizzle table definitions — no hand-maintained mirrors.
export type ClanRow = typeof clans.$inferSelect;
export type ClanMemberRow = ClanRow['members'][number];
export type ClanPerkRow = ClanRow['activePerks'][number];
export type ClanBankTransactionRow = ClanRow['bankTransactions'][number];

/**
 * Row shape for the last-territory-income select. The column was previously accessed via
 * raw SQL wrapped in `as unknown` casts because it was missing from the schema; it is now
 * a proper column (`clans.lastTerritoryIncomeCollection`) and read through the builder.
 */
export interface LastCollectionRow {
  last_territory_income_collection: Date | null;
}

/**
 * Legacy alias kept for the admin analytics route. Prefer `ClanRow` (inferred) — this is
 * now the same type rather than a parallel hand-written interface.
 */
export type ClanSqlRow = ClanRow;

/**
 * Claim territory tile for clan
 * Validates adjacency, cost, and territory limits
 * 
 * @param clanId - Clan ID
 * @param playerId - Player claiming territory (must be Officer+)
 * @param x - Tile X coordinate
 * @param y - Tile Y coordinate
 * @returns Claimed territory details and updated clan stats
 * @throws Error if requirements not met or insufficient resources
 * @example
 * const result = await claimTerritory('clan123', 'player456', 10, 15);
 * // result: { success: true, territory: {...}, cost: {...} }
 */
export async function claimTerritory(
  clanId: string,
  playerId: string,
  x: number,
  y: number
): Promise<{
  success: boolean;
  territory: ClanTerritory;
  cost: { metal: number; energy: number };
  defenseBonus: number;
}> {
  // Get clan
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clanRow = clanResult[0];
  if (!clanRow) {
    throw new Error('Clan not found');
  }

  const members = clanRow.members || [];
  const member = members.find((m) => m.playerId === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }

  // Check permissions (Officer, Co-Leader, or Leader)
  const allowedRoles = ['LEADER', 'CO_LEADER', 'OFFICER'];
  if (!allowedRoles.includes(member.role)) {
    throw new Error('Insufficient permissions to claim territory');
  }

  // Check if tile is already claimed
  const currentTerritories = clanRow.territories || [];
  const existingTerritory = currentTerritories.find((t) => t.tileX === x && t.tileY === y);
  if (existingTerritory) {
    throw new Error('Territory already claimed by your clan');
  }

  // Check if tile is claimed by another clan (typed builder query — the previous raw
  // JSON_CONTAINS fragment never ran on Postgres and its guard was runtime-dead;
  // FID-20260902-001 Option A converts it to a real jsonb containment check)
  const otherClanRows = await db.select({ id: clans.id }).from(clans)
    .where(and(
      ne(clans.id, clanId),
      sql`${clans.territories} @> ${JSON.stringify([{ x, y }])}::jsonb`
    ));
  if (otherClanRows.length > 0) {
    throw new Error('Territory already claimed by another clan');
  }

  // Validate adjacency (must be adjacent to existing territory, unless first claim)
  if (currentTerritories.length > 0) {
    const isAdjacent = currentTerritories.some((t) => {
      const dx = Math.abs(t.tileX - x);
      const dy = Math.abs(t.tileY - y);
      return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    });

    if (!isAdjacent) {
      throw new Error('Territory must be adjacent to existing clan territory');
    }
  }

  // Check territory limit (use level-based caps)
  const clanLevel = clanRow.levelCurrentLevel || 1;
  const maxTerritories = getMaxTerritoriesByLevel(clanLevel);
  if (currentTerritories.length >= maxTerritories) {
    throw new Error(`Territory limit reached (${maxTerritories} for level ${clanLevel})`);
  }

  // Calculate base cost using tiered system
  const territoryCount = currentTerritories.length;
  const baseCost = getTerritoryClaimCost(territoryCount);
  
  // Apply perk/research reductions
  let costReduction = 0;
  
  // Check for territory cost reduction from perks
  const activePerks = clanRow.activePerks || [];
  for (const perk of activePerks) {
    if (perk.bonus?.type === 'territory_cost') {
      costReduction += perk.bonus.value ?? 0;
    }
  }

  const finalCostMetal = Math.floor(baseCost.metal * (1 - costReduction / 100));
  const finalCostEnergy = Math.floor(baseCost.energy * (1 - costReduction / 100));

  // Check clan bank balance
  const bankMetal = Number(clanRow.bankTreasuryMetal) || 0;
  const bankEnergy = Number(clanRow.bankTreasuryEnergy) || 0;

  if (bankMetal < finalCostMetal) {
    throw new Error(
      `Insufficient metal in clan bank (need ${finalCostMetal}, have ${bankMetal})`
    );
  }
  if (bankEnergy < finalCostEnergy) {
    throw new Error(
      `Insufficient energy in clan bank (need ${finalCostEnergy}, have ${bankEnergy})`
    );
  }

  // Create territory object
  const newTerritory: ClanTerritory = {
    clanId,
    tileX: x,
    tileY: y,
    claimedAt: new Date(),
    claimedBy: playerId,
    defenseBonus: getDefenseBonus(clanId, x, y, currentTerritories.map((t) => ({ x: t.tileX, y: t.tileY }))),
  };

  // Deduct cost and add territory
  const updatedTerritories = [...currentTerritories, newTerritory];
  const newStatsTotalTerritories = (clanRow.statsTotalTerritories || 0) + 1;
  const newBankMetal = BigInt(bankMetal) - BigInt(finalCostMetal);
  const newBankEnergy = BigInt(bankEnergy) - BigInt(finalCostEnergy);

  await db.update(clans).set({
    territories: updatedTerritories,
    statsTotalTerritories: newStatsTotalTerritories,
    bankTreasuryMetal: Number(newBankMetal),
    bankTreasuryEnergy: Number(newBankEnergy),
  }).where(eq(clans.id, clanId));

  // Log activity (SCOPE #16: legacy divergent-column insert converted to the
  // canonical activity service so territory rows stop being written to the wrong columns)
  await logClanActivity(clanId, ClanActivityType.TERRITORY_CLAIMED, playerId, {
    x,
    y,
    cost: { metal: finalCostMetal, energy: finalCostEnergy },
    claimedBy: playerId,
  });

  // Defense bonus for this tile is computed at claim time on newTerritory (per-tile
  // bonus recomputes on read); reuse it for the result.
  const defenseBonus = newTerritory.defenseBonus;

  return {
    success: true,
    territory: newTerritory,
    cost: { metal: finalCostMetal, energy: finalCostEnergy },
    defenseBonus,
  };
}

/**
 * Abandon territory tile
 * Removes tile from clan control (no refund)
 * 
 * @param clanId - Clan ID
 * @param playerId - Player abandoning territory (must be Officer+)
 * @param x - Tile X coordinate
 * @param y - Tile Y coordinate
 * @returns Success status
 * @throws Error if not found or insufficient permissions
 */
export async function abandonTerritory(
  clanId: string,
  playerId: string,
  x: number,
  y: number
): Promise<{ success: boolean; message: string }> {
  // Get clan
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clanRow = clanResult[0];
  if (!clanRow) {
    throw new Error('Clan not found');
  }

  // Verify player is in clan and has permissions
  const members = clanRow.members || [];
  const member = members.find((m) => m.playerId === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }

  // Check permissions
  const allowedRoles = ['LEADER', 'CO_LEADER', 'OFFICER'];
  if (!allowedRoles.includes(member.role)) {
    throw new Error('Insufficient permissions to abandon territory');
  }

  // Check if territory exists
  const currentTerritories = clanRow.territories || [];
  const territory = currentTerritories.find((t) => t.tileX === x && t.tileY === y);
  if (!territory) {
    throw new Error('Territory not found');
  }

  // Remove territory
  const filteredTerritories = currentTerritories.filter((t) => !(t.tileX === x && t.tileY === y));
  const newStatsTotalTerritories = (clanRow.statsTotalTerritories || 0) - 1;

  await db.update(clans).set({
    territories: filteredTerritories,
    statsTotalTerritories: newStatsTotalTerritories,
  }).where(eq(clans.id, clanId));

  // Log activity (SCOPE #16: converted to the canonical activity service)
  await logClanActivity(clanId, ClanActivityType.TERRITORY_LOST, playerId, {
    x,
    y,
    abandonedBy: playerId,
  });

  return {
    success: true,
    message: `Territory (${x}, ${y}) abandoned`,
  };
}

/**
 * Get territory at specific coordinates
 * Returns clan info if territory is claimed
 * 
 * @param x - Tile X coordinate
 * @param y - Tile Y coordinate
 * @returns Territory info or null if unclaimed
 */
export async function getTerritoryAt(
  x: number,
  y: number
): Promise<{ clanId: string; clanTag: string; clanName: string; claimedAt: Date } | null> {
  // Typed builder query (the previous raw JSON_CONTAINS fragment never ran on Postgres —
  // its guard was runtime-dead; FID-20260902-001 Option A converts it to jsonb containment)
  const clanRows = await db.select().from(clans)
    .where(sql`${clans.territories} @> ${JSON.stringify([{ x, y }])}::jsonb`)
    .limit(1);
  const clanRow = clanRows[0];
  if (!clanRow) {
    return null;
  }

  const territories = clanRow.territories || [];
  const territory = territories.find((t) => t.tileX === x && t.tileY === y);
  if (!territory) {
    return null;
  }

  return {
    clanId: clanRow.id,
    clanTag: clanRow.tag,
    clanName: clanRow.name,
    // jsonb reads can yield ISO strings; normalize to the promised Date contract.
    claimedAt: new Date(territory.claimedAt),
  };
}

/**
 * Get all territories for a clan
 * Returns array of territory objects
 * 
 * @param clanId - Clan ID
 * @returns Array of territories
 */
export async function getClanTerritories(clanId: string): Promise<ClanTerritory[]> {
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clanRow = clanResult[0];
  if (!clanRow) {
    throw new Error('Clan not found');
  }

  return clanRow.territories || [];
}

/**
 * Calculate defense bonus for a territory
 * Based on number of adjacent clan tiles (+10% per tile, max +50%)
 * 
 * @param clanId - Clan ID
 * @param x - Tile X coordinate
 * @param y - Tile Y coordinate
 * @param territories - Optional territory array (for calculations before DB update)
 * @returns Defense bonus percentage
 */
export function getDefenseBonus(
  clanId: string,
  x: number,
  y: number,
  territories?: Array<{ x: number; y: number }>
): number {
  if (!territories) {
    // If no territories provided, this would need to fetch from DB
    // For now, return 0 (caller should provide territories)
    return 0;
  }

  // Count adjacent tiles owned by same clan
  let adjacentCount = 0;
  const adjacentOffsets = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const offset of adjacentOffsets) {
    const adjX = x + offset.dx;
    const adjY = y + offset.dy;
    const hasAdjacentTile = territories.some((t) => t.x === adjX && t.y === adjY);
    if (hasAdjacentTile) {
      adjacentCount++;
    }
  }

  // Calculate bonus (+10% per adjacent tile, max +50%)
  const bonus = Math.min(
    adjacentCount * TERRITORY_CONSTANTS.DEFENSE_BONUS_PER_TILE,
    TERRITORY_CONSTANTS.MAX_DEFENSE_BONUS
  );

  return bonus;
}

/**
 * Validate territory claim
 * Checks all requirements without making changes
 * 
 * @param clanId - Clan ID
 * @param playerId - Player attempting claim
 * @param x - Tile X coordinate
 * @param y - Tile Y coordinate
 * @returns Validation result with details
 */
export async function validateTerritoryClaim(
  clanId: string,
  playerId: string,
  x: number,
  y: number
): Promise<{
  valid: boolean;
  errors: string[];
  cost?: { metal: number; energy: number };
  adjacencyValid?: boolean;
}> {
  const errors: string[] = [];

  try {
    // Get clan
    const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
    const clanRow = clanResult[0] as ClanRow;
    if (!clanRow) {
      errors.push('Clan not found');
      return { valid: false, errors };
    }

    // Check member
    const members = clanRow.members || [];
    const member = members.find((m) => m.playerId === playerId);
    if (!member) {
      errors.push('Player is not a member of this clan');
    }

    // Check permissions
    const allowedRoles = ['LEADER', 'CO_LEADER', 'OFFICER'];
    if (member && !allowedRoles.includes(member.role)) {
      errors.push('Insufficient permissions (Officer+ required)');
    }

    // Check if already claimed
    const currentTerritories = clanRow.territories || [];
    const existingTerritory = currentTerritories.find((t) => t.tileX === x && t.tileY === y);
    if (existingTerritory) {
      errors.push('Territory already claimed by your clan');
    }

    // Check other clans (typed builder query — the raw fragment never ran on Postgres)
    const otherClanRows = await db.select({ id: clans.id }).from(clans)
      .where(and(
        ne(clans.id, clanId),
        sql`${clans.territories} @> ${JSON.stringify([{ x, y }])}::jsonb`
      ));
    if (otherClanRows.length > 0) {
      errors.push('Territory already claimed by another clan');
    }

    // Check adjacency
    let adjacencyValid = true;
    if (currentTerritories.length > 0) {
      const isAdjacent = currentTerritories.some((t) => {
        const dx = Math.abs(t.tileX - x);
        const dy = Math.abs(t.tileY - y);
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
      });

      if (!isAdjacent) {
        errors.push('Territory must be adjacent to existing clan territory');
        adjacencyValid = false;
      }
    }

    // Check limit (use level-based caps)
    const clanLevel = clanRow.levelCurrentLevel || 1;
    const maxTerritories = getMaxTerritoriesByLevel(clanLevel);
    if (currentTerritories.length >= maxTerritories) {
      errors.push(`Territory limit reached (${maxTerritories} for level ${clanLevel})`);
    }

    // Calculate cost using tiered system
    const territoryCount = currentTerritories.length;
    const baseCost = getTerritoryClaimCost(territoryCount);
    
    let costReduction = 0;
    const activePerks = clanRow.activePerks || [];
    for (const perk of activePerks) {
      if (perk.bonus?.type === 'territory_cost') {
        costReduction += perk.bonus.value ?? 0;
      }
    }

    const finalCostMetal = Math.floor(baseCost.metal * (1 - costReduction / 100));
    const finalCostEnergy = Math.floor(baseCost.energy * (1 - costReduction / 100));

    // Check balance
    const bankMetal = Number(clanRow.bankTreasuryMetal) || 0;
    const bankEnergy = Number(clanRow.bankTreasuryEnergy) || 0;

    if (bankMetal < finalCostMetal) {
      errors.push(`Insufficient metal (need ${finalCostMetal}, have ${bankMetal})`);
    }
    if (bankEnergy < finalCostEnergy) {
      errors.push(`Insufficient energy (need ${finalCostEnergy}, have ${bankEnergy})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      cost: { metal: finalCostMetal, energy: finalCostEnergy },
      adjacencyValid,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { valid: false, errors };
  }
}

/**
 * Get maximum territories allowed for clan based on level
 * 
 * @param clanLevel - Current clan level
 * @returns Maximum territory count
 * @example
 * const max = getMaxTerritoriesByLevel(25); // Returns 400
 */
export function getMaxTerritoriesByLevel(clanLevel: number): number {
  // Find the highest applicable cap
  let maxTerritories = TERRITORY_LEVEL_CAPS[0].maxTerritories;
  
  for (const cap of TERRITORY_LEVEL_CAPS) {
    if (clanLevel >= cap.minLevel) {
      maxTerritories = cap.maxTerritories;
    } else {
      break;
    }
  }
  
  return maxTerritories;
}

/**
 * Get territory claiming cost based on current territory count
 * 
 * @param currentTerritoryCount - How many territories clan currently owns
 * @returns Cost in metal and energy
 * @example
 * const cost = getTerritoryClaimCost(75); // Returns { metal: 4000, energy: 4000 }
 */
export function getTerritoryClaimCost(currentTerritoryCount: number): { metal: number; energy: number } {
  // Find applicable tier
  let costMetal = TERRITORY_COST_TIERS[TERRITORY_COST_TIERS.length - 1].costMetal;
  let costEnergy = TERRITORY_COST_TIERS[TERRITORY_COST_TIERS.length - 1].costEnergy;
  
  for (const tier of TERRITORY_COST_TIERS) {
    if (currentTerritoryCount < tier.upTo) {
      costMetal = tier.costMetal;
      costEnergy = tier.costEnergy;
      break;
    }
  }
  
  return { metal: costMetal, energy: costEnergy };
}

/**
 * Calculate daily passive income from territories
 * Income scales with clan level: baseIncome * (1 + (level - 1) * scalingFactor)
 * 
 * @param clanLevel - Current clan level
 * @param territoryCount - Number of territories owned
 * @returns Daily income in metal and energy
 * @example
 * const income = calculateDailyPassiveIncome(20, 75);
 * // Returns { metalPerDay: 217500, energyPerDay: 217500, perTerritory: 2900 }
 */
export function calculateDailyPassiveIncome(
  clanLevel: number,
  territoryCount: number
): {
  metalPerDay: number;
  energyPerDay: number;
  perTerritory: number;
} {
  // Calculate income per territory based on clan level
  const incomePerTerritory = Math.floor(
    TERRITORY_INCOME_CONSTANTS.BASE_INCOME_METAL * 
    (1 + (clanLevel - 1) * TERRITORY_INCOME_CONSTANTS.SCALING_FACTOR)
  );
  
  const totalMetalPerDay = incomePerTerritory * territoryCount;
  const totalEnergyPerDay = incomePerTerritory * territoryCount;
  
  return {
    metalPerDay: totalMetalPerDay,
    energyPerDay: totalEnergyPerDay,
    perTerritory: incomePerTerritory,
  };
}

/**
 * Collect daily passive income from territories and deposit to clan bank
 * Should be called automatically via cron job at midnight UTC
 * 
 * @param clanId - Clan ID to collect income for
 * @returns Collection result with amounts and timestamp
 * @throws Error if clan not found or collection already done today
 * @example
 * const result = await collectDailyTerritoryIncome('clan123');
 * // result: { success: true, metalCollected: 217500, energyCollected: 217500, timestamp: Date }
 */
export async function collectDailyTerritoryIncome(
  clanId: string
): Promise<{
  success: boolean;
  metalCollected: number;
  energyCollected: number;
  territoryCount: number;
  timestamp: Date;
  message: string;
}> {
  try {
    // Get clan
    const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
    const clanRow = clanResult[0] as ClanRow;
    if (!clanRow) {
      throw new Error('Clan not found');
    }
    
    const territories = clanRow.territories || [];
    const territoryCount = territories.length;
    
    // No territories = no income
    if (territoryCount === 0) {
      return {
        success: true,
        metalCollected: 0,
        energyCollected: 0,
        territoryCount: 0,
        timestamp: new Date(),
        message: 'No territories to collect income from',
      };
    }
    
    // Check if already collected today
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Dedup guard (SCOPE #11): previously a raw-SQL select whose result was never a plain
    // array on node-postgres — `undefined > 0` made this check silently pass and a second
    // same-day call re-collected income. Now a real column-backed read.
    const lastCollectionRows = await db
      .select({ lastCollection: clans.lastTerritoryIncomeCollection })
      .from(clans)
      .where(eq(clans.id, clanId));

    const lastCollectionRow = lastCollectionRows[0];
    const lastCollectionAt = lastCollectionRow?.lastCollection ?? null;
    
    if (lastCollectionAt && new Date(lastCollectionAt) >= todayStart) {
      return {
        success: false,
        metalCollected: 0,
        energyCollected: 0,
        territoryCount,
        timestamp: now,
        message: 'Income already collected today',
      };
    }
    
    // Calculate income
    const clanLevel = clanRow.levelCurrentLevel || 1;
    const income = calculateDailyPassiveIncome(clanLevel, territoryCount);
    
    // Update clan bank
    const newBankMetal = Number(clanRow.bankTreasuryMetal) + income.metalPerDay;
    const newBankEnergy = Number(clanRow.bankTreasuryEnergy) + income.energyPerDay;
    
    // Update bank transactions (transaction now conforms to ClanBankTransaction)
    const bankTransactions = clanRow.bankTransactions || [];
    const newTransaction: ClanBankTransaction = {
      transactionId: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
      type: ClanBankTransactionType.TERRITORY_INCOME,
      amount: {
        metal: income.metalPerDay,
        energy: income.energyPerDay,
      },
      timestamp: now,
      description: `Daily territory income from ${territoryCount} territories (${income.perTerritory} M/E per territory)`,
    };
    const updatedTransactions = [...bankTransactions, newTransaction];

    await db.update(clans).set({
      bankTreasuryMetal: newBankMetal,
      bankTreasuryEnergy: newBankEnergy,
      bankTransactions: updatedTransactions,
      lastTerritoryIncomeCollection: now,
    }).where(eq(clans.id, clanId));

    // Log activity (SCOPE #16: converted to the canonical activity service)
    await logClanActivity(clanId, ClanActivityType.TERRITORY_INCOME_COLLECTED, undefined, {
      territoryCount,
      metalCollected: income.metalPerDay,
      energyCollected: income.energyPerDay,
      perTerritory: income.perTerritory,
      clanLevel,
    });
    
    return {
      success: true,
      metalCollected: income.metalPerDay,
      energyCollected: income.energyPerDay,
      territoryCount,
      timestamp: now,
      message: `Collected ${income.metalPerDay} M + ${income.energyPerDay} E from ${territoryCount} territories`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      metalCollected: 0,
      energyCollected: 0,
      territoryCount: 0,
      timestamp: new Date(),
      message: `Error collecting income: ${message}`,
    };
  }
}

/**
 * Get projected income for a clan
 * Does not collect, just calculates what would be collected
 * 
 * @param clanId - Clan ID
 * @returns Projected income details
 * @example
 * const projection = await getProjectedTerritoryIncome('clan123');
 * // projection: { metalPerDay: 217500, energyPerDay: 217500, perTerritory: 2900, territoryCount: 75 }
 */
export async function getProjectedTerritoryIncome(
  clanId: string
): Promise<{
  metalPerDay: number;
  energyPerDay: number;
  perTerritory: number;
  territoryCount: number;
  clanLevel: number;
  nextCollection: Date;
  canCollectNow: boolean;
}> {
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clanRow = clanResult[0];
  if (!clanRow) {
    throw new Error('Clan not found');
  }
  
  const territories = clanRow.territories || [];
  const territoryCount = territories.length;
  const clanLevel = clanRow.levelCurrentLevel || 1;
  
  const income = calculateDailyPassiveIncome(clanLevel, territoryCount);
  
  // Calculate next collection time (midnight UTC)
  const now = new Date();
  const nextCollection = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  nextCollection.setUTCHours(TERRITORY_INCOME_CONSTANTS.COLLECTION_HOUR, 0, 0, 0);
  
  // Check if can collect now
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const lastCollectionRows = await db
    .select({ lastCollection: clans.lastTerritoryIncomeCollection })
    .from(clans)
    .where(eq(clans.id, clanId));

  const lastCollectionRow = lastCollectionRows[0];
  const lastCollectionAt = lastCollectionRow?.lastCollection ?? null;
  
  const canCollectNow = !lastCollectionAt || new Date(lastCollectionAt) < todayStart;
  
  return {
    ...income,
    territoryCount,
    clanLevel,
    nextCollection,
    canCollectNow,
  };
}
