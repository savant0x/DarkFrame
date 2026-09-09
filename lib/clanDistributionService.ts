/**
 * Clan Fund Distribution Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages distribution of clan bank resources to members. Leaders can distribute
 * Metal, Energy, and RP using multiple distribution methods. All distributions
 * are logged for audit purposes.
 * 
 * Distribution Methods:
 * 1. Equal Split - Divide equally among all members
 * 2. Percentage-Based - Custom percentage per role or specific players
 * 3. Merit-Based - Based on contribution metrics (territories, wars, donations)
 * 4. Direct Grant - Direct transfer to specific players
 * 
 * Features:
 * - Multiple distribution methods
 * - Permission-based limits (Leader unlimited, Co-Leader 50K/day)
 * - Balance validation
 * - Transaction logging
 * - Distribution history tracking
 * - Contribution metrics calculation
 * 
 * Permissions:
 * - Leader: All methods, unlimited
 * - Co-Leader: Equal Split and Direct Grant, max 50K per day
 * - Others: View only
 * 
 * @module lib/clanDistributionService
 */

import { db } from '@/lib/db';
import { clans, players } from '@/lib/db/schema';
import { eq, sql, type SQL } from 'drizzle-orm';
import { ClanRole, type ClanMember } from '@/types/clan.types';


export enum DistributionMethod {
  EQUAL_SPLIT = 'EQUAL_SPLIT',
  PERCENTAGE = 'PERCENTAGE',
  MERIT = 'MERIT',
  DIRECT_GRANT = 'DIRECT_GRANT',
}

export interface DistributionRecord {
  _id?: string;
  clanId: string;
  method: DistributionMethod;
  distributedBy: string;
  distributedByUsername: string;
  timestamp: Date;
  resources: {
    metal?: number;
    energy?: number;
    rp?: number;
  };
  recipients: Array<{
    playerId: string;
    username: string;
    amount: {
      metal?: number;
      energy?: number;
      rp?: number;
    };
    percentage?: number;
  }>;
  totalDistributed: {
    metal: number;
    energy: number;
    rp: number;
  };
  notes?: string;
}

export interface MeritWeights {
  territoriesClaimed: number;
  warsParticipated: number;
  resourcesDonated: number;
}

export interface DistributionLimits {
  dailyMetal: number;
  dailyEnergy: number;
  dailyRP: number;
}

export const DEFAULT_MERIT_WEIGHTS: MeritWeights = {
  territoriesClaimed: 0.4,
  warsParticipated: 0.3,
  resourcesDonated: 0.3,
};

export const CO_LEADER_DAILY_LIMITS: DistributionLimits = {
  dailyMetal: 50000,
  dailyEnergy: 50000,
  dailyRP: 50000,
};

/** Resource types distributable from the clan bank. */
type DistributionResourceType = 'metal' | 'energy' | 'rp';

/** Treasury row key per resource — single source of truth for balance reads. */
const TREASURY_KEYS = {
  metal: 'bankTreasuryMetal',
  energy: 'bankTreasuryEnergy',
  rp: 'bankTreasuryResearchPoints',
} as const;

/** Treasury column per resource — single source of truth for SQL writes. */
const TREASURY_COLUMNS = {
  metal: clans.bankTreasuryMetal,
  energy: clans.bankTreasuryEnergy,
  rp: clans.bankTreasuryResearchPoints,
} as const;

/** Player resource column per resource — single source of truth for SQL writes. */
const PLAYER_RESOURCE_COLUMNS = {
  metal: players.resourcesMetal,
  energy: players.resourcesEnergy,
  rp: players.researchPoints,
} as const;

function getTreasuryBalance(
  clan: typeof clans.$inferSelect,
  resourceType: DistributionResourceType
): number {
  return Number(clan[TREASURY_KEYS[resourceType]] || 0);
}

/** Typed increment of a player's resource column (drizzle set() payload). */
function playerResourceIncrement(
  resourceType: DistributionResourceType,
  amount: number
): { resourcesMetal: SQL } | { resourcesEnergy: SQL } | { researchPoints: SQL } {
  const gain = sql`${PLAYER_RESOURCE_COLUMNS[resourceType]} + ${amount}`;
  if (resourceType === 'metal') return { resourcesMetal: gain };
  if (resourceType === 'energy') return { resourcesEnergy: gain };
  return { researchPoints: gain };
}

/** Typed decrement of a clan treasury column (drizzle set() payload). */
function clanTreasuryDecrement(
  resourceType: DistributionResourceType,
  amount: number
): { bankTreasuryMetal: SQL } | { bankTreasuryEnergy: SQL } | { bankTreasuryResearchPoints: SQL } {
  const spend = sql`${TREASURY_COLUMNS[resourceType]} - ${amount}`;
  if (resourceType === 'metal') return { bankTreasuryMetal: spend };
  if (resourceType === 'energy') return { bankTreasuryEnergy: spend };
  return { bankTreasuryResearchPoints: spend };
}

/**
 * Raw shape of a `clan_distributions` row as returned by db.execute(). The table
 * has no drizzle definition (raw-SQL only, pre-dating the repo's migration files);
 * columns are snake_case and the jsonb payloads may arrive stringified or as
 * pre-parsed objects depending on driver behavior.
 */
interface ClanDistributionRow {
  id: string | number;
  clan_id: string | number;
  method: string;
  distributed_by: string;
  distributed_by_username: string | null;
  timestamp: Date | string;
  resources: string | DistributionRecord['resources'] | null;
  recipients: string | DistributionRecord['recipients'] | null;
  total_distributed: string | DistributionRecord['totalDistributed'] | null;
  notes: string | null;
}

/** All four distribution methods, for enum validation at the raw-SQL boundary. */
const DISTRIBUTION_METHODS = new Set<string>(Object.values(DistributionMethod));

function isDistributionMethod(value: unknown): value is DistributionMethod {
  return typeof value === 'string' && DISTRIBUTION_METHODS.has(value);
}

/** Guard for the per-resource amount payloads (resources / recipient.amount). */
function isResourceAmount(value: unknown): value is DistributionRecord['resources'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    (record.metal === undefined || typeof record.metal === 'number') &&
    (record.energy === undefined || typeof record.energy === 'number') &&
    (record.rp === undefined || typeof record.rp === 'number')
  );
}

/** Guard for the totalDistributed payload (all three keys required numbers). */
function isTotalDistributed(value: unknown): value is DistributionRecord['totalDistributed'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.metal === 'number' &&
    typeof record.energy === 'number' &&
    typeof record.rp === 'number'
  );
}

/** Guard for one recipient entry (playerId + username + resource amounts). */
function isDistributionRecipient(value: unknown): value is DistributionRecord['recipients'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.playerId === 'string' &&
    typeof record.username === 'string' &&
    isResourceAmount(record.amount)
  );
}

function isRecipients(value: unknown): value is DistributionRecord['recipients'] {
  return Array.isArray(value) && value.every(isDistributionRecipient);
}

/**
 * Parse a jsonb payload from a `clan_distributions` row — drivers may deliver
 * it as a string or a pre-parsed object. Validated against the payload guard
 * so untrusted jsonb content can never masquerade as a domain shape. Malformed
 * JSON or shape mismatches are logged (Law 14) and yield the caller's fallback.
 */
function parseDistributionPayload<T>(
  raw: string | T | null,
  guard: (value: unknown) => value is T,
  fallback: T,
  column: string
): T {
  if (raw === null) {
    return fallback;
  }
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error(`Malformed ${column} JSON in clan_distributions row:`, error);
      return fallback;
    }
  }
  return guard(parsed) ? parsed : fallback;
}

/** Legacy per-member contribution shape optionally carried in the jsonb row. */
interface LegacyContributions {
  resourcesDonated: number;
  territoriesClaimed: number;
  warsParticipated: number;
}

/**
 * The members jsonb column is schemaless: legacy rows may carry a
 * contribution-tracking object beyond the typed ClanMember fields. No writer
 * for it exists in the current codebase (verified), so merit scoring treats
 * absent/invalid data as zero — which yields an equal split. This guard reads
 * the legacy shape without scattering `any` through the scoring code.
 */
function readLegacyContributions(member: ClanMember): LegacyContributions {
  const candidate = (member as { contributions?: unknown }).contributions;
  const num = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0;
  if (!candidate || typeof candidate !== 'object') {
    return { resourcesDonated: 0, territoriesClaimed: 0, warsParticipated: 0 };
  }
  const record = candidate as Record<string, unknown>;
  return {
    resourcesDonated: num(record.resourcesDonated),
    territoriesClaimed: num(record.territoriesClaimed),
    warsParticipated: num(record.warsParticipated),
  };
}

export async function distributeEqualSplit(
  clanId: string,
  distributorId: string,
  resourceType: DistributionResourceType,
  totalAmount: number
): Promise<DistributionRecord> {
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    throw new Error('Clan not found');
  }
  
  const clan = clanRows[0];
  await verifyDistributionPermission(clan, distributorId, DistributionMethod.EQUAL_SPLIT, totalAmount, resourceType);
  
  const currentBalance = getTreasuryBalance(clan, resourceType);
  if (currentBalance < totalAmount) {
    throw new Error(`Insufficient ${resourceType} in clan bank (have ${currentBalance}, need ${totalAmount})`);
  }
  
  const memberCount = clan.members.length;
  const amountPerMember = Math.floor(totalAmount / memberCount);
  const remainder = totalAmount - (amountPerMember * memberCount);
  
  const recipients: DistributionRecord['recipients'] = [];
  for (let i = 0; i < clan.members.length; i++) {
    const member = clan.members[i];
    const playerRows = await db.select().from(players).where(eq(players.username, member.playerId)).limit(1);
    const player = playerRows[0];
    
    const amount = i === 0 ? amountPerMember + remainder : amountPerMember;
    
    recipients.push({
      playerId: member.playerId,
      username: player?.username || 'Unknown',
      amount: {
        [resourceType]: amount,
      },
    });
    
    await db.update(players).set(playerResourceIncrement(resourceType, amount)).where(eq(players.username, member.playerId));
  }
  
  await db.update(clans).set(clanTreasuryDecrement(resourceType, totalAmount)).where(eq(clans.id, clanId));
  
  const distributorRows = await db.select().from(players).where(eq(players.username, distributorId)).limit(1);
  const distributor = distributorRows[0];
  
  const record: DistributionRecord = {
    clanId,
    method: DistributionMethod.EQUAL_SPLIT,
    distributedBy: distributorId,
    distributedByUsername: distributor?.username || 'Unknown',
    timestamp: new Date(),
    resources: {
      [resourceType]: totalAmount,
    },
    recipients,
    totalDistributed: {
      metal: resourceType === 'metal' ? totalAmount : 0,
      energy: resourceType === 'energy' ? totalAmount : 0,
      rp: resourceType === 'rp' ? totalAmount : 0,
    },
    notes: `Equal split: ${amountPerMember} ${resourceType} per member (${memberCount} members)`,
  };
  
  await db.execute(sql`
    INSERT INTO clan_distributions
    (clan_id, method, distributed_by, distributed_by_username, timestamp, resources,
     recipients, total_distributed, notes)
    VALUES (${record.clanId}, ${record.method}, ${record.distributedBy},
            ${record.distributedByUsername}, ${record.timestamp}, ${JSON.stringify(record.resources)},
            ${JSON.stringify(record.recipients)}, ${JSON.stringify(record.totalDistributed)},
            ${record.notes || null})
  `);
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${clanId}, 'FUND_DISTRIBUTION', ${new Date()},
            ${JSON.stringify({
              method: 'EQUAL_SPLIT',
              resourceType,
              totalAmount,
              memberCount,
              amountPerMember,
              distributedBy: distributor?.username,
            })})
  `);
  
  return record;
}

export async function distributeByPercentage(
  clanId: string,
  distributorId: string,
  resourceType: DistributionResourceType,
  percentageMap: Record<string, number>,
  totalAmount: number
): Promise<DistributionRecord> {
  const totalPercentage = Object.values(percentageMap).reduce((sum, pct) => sum + pct, 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(`Percentages must total 100% (currently ${totalPercentage}%)`);
  }
  
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    throw new Error('Clan not found');
  }
  
  const clan = clanRows[0];
  await verifyDistributionPermission(clan, distributorId, DistributionMethod.PERCENTAGE, totalAmount, resourceType);
  
  const currentBalance = getTreasuryBalance(clan, resourceType);
  if (currentBalance < totalAmount) {
    throw new Error(`Insufficient ${resourceType} in clan bank`);
  }
  
  const recipients: DistributionRecord['recipients'] = [];
  let distributed = 0;
  
  for (const [playerId, percentage] of Object.entries(percentageMap)) {
    const amount = Math.floor(totalAmount * (percentage / 100));
    distributed += amount;
    
    const playerRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
    const player = playerRows[0];
    
    recipients.push({
      playerId,
      username: player?.username || 'Unknown',
      amount: {
        [resourceType]: amount,
      },
      percentage,
    });
    
    await db.update(players).set(playerResourceIncrement(resourceType, amount)).where(eq(players.username, playerId));
  }
  
  if (distributed < totalAmount && recipients.length > 0) {
    const remainder = totalAmount - distributed;
    recipients[0].amount[resourceType]! += remainder;
    await db.update(players).set(playerResourceIncrement(resourceType, remainder)).where(eq(players.username, recipients[0].playerId));
  }
  
  await db.update(clans).set(clanTreasuryDecrement(resourceType, totalAmount)).where(eq(clans.id, clanId));
  
  const distributorRows = await db.select().from(players).where(eq(players.username, distributorId)).limit(1);
  const distributor = distributorRows[0];
  
  const record: DistributionRecord = {
    clanId,
    method: DistributionMethod.PERCENTAGE,
    distributedBy: distributorId,
    distributedByUsername: distributor?.username || 'Unknown',
    timestamp: new Date(),
    resources: {
      [resourceType]: totalAmount,
    },
    recipients,
    totalDistributed: {
      metal: resourceType === 'metal' ? totalAmount : 0,
      energy: resourceType === 'energy' ? totalAmount : 0,
      rp: resourceType === 'rp' ? totalAmount : 0,
    },
    notes: `Percentage-based distribution to ${recipients.length} members`,
  };
  
  await db.execute(sql`
    INSERT INTO clan_distributions
    (clan_id, method, distributed_by, distributed_by_username, timestamp, resources,
     recipients, total_distributed, notes)
    VALUES (${record.clanId}, ${record.method}, ${record.distributedBy},
            ${record.distributedByUsername}, ${record.timestamp}, ${JSON.stringify(record.resources)},
            ${JSON.stringify(record.recipients)}, ${JSON.stringify(record.totalDistributed)},
            ${record.notes || null})
  `);
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${clanId}, 'FUND_DISTRIBUTION', ${new Date()},
            ${JSON.stringify({
              method: 'PERCENTAGE',
              resourceType,
              totalAmount,
              recipientCount: recipients.length,
              distributedBy: distributor?.username,
            })})
  `);
  
  return record;
}

export async function distributeByMerit(
  clanId: string,
  distributorId: string,
  resourceType: DistributionResourceType,
  totalAmount: number,
  weights: MeritWeights = DEFAULT_MERIT_WEIGHTS
): Promise<DistributionRecord> {
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    throw new Error('Clan not found');
  }
  
  const clan = clanRows[0];
  const distributor = clan.members.find((m) => m.playerId === distributorId);
  if (!distributor || distributor.role !== ClanRole.LEADER) {
    throw new Error('Only clan leaders can use merit-based distribution');
  }
  
  const currentBalance = getTreasuryBalance(clan, resourceType);
  if (currentBalance < totalAmount) {
    throw new Error(`Insufficient ${resourceType} in clan bank`);
  }
  
  const meritScores: Array<{ playerId: string; username: string; score: number }> = [];
  
  for (const member of clan.members) {
    const contributions = readLegacyContributions(member);
    
    const score =
      contributions.territoriesClaimed * weights.territoriesClaimed +
      contributions.warsParticipated * weights.warsParticipated +
      (contributions.resourcesDonated / 1000) * weights.resourcesDonated;
    
    const playerRows = await db.select().from(players).where(eq(players.username, member.playerId)).limit(1);
    const player = playerRows[0];
    
    meritScores.push({
      playerId: member.playerId,
      username: player?.username || 'Unknown',
      score: Math.max(score, 1),
    });
  }
  
  const totalMeritScore = meritScores.reduce((sum, m) => sum + m.score, 0);
  
  const recipients: DistributionRecord['recipients'] = [];
  let distributed = 0;
  
  for (let i = 0; i < meritScores.length; i++) {
    const merit = meritScores[i];
    const percentage = (merit.score / totalMeritScore) * 100;
    const amount = Math.floor(totalAmount * (merit.score / totalMeritScore));
    distributed += amount;
    
    recipients.push({
      playerId: merit.playerId,
      username: merit.username,
      amount: {
        [resourceType]: amount,
      },
      percentage,
    });
    
    await db.update(players).set(playerResourceIncrement(resourceType, amount)).where(eq(players.username, merit.playerId));
  }
  
  if (distributed < totalAmount && recipients.length > 0) {
    const remainder = totalAmount - distributed;
    recipients[0].amount[resourceType]! += remainder;
    await db.update(players).set(playerResourceIncrement(resourceType, remainder)).where(eq(players.username, recipients[0].playerId));
  }
  
  await db.update(clans).set(clanTreasuryDecrement(resourceType, totalAmount)).where(eq(clans.id, clanId));
  
  const distributorPlayerRows = await db.select().from(players).where(eq(players.username, distributorId)).limit(1);
  const distributorPlayer = distributorPlayerRows[0];
  
  const record: DistributionRecord = {
    clanId,
    method: DistributionMethod.MERIT,
    distributedBy: distributorId,
    distributedByUsername: distributorPlayer?.username || 'Unknown',
    timestamp: new Date(),
    resources: {
      [resourceType]: totalAmount,
    },
    recipients,
    totalDistributed: {
      metal: resourceType === 'metal' ? totalAmount : 0,
      energy: resourceType === 'energy' ? totalAmount : 0,
      rp: resourceType === 'rp' ? totalAmount : 0,
    },
    notes: `Merit-based: Territories ${weights.territoriesClaimed * 100}%, Wars ${weights.warsParticipated * 100}%, Donations ${weights.resourcesDonated * 100}%`,
  };
  
  await db.execute(sql`
    INSERT INTO clan_distributions
    (clan_id, method, distributed_by, distributed_by_username, timestamp, resources,
     recipients, total_distributed, notes)
    VALUES (${record.clanId}, ${record.method}, ${record.distributedBy},
            ${record.distributedByUsername}, ${record.timestamp}, ${JSON.stringify(record.resources)},
            ${JSON.stringify(record.recipients)}, ${JSON.stringify(record.totalDistributed)},
            ${record.notes || null})
  `);
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${clanId}, 'FUND_DISTRIBUTION', ${new Date()},
            ${JSON.stringify({
              method: 'MERIT',
              resourceType,
              totalAmount,
              recipientCount: recipients.length,
              distributedBy: distributorPlayer?.username,
              weights,
            })})
  `);
  
  return record;
}

export async function directGrant(
  clanId: string,
  distributorId: string,
  grants: Array<{ playerId: string; metal?: number; energy?: number; rp?: number }>
): Promise<DistributionRecord> {
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    throw new Error('Clan not found');
  }
  
  const clan = clanRows[0];
  
  const totalMetal = grants.reduce((sum, g) => sum + (g.metal || 0), 0);
  const totalEnergy = grants.reduce((sum, g) => sum + (g.energy || 0), 0);
  const totalRP = grants.reduce((sum, g) => sum + (g.rp || 0), 0);
  
  if (totalMetal > 0) {
    await verifyDistributionPermission(clan, distributorId, DistributionMethod.DIRECT_GRANT, totalMetal, 'metal');
  }
  if (totalEnergy > 0) {
    await verifyDistributionPermission(clan, distributorId, DistributionMethod.DIRECT_GRANT, totalEnergy, 'energy');
  }
  if (totalRP > 0) {
    await verifyDistributionPermission(clan, distributorId, DistributionMethod.DIRECT_GRANT, totalRP, 'rp');
  }
  
  const bankMetal = Number(clan.bankTreasuryMetal || 0);
  const bankEnergy = Number(clan.bankTreasuryEnergy || 0);
  const bankRP = clan.bankTreasuryResearchPoints || 0;
  
  if (bankMetal < totalMetal) {
    throw new Error(`Insufficient metal in clan bank (have ${bankMetal}, need ${totalMetal})`);
  }
  if (bankEnergy < totalEnergy) {
    throw new Error(`Insufficient energy in clan bank (have ${bankEnergy}, need ${totalEnergy})`);
  }
  if (bankRP < totalRP) {
    throw new Error(`Insufficient RP in clan bank (have ${bankRP}, need ${totalRP})`);
  }
  
  const recipients: DistributionRecord['recipients'] = [];
  
  for (const grant of grants) {
    const playerRows = await db.select().from(players).where(eq(players.username, grant.playerId)).limit(1);
    const player = playerRows[0];
    
    recipients.push({
      playerId: grant.playerId,
      username: player?.username || 'Unknown',
      amount: {
        metal: grant.metal || 0,
        energy: grant.energy || 0,
        rp: grant.rp || 0,
      },
    });
    
    const updates: Partial<{ resourcesMetal: SQL; resourcesEnergy: SQL; researchPoints: SQL }> = {};
    if (grant.metal) updates.resourcesMetal = sql`${players.resourcesMetal} + ${grant.metal}`;
    if (grant.energy) updates.resourcesEnergy = sql`${players.resourcesEnergy} + ${grant.energy}`;
    if (grant.rp) updates.researchPoints = sql`${players.researchPoints} + ${grant.rp}`;
    
    if (Object.keys(updates).length > 0) {
      await db.update(players).set(updates).where(eq(players.username, grant.playerId));
    }
  }
  
  const clanUpdates: Partial<{ bankTreasuryMetal: SQL; bankTreasuryEnergy: SQL; bankTreasuryResearchPoints: SQL }> = {};
  if (totalMetal > 0) clanUpdates.bankTreasuryMetal = sql`${clans.bankTreasuryMetal} - ${totalMetal}`;
  if (totalEnergy > 0) clanUpdates.bankTreasuryEnergy = sql`${clans.bankTreasuryEnergy} - ${totalEnergy}`;
  if (totalRP > 0) clanUpdates.bankTreasuryResearchPoints = sql`${clans.bankTreasuryResearchPoints} - ${totalRP}`;
  
  await db.update(clans).set(clanUpdates).where(eq(clans.id, clanId));
  
  const distributorRows = await db.select().from(players).where(eq(players.username, distributorId)).limit(1);
  const distributor = distributorRows[0];
  
  const record: DistributionRecord = {
    clanId,
    method: DistributionMethod.DIRECT_GRANT,
    distributedBy: distributorId,
    distributedByUsername: distributor?.username || 'Unknown',
    timestamp: new Date(),
    resources: {
      metal: totalMetal,
      energy: totalEnergy,
      rp: totalRP,
    },
    recipients,
    totalDistributed: {
      metal: totalMetal,
      energy: totalEnergy,
      rp: totalRP,
    },
    notes: `Direct grants to ${grants.length} members`,
  };
  
  await db.execute(sql`
    INSERT INTO clan_distributions
    (clan_id, method, distributed_by, distributed_by_username, timestamp, resources,
     recipients, total_distributed, notes)
    VALUES (${record.clanId}, ${record.method}, ${record.distributedBy},
            ${record.distributedByUsername}, ${record.timestamp}, ${JSON.stringify(record.resources)},
            ${JSON.stringify(record.recipients)}, ${JSON.stringify(record.totalDistributed)},
            ${record.notes || null})
  `);
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${clanId}, 'FUND_DISTRIBUTION', ${new Date()},
            ${JSON.stringify({
              method: 'DIRECT_GRANT',
              totalMetal,
              totalEnergy,
              totalRP,
              recipientCount: grants.length,
              distributedBy: distributor?.username,
            })})
  `);
  
  return record;
}

async function verifyDistributionPermission(
  clan: typeof clans.$inferSelect,
  distributorId: string,
  method: DistributionMethod,
  amount: number,
  resourceType: DistributionResourceType
): Promise<void> {
  const member = clan.members.find((m) => m.playerId === distributorId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }
  
  const role = member.role;
  
  if (role === ClanRole.LEADER) {
    return;
  }

  if (role === ClanRole.CO_LEADER) {
    if (method !== DistributionMethod.EQUAL_SPLIT && method !== DistributionMethod.DIRECT_GRANT) {
      throw new Error('Co-Leaders can only use Equal Split or Direct Grant methods');
    }
    
    const limit = CO_LEADER_DAILY_LIMITS[`daily${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}` as keyof DistributionLimits];
    const todayDistributed = await getTodayDistributedByPlayer(clan.id, distributorId, resourceType);
    
    if (todayDistributed + amount > limit) {
      throw new Error(`Co-Leader daily limit exceeded for ${resourceType} (${limit} per day, already distributed ${todayDistributed})`);
    }
    
    return;
  }
  
  throw new Error('Insufficient permissions to distribute clan funds');
}

async function getTodayDistributedByPlayer(
  clanId: string,
  playerId: string,
  resourceType: DistributionResourceType
): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const result = await db.execute(sql`
    SELECT recipients FROM clan_distributions
    WHERE clan_id = ${clanId}
      AND distributed_by = ${playerId}
      AND timestamp >= ${todayStart}
  `);
  
  let total = 0;
  const rows = result.rows as unknown as Array<{ recipients: string | DistributionRecord['recipients'] | null }>;
  for (const row of rows) {
    const dist = parseDistributionPayload(
      row.recipients,
      isRecipients,
      [],
      'recipients'
    );
    for (const recipient of dist) {
      total += recipient.amount[resourceType] || 0;
    }
  }
  
  return total;
}

export async function getDistributionHistory(
  clanId: string,
  limit = 100
): Promise<DistributionRecord[]> {
  const result = await db.execute(sql`
    SELECT * FROM clan_distributions
    WHERE clan_id = ${clanId}
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `);
  
  const rows = result.rows as unknown as ClanDistributionRow[];
  return rows.map((row): DistributionRecord => {
    if (!isDistributionMethod(row.method)) {
      throw new Error(`Invalid distribution method in clan_distributions row: ${String(row.method)}`);
    }
    const method: DistributionMethod = row.method;
    return {
      _id: String(row.id),
      clanId: String(row.clan_id),
      method,
      distributedBy: row.distributed_by,
      distributedByUsername: row.distributed_by_username ?? 'Unknown',
      timestamp: new Date(row.timestamp),
      resources: parseDistributionPayload(row.resources, isResourceAmount, {}, 'resources'),
      recipients: parseDistributionPayload(row.recipients, isRecipients, [], 'recipients'),
      totalDistributed: parseDistributionPayload(
        row.total_distributed,
        isTotalDistributed,
        { metal: 0, energy: 0, rp: 0 },
        'total_distributed'
      ),
      notes: row.notes ?? undefined,
    };
  });
}
