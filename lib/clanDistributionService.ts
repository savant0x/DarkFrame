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
import { eq, sql, gte, desc } from 'drizzle-orm';
import type { Clan, ClanMember, ClanRole } from '@/types/clan.types';

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

export async function distributeEqualSplit(
  clanId: string,
  distributorId: string,
  resourceType: 'metal' | 'energy' | 'rp',
  totalAmount: number
): Promise<DistributionRecord> {
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    throw new Error('Clan not found');
  }
  
  const clan = clanRows[0];
  await verifyDistributionPermission(clan, distributorId, DistributionMethod.EQUAL_SPLIT, totalAmount, resourceType);
  
  const treasuryKey = resourceType === 'rp' ? 'researchPoints' : resourceType;
  const currentBalance = Number((clan as any)[`bankTreasury${treasuryKey.charAt(0).toUpperCase() + treasuryKey.slice(1)}`] || 0);
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
    
    const playerField = resourceType === 'metal' ? 'resourcesMetal' : resourceType === 'energy' ? 'resourcesEnergy' : 'researchPoints';
    await db.update(players).set({
      [playerField]: sql`${(players as any)[playerField]} + ${amount}`,
    }).where(eq(players.username, member.playerId));
  }
  
  const clanField = resourceType === 'metal' ? 'bankTreasuryMetal' : resourceType === 'energy' ? 'bankTreasuryEnergy' : 'bankTreasuryResearchPoints';
  await db.update(clans).set({
    [clanField]: sql`${(clans as any)[clanField]} - ${totalAmount}`,
  }).where(eq(clans.id, clanId));
  
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
  resourceType: 'metal' | 'energy' | 'rp',
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
  
  const treasuryKey = resourceType === 'rp' ? 'researchPoints' : resourceType;
  const currentBalance = Number((clan as any)[`bankTreasury${treasuryKey.charAt(0).toUpperCase() + treasuryKey.slice(1)}`] || 0);
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
    
    const playerField = resourceType === 'metal' ? 'resourcesMetal' : resourceType === 'energy' ? 'resourcesEnergy' : 'researchPoints';
    await db.update(players).set({
      [playerField]: sql`${(players as any)[playerField]} + ${amount}`,
    }).where(eq(players.username, playerId));
  }
  
  if (distributed < totalAmount && recipients.length > 0) {
    const remainder = totalAmount - distributed;
    recipients[0].amount[resourceType]! += remainder;
    const playerField = resourceType === 'metal' ? 'resourcesMetal' : resourceType === 'energy' ? 'resourcesEnergy' : 'researchPoints';
    await db.update(players).set({
      [playerField]: sql`${(players as any)[playerField]} + ${remainder}`,
    }).where(eq(players.username, recipients[0].playerId));
  }
  
  const clanField = resourceType === 'metal' ? 'bankTreasuryMetal' : resourceType === 'energy' ? 'bankTreasuryEnergy' : 'bankTreasuryResearchPoints';
  await db.update(clans).set({
    [clanField]: sql`${(clans as any)[clanField]} - ${totalAmount}`,
  }).where(eq(clans.id, clanId));
  
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
  resourceType: 'metal' | 'energy' | 'rp',
  totalAmount: number,
  weights: MeritWeights = DEFAULT_MERIT_WEIGHTS
): Promise<DistributionRecord> {
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    throw new Error('Clan not found');
  }
  
  const clan = clanRows[0];
  const distributor = clan.members.find((m: any) => m.playerId === distributorId);
  if (!distributor || distributor.role !== 'LEADER') {
    throw new Error('Only clan leaders can use merit-based distribution');
  }
  
  const treasuryKey = resourceType === 'rp' ? 'researchPoints' : resourceType;
  const currentBalance = Number((clan as any)[`bankTreasury${treasuryKey.charAt(0).toUpperCase() + treasuryKey.slice(1)}`] || 0);
  if (currentBalance < totalAmount) {
    throw new Error(`Insufficient ${resourceType} in clan bank`);
  }
  
  const meritScores: Array<{ playerId: string; username: string; score: number }> = [];
  
  for (const member of clan.members) {
    const contributions = (member as any).contributions || {
      resourcesDonated: 0,
      territoriesClaimed: 0,
      warsParticipated: 0,
    };
    
    const score =
      (contributions.territoriesClaimed || 0) * weights.territoriesClaimed +
      (contributions.warsParticipated || 0) * weights.warsParticipated +
      ((contributions.resourcesDonated || 0) / 1000) * weights.resourcesDonated;
    
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
    
    const playerField = resourceType === 'metal' ? 'resourcesMetal' : resourceType === 'energy' ? 'resourcesEnergy' : 'researchPoints';
    await db.update(players).set({
      [playerField]: sql`${(players as any)[playerField]} + ${amount}`,
    }).where(eq(players.username, merit.playerId));
  }
  
  if (distributed < totalAmount && recipients.length > 0) {
    const remainder = totalAmount - distributed;
    recipients[0].amount[resourceType]! += remainder;
    const playerField = resourceType === 'metal' ? 'resourcesMetal' : resourceType === 'energy' ? 'resourcesEnergy' : 'researchPoints';
    await db.update(players).set({
      [playerField]: sql`${(players as any)[playerField]} + ${remainder}`,
    }).where(eq(players.username, recipients[0].playerId));
  }
  
  const clanField = resourceType === 'metal' ? 'bankTreasuryMetal' : resourceType === 'energy' ? 'bankTreasuryEnergy' : 'bankTreasuryResearchPoints';
  await db.update(clans).set({
    [clanField]: sql`${(clans as any)[clanField]} - ${totalAmount}`,
  }).where(eq(clans.id, clanId));
  
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
    
    const updates: any = {};
    if (grant.metal) updates.resourcesMetal = sql`${players.resourcesMetal} + ${grant.metal}`;
    if (grant.energy) updates.resourcesEnergy = sql`${players.resourcesEnergy} + ${grant.energy}`;
    if (grant.rp) updates.researchPoints = sql`${players.researchPoints} + ${grant.rp}`;
    
    if (Object.keys(updates).length > 0) {
      await db.update(players).set(updates).where(eq(players.username, grant.playerId));
    }
  }
  
  const clanUpdates: any = {};
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
  clan: any,
  distributorId: string,
  method: DistributionMethod,
  amount: number,
  resourceType: 'metal' | 'energy' | 'rp'
): Promise<void> {
  const member = clan.members.find((m: any) => m.playerId === distributorId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }
  
  const role = member.role as string;
  
  if (role === 'LEADER') {
    return;
  }
  
  if (role === 'CO_LEADER') {
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
  resourceType: 'metal' | 'energy' | 'rp'
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
  for (const row of (result as any) as any[]) {
    const dist = JSON.parse(row.recipients);
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
  
  return (result.rows as any[]).map((row: any) => ({
    _id: row.id,
    clanId: row.clan_id,
    method: row.method,
    distributedBy: row.distributed_by,
    distributedByUsername: row.distributed_by_username,
    timestamp: new Date(row.timestamp),
    resources: typeof row.resources === 'string' ? JSON.parse(row.resources) : row.resources,
    recipients: typeof row.recipients === 'string' ? JSON.parse(row.recipients) : row.recipients,
    totalDistributed: typeof row.total_distributed === 'string' ? JSON.parse(row.total_distributed) : row.total_distributed,
    notes: row.notes,
  }));
}
