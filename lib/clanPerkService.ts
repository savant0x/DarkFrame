/**
 * Clan Perk Management Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages clan perk system with 4 tiers (Bronze, Silver, Gold, Legendary) and 4 categories
 * (Combat, Economic, Social, Strategic). Perks provide passive bonuses to all clan members
 * and require specific clan levels to unlock. Activation costs resources from clan bank.
 * 
 * Core Systems:
 * - Perk Catalog: 16 total perks (4 tiers x 4 categories)
 * - Tier Unlocking: Bronze (Lvl 5), Silver (Lvl 10), Gold (Lvl 15), Legendary (Lvl 20)
 * - Activation Management: Purchase perks using clan bank resources
 * - Active Perk Limits: Max 4 active perks at once (1 per category recommended)
 * - Cost Scaling: Bronze (100K/100K/10K), Silver (250K/250K/25K), Gold (500K/500K/50K), Legendary (1M/1M/100K)
 * 
 * Perk Categories:
 * - COMBAT: Attack/Defense bonuses for battles (5-25% boost)
 * - ECONOMIC: Resource generation and efficiency (5-20% boost)
 * - SOCIAL: Member benefits and capacity (XP boost, max members)
 * - STRATEGIC: Territory and warfare bonuses (territory cost reduction, war bonuses)
 */

import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import {
  Clan,
  ClanPerk,
  ClanPerkTier,
  ClanPerkCategory,
  CLAN_PERK_CATALOG,
  CLAN_PERK_LIMITS,
  ClanRole,
  hasPermission,
} from '@/types/clan.types';

function mapRowToClanPerk(row: Record<string, unknown>): ClanPerk {
  return {
    id: row.perk_id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    category: row.category as ClanPerkCategory,
    tier: row.tier as ClanPerkTier,
    requiredLevel: row.required_level as number,
    cost: {
      metal: row.cost_metal as number,
      energy: row.cost_energy as number,
      researchPoints: row.cost_rp as number,
    },
    bonus: {
      type: row.bonus_type as ClanPerk['bonus']['type'],
      value: row.bonus_value as number,
    },
    activatedAt: row.activated_at ? new Date(row.activated_at as string) : undefined,
    activatedBy: row.activated_by as string | undefined,
  };
}

function mapRowToClanMember(row: Record<string, unknown>) {
  return {
    playerId: row.player_id as string,
    username: row.username as string,
    role: row.role as ClanRole,
    joinedAt: new Date(row.joined_at as string),
    lastActive: new Date(row.last_active as string),
  };
}

async function fetchFullClan(supabase: ReturnType<typeof createServiceClient>, clanId: string): Promise<Clan> {
  const { data: clanRow, error } = await supabase
    .from('clans')
    .select('*')
    .eq('id', clanId)
    .single();

  if (error || !clanRow) {
    throw new Error('Clan not found');
  }

  const { data: memberRows } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId);

  const { data: perkRows } = await supabase
    .from('clan_perks')
    .select('*')
    .eq('clan_id', clanId);

  const r = clanRow as Record<string, unknown>;
  const members = (memberRows || []).map(mapRowToClanMember);
  const activePerks = (perkRows || []).map(mapRowToClanPerk);

  const clanSettings = (r.clan_settings as Record<string, unknown>) || {};

  return {
    _id: r.id as string,
    name: r.name as string,
    tag: r.tag as string,
    description: r.description as string,
    leaderId: r.leader_id as string,
    members,
    maxMembers: r.max_members as number,
    level: {
      currentLevel: r.clan_level as number,
      totalXP: r.total_xp as number,
      currentLevelXP: r.current_level_xp as number,
      xpToNextLevel: r.xp_to_next_level as number,
      featuresUnlocked: [],
      milestonesCompleted: [],
      lastLevelUp: r.last_level_up ? new Date(r.last_level_up as string) : undefined,
      lastXPGain: r.last_xp_gain ? new Date(r.last_xp_gain as string) : undefined,
      prestigeBadge: r.prestige_badge as string | undefined,
    },
    createdAt: new Date(r.created_at as string),
    settings: {
      messageOfTheDay: (clanSettings.messageOfTheDay as string) || '',
      isRecruiting: (clanSettings.isRecruiting as boolean) || false,
      minLevelToJoin: (clanSettings.minLevelToJoin as number) || 1,
      requiresApproval: (clanSettings.requiresApproval as boolean) || false,
      allowTerritoryControl: (clanSettings.allowTerritoryControl as boolean) !== false,
      allowWarDeclarations: (clanSettings.allowWarDeclarations as boolean) !== false,
    },
    stats: {
      totalPower: r.total_power as number || 0,
      totalTerritories: r.total_territories as number || 0,
      totalMonuments: r.total_monuments as number || 0,
      warsWon: r.wars_won as number || 0,
      warsLost: r.wars_lost as number || 0,
      totalRP: r.total_rp as number || 0,
    },
    research: {
      researchPoints: r.research_points as number || 0,
      unlockedTechs: r.unlocked_research as string[] || [],
      activeResearch: r.active_research as string | null,
    },
    bank: {
      treasury: {
        metal: r.bank_treasury_metal as number || 0,
        energy: r.bank_treasury_energy as number || 0,
        researchPoints: r.bank_treasury_rp as number || 0,
      },
      taxRates: {
        metal: r.bank_tax_metal as number || 0,
        energy: r.bank_tax_energy as number || 0,
        researchPoints: r.bank_tax_rp as number || 0,
      },
      upgradeLevel: r.bank_upgrade_level as number || 1,
      capacity: r.bank_capacity as number || 0,
      transactions: [],
    },
    activePerks,
    territories: [],
    monuments: [],
    wars: {
      active: [],
      history: [],
    },
  };
}

export async function activatePerk(
  clanId: string,
  playerId: string,
  perkId: string
): Promise<{
  success: boolean;
  clan: Clan;
  perk: ClanPerk;
  costPaid: { metal: number; energy: number; researchPoints: number };
  message: string;
}> {
  const supabase = createServiceClient();

  const clan = await fetchFullClan(supabase, clanId);

  if (!clan) {
    throw new Error('Clan not found');
  }

  const member = clan.members.find((m) => m.playerId === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }

  if (!hasPermission(member.role, 'canManageResearch')) {
    throw new Error('Insufficient permissions to activate perks');
  }

  const perk = CLAN_PERK_CATALOG.find((p) => p.id === perkId);
  if (!perk) {
    throw new Error('Perk not found in catalog');
  }

  const isActive = clan.activePerks.some((p) => p.id === perkId);
  if (isActive) {
    throw new Error('Perk is already active');
  }

  if (clan.level.currentLevel < perk.requiredLevel) {
    throw new Error(`Clan must be level ${perk.requiredLevel} to activate this perk`);
  }

  const tierUnlocked = await isTierUnlocked(supabase, clanId, perk.tier);
  if (!tierUnlocked) {
    throw new Error(`${perk.tier} tier perks are not unlocked yet`);
  }

  if (clan.activePerks.length >= CLAN_PERK_LIMITS.MAX_ACTIVE_PERKS) {
    throw new Error(`Maximum active perks reached (${CLAN_PERK_LIMITS.MAX_ACTIVE_PERKS}). Deactivate a perk first.`);
  }

  const { metal, energy, researchPoints } = perk.cost;
  if (clan.bank.treasury.metal < metal) {
    throw new Error(`Insufficient metal in bank (need ${metal}, have ${clan.bank.treasury.metal})`);
  }
  if (clan.bank.treasury.energy < energy) {
    throw new Error(`Insufficient energy in bank (need ${energy}, have ${clan.bank.treasury.energy})`);
  }
  if (clan.bank.treasury.researchPoints < researchPoints) {
    throw new Error(`Insufficient RP in bank (need ${researchPoints}, have ${clan.bank.treasury.researchPoints})`);
  }

  const activatedPerk: ClanPerk = {
    ...perk,
    activatedAt: new Date(),
    activatedBy: playerId,
  };

  await supabase.from('clan_perks').insert({
    id: crypto.randomUUID(),
    clan_id: clanId,
    perk_id: perk.id,
    name: perk.name,
    description: perk.description,
    category: perk.category,
    tier: perk.tier,
    required_level: perk.requiredLevel,
    cost_metal: perk.cost.metal,
    cost_energy: perk.cost.energy,
    cost_rp: perk.cost.researchPoints,
    bonus_type: perk.bonus.type,
    bonus_value: perk.bonus.value,
    activated_at: new Date().toISOString(),
    activated_by: playerId,
  });

  await supabase
    .from('clans')
    .update({
      bank_treasury_metal: clan.bank.treasury.metal - metal,
      bank_treasury_energy: clan.bank.treasury.energy - energy,
      bank_treasury_rp: clan.bank.treasury.researchPoints - researchPoints,
    })
    .eq('id', clanId);

  await logPerkActivity(supabase, clanId, playerId, 'activate', perkId, perk.name);

  const updatedClan = await fetchFullClan(supabase, clanId);

  return {
    success: true,
    clan: updatedClan,
    perk: activatedPerk,
    costPaid: { metal, energy, researchPoints },
    message: `${perk.name} activated! ${perk.description}`,
  };
}

export async function deactivatePerk(
  clanId: string,
  playerId: string,
  perkId: string
): Promise<{
  success: boolean;
  clan: Clan;
  perkName: string;
  message: string;
}> {
  const supabase = createServiceClient();

  const clan = await fetchFullClan(supabase, clanId);

  if (!clan) {
    throw new Error('Clan not found');
  }

  const member = clan.members.find((m) => m.playerId === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }

  if (!hasPermission(member.role, 'canManageResearch')) {
    throw new Error('Insufficient permissions to deactivate perks');
  }

  const activePerk = clan.activePerks.find((p) => p.id === perkId);
  if (!activePerk) {
    throw new Error('Perk is not currently active');
  }

  await supabase
    .from('clan_perks')
    .delete()
    .eq('clan_id', clanId)
    .eq('perk_id', perkId);

  await logPerkActivity(supabase, clanId, playerId, 'deactivate', perkId, activePerk.name);

  const updatedClan = await fetchFullClan(supabase, clanId);

  return {
    success: true,
    clan: updatedClan,
    perkName: activePerk.name,
    message: `${activePerk.name} deactivated. Perk slot freed.`,
  };
}

export async function getAvailablePerks(clanId: string): Promise<{
  unlocked: ClanPerk[];
  locked: Array<ClanPerk & { levelsToUnlock: number }>;
  activeCount: number;
  maxActive: number;
}> {
  const supabase = createServiceClient();

  const { data: clan, error } = await supabase
    .from('clans')
    .select('clan_level')
    .eq('id', clanId)
    .single();

  if (error || !clan) {
    throw new Error('Clan not found');
  }

  const { data: perks } = await supabase
    .from('clan_perks')
    .select('*')
    .eq('clan_id', clanId);

  const currentLevel = (clan as Record<string, unknown>).clan_level as number;
  const activePerks = (perks || []).map(mapRowToClanPerk);
  const unlocked: ClanPerk[] = [];
  const locked: Array<ClanPerk & { levelsToUnlock: number }> = [];

  for (const perk of CLAN_PERK_CATALOG) {
    const tierUnlockLevels: Record<ClanPerkTier, number> = {
      BRONZE: 5,
      SILVER: 10,
      GOLD: 15,
      LEGENDARY: 20,
    };
    const tierAvailable = currentLevel >= tierUnlockLevels[perk.tier];

    if (currentLevel >= perk.requiredLevel && tierAvailable) {
      unlocked.push(perk);
    } else {
      locked.push({
        ...perk,
        levelsToUnlock: Math.max(0, perk.requiredLevel - currentLevel),
      });
    }
  }

  return {
    unlocked,
    locked,
    activeCount: activePerks.length,
    maxActive: CLAN_PERK_LIMITS.MAX_ACTIVE_PERKS,
  };
}

export async function getActivePerks(clanId: string): Promise<{
  perks: ClanPerk[];
  totalBonuses: {
    attack: number;
    defense: number;
    resourceYield: number;
    xpGain: number;
    territoryCostReduction: number;
  };
}> {
  const supabase = createServiceClient();

  const { data: perks, error } = await supabase
    .from('clan_perks')
    .select('*')
    .eq('clan_id', clanId);

  if (error) {
    throw new Error('Clan not found');
  }

  const activePerks = (perks || []).map(mapRowToClanPerk);
  const totalBonuses = {
    attack: 0,
    defense: 0,
    resourceYield: 0,
    xpGain: 0,
    territoryCostReduction: 0,
  };

  for (const perk of activePerks) {
    switch (perk.bonus.type) {
      case 'attack':
        totalBonuses.attack += perk.bonus.value;
        break;
      case 'defense':
        totalBonuses.defense += perk.bonus.value;
        break;
      case 'resource_yield':
        totalBonuses.resourceYield += perk.bonus.value;
        break;
      case 'xp_gain':
        totalBonuses.xpGain += perk.bonus.value;
        break;
      case 'territory_cost':
        totalBonuses.territoryCostReduction += perk.bonus.value;
        break;
    }
  }

  return {
    perks: activePerks,
    totalBonuses,
  };
}

export function getPerksByCategory(
  category: ClanPerkCategory,
  clanLevel?: number
): ClanPerk[] {
  let perks = CLAN_PERK_CATALOG.filter((p) => p.category === category);

  if (clanLevel !== undefined) {
    perks = perks.filter((p) => p.requiredLevel <= clanLevel);
  }

  return perks;
}

export function getPerksByTier(tier: ClanPerkTier): ClanPerk[] {
  return CLAN_PERK_CATALOG.filter((p) => p.tier === tier);
}

export function calculateTierCost(tier: ClanPerkTier): {
  metal: number;
  energy: number;
  researchPoints: number;
  perkCount: number;
} {
  const perks = getPerksByTier(tier);
  const totalCost = perks.reduce(
    (acc, perk) => ({
      metal: acc.metal + perk.cost.metal,
      energy: acc.energy + perk.cost.energy,
      researchPoints: acc.researchPoints + perk.cost.researchPoints,
    }),
    { metal: 0, energy: 0, researchPoints: 0 }
  );

  return {
    ...totalCost,
    perkCount: perks.length,
  };
}

export async function getRecommendedPerks(clanId: string): Promise<
  Array<{
    perk: ClanPerk;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }>
> {
  const supabase = createServiceClient();

  const clan = await fetchFullClan(supabase, clanId);

  const recommendations: Array<{
    perk: ClanPerk;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }> = [];

  const { unlocked } = await getAvailablePerks(clanId);
  const activeIds = clan.activePerks.map((p) => p.id);

  const hasActiveWars = clan.wars.active.length > 0;
  if (hasActiveWars) {
    const combatPerks = unlocked.filter(
      (p) => p.category === 'COMBAT' && !activeIds.includes(p.id)
    );
    for (const perk of combatPerks.slice(0, 2)) {
      recommendations.push({
        perk,
        reason: 'Recommended for active warfare - boosts combat effectiveness',
        priority: 'high',
      });
    }
  }

  const bankUsage =
    (clan.bank.treasury.metal + clan.bank.treasury.energy) /
    (clan.bank.capacity * 2);
  if (bankUsage < 0.3) {
    const economicPerks = unlocked.filter(
      (p) => p.category === 'ECONOMIC' && !activeIds.includes(p.id)
    );
    for (const perk of economicPerks.slice(0, 2)) {
      recommendations.push({
        perk,
        reason: 'Low resources - boosts resource generation',
        priority: 'high',
      });
    }
  }

  const memberUsage = clan.members.length / clan.maxMembers;
  if (memberUsage > 0.8) {
    const socialPerks = unlocked.filter(
      (p) => p.category === 'SOCIAL' && !activeIds.includes(p.id)
    );
    for (const perk of socialPerks.slice(0, 1)) {
      recommendations.push({
        perk,
        reason: 'Near member capacity - increases max members or XP gain',
        priority: 'medium',
      });
    }
  }

  if (clan.stats.totalTerritories > 5) {
    const strategicPerks = unlocked.filter(
      (p) => p.category === 'STRATEGIC' && !activeIds.includes(p.id)
    );
    for (const perk of strategicPerks.slice(0, 1)) {
      recommendations.push({
        perk,
        reason: 'Large territory - reduces costs and boosts territory bonuses',
        priority: 'medium',
      });
    }
  }

  const remainingSlots = CLAN_PERK_LIMITS.MAX_ACTIVE_PERKS - clan.activePerks.length;
  const remainingPerks = unlocked
    .filter((p) => !activeIds.includes(p.id))
    .filter((p) => !recommendations.some((r) => r.perk.id === p.id))
    .sort((a, b) => {
      const tierOrder: Record<ClanPerkTier, number> = {
        LEGENDARY: 4,
        GOLD: 3,
        SILVER: 2,
        BRONZE: 1,
      };
      return tierOrder[b.tier] - tierOrder[a.tier];
    });

  for (const perk of remainingPerks.slice(0, Math.max(0, remainingSlots - recommendations.length))) {
    recommendations.push({
      perk,
      reason: 'High tier perk with strong bonuses',
      priority: 'low',
    });
  }

  return recommendations;
}

async function isTierUnlocked(
  supabase: ReturnType<typeof createServiceClient>,
  clanId: string,
  tier: ClanPerkTier
): Promise<boolean> {
  const tierLevels: Record<ClanPerkTier, number> = {
    BRONZE: 5,
    SILVER: 10,
    GOLD: 15,
    LEGENDARY: 20,
  };

  const { data: clan } = await supabase
    .from('clans')
    .select('clan_level')
    .eq('id', clanId)
    .single();

  if (!clan) return false;

  return ((clan as Record<string, unknown>).clan_level as number) >= tierLevels[tier];
}

async function logPerkActivity(
  supabase: ReturnType<typeof createServiceClient>,
  clanId: string,
  playerId: string,
  action: 'activate' | 'deactivate',
  perkId: string,
  perkName: string
): Promise<void> {
  await supabase.from('clan_activity').insert({
    clan_id: clanId,
    activity_type: action === 'activate' ? 'PERK_ACTIVATED' : 'PERK_DEACTIVATED',
    player_id: playerId,
    created_at: new Date().toISOString(),
    details: {
      perk_id: perkId,
      perk_name: perkName,
    },
  });
}
