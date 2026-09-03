import { db } from '@/lib/db';
import { clans } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  Clan,
  ClanPerk,
  ClanPerkTier,
  ClanPerkCategory,
  CLAN_PERK_CATALOG,
  CLAN_PERK_LIMITS,
} from '@/types/clan.types';

export function initializeClanPerkService(): void {
  // No-op: Drizzle uses direct db import
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
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0] as unknown as Clan;
  if (!clan) {
    throw new Error('Clan not found');
  }

  const member = clan.members.find((m) => m.playerId === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }

  const { hasPermission } = await import('@/types/clan.types');
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

  const tierUnlocked = await isTierUnlocked(clan, perk.tier);
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

  const updatedPerks = [...clan.activePerks, activatedPerk];

  await db.update(clans)
    .set({
      activePerks: updatedPerks as any,
      bankTreasuryMetal: Number(BigInt(Number(clan.bank.treasury.metal) - metal)),
      bankTreasuryEnergy: Number(BigInt(Number(clan.bank.treasury.energy) - energy)),
      bankTreasuryResearchPoints: clan.bank.treasury.researchPoints - researchPoints,
    })
    .where(eq(clans.id, clanId));

  await logPerkActivity(clanId, playerId, 'activate', perkId, perk.name);

  const updatedResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const updatedClan = updatedResult[0] as unknown as Clan;
  if (!updatedClan) {
    throw new Error('Failed to retrieve updated clan');
  }

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
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0] as unknown as Clan;
  if (!clan) {
    throw new Error('Clan not found');
  }

  const member = clan.members.find((m) => m.playerId === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }

  const { hasPermission } = await import('@/types/clan.types');
  if (!hasPermission(member.role, 'canManageResearch')) {
    throw new Error('Insufficient permissions to deactivate perks');
  }

  const activePerk = clan.activePerks.find((p) => p.id === perkId);
  if (!activePerk) {
    throw new Error('Perk is not currently active');
  }

  const updatedPerks = clan.activePerks.filter((p) => p.id !== perkId);

  await db.update(clans)
    .set({
      activePerks: updatedPerks as any,
    })
    .where(eq(clans.id, clanId));

  await logPerkActivity(clanId, playerId, 'deactivate', perkId, activePerk.name);

  const updatedResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const updatedClan = updatedResult[0] as unknown as Clan;
  if (!updatedClan) {
    throw new Error('Failed to retrieve updated clan');
  }

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
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0] as unknown as Clan;

  if (!clan) {
    throw new Error('Clan not found');
  }

  const currentLevel = clan.level.currentLevel;
  const unlocked: ClanPerk[] = [];
  const locked: Array<ClanPerk & { levelsToUnlock: number }> = [];

  for (const perk of CLAN_PERK_CATALOG) {
    const tierAvailable = await isTierUnlocked(clan, perk.tier);

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
    activeCount: clan.activePerks.length,
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
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0] as unknown as Clan;

  if (!clan) {
    throw new Error('Clan not found');
  }

  const totalBonuses = {
    attack: 0,
    defense: 0,
    resourceYield: 0,
    xpGain: 0,
    territoryCostReduction: 0,
  };

  for (const perk of clan.activePerks) {
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
    perks: clan.activePerks,
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
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0] as unknown as Clan;

  if (!clan) {
    throw new Error('Clan not found');
  }

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

  for (const perk of remainingPerks.slice(0, remainingSlots - recommendations.length)) {
    recommendations.push({
      perk,
      reason: 'High tier perk with strong bonuses',
      priority: 'low',
    });
  }

  return recommendations;
}

async function isTierUnlocked(clan: Clan, tier: ClanPerkTier): Promise<boolean> {
  const tierLevels: Record<ClanPerkTier, number> = {
    BRONZE: 5,
    SILVER: 10,
    GOLD: 15,
    LEGENDARY: 20,
  };

  return clan.level.currentLevel >= tierLevels[tier];
}

async function logPerkActivity(
  clanId: string,
  playerId: string,
  action: 'activate' | 'deactivate',
  perkId: string,
  perkName: string
): Promise<void> {
  const { modLog } = await import('@/lib/db/schema');

  await db.insert(modLog).values({
    id: `ml-${Date.now()}`,
    moderatorId: playerId,
    action: action === 'activate' ? 'PERK_ACTIVATED' : 'PERK_DEACTIVATED',
    targetId: clanId,
    reason: `Perk ${action}: ${perkName}`,
    details: JSON.stringify({ perkId, perkName }),
    createdAt: new Date(),
  });
}
