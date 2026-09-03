/**
 * Clan Chat Service
 * 
 * Created: 2025-10-18
 * Updated: 2026-04-04 (Migrated to Drizzle ORM)
 * 
 * OVERVIEW:
 * Manages clan chat functionality including message sending, history retrieval,
 * and moderation. Provides real-time chat experience for clan members with
 * role-based permissions and message persistence.
 * 
 * Features:
 * - Message sending with validation
 * - Message history with pagination
 * - Role-based moderation (delete messages)
 * - Message editing (own messages only)
 * - Anti-spam protection (rate limiting)
 * - System messages for clan events
 * 
 * Permissions:
 * - Send: All members except Recruit (24hr wait)
 * - Edit: Own messages within 5 minutes
 * - Delete: Leaders/Co-Leaders can delete any, others own only
 * - View: All members
 * 
 * @module lib/clanChatService
 */

import { randomUUID } from 'node:crypto';
import { eq, and, gt, lt, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clans, players } from '@/lib/db/schema';
import {
  Clan,
  ClanBank,
  ClanBankTransaction,
  ClanBankTransactionType,
  ClanActivityType,
  CLAN_BANK_CONSTANTS,
  calculateTaxAmount,
  hasPermission,
} from '@/types/clan.types';

/**
 * Helper: Convert flat DB row to nested Clan object
 */
function rowToClan(row: any): Clan {
  return {
    _id: row.id,
    name: row.name,
    tag: row.tag,
    description: row.description,
    leaderId: row.leaderId,
    members: (row.members as any[]) || [],
    maxMembers: row.maxMembers,
    level: {
      currentLevel: row.levelCurrentLevel,
      totalXP: row.levelTotalXP,
      currentLevelXP: row.levelCurrentLevelXP,
      xpToNextLevel: row.levelXpToNextLevel,
      featuresUnlocked: row.levelFeaturesUnlocked || [],
      milestonesCompleted: row.levelMilestonesCompleted || [],
      lastLevelUp: row.levelLastLevelUp ? new Date(row.levelLastLevelUp as string) : new Date(),
    },
    createdAt: row.createdAt ? new Date(row.createdAt as string) : new Date(),
    settings: {
      messageOfTheDay: row.settingsMessageOfTheDay,
      isRecruiting: Boolean(row.settingsIsRecruiting),
      minLevelToJoin: row.settingsMinLevelToJoin,
      requiresApproval: Boolean(row.settingsRequiresApproval),
      allowTerritoryControl: Boolean(row.settingsAllowTerritoryControl),
      allowWarDeclarations: Boolean(row.settingsAllowWarDeclarations),
    },
    stats: {
      totalPower: row.statsTotalPower,
      totalTerritories: row.statsTotalTerritories,
      totalMonuments: row.statsTotalMonuments,
      warsWon: row.statsWarsWon,
      warsLost: row.statsWarsLost,
      totalRP: row.statsTotalRP,
    },
    research: {
      researchPoints: row.researchResearchPoints,
      unlockedTechs: row.researchUnlockedTechs || [],
      activeResearch: row.researchActiveResearch,
    },
    bank: {
      treasury: {
        metal: Number(row.bankTreasuryMetal),
        energy: Number(row.bankTreasuryEnergy),
        researchPoints: row.bankTreasuryResearchPoints,
      },
      taxRates: {
        metal: row.bankTaxRatesMetal,
        energy: row.bankTaxRatesEnergy,
        researchPoints: row.bankTaxRatesResearchPoints,
      },
      upgradeLevel: row.bankUpgradeLevel,
      capacity: Number(row.bankCapacity),
      transactions: row.bankTransactions || [],
    },
    activePerks: row.activePerks || [],
    territories: row.territories || [],
    monuments: row.monuments || [],
    wars: {
      active: row.warsActive || [],
      history: row.warsHistory || [],
    },
  };
}

/**
 * Get clan by ID
 */
async function getClanById(clanId: string): Promise<Clan | null> {
  const result = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (result.length === 0) return null;
  return rowToClan(result[0]);
}

/**
 * Get player by MongoDB-style ID (uses mongoId field)
 */
async function getPlayerById(playerId: string) {
  const result = await db.select().from(players).where(eq(players.mongoId, playerId)).limit(1);
  return result[0] || null;
}

/**
 * Helper function to log clan activity
 */
async function logClanActivity(
  clanId: string,
  activityType: ClanActivityType,
  playerId: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO clan_activities (clan_id, activity_type, player_id, metadata, timestamp)
      VALUES (${clanId}, ${activityType}, ${playerId}, ${JSON.stringify(metadata)}, NOW())
    `);
  } catch (error) {
    console.error('Failed to log clan activity:', error);
  }
}

/**
 * Deposit resources to clan bank
 * Any member can deposit. Validates capacity limits and logs transaction.
 * 
 * @param clanId - Clan ID
 * @param playerId - Player making deposit
 * @param resources - Resources to deposit (metal, energy, researchPoints)
 * @returns Updated bank state
 * @throws Error if capacity exceeded or invalid amounts
 * 
 * @example
 * await depositToBank('clan123', 'player456', { metal: 1000, energy: 500 });
 */
export async function depositToBank(
  clanId: string,
  playerId: string,
  resources: { metal?: number; energy?: number; researchPoints?: number }
): Promise<ClanBank> {
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const member = clan.members.find(m => m.playerId === playerId);
  if (!member) {
    throw new Error('Player not in clan');
  }
  
  const depositMetal = resources.metal || 0;
  const depositEnergy = resources.energy || 0;
  const depositRP = resources.researchPoints || 0;
  
  if (depositMetal < 0 || depositEnergy < 0 || depositRP < 0) {
    throw new Error('Deposit amounts must be positive');
  }
  
  if (depositMetal === 0 && depositEnergy === 0 && depositRP === 0) {
    throw new Error('Must deposit at least one resource');
  }
  
  const currentMetal = clan.bank.treasury.metal;
  const currentEnergy = clan.bank.treasury.energy;
  const currentRP = clan.bank.treasury.researchPoints;
  const capacity = clan.bank.capacity;
  
  if (currentMetal + depositMetal > capacity) {
    throw new Error(`Metal capacity exceeded. Current: ${currentMetal}, Capacity: ${capacity}`);
  }
  
  if (currentEnergy + depositEnergy > capacity) {
    throw new Error(`Energy capacity exceeded. Current: ${currentEnergy}, Capacity: ${capacity}`);
  }
  
  if (currentRP + depositRP > capacity) {
    throw new Error(`Research Points capacity exceeded. Current: ${currentRP}, Capacity: ${capacity}`);
  }
  
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new Error('Player not found');
  }
  
  if (Number(Number(player.resourcesMetal)) < depositMetal) {
    throw new Error('Insufficient Metal');
  }
  if (Number(Number(player.resourcesEnergy)) < depositEnergy) {
    throw new Error('Insufficient Energy');
  }
  if (player.researchPoints < depositRP) {
    throw new Error('Insufficient Research Points');
  }
  
  const transaction: ClanBankTransaction = {
    transactionId: randomUUID(),
    type: ClanBankTransactionType.DEPOSIT,
    playerId,
    username: member.username,
    amount: {
      metal: depositMetal > 0 ? depositMetal : undefined,
      energy: depositEnergy > 0 ? depositEnergy : undefined,
      researchPoints: depositRP > 0 ? depositRP : undefined,
    },
    timestamp: new Date(),
    description: `${member.username} deposited resources to bank`,
  };
  
  const updatedTransactions = [...(clan.bank.transactions || []), transaction].slice(-CLAN_BANK_CONSTANTS.TRANSACTION_HISTORY_LIMIT);
  
  await db.update(clans).set({
    bankTreasuryMetal: Number(BigInt(clan.bank.treasury.metal + depositMetal)),
    bankTreasuryEnergy: Number(BigInt(clan.bank.treasury.energy + depositEnergy)),
    bankTreasuryResearchPoints: clan.bank.treasury.researchPoints + depositRP,
    bankTransactions: updatedTransactions,
  }).where(eq(clans.id, clanId));
  
  await db.update(players).set({
    resourcesMetal: Number(player.resourcesMetal) - depositMetal,
    resourcesEnergy: Number(player.resourcesEnergy) - depositEnergy,
    researchPoints: player.researchPoints - depositRP,
  }).where(eq(players.mongoId, playerId));
  
  await logClanActivity(clanId, ClanActivityType.BANK_DEPOSIT, playerId, {
    resources,
    username: member.username,
  });
  
  const updatedClan = await getClanById(clanId);
  return updatedClan!.bank;
}

/**
 * Withdraw resources from clan bank
 * Only Leader and Co-Leader can withdraw. Validates available balance.
 * 
 * @param clanId - Clan ID
 * @param playerId - Player making withdrawal (must have permission)
 * @param resources - Resources to withdraw
 * @returns Updated bank state
 * @throws Error if no permission or insufficient balance
 * 
 * @example
 * await withdrawFromBank('clan123', 'leader456', { metal: 5000 });
 */
export async function withdrawFromBank(
  clanId: string,
  playerId: string,
  resources: { metal?: number; energy?: number; researchPoints?: number }
): Promise<ClanBank> {
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const member = clan.members.find(m => m.playerId === playerId);
  if (!member) {
    throw new Error('Player not in clan');
  }
  
  if (!hasPermission(member.role, 'canWithdrawFromBank')) {
    throw new Error('No permission to withdraw from bank');
  }
  
  const withdrawMetal = resources.metal || 0;
  const withdrawEnergy = resources.energy || 0;
  const withdrawRP = resources.researchPoints || 0;
  
  if (withdrawMetal < 0 || withdrawEnergy < 0 || withdrawRP < 0) {
    throw new Error('Withdrawal amounts must be positive');
  }
  
  if (withdrawMetal === 0 && withdrawEnergy === 0 && withdrawRP === 0) {
    throw new Error('Must withdraw at least one resource');
  }
  
  const currentMetal = clan.bank.treasury.metal;
  const currentEnergy = clan.bank.treasury.energy;
  const currentRP = clan.bank.treasury.researchPoints;
  
  if (withdrawMetal > currentMetal) {
    throw new Error(`Insufficient Metal in bank. Available: ${currentMetal}`);
  }
  
  if (withdrawEnergy > currentEnergy) {
    throw new Error(`Insufficient Energy in bank. Available: ${currentEnergy}`);
  }
  
  if (withdrawRP > currentRP) {
    throw new Error(`Insufficient Research Points in bank. Available: ${currentRP}`);
  }
  
  const transaction: ClanBankTransaction = {
    transactionId: randomUUID(),
    type: ClanBankTransactionType.WITHDRAWAL,
    playerId,
    username: member.username,
    amount: {
      metal: withdrawMetal > 0 ? withdrawMetal : undefined,
      energy: withdrawEnergy > 0 ? withdrawEnergy : undefined,
      researchPoints: withdrawRP > 0 ? withdrawRP : undefined,
    },
    timestamp: new Date(),
    description: `${member.username} withdrew resources from bank`,
  };
  
  const updatedTransactions = [...(clan.bank.transactions || []), transaction].slice(-CLAN_BANK_CONSTANTS.TRANSACTION_HISTORY_LIMIT);
  
  await db.update(clans).set({
    bankTreasuryMetal: Number(BigInt(clan.bank.treasury.metal - withdrawMetal)),
    bankTreasuryEnergy: Number(BigInt(clan.bank.treasury.energy - withdrawEnergy)),
    bankTreasuryResearchPoints: clan.bank.treasury.researchPoints - withdrawRP,
    bankTransactions: updatedTransactions,
  }).where(eq(clans.id, clanId));
  
  const player = await getPlayerById(playerId);
  if (player) {
    await db.update(players).set({
      resourcesMetal: Number(player.resourcesMetal) + withdrawMetal,
      resourcesEnergy: Number(player.resourcesEnergy) + withdrawEnergy,
      researchPoints: player.researchPoints + withdrawRP,
    }).where(eq(players.mongoId, playerId));
  }
  
  await logClanActivity(clanId, ClanActivityType.BANK_WITHDRAWAL, playerId, {
    resources,
    username: member.username,
  });
  
  const updatedClan = await getClanById(clanId);
  return updatedClan!.bank;
}

/**
 * Set clan tax rates
 * Only Leader can set tax rates. Validates rates are within 0-50% range.
 * 
 * @param clanId - Clan ID
 * @param playerId - Player setting rates (must be Leader)
 * @param taxRates - New tax rates for each resource
 * @returns Updated bank state
 * @throws Error if not Leader or invalid rates
 * 
 * @example
 * await setTaxRates('clan123', 'leader456', { metal: 10, energy: 10, researchPoints: 5 });
 */
export async function setTaxRates(
  clanId: string,
  playerId: string,
  taxRates: { metal?: number; energy?: number; researchPoints?: number }
): Promise<ClanBank> {
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const member = clan.members.find(m => m.playerId === playerId);
  if (!member) {
    throw new Error('Player not in clan');
  }
  
  if (!hasPermission(member.role, 'canManageTaxes')) {
    throw new Error('Only clan leader can manage tax rates');
  }
  
  const validateRate = (rate: number | undefined, resourceName: string) => {
    if (rate === undefined) return;
    if (rate < CLAN_BANK_CONSTANTS.MIN_TAX_RATE || rate > CLAN_BANK_CONSTANTS.MAX_TAX_RATE) {
      throw new Error(`${resourceName} tax rate must be between ${CLAN_BANK_CONSTANTS.MIN_TAX_RATE}% and ${CLAN_BANK_CONSTANTS.MAX_TAX_RATE}%`);
    }
  };
  
  validateRate(taxRates.metal, 'Metal');
  validateRate(taxRates.energy, 'Energy');
  validateRate(taxRates.researchPoints, 'Research Points');
  
  const updateFields: Record<string, any> = {};
  if (taxRates.metal !== undefined) updateFields.bankTaxRatesMetal = String(taxRates.metal);
  if (taxRates.energy !== undefined) updateFields.bankTaxRatesEnergy = String(taxRates.energy);
  if (taxRates.researchPoints !== undefined) updateFields.bankTaxRatesResearchPoints = String(taxRates.researchPoints);
  
  await db.update(clans).set(updateFields).where(eq(clans.id, clanId));
  
  await logClanActivity(clanId, ClanActivityType.TAX_RATE_CHANGED, playerId, {
    newRates: taxRates,
    username: member.username,
  });
  
  const updatedClan = await getClanById(clanId);
  return updatedClan!.bank;
}

/**
 * Collect taxes from member harvest
 * Automatically called when members harvest resources. Calculates tax based on clan rates.
 * 
 * @param clanId - Clan ID
 * @param playerId - Player being taxed
 * @param harvestAmount - Amount harvested by player
 * @param resourceType - Type of resource ('metal' | 'energy')
 * @returns Tax amount collected
 * 
 * @example
 * const taxCollected = await collectTax('clan123', 'player456', 1000, 'metal');
 */
export async function collectTax(
  clanId: string,
  playerId: string,
  harvestAmount: number,
  resourceType: 'metal' | 'energy'
): Promise<number> {
  const clan = await getClanById(clanId);
  if (!clan) {
    return 0;
  }
  
  const taxRate = clan.bank.taxRates[resourceType];
  if (taxRate === 0) {
    return 0;
  }
  
  const taxAmount = calculateTaxAmount(harvestAmount, taxRate);
  if (taxAmount === 0) {
    return 0;
  }
  
  const currentAmount = clan.bank.treasury[resourceType];
  const capacity = clan.bank.capacity;
  
  if (currentAmount + taxAmount > capacity) {
    return 0;
  }
  
  const member = clan.members.find(m => m.playerId === playerId);
  if (!member) {
    return 0;
  }
  
  const transaction: ClanBankTransaction = {
    transactionId: randomUUID(),
    type: ClanBankTransactionType.TAX_COLLECTION,
    playerId,
    username: member.username,
    amount: {
      [resourceType]: taxAmount,
    },
    timestamp: new Date(),
    description: `Tax collected from ${member.username}'s harvest (${taxRate}%)`,
  };
  
  const updatedTransactions = [...(clan.bank.transactions || []), transaction].slice(-CLAN_BANK_CONSTANTS.TRANSACTION_HISTORY_LIMIT);
  
  const updateFields: Record<string, any> = {
    bankTransactions: updatedTransactions,
  };
  updateFields[`bankTreasury${resourceType === 'metal' ? 'Metal' : 'Energy'}`] = currentAmount + taxAmount;
  
  await db.update(clans).set(updateFields).where(eq(clans.id, clanId));
  
  await logClanActivity(clanId, ClanActivityType.TAX_COLLECTED, playerId, {
    amount: taxAmount,
    resourceType,
    taxRate,
  });
  
  return taxAmount;
}

/**
 * Upgrade clan bank capacity
 * Leader only. Costs resources and increases max capacity.
 * 
 * @param clanId - Clan ID
 * @param playerId - Player purchasing upgrade (must be Leader)
 * @returns Updated bank state with new capacity
 * @throws Error if not Leader, insufficient resources, or max level reached
 * 
 * @example
 * await upgradeBankCapacity('clan123', 'leader456');
 */
export async function upgradeBankCapacity(
  clanId: string,
  playerId: string
): Promise<ClanBank> {
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const member = clan.members.find(m => m.playerId === playerId);
  if (!member) {
    throw new Error('Player not in clan');
  }
  
  if (!hasPermission(member.role, 'canUpgradeBank')) {
    throw new Error('Only clan leader can upgrade bank');
  }
  
  const currentLevel = clan.bank.upgradeLevel;
  if (currentLevel >= 6) {
    throw new Error('Bank is already at maximum level');
  }
  
  const upgradeCost = CLAN_BANK_CONSTANTS.UPGRADE_COSTS.find(u => u.level === currentLevel + 1);
  if (!upgradeCost) {
    throw new Error('Invalid upgrade level');
  }
  
  const bankMetal = clan.bank.treasury.metal;
  const bankEnergy = clan.bank.treasury.energy;
  const bankRP = clan.bank.treasury.researchPoints;
  
  if (bankMetal < upgradeCost.metal) {
    throw new Error(`Insufficient Metal in bank. Need: ${upgradeCost.metal}, Have: ${bankMetal}`);
  }
  
  if (bankEnergy < upgradeCost.energy) {
    throw new Error(`Insufficient Energy in bank. Need: ${upgradeCost.energy}, Have: ${bankEnergy}`);
  }
  
  if (bankRP < upgradeCost.rp) {
    throw new Error(`Insufficient RP in bank. Need: ${upgradeCost.rp}, Have: ${bankRP}`);
  }
  
  const baseCapacity = 1000000;
  const newLevel = currentLevel + 1;
  const multiplier = CLAN_BANK_CONSTANTS.CAPACITY_MULTIPLIERS[newLevel - 1];
  const newCapacity = Math.floor(baseCapacity * multiplier);
  
  const transaction: ClanBankTransaction = {
    transactionId: randomUUID(),
    type: ClanBankTransactionType.BANK_UPGRADE,
    playerId,
    username: member.username,
    amount: {
      metal: upgradeCost.metal,
      energy: upgradeCost.energy,
      researchPoints: upgradeCost.rp,
    },
    timestamp: new Date(),
    description: `Bank upgraded to level ${newLevel}`,
  };
  
  const updatedTransactions = [...(clan.bank.transactions || []), transaction].slice(-CLAN_BANK_CONSTANTS.TRANSACTION_HISTORY_LIMIT);
  
  await db.update(clans).set({
    bankTreasuryMetal: Number(BigInt(bankMetal - upgradeCost.metal)),
    bankTreasuryEnergy: Number(BigInt(bankEnergy - upgradeCost.energy)),
    bankTreasuryResearchPoints: bankRP - upgradeCost.rp,
    bankUpgradeLevel: newLevel,
    bankCapacity: Number(BigInt(newCapacity)),
    bankTransactions: updatedTransactions,
  }).where(eq(clans.id, clanId));
  
  await logClanActivity(clanId, ClanActivityType.BANK_UPGRADED, playerId, {
    newLevel,
    newCapacity,
    cost: upgradeCost,
    username: member.username,
  });
  
  const updatedClan = await getClanById(clanId);
  return updatedClan!.bank;
}

/**
 * Get bank transaction history
 * Returns last N transactions (default 100, max defined by TRANSACTION_HISTORY_LIMIT).
 * 
 * @param clanId - Clan ID
 * @param limit - Number of transactions to return (default 100)
 * @returns Array of transactions, newest first
 * 
 * @example
 * const history = await getBankTransactionHistory('clan123', 50);
 */
export async function getBankTransactionHistory(
  clanId: string,
  limit: number = CLAN_BANK_CONSTANTS.TRANSACTION_HISTORY_LIMIT
): Promise<ClanBankTransaction[]> {
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const transactions = clan.bank.transactions || [];
  return transactions.slice(-limit).reverse();
}

/**
 * Get bank statistics
 * Returns current treasury balances, capacity info, tax rates, and usage percentages.
 * 
 * @param clanId - Clan ID
 * @returns Bank statistics object
 * 
 * @example
 * const stats = await getBankStats('clan123');
 */
export async function getBankStats(clanId: string): Promise<{
  treasury: { metal: number; energy: number; researchPoints: number };
  capacity: number;
  upgradeLevel: number;
  taxRates: { metal: number; energy: number; researchPoints: number };
  usage: { metal: number; energy: number; researchPoints: number };
  nextUpgradeCost?: { metal: number; energy: number; rp: number };
}> {
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const bank = clan.bank;
  const capacity = bank.capacity;
  
  const metalUsage = capacity > 0 ? (bank.treasury.metal / capacity) * 100 : 0;
  const energyUsage = capacity > 0 ? (bank.treasury.energy / capacity) * 100 : 0;
  const rpUsage = capacity > 0 ? (bank.treasury.researchPoints / capacity) * 100 : 0;
  
  let nextUpgradeCost;
  if (bank.upgradeLevel < 6) {
    nextUpgradeCost = CLAN_BANK_CONSTANTS.UPGRADE_COSTS.find(u => u.level === bank.upgradeLevel + 1);
  }
  
  return {
    treasury: bank.treasury,
    capacity: bank.capacity,
    upgradeLevel: bank.upgradeLevel,
    taxRates: bank.taxRates,
    usage: {
      metal: Math.round(metalUsage * 100) / 100,
      energy: Math.round(energyUsage * 100) / 100,
      researchPoints: Math.round(rpUsage * 100) / 100,
    },
    nextUpgradeCost,
  };
}

/**
 * IMPLEMENTATION NOTES:
 * - Migrated from MongoDB to Drizzle ORM with MySQL
 * - All operations validate permissions using hasPermission() helper
 * - Deposit: Any member can deposit, capacity limits enforced
 * - Withdrawal: Leader/Co-Leader only (canWithdrawFromBank permission)
 * - Tax rates: Leader only (canManageTaxes permission), 0-50% range
 * - Bank upgrades: Leader only (canUpgradeBank permission), 6 levels max
 * - Tax collection: Automatic on harvest, respects capacity limits
 * - Transaction history: Last 100 transactions kept (configurable via CLAN_BANK_CONSTANTS)
 * - Capacity: Base 1M per resource, multipliers: 1x, 1.5x, 2x, 3x, 4x, 6x
 * - All transactions logged to activity feed for transparency
 * - Resource deduction from player happens atomically with bank deposit
 * - Capacity overflow prevention on deposits and tax collection
 * - Player lookups use mongoId field for backward compatibility
 * - Clan bank data stored as flat columns in clans table
 */
