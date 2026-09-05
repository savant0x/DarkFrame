import { db } from '@/lib/db';
import { clans } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { ClanWar } from '@/types/clan.types';
import { ClanWarStatus } from '@/types/clan.types';

/**
 * Structural contract for the `clans` rows this service reads and writes.
 *
 * The Drizzle row type is currently opaque because of the open dialect split
 * (SCOPE.md item #7: MySQL-dialect schema vs node-postgres driver), so both the
 * legacy Mongo-shaped JSON columns (members/level/bank/activePerks) and the flat
 * relational columns the warfare code touches are documented here and asserted
 * at the query boundary. Revisit when the DB direction converges.
 */
interface ClanWarfareRow {
  id: string;
  name: string;
  tag: string;
  members: Array<{ playerId: string; role: string }>;
  // pg row shape (drizzle): flat columns, NOT nested domain objects
  levelCurrentLevel: number;
  bankTreasuryMetal: number | null;
  bankTreasuryEnergy: number | null;
  activePerks?: Array<{ bonus?: { type?: string; value?: number } | null }>;
  territories?: Array<{
    clanId: string;
    tileX: number;
    tileY: number;
    claimedAt: Date;
    claimedBy: string;
    defenseBonus: number;
  }>;
  statsTotalTerritories?: number | null;
}

export const WAR_CONSTANTS = {
  BASE_WAR_COST_METAL: 50000,
  BASE_WAR_COST_ENERGY: 50000,
  MIN_LEVEL_TO_DECLARE_WAR: 10,
  MIN_WAR_DURATION_HOURS: 48,
  WAR_COOLDOWN_HOURS: 168,
  BASE_CAPTURE_SUCCESS_RATE: 0.7,
  DEFENSE_BONUS_IMPACT: 0.5,
  WAR_SPOILS_METAL_PERCENT: 15,
  WAR_SPOILS_ENERGY_PERCENT: 15,
  WAR_SPOILS_RP_PERCENT: 10,
  WAR_VICTORY_XP_BONUS: 50000,
  WAR_DEFEAT_XP_PENALTY: 25000,
} as const;

export function initializeWarfareService(): void {
  // No-op: Drizzle uses direct db import
}

export async function declareWar(
  clanId: string,
  targetClanId: string,
  playerId: string
): Promise<{
  war: ClanWar;
  cost: { metal: number; energy: number };
  message: string;
}> {
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0] as unknown as ClanWarfareRow;
  if (!clan) throw new Error('Declaring clan not found');

  const targetResult = await db.select().from(clans).where(eq(clans.id, targetClanId)).limit(1);
  const targetClan = targetResult[0] as unknown as ClanWarfareRow;
  if (!targetClan) throw new Error('Target clan not found');
  if (clanId === targetClanId) throw new Error('Cannot declare war on your own clan');

  const member = clan.members.find((m) => m.playerId === playerId);
  if (!member) throw new Error('Player not in clan');
  if (!['LEADER', 'CO_LEADER', 'OFFICER'].includes(member.role)) {
    throw new Error('Only Leaders, Co-Leaders, and Officers can declare war');
  }

  if (clan.levelCurrentLevel < WAR_CONSTANTS.MIN_LEVEL_TO_DECLARE_WAR) {
    throw new Error(
      `Clan level ${WAR_CONSTANTS.MIN_LEVEL_TO_DECLARE_WAR} required to declare war (current: ${clan.levelCurrentLevel})`
    );
  }

  let costReduction = 0;
  for (const perk of clan.activePerks || []) {
    if (perk.bonus?.type === 'territory_cost') {
      costReduction += perk.bonus.value ?? 0;
    }
  }

  const baseCost = {
    metal: WAR_CONSTANTS.BASE_WAR_COST_METAL,
    energy: WAR_CONSTANTS.BASE_WAR_COST_ENERGY,
  };

  const finalCost = {
    metal: Math.floor(baseCost.metal * (1 - costReduction / 100)),
    energy: Math.floor(baseCost.energy * (1 - costReduction / 100)),
  };

  const currentMetal = Number(clan.bankTreasuryMetal ?? 0);
  const currentEnergy = Number(clan.bankTreasuryEnergy ?? 0);

  if (currentMetal < finalCost.metal) {
    throw new Error(`Insufficient Metal (need ${finalCost.metal}, have ${currentMetal})`);
  }
  if (currentEnergy < finalCost.energy) {
    throw new Error(`Insufficient Energy (need ${finalCost.energy}, have ${currentEnergy})`);
  }

  // Atomicity (FID §5.2 money-loss class): the treasury debit and the WAR_DECLARED
  // record must commit together. Previously a failed mod_log insert (id overflow /
  // target_id width) left the treasury debited with no war in existence.
  const warId = `${clanId}-${targetClanId}-${Date.now()}`;
  const warDoc: ClanWar = {
    warId,
    attackerClanId: clanId,
    defenderClanId: targetClanId,
    status: ClanWarStatus.DECLARED,
    declaredAt: new Date(),
    declarationCost: {
      metal: finalCost.metal,
      energy: finalCost.energy,
    },
    stats: {
      attackerTerritoryGained: 0,
      defenderTerritoryGained: 0,
      attackerBattlesWon: 0,
      defenderBattlesWon: 0,
    },
  };

  const { modLog } = await import('@/lib/db/schema');
  // pg: mod_log.id is varchar(24) with no auto default that fits — drizzle's uuid
  // default (36 chars) overflows. generateId() yields 23 chars (FID §5.2 id-overflow class).
  const { generateId } = await import('@/lib/utils');

  await db.transaction(async (tx) => {
    await tx.insert(modLog).values({
      id: generateId(),
      moderatorId: playerId,
      action: 'WAR_DECLARED',
      targetId: targetClanId,
      reason: `War declared on ${targetClan.name}`,
      details: JSON.stringify({ warId, attackerClanId: clanId, targetClanId, cost: finalCost }),
      createdAt: new Date(),
    });

    await tx.update(clans)
      .set({
        bankTreasuryMetal: Number(BigInt(currentMetal - finalCost.metal)),
        bankTreasuryEnergy: Number(BigInt(currentEnergy - finalCost.energy)),
      })
      .where(eq(clans.id, clanId));
  });

  return {
    war: warDoc,
    cost: finalCost,
    message: `War declared against [${targetClan.tag}] ${targetClan.name}`,
  };
}

export async function captureTerritory(
  clanId: string,
  targetClanId: string,
  tileX: number,
  tileY: number,
  playerId: string
): Promise<{
  success: boolean;
  territory?: { tileX: number; tileY: number; clanId: string };
  defenseBonus?: number;
  message: string;
}> {
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0] as unknown as ClanWarfareRow;
  if (!clan) throw new Error('Capturing clan not found');

  const targetResult = await db.select().from(clans).where(eq(clans.id, targetClanId)).limit(1);
  const targetClan = targetResult[0] as unknown as ClanWarfareRow;
  if (!targetClan) throw new Error('Target clan not found');

  const member = clan.members.find((m) => m.playerId === playerId);
  if (!member) throw new Error('Player not in clan');
  if (!['LEADER', 'CO_LEADER', 'OFFICER'].includes(member.role)) {
    throw new Error('Only Leaders, Co-Leaders, and Officers can capture territories');
  }

  const territories = targetClan.territories || [];
  const territoryIndex = territories.findIndex((t) => t.tileX === tileX && t.tileY === tileY);
  if (territoryIndex === -1) {
    throw new Error('Territory not owned by target clan');
  }

  const defenseBonus = calculateDefenseBonus(territories, tileX, tileY);

  const successRate = Math.max(
    0.3,
    WAR_CONSTANTS.BASE_CAPTURE_SUCCESS_RATE - (defenseBonus / 100) * WAR_CONSTANTS.DEFENSE_BONUS_IMPACT
  );

  const captureSuccessful = Math.random() < successRate;

  if (!captureSuccessful) {
    return {
      success: false,
      defenseBonus,
      message: `Failed to capture territory. Enemy defense bonus: ${defenseBonus}%`,
    };
  }

  const updatedTargetTerritories = territories.filter((t) => !(t.tileX === tileX && t.tileY === tileY));
  const clanTerritories = clan.territories ?? [];
  const newTerritory = {
    clanId,
    tileX,
    tileY,
    claimedAt: new Date(),
    claimedBy: playerId,
    defenseBonus: 0,
  };

  await db.update(clans)
    .set({
      territories: updatedTargetTerritories,
      statsTotalTerritories: Math.max(0, (targetClan.statsTotalTerritories || 0) - 1),
    })
    .where(eq(clans.id, targetClanId));

  await db.update(clans)
    .set({
      territories: [...clanTerritories, newTerritory],
      statsTotalTerritories: (clan.statsTotalTerritories || 0) + 1,
    })
    .where(eq(clans.id, clanId));

  return {
    success: true,
    territory: { tileX, tileY, clanId },
    defenseBonus,
    message: `Successfully captured territory (${tileX}, ${tileY})!`,
  };
}

export async function endWar(
  _warId: string,
  _outcome: 'WIN' | 'LOSS' | 'TRUCE',
  _endedBy: string
): Promise<ClanWar | null> {
  throw new Error('endWar requires clan_wars table - not yet migrated to Drizzle');
}

export async function getActiveWars(_clanId: string): Promise<ClanWar[]> {
  return [];
}

export async function getClanWarHistory(_clanId: string, _limit = 50): Promise<ClanWar[]> {
  return [];
}

export async function getWar(_warId: string): Promise<ClanWar | null> {
  return null;
}

export async function calculateWarSpoils(
  winnerClanId: string,
  loserClanId: string
): Promise<{
  metal: number;
  energy: number;
  rp: number;
}> {
  const loserResult = await db.select().from(clans).where(eq(clans.id, loserClanId)).limit(1);
  const loserClan = loserResult[0];
  if (!loserClan) {
    return { metal: 0, energy: 0, rp: 0 };
  }

  const loserMetal = Number(loserClan.bankTreasuryMetal || 0n);
  const loserEnergy = Number(loserClan.bankTreasuryEnergy || 0n);
  const loserRP = loserClan.researchResearchPoints || 0;

  const metalSpoils = Math.floor(loserMetal * (WAR_CONSTANTS.WAR_SPOILS_METAL_PERCENT / 100));
  const energySpoils = Math.floor(loserEnergy * (WAR_CONSTANTS.WAR_SPOILS_ENERGY_PERCENT / 100));
  const rpSpoils = Math.floor(loserRP * (WAR_CONSTANTS.WAR_SPOILS_RP_PERCENT / 100));

  return {
    metal: metalSpoils,
    energy: energySpoils,
    rp: rpSpoils,
  };
}

export function checkWarObjectives(war: ClanWar): {
  metalBonus: number;
  energyBonus: number;
  rpBonus: number;
  xpBonus: number;
  objectivesAchieved: string[];
} {
  const bonuses = {
    metalBonus: 0,
    energyBonus: 0,
    rpBonus: 0,
    xpBonus: 0,
    objectivesAchieved: [] as string[],
  };

  const territoriesCaptured = war.stats.attackerTerritoryGained || 0;
  if (territoriesCaptured >= 20) {
    bonuses.objectivesAchieved.push('CONQUEST_VICTORY');
  }

  const warDuration = (war.endedAt?.getTime() || Date.now()) - war.declaredAt.getTime();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  if (warDuration < threeDaysMs) {
    bonuses.objectivesAchieved.push('BLITZKRIEG');
    bonuses.rpBonus += 10000;
  }

  const defenderTerritoryGained = war.stats.defenderTerritoryGained || 0;
  if (defenderTerritoryGained === 0 && territoriesCaptured > 0) {
    bonuses.objectivesAchieved.push('DECISIVE_VICTORY');
    bonuses.xpBonus += 25000;
  }

  if (territoriesCaptured >= 10) {
    bonuses.objectivesAchieved.push('STRATEGIC_DOMINATION');
  }

  return bonuses;
}

export async function distributeWarSpoils(
  war: ClanWar,
  winnerId: string,
  loserId: string
): Promise<{
  success: boolean;
  spoils: { metal: number; energy: number; rp: number };
  bonuses: { metal: number; energy: number; rp: number; xp: number };
  objectivesAchieved: string[];
  message: string;
}> {
  try {
    const baseSpoils = await calculateWarSpoils(winnerId, loserId);
    const objectiveResults = checkWarObjectives(war);

    let finalMetal = baseSpoils.metal;
    let finalEnergy = baseSpoils.energy;
    let finalRP = baseSpoils.rp;

    if (objectiveResults.objectivesAchieved.includes('CONQUEST_VICTORY')) {
      finalMetal = Math.floor(finalMetal * 1.25);
      finalEnergy = Math.floor(finalEnergy * 1.25);
    }

    finalRP += objectiveResults.rpBonus;

    const winnerResult = await db.select().from(clans).where(eq(clans.id, winnerId)).limit(1);
    const winnerClan = winnerResult[0];
    const loserResult = await db.select().from(clans).where(eq(clans.id, loserId)).limit(1);
    const loserClan = loserResult[0];

    if (winnerClan && loserClan) {
      await db.update(clans)
        .set({
          bankTreasuryMetal: Number(BigInt(Number(loserClan.bankTreasuryMetal || 0n) - finalMetal)),
          bankTreasuryEnergy: Number(BigInt(Number(loserClan.bankTreasuryEnergy || 0n) - finalEnergy)),
          researchResearchPoints: Math.max(0, (loserClan.researchResearchPoints || 0) - finalRP),
        })
        .where(eq(clans.id, loserId));

      await db.update(clans)
        .set({
          bankTreasuryMetal: Number(BigInt(Number(winnerClan.bankTreasuryMetal || 0n) + finalMetal)),
          bankTreasuryEnergy: Number(BigInt(Number(winnerClan.bankTreasuryEnergy || 0n) + finalEnergy)),
          researchResearchPoints: (winnerClan.researchResearchPoints || 0) + finalRP,
        })
        .where(eq(clans.id, winnerId));
    }

    return {
      success: true,
      spoils: { metal: finalMetal, energy: finalEnergy, rp: finalRP },
      bonuses: {
        metal: finalMetal - baseSpoils.metal,
        energy: finalEnergy - baseSpoils.energy,
        rp: objectiveResults.rpBonus,
        xp: WAR_CONSTANTS.WAR_VICTORY_XP_BONUS + objectiveResults.xpBonus,
      },
      objectivesAchieved: objectiveResults.objectivesAchieved,
      message: `War spoils collected: ${finalMetal} M, ${finalEnergy} E, ${finalRP} RP`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      spoils: { metal: 0, energy: 0, rp: 0 },
      bonuses: { metal: 0, energy: 0, rp: 0, xp: 0 },
      objectivesAchieved: [],
      message: `Failed to distribute spoils: ${message}`,
    };
  }
}

function calculateDefenseBonus(
  territories: Array<{ tileX: number; tileY: number }>,
  tileX: number,
  tileY: number
): number {
  let adjacentCount = 0;

  const directions = [
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
  ];

  for (const dir of directions) {
    const adjX = tileX + dir.dx;
    const adjY = tileY + dir.dy;

    if (territories.some((t) => t.tileX === adjX && t.tileY === adjY)) {
      adjacentCount++;
    }
  }

  return Math.min(adjacentCount * 10, 50);
}

export async function declareJointWar(
  clanId: string,
  allyClanId: string,
  targetClanId: string,
  targetAllyClanId: string | null,
  _playerId: string
): Promise<ClanWar> {
  const { areAllies, getAllianceBetweenClans } = await import('@/lib/clanAllianceService');

  const attackerAlliance = await getAllianceBetweenClans(clanId, allyClanId);
  if (!attackerAlliance || attackerAlliance.type === 'NAP' || attackerAlliance.type === 'TRADE') {
    throw new Error('Joint warfare requires Military Alliance or Federation');
  }

  const hasWarContract = attackerAlliance.contracts.some(
    (c) => c.type === 'DEFENSE_PACT' || c.type === 'WAR_SUPPORT'
  );

  if (!hasWarContract) {
    throw new Error('Joint warfare requires Defense Pact or War Support contract');
  }

  if (targetAllyClanId) {
    const isTargetAllied = await areAllies(targetClanId, targetAllyClanId);
    if (!isTargetAllied) {
      throw new Error('Target clans must be allies for 2v2 warfare');
    }
  }

  const allClanIds = [clanId, allyClanId, targetClanId];
  if (targetAllyClanId) allClanIds.push(targetAllyClanId);

  const clanResults = await db.select().from(clans).where(inArray(clans.id, allClanIds));
  if (clanResults.length < (targetAllyClanId ? 4 : 3)) {
    throw new Error('One or more clans not found');
  }

  const totalCost = {
    metal: WAR_CONSTANTS.BASE_WAR_COST_METAL,
    energy: WAR_CONSTANTS.BASE_WAR_COST_ENERGY,
  };

  const costPerClan = {
    metal: Math.floor(totalCost.metal / 2),
    energy: Math.floor(totalCost.energy / 2),
  };

  for (const attackerClanId of [clanId, allyClanId]) {
    const attackerClan = clanResults.find((c) => c.id === attackerClanId);
    const treasury = {
      metal: Number(attackerClan?.bankTreasuryMetal || 0n),
      energy: Number(attackerClan?.bankTreasuryEnergy || 0n),
    };

    if (treasury.metal < costPerClan.metal || treasury.energy < costPerClan.energy) {
      throw new Error(`${attackerClan?.name} has insufficient funds for joint war`);
    }

    await db.update(clans)
      .set({
        bankTreasuryMetal: Number(BigInt(treasury.metal - costPerClan.metal)),
        bankTreasuryEnergy: Number(BigInt(treasury.energy - costPerClan.energy)),
      })
      .where(eq(clans.id, attackerClanId));
  }

  const warId = `${clanId}-${allyClanId}-${targetClanId}-${Date.now()}`;
  const war: ClanWar = {
    warId,
    attackerClanId: clanId,
    defenderClanId: targetClanId,
    status: ClanWarStatus.ACTIVE,
    declaredAt: new Date(),
    declarationCost: totalCost,
    stats: {
      attackerTerritoryGained: 0,
      defenderTerritoryGained: 0,
      attackerBattlesWon: 0,
      defenderBattlesWon: 0,
    },
  } as ClanWar;

  return war;
}

export async function getWarParticipants(_warId: string): Promise<{
  attackers: string[];
  defenders: string[];
}> {
  return { attackers: [], defenders: [] };
}

export async function canParticipateInWar(warId: string, clanId: string): Promise<boolean> {
  const participants = await getWarParticipants(warId);
  return participants.attackers.includes(clanId) || participants.defenders.includes(clanId);
}
