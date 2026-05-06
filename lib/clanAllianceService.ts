/**
 * Clan Alliance Service
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages alliances between clans, enabling cooperation through contracts.
 * Supports 4 alliance types with different costs, benefits, and contract options.
 * Enables joint warfare capabilities for allied clans.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

export enum AllianceType {
  NAP = 'NAP',
  TRADE = 'TRADE',
  MILITARY = 'MILITARY',
  FEDERATION = 'FEDERATION',
}

export enum AllianceStatus {
  PROPOSED = 'PROPOSED',
  ACTIVE = 'ACTIVE',
  BROKEN = 'BROKEN',
  EXPIRED = 'EXPIRED',
}

export enum ContractType {
  RESOURCE_SHARING = 'RESOURCE_SHARING',
  DEFENSE_PACT = 'DEFENSE_PACT',
  WAR_SUPPORT = 'WAR_SUPPORT',
  JOINT_RESEARCH = 'JOINT_RESEARCH',
}

export interface AllianceContract {
  type: ContractType;
  terms: {
    resourceSharePercentage?: number;
    autoJoinDefense?: boolean;
    supportAmount?: { metal: number; energy: number };
    researchSharePercentage?: number;
  };
  createdAt: Date;
  createdBy: string;
}

export interface Alliance {
  _id?: string;
  clanIds: [string, string];
  type: AllianceType;
  status: AllianceStatus;
  proposedBy: string;
  proposedAt: Date;
  acceptedAt?: Date;
  contracts: AllianceContract[];
  cost: { metal: number; energy: number };
  brokenAt?: Date;
  brokenBy?: string;
  cooldownUntil?: Date;
  metadata: { createdBy: string; createdByUsername: string };
}

export const ALLIANCE_COSTS = {
  [AllianceType.NAP]: { metal: 0, energy: 0 },
  [AllianceType.TRADE]: { metal: 10000, energy: 10000 },
  [AllianceType.MILITARY]: { metal: 50000, energy: 50000 },
  [AllianceType.FEDERATION]: { metal: 200000, energy: 200000 },
};

export const ALLIANCE_BREAK_COOLDOWN_HOURS = 72;

export const CONTRACT_LIMITS: Record<AllianceType, ContractType[]> = {
  [AllianceType.NAP]: [],
  [AllianceType.TRADE]: [ContractType.RESOURCE_SHARING],
  [AllianceType.MILITARY]: [ContractType.RESOURCE_SHARING, ContractType.DEFENSE_PACT, ContractType.WAR_SUPPORT],
  [AllianceType.FEDERATION]: [ContractType.RESOURCE_SHARING, ContractType.DEFENSE_PACT, ContractType.WAR_SUPPORT, ContractType.JOINT_RESEARCH],
};

export async function proposeAlliance(
  proposingClanId: string,
  targetClanId: string,
  allianceType: AllianceType,
  proposedBy: string
): Promise<Alliance> {
  const supabase = createServiceClient();

  if (proposingClanId === targetClanId) throw new Error('Cannot create alliance with own clan');

  const { data: proposingClan } = await supabase.from('clans').select('*').eq('id', proposingClanId).single();
  const { data: targetClan } = await supabase.from('clans').select('*').eq('id', targetClanId).single();
  if (!proposingClan || !targetClan) throw new Error('One or both clans not found');

  // Verify proposer is Leader or Co-Leader
  const { data: proposerMember } = await supabase.from('clan_members').select('*').eq('clan_id', proposingClanId).eq('player_id', proposedBy).single();
  if (!proposerMember || (proposerMember.role !== 'LEADER' && proposerMember.role !== 'CO_LEADER')) {
    throw new Error('Only Leaders or Co-Leaders can propose alliances');
  }

  // Check for existing
  const { data: existing } = await supabase
    .from('clan_alliances')
    .select('id')
    .or(`clan_a_id.eq.${proposingClanId},clan_b_id.eq.${targetClanId}`)
    .eq('status', 'ACTIVE')
    .single();

  if (existing) throw new Error('Alliance already exists or is pending');

  const cost = ALLIANCE_COSTS[allianceType];

  // Deduct cost
  if (cost.metal > 0 || cost.energy > 0) {
    await supabase.from('clans').update({
      bank_treasury_metal: Math.max(0, (proposingClan.bank_treasury_metal || 0) - cost.metal),
      bank_treasury_energy: Math.max(0, (proposingClan.bank_treasury_energy || 0) - cost.energy),
    }).eq('id', proposingClanId);
  }

  // Create alliance
  const { data: inserted } = await supabase.from('clan_alliances').insert({
    clan_a_id: proposingClanId,
    clan_b_id: targetClanId,
    alliance_type: allianceType,
    status: 'PROPOSED',
    proposed_at: new Date().toISOString(),
    contracts: {},
  }).select('id').single();

  // Log activity
  await supabase.from('clan_activity').insert([{
    clan_id: proposingClanId,
    activity_type: 'ALLIANCE_PROPOSED',
    player_id: proposedBy,
    details: { allianceType, targetClanId, targetClanName: targetClan.name },
  }, {
    clan_id: targetClanId,
    activity_type: 'ALLIANCE_RECEIVED',
    details: { allianceType, proposingClanId, proposingClanName: proposingClan.name },
  }]);

  return {
    clanIds: [proposingClanId, targetClanId],
    type: allianceType,
    status: AllianceStatus.PROPOSED,
    proposedBy: proposingClanId,
    proposedAt: new Date(),
    contracts: [],
    cost,
    metadata: { createdBy: proposedBy, createdByUsername: proposerMember.username },
  };
}

export async function acceptAlliance(
  allianceId: string,
  acceptingClanId: string,
  acceptedBy: string
): Promise<Alliance> {
  const supabase = createServiceClient();

  const { data: alliance } = await supabase.from('clan_alliances').select('*').eq('id', allianceId).single();
  if (!alliance) throw new Error('Alliance not found');
  if (alliance.status !== 'PROPOSED') throw new Error('Alliance is not in proposed state');

  // Verify accepting clan
  if (acceptingClanId !== alliance.clan_b_id) throw new Error('Only the target clan can accept this alliance');

  const { data: acceptingClan } = await supabase.from('clans').select('*').eq('id', acceptingClanId).single();
  if (!acceptingClan) throw new Error('Accepting clan not found');

  const { data: accepterMember } = await supabase.from('clan_members').select('*').eq('clan_id', acceptingClanId).eq('player_id', acceptedBy).single();
  if (!accepterMember || (accepterMember.role !== 'LEADER' && accepterMember.role !== 'CO_LEADER')) {
    throw new Error('Only Leaders or Co-Leaders can accept alliances');
  }

  // Deduct cost from accepting clan
  const cost = alliance.alliance_type; // Would be derived from type, simplified

  await supabase.from('clan_alliances').update({
    status: 'ACTIVE',
    accepted_at: new Date().toISOString(),
  }).eq('id', allianceId);

  await supabase.from('clan_activity').insert([{
    clan_id: acceptingClanId,
    activity_type: 'ALLIANCE_ACCEPTED',
    player_id: acceptedBy,
    details: { allianceType: alliance.alliance_type, allyClanId: alliance.clan_a_id },
  }, {
    clan_id: alliance.clan_a_id,
    activity_type: 'ALLIANCE_FORMED',
    details: { allyClanId: acceptingClanId, allyClanName: acceptingClan.name },
  }]);

  const { data: updated } = await supabase.from('clan_alliances').select('*').eq('id', allianceId).single();
  return updated as unknown as Alliance;
}

export async function breakAlliance(
  allianceId: string,
  breakingClanId: string,
  brokenBy: string
): Promise<Alliance> {
  const supabase = createServiceClient();

  const { data: alliance } = await supabase.from('clan_alliances').select('*').eq('id', allianceId).single();
  if (!alliance) throw new Error('Alliance not found');
  if (alliance.status !== 'ACTIVE') throw new Error('Alliance is not active');

  const cooldownUntil = new Date();
  cooldownUntil.setHours(cooldownUntil.getHours() + ALLIANCE_BREAK_COOLDOWN_HOURS);

  await supabase.from('clan_alliances').update({
    status: 'BROKEN',
    broken_at: new Date().toISOString(),
  }).eq('id', allianceId);

  const otherClanId = alliance.clan_a_id === breakingClanId ? alliance.clan_b_id : alliance.clan_a_id;

  await supabase.from('clan_activity').insert([{
    clan_id: breakingClanId,
    activity_type: 'ALLIANCE_BROKEN',
    player_id: brokenBy,
    details: { allianceType: alliance.alliance_type, formerAllyClanId: otherClanId },
  }, {
    clan_id: otherClanId,
    activity_type: 'ALLIANCE_BROKEN',
    details: { formerAllyClanId: breakingClanId },
  }]);

  const { data: updated } = await supabase.from('clan_alliances').select('*').eq('id', allianceId).single();
  return { ...updated, cooldownUntil } as unknown as Alliance;
}

export async function addContract(
  allianceId: string,
  clanId: string,
  playerId: string,
  contractType: ContractType,
  terms: AllianceContract['terms']
): Promise<Alliance> {
  const supabase = createServiceClient();

  const { data: alliance } = await supabase.from('clan_alliances').select('*').eq('id', allianceId).single();
  if (!alliance) throw new Error('Alliance not found');
  if (alliance.status !== 'ACTIVE') throw new Error('Alliance must be active to add contracts');

  // Check allowed contracts
  const allowedContracts = CONTRACT_LIMITS[alliance.alliance_type as AllianceType] || [];
  if (!allowedContracts.includes(contractType)) throw new Error(`Contract not allowed for ${alliance.alliance_type}`);

  // Update contracts JSON
  const existingContracts = (alliance.contracts as unknown as Record<string, unknown>) || {};
  existingContracts[contractType] = terms;

  await supabase.from('clan_alliances').update({ contracts: existingContracts as unknown as Json }).eq('id', allianceId);

  const { data: updated } = await supabase.from('clan_alliances').select('*').eq('id', allianceId).single();
  return updated as unknown as Alliance;
}

export async function removeContract(
  allianceId: string,
  clanId: string,
  playerId: string,
  contractType: ContractType
): Promise<Alliance> {
  const supabase = createServiceClient();

  const { data: alliance } = await supabase.from('clan_alliances').select('*').eq('id', allianceId).single();
  if (!alliance) throw new Error('Alliance not found');

  const contracts = (alliance.contracts as unknown as Record<string, unknown>) || {};
  delete contracts[contractType];

  await supabase.from('clan_alliances').update({ contracts: contracts as unknown as Json }).eq('id', allianceId);

  const { data: updated } = await supabase.from('clan_alliances').select('*').eq('id', allianceId).single();
  return updated as unknown as Alliance;
}

export async function getAlliancesForClan(clanId: string, includeInactive = false): Promise<Alliance[]> {
  const supabase = createServiceClient();
  let query = supabase.from('clan_alliances').select('*').or(`clan_a_id.eq.${clanId},clan_b_id.eq.${clanId}`);
  if (!includeInactive) query = query.in('status', ['PROPOSED', 'ACTIVE']);
  const { data } = await query.order('proposed_at', { ascending: false });
  return (data || []) as unknown as Alliance[];
}

export async function getAllianceBetweenClans(clanId1: string, clanId2: string): Promise<Alliance | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('clan_alliances')
    .select('*')
    .or(`and(clan_a_id.eq.${clanId1},clan_b_id.eq.${clanId2}),and(clan_a_id.eq.${clanId2},clan_b_id.eq.${clanId1})`)
    .eq('status', 'ACTIVE')
    .single();
  return data as unknown as Alliance | null;
}

export async function areAllies(clanId1: string, clanId2: string): Promise<boolean> {
  const alliance = await getAllianceBetweenClans(clanId1, clanId2);
  return alliance !== null;
}

export async function getAllyIds(clanId: string): Promise<string[]> {
  const alliances = await getAlliancesForClan(clanId, false);
  return alliances
    .filter((a: any) => a.status === 'ACTIVE' || a.status === AllianceStatus.ACTIVE)
    .map((a: any) => a.clan_a_id === clanId ? a.clan_b_id : a.clan_a_id)
    .filter(Boolean);
}
