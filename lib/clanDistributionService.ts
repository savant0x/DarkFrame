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

import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export enum DistributionMethod {
  EQUAL_SPLIT = 'EQUAL_SPLIT',
  PERCENTAGE = 'PERCENTAGE',
  MERIT = 'MERIT',
  DIRECT_GRANT = 'DIRECT_GRANT',
}

export interface DistributionRecord {
  id?: string;
  clan_id: string;
  method: DistributionMethod;
  distributed_by: string;
  distributed_by_username: string;
  timestamp: string;
  
  resources: {
    metal?: number;
    energy?: number;
    rp?: number;
  };
  
  recipients: Array<{
    player_id: string;
    username: string;
    amount: {
      metal?: number;
      energy?: number;
      rp?: number;
    };
    percentage?: number;
  }>;
  
  total_distributed: {
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

type ResourceType = 'metal' | 'energy' | 'rp';

function playerResourceColumn(rt: ResourceType): 'resources_metal' | 'resources_energy' | 'research_points' {
  if (rt === 'metal') return 'resources_metal';
  if (rt === 'energy') return 'resources_energy';
  return 'research_points';
}

function clanTreasuryColumn(rt: ResourceType): 'bank_treasury_metal' | 'bank_treasury_energy' | 'bank_treasury_rp' {
  if (rt === 'metal') return 'bank_treasury_metal';
  if (rt === 'energy') return 'bank_treasury_energy';
  return 'bank_treasury_rp';
}

function txAmountColumn(rt: ResourceType): 'amount_metal' | 'amount_energy' | 'amount_rp' {
  if (rt === 'metal') return 'amount_metal';
  if (rt === 'energy') return 'amount_energy';
  return 'amount_rp';
}

async function addPlayerResource(
  supabase: ReturnType<typeof createServiceClient>,
  playerUsername: string,
  resourceType: ResourceType,
  amount: number
): Promise<void> {
  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .eq('username', playerUsername)
    .single();

  if (!existing) return;

  const col = playerResourceColumn(resourceType);
  const current = (existing as Record<string, unknown>)[col] as number || 0;
  const newValue = current + amount;

  if (resourceType === 'metal') {
    await supabase.from('players').update({ resources_metal: newValue }).eq('username', playerUsername);
  } else if (resourceType === 'energy') {
    await supabase.from('players').update({ resources_energy: newValue }).eq('username', playerUsername);
  } else {
    await supabase.from('players').update({ research_points: newValue }).eq('username', playerUsername);
  }
}

async function deductClanTreasury(
  supabase: ReturnType<typeof createServiceClient>,
  clanId: string,
  resourceType: ResourceType,
  amount: number
): Promise<void> {
  const { data: clan } = await supabase
    .from('clans')
    .select('bank_treasury_metal, bank_treasury_energy, bank_treasury_rp')
    .eq('id', clanId)
    .single();

  if (!clan) return;

  const col = clanTreasuryColumn(resourceType);
  const current = (clan as Record<string, unknown>)[col] as number || 0;

  if (resourceType === 'metal') {
    await supabase.from('clans').update({ bank_treasury_metal: current - amount }).eq('id', clanId);
  } else if (resourceType === 'energy') {
    await supabase.from('clans').update({ bank_treasury_energy: current - amount }).eq('id', clanId);
  } else {
    await supabase.from('clans').update({ bank_treasury_rp: current - amount }).eq('id', clanId);
  }
}

export async function distributeEqualSplit(
  clanId: string,
  distributorId: string,
  resourceType: 'metal' | 'energy' | 'rp',
  totalAmount: number
): Promise<DistributionRecord> {
  const supabase = createServiceClient();
  
  const { data: clan, error: clanError } = await supabase
    .from('clans')
    .select('*')
    .eq('id', clanId)
    .single();
  
  if (clanError || !clan) {
    throw new Error('Clan not found');
  }

  const { data: members, error: membersError } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId);
  
  if (membersError || !members) {
    throw new Error('Failed to load clan members');
  }

  await verifyDistributionPermission(clanId, members, distributorId, DistributionMethod.EQUAL_SPLIT, totalAmount, resourceType);
  
  const treasuryCol = clanTreasuryColumn(resourceType);
  const currentBalance = (clan as Record<string, unknown>)[treasuryCol] as number || 0;
  if (currentBalance < totalAmount) {
    throw new Error(`Insufficient ${resourceType} in clan bank (have ${currentBalance}, need ${totalAmount})`);
  }
  
  const memberCount = members.length;
  const amountPerMember = Math.floor(totalAmount / memberCount);
  const remainder = totalAmount - (amountPerMember * memberCount);
  
  const recipients: DistributionRecord['recipients'] = [];
  
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const amount = i === 0 ? amountPerMember + remainder : amountPerMember;
    
    recipients.push({
      player_id: member.player_id,
      username: member.username,
      amount: {
        [resourceType]: amount,
      },
    });
    
    await addPlayerResource(supabase, member.player_id, resourceType, amount);
  }
  
  await deductClanTreasury(supabase, clanId, resourceType, totalAmount);
  
  const distributorMember = members.find((m) => m.player_id === distributorId);
  
  const record: DistributionRecord = {
    clan_id: clanId,
    method: DistributionMethod.EQUAL_SPLIT,
    distributed_by: distributorId,
    distributed_by_username: distributorMember?.username || 'Unknown',
    timestamp: new Date().toISOString(),
    resources: {
      [resourceType]: totalAmount,
    },
    recipients,
    total_distributed: {
      metal: resourceType === 'metal' ? totalAmount : 0,
      energy: resourceType === 'energy' ? totalAmount : 0,
      rp: resourceType === 'rp' ? totalAmount : 0,
    },
    notes: `Equal split: ${amountPerMember} ${resourceType} per member (${memberCount} members)`,
  };
  
  await supabase.from('clan_bank_transactions').insert({
    id: crypto.randomUUID(),
    clan_id: clanId,
    player_id: distributorId,
    username: distributorMember?.username || null,
    transaction_type: 'WITHDRAWAL',
    amount_metal: resourceType === 'metal' ? totalAmount : 0,
    amount_energy: resourceType === 'energy' ? totalAmount : 0,
    amount_rp: resourceType === 'rp' ? totalAmount : 0,
    description: `Equal split distribution to ${memberCount} members`,
    created_at: new Date().toISOString(),
  });
  
  await supabase.from('clan_activity').insert({
    clan_id: clanId,
    activity_type: 'FUND_DISTRIBUTION',
    player_id: distributorId,
    username: distributorMember?.username || null,
    created_at: new Date().toISOString(),
    details: {
      method: 'EQUAL_SPLIT',
      resource_type: resourceType,
      total_amount: totalAmount,
      member_count: memberCount,
      amount_per_member: amountPerMember,
      distributed_by: distributorMember?.username,
    },
  });
  
  return record;
}

export async function distributeByPercentage(
  clanId: string,
  distributorId: string,
  resourceType: 'metal' | 'energy' | 'rp',
  percentageMap: Record<string, number>,
  totalAmount: number
): Promise<DistributionRecord> {
  const supabase = createServiceClient();
  
  const totalPercentage = Object.values(percentageMap).reduce((sum, pct) => sum + pct, 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(`Percentages must total 100% (currently ${totalPercentage}%)`);
  }
  
  const { data: clan, error: clanError } = await supabase
    .from('clans')
    .select('*')
    .eq('id', clanId)
    .single();
  
  if (clanError || !clan) {
    throw new Error('Clan not found');
  }
  
  const { data: members, error: membersError } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId);
  
  if (membersError || !members) {
    throw new Error('Failed to load clan members');
  }

  await verifyDistributionPermission(clanId, members, distributorId, DistributionMethod.PERCENTAGE, totalAmount, resourceType);
  
  const treasuryCol = clanTreasuryColumn(resourceType);
  const currentBalance = (clan as Record<string, unknown>)[treasuryCol] as number || 0;
  if (currentBalance < totalAmount) {
    throw new Error(`Insufficient ${resourceType} in clan bank`);
  }
  
  const recipients: DistributionRecord['recipients'] = [];
  let distributed = 0;
  
  for (const [playerId, percentage] of Object.entries(percentageMap)) {
    const amount = Math.floor(totalAmount * (percentage / 100));
    distributed += amount;
    
    const { data: player } = await supabase
      .from('players')
      .select('username')
      .eq('username', playerId)
      .single();
    
    recipients.push({
      player_id: playerId,
      username: player?.username || 'Unknown',
      amount: {
        [resourceType]: amount,
      },
      percentage,
    });
    
    await addPlayerResource(supabase, playerId, resourceType, amount);
  }
  
  if (distributed < totalAmount && recipients.length > 0) {
    const remainder = totalAmount - distributed;
    if (recipients[0].amount[resourceType] !== undefined) {
      recipients[0].amount[resourceType] = (recipients[0].amount[resourceType] || 0) + remainder;
    }
    await addPlayerResource(supabase, recipients[0].player_id, resourceType, remainder);
  }
  
  await deductClanTreasury(supabase, clanId, resourceType, totalAmount);
  
  const distributorMember = members.find((m) => m.player_id === distributorId);
  
  const record: DistributionRecord = {
    clan_id: clanId,
    method: DistributionMethod.PERCENTAGE,
    distributed_by: distributorId,
    distributed_by_username: distributorMember?.username || 'Unknown',
    timestamp: new Date().toISOString(),
    resources: {
      [resourceType]: totalAmount,
    },
    recipients,
    total_distributed: {
      metal: resourceType === 'metal' ? totalAmount : 0,
      energy: resourceType === 'energy' ? totalAmount : 0,
      rp: resourceType === 'rp' ? totalAmount : 0,
    },
    notes: `Percentage-based distribution to ${recipients.length} members`,
  };
  
  await supabase.from('clan_bank_transactions').insert({
    id: crypto.randomUUID(),
    clan_id: clanId,
    player_id: distributorId,
    username: distributorMember?.username || null,
    transaction_type: 'WITHDRAWAL',
    amount_metal: resourceType === 'metal' ? totalAmount : 0,
    amount_energy: resourceType === 'energy' ? totalAmount : 0,
    amount_rp: resourceType === 'rp' ? totalAmount : 0,
    description: `Percentage distribution to ${recipients.length} members`,
    created_at: new Date().toISOString(),
  });
  
  await supabase.from('clan_activity').insert({
    clan_id: clanId,
    activity_type: 'FUND_DISTRIBUTION',
    player_id: distributorId,
    username: distributorMember?.username || null,
    created_at: new Date().toISOString(),
    details: {
      method: 'PERCENTAGE',
      resource_type: resourceType,
      total_amount: totalAmount,
      recipient_count: recipients.length,
      distributed_by: distributorMember?.username,
    },
  });
  
  return record;
}

export async function distributeByMerit(
  clanId: string,
  distributorId: string,
  resourceType: 'metal' | 'energy' | 'rp',
  totalAmount: number,
  weights: MeritWeights = DEFAULT_MERIT_WEIGHTS
): Promise<DistributionRecord> {
  const supabase = createServiceClient();
  
  const { data: clan, error: clanError } = await supabase
    .from('clans')
    .select('*')
    .eq('id', clanId)
    .single();
  
  if (clanError || !clan) {
    throw new Error('Clan not found');
  }
  
  const { data: members, error: membersError } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId);
  
  if (membersError || !members) {
    throw new Error('Failed to load clan members');
  }

  const distributor = members.find((m) => m.player_id === distributorId);
  if (!distributor || distributor.role !== 'LEADER') {
    throw new Error('Only clan leaders can use merit-based distribution');
  }
  
  const treasuryCol = clanTreasuryColumn(resourceType);
  const currentBalance = (clan as Record<string, unknown>)[treasuryCol] as number || 0;
  if (currentBalance < totalAmount) {
    throw new Error(`Insufficient ${resourceType} in clan bank`);
  }
  
  const meritScores: Array<{ playerId: string; username: string; score: number }> = [];
  
  for (const member of members) {
    const contributionData = (member as Record<string, unknown>) as { contributions_donated?: number; contributions_territories?: number; contributions_wars?: number };
    const contributions = {
      resources_donated: contributionData.contributions_donated || 0,
      territories_claimed: contributionData.contributions_territories || 0,
      wars_participated: contributionData.contributions_wars || 0,
    };
    
    const score =
      (contributions.territories_claimed || 0) * weights.territoriesClaimed +
      (contributions.wars_participated || 0) * weights.warsParticipated +
      ((contributions.resources_donated || 0) / 1000) * weights.resourcesDonated;
    
    meritScores.push({
      playerId: member.player_id,
      username: member.username,
      score: Math.max(score, 1),
    });
  }
  
  const totalMeritScore = meritScores.reduce((sum, m) => sum + m.score, 0);
  
  const recipients: DistributionRecord['recipients'] = [];
  let distributed = 0;
  
  for (const merit of meritScores) {
    const percentage = (merit.score / totalMeritScore) * 100;
    const amount = Math.floor(totalAmount * (merit.score / totalMeritScore));
    distributed += amount;
    
    recipients.push({
      player_id: merit.playerId,
      username: merit.username,
      amount: {
        [resourceType]: amount,
      },
      percentage,
    });
    
    await addPlayerResource(supabase, merit.playerId, resourceType, amount);
  }
  
  if (distributed < totalAmount && recipients.length > 0) {
    const remainder = totalAmount - distributed;
    if (recipients[0].amount[resourceType] !== undefined) {
      recipients[0].amount[resourceType] = (recipients[0].amount[resourceType] || 0) + remainder;
    }
    await addPlayerResource(supabase, recipients[0].player_id, resourceType, remainder);
  }
  
  await deductClanTreasury(supabase, clanId, resourceType, totalAmount);
  
  const distributorPlayer = members.find((m) => m.player_id === distributorId)?.username || 'Unknown';
  
  const record: DistributionRecord = {
    clan_id: clanId,
    method: DistributionMethod.MERIT,
    distributed_by: distributorId,
    distributed_by_username: distributorPlayer,
    timestamp: new Date().toISOString(),
    resources: {
      [resourceType]: totalAmount,
    },
    recipients,
    total_distributed: {
      metal: resourceType === 'metal' ? totalAmount : 0,
      energy: resourceType === 'energy' ? totalAmount : 0,
      rp: resourceType === 'rp' ? totalAmount : 0,
    },
    notes: `Merit-based: Territories ${weights.territoriesClaimed * 100}%, Wars ${weights.warsParticipated * 100}%, Donations ${weights.resourcesDonated * 100}%`,
  };
  
  await supabase.from('clan_bank_transactions').insert({
    id: crypto.randomUUID(),
    clan_id: clanId,
    player_id: distributorId,
    username: distributorPlayer || null,
    transaction_type: 'WITHDRAWAL',
    amount_metal: resourceType === 'metal' ? totalAmount : 0,
    amount_energy: resourceType === 'energy' ? totalAmount : 0,
    amount_rp: resourceType === 'rp' ? totalAmount : 0,
    description: `Merit-based distribution to ${recipients.length} members`,
    created_at: new Date().toISOString(),
  });
  
  await supabase.from('clan_activity').insert({
    clan_id: clanId,
    activity_type: 'FUND_DISTRIBUTION',
    player_id: distributorId,
    username: distributorPlayer || null,
    created_at: new Date().toISOString(),
    details: {
      method: 'MERIT',
      resource_type: resourceType,
      total_amount: totalAmount,
      recipient_count: recipients.length,
      distributed_by: distributorPlayer,
      weights: {
        territoriesClaimed: weights.territoriesClaimed,
        warsParticipated: weights.warsParticipated,
        resourcesDonated: weights.resourcesDonated,
      },
    },
  });
  
  return record;
}

export async function directGrant(
  clanId: string,
  distributorId: string,
  grants: Array<{ playerId: string; metal?: number; energy?: number; rp?: number }>
): Promise<DistributionRecord> {
  const supabase = createServiceClient();
  
  const { data: clan, error: clanError } = await supabase
    .from('clans')
    .select('*')
    .eq('id', clanId)
    .single();
  
  if (clanError || !clan) {
    throw new Error('Clan not found');
  }
  
  const { data: members, error: membersError } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId);
  
  if (membersError || !members) {
    throw new Error('Failed to load clan members');
  }

  const totalMetal = grants.reduce((sum, g) => sum + (g.metal || 0), 0);
  const totalEnergy = grants.reduce((sum, g) => sum + (g.energy || 0), 0);
  const totalRP = grants.reduce((sum, g) => sum + (g.rp || 0), 0);
  
  if (totalMetal > 0) {
    await verifyDistributionPermission(clanId, members, distributorId, DistributionMethod.DIRECT_GRANT, totalMetal, 'metal');
  }
  if (totalEnergy > 0) {
    await verifyDistributionPermission(clanId, members, distributorId, DistributionMethod.DIRECT_GRANT, totalEnergy, 'energy');
  }
  if (totalRP > 0) {
    await verifyDistributionPermission(clanId, members, distributorId, DistributionMethod.DIRECT_GRANT, totalRP, 'rp');
  }
  
  const bankMetal = (clan as Record<string, unknown>).bank_treasury_metal as number || 0;
  const bankEnergy = (clan as Record<string, unknown>).bank_treasury_energy as number || 0;
  const bankRP = (clan as Record<string, unknown>).bank_treasury_rp as number || 0;
  
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
    const { data: player } = await supabase
      .from('players')
      .select('username')
      .eq('username', grant.playerId)
      .single();
    
    recipients.push({
      player_id: grant.playerId,
      username: player?.username || 'Unknown',
      amount: {
        metal: grant.metal || 0,
        energy: grant.energy || 0,
        rp: grant.rp || 0,
      },
    });
    
    for (const resourceType of ['metal', 'energy', 'rp'] as const) {
      const amount = grant[resourceType];
      if (amount) {
        await addPlayerResource(supabase, grant.playerId, resourceType, amount);
      }
    }
  }
  
  // Deduct from clan treasury
  if (totalMetal > 0) {
    await supabase.from('clans').update({ bank_treasury_metal: bankMetal - totalMetal }).eq('id', clanId);
  }
  if (totalEnergy > 0) {
    await supabase.from('clans').update({ bank_treasury_energy: bankEnergy - totalEnergy }).eq('id', clanId);
  }
  if (totalRP > 0) {
    await supabase.from('clans').update({ bank_treasury_rp: bankRP - totalRP }).eq('id', clanId);
  }
  
  const distributorMember = members.find((m) => m.player_id === distributorId);
  
  const record: DistributionRecord = {
    clan_id: clanId,
    method: DistributionMethod.DIRECT_GRANT,
    distributed_by: distributorId,
    distributed_by_username: distributorMember?.username || 'Unknown',
    timestamp: new Date().toISOString(),
    resources: {
      metal: totalMetal,
      energy: totalEnergy,
      rp: totalRP,
    },
    recipients,
    total_distributed: {
      metal: totalMetal,
      energy: totalEnergy,
      rp: totalRP,
    },
    notes: `Direct grants to ${grants.length} members`,
  };
  
  await supabase.from('clan_bank_transactions').insert({
    id: crypto.randomUUID(),
    clan_id: clanId,
    player_id: distributorId,
    username: distributorMember?.username || null,
    transaction_type: 'WITHDRAWAL',
    amount_metal: totalMetal,
    amount_energy: totalEnergy,
    amount_rp: totalRP,
    description: `Direct grants to ${grants.length} members`,
    created_at: new Date().toISOString(),
  });
  
  await supabase.from('clan_activity').insert({
    clan_id: clanId,
    activity_type: 'FUND_DISTRIBUTION',
    player_id: distributorId,
    username: distributorMember?.username || null,
    created_at: new Date().toISOString(),
    details: {
      method: 'DIRECT_GRANT',
      total_metal: totalMetal,
      total_energy: totalEnergy,
      total_rp: totalRP,
      recipient_count: grants.length,
      distributed_by: distributorMember?.username,
    },
  });
  
  return record;
}

async function verifyDistributionPermission(
  clanId: string,
  members: Array<{ player_id: string; username: string; role: string }>,
  distributorId: string,
  method: DistributionMethod,
  amount: number,
  resourceType: 'metal' | 'energy' | 'rp'
): Promise<void> {
  const member = members.find((m) => m.player_id === distributorId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }
  
  const role = member.role;
  
  if (role === 'LEADER') {
    return;
  }
  
  if (role === 'CO_LEADER') {
    if (method !== DistributionMethod.EQUAL_SPLIT && method !== DistributionMethod.DIRECT_GRANT) {
      throw new Error('Co-Leaders can only use Equal Split or Direct Grant methods');
    }
    
    const limitKey = `daily${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}` as keyof DistributionLimits;
    const limit = CO_LEADER_DAILY_LIMITS[limitKey];
    const todayDistributed = await getTodayDistributedByPlayer(clanId, distributorId, resourceType);
    
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
  const supabase = createServiceClient();
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const amountCol = txAmountColumn(resourceType);
  
  const { data: distributions, error } = await supabase
    .from('clan_bank_transactions')
    .select(amountCol)
    .eq('clan_id', clanId)
    .eq('player_id', playerId)
    .eq('transaction_type', 'WITHDRAWAL')
    .gte('created_at', todayStart.toISOString());
  
  if (error || !distributions) {
    return 0;
  }
  
  return (distributions as Array<Record<string, number>>).reduce((sum, d) => {
    return sum + (d[amountCol] || 0);
  }, 0);
}

export async function getDistributionHistory(
  clanId: string,
  limit = 100
): Promise<DistributionRecord[]> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('clan_bank_transactions')
    .select('*')
    .eq('clan_id', clanId)
    .eq('transaction_type', 'WITHDRAWAL')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error || !data) {
    return [];
  }
  
  return data.map((tx) => ({
    id: (tx as Record<string, unknown>).id as string,
    clan_id: (tx as Record<string, unknown>).clan_id as string,
    method: DistributionMethod.EQUAL_SPLIT,
    distributed_by: ((tx as Record<string, unknown>).player_id as string) || '',
    distributed_by_username: ((tx as Record<string, unknown>).username as string) || 'Unknown',
    timestamp: (tx as Record<string, unknown>).created_at as string,
    resources: {
      metal: (tx as Record<string, unknown>).amount_metal as number || 0,
      energy: (tx as Record<string, unknown>).amount_energy as number || 0,
      rp: (tx as Record<string, unknown>).amount_rp as number || 0,
    },
    recipients: [],
    total_distributed: {
      metal: (tx as Record<string, unknown>).amount_metal as number || 0,
      energy: (tx as Record<string, unknown>).amount_energy as number || 0,
      rp: (tx as Record<string, unknown>).amount_rp as number || 0,
    },
    notes: ((tx as Record<string, unknown>).description as string) || undefined,
  })) as DistributionRecord[];
}
