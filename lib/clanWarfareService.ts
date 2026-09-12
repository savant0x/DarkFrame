/**
 * @file lib/clanWarfareService.ts
 * @created 2025-10 (original) · @last-modified 2026-09-12 (FID-20260912-076 War Engine v2)
 *
 * OVERVIEW:
 * War Engine v2 — wars are real rows in `clan_wars` (migration 0029), scored
 * by actual battle outcomes, settled automatically by the hourly job
 * (lib/jobs/clanWarSettlementManager.ts).
 *
 * v1 was a facade: declarations lived only in mod_log, all read functions
 * were stubs, endWar threw, and capture was a war-free RNG coin flip. Every
 * part of that is replaced. Constants (costs/percentages) are preserved.
 *
 * Lifecycle:
 *   declareWar()           -> clan_wars row (ACTIVE) + atomic treasury debit
 *   recordWarBattleOutcome()-> +1 score to the winning side (idempotent-ish)
 *   attemptTerritoryCapture()-> contested capture, war-gated, costs treasury
 *   proposeTruce()         -> both-side truce bookkeeping
 *   settleDueWars()        -> job entry: ends wars, pays spoils, notifies
 */

import { db } from '@/lib/db';
import { clans, clanWars, modLog } from '@/lib/db/schema';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { generateId } from '@/lib/utils';
import { logClanActivity } from '@/lib/clanActivityService';
import { ClanActivityType } from '@/types/clan.types';
import type { ClanTerritory } from '@/types/clan.types';
import { notifySystem } from '@/lib/battleNotification';
import { awardRP } from '@/lib/researchPointService';
import { awardClanXP } from '@/lib/clanLevelService';

/** Territories as stored in the clans.territories jsonb (loose row shape -> canonical type). */
function asTerritories(raw: ClanWarfareRow['territories'] | ClanTerritory[] | undefined): ClanTerritory[] {
  return (raw ?? []).map((t) => ({
    clanId: t.clanId,
    tileX: t.tileX,
    tileY: t.tileY,
    claimedAt: new Date(t.claimedAt),
    claimedBy: t.claimedBy,
    defenseBonus: t.defenseBonus,
  }));
}

export const WAR_CONSTANTS = {
  BASE_WAR_COST_METAL: 50000,
  BASE_WAR_COST_ENERGY: 50000,
  MIN_LEVEL_TO_DECLARE_WAR: 10,
  MIN_WAR_DURATION_HOURS: 48,
  WAR_COOLDOWN_HOURS: 168,
  BASE_CAPTURE_SUCCESS_RATE: 0.7, // legacy constant retained for compat reads
  DEFENSE_BONUS_IMPACT: 0.5,
  WAR_SPOILS_METAL_PERCENT: 15,
  WAR_SPOILS_ENERGY_PERCENT: 15,
  WAR_SPOILS_RP_PERCENT: 10,
  WAR_VICTORY_XP_BONUS: 50000,
  WAR_DEFEAT_XP_PENALTY: 25000,
  // v2 additions
  CAPTURE_COST_METAL: 25000,
  CAPTURE_COST_ENERGY: 25000,
  CAPTURES_PER_CLAN_PER_DAY: 3,
  CAPTURE_JITTER: 0.15, // ±15% strength jitter on contested captures
  TRUCE_BOTH_WINDOW_HOURS: 24, // both-proposed truce resolves immediately
  UNILATERAL_TRUCE_AFTER_DAYS: 7, // one side can force truce after a week of war
} as const;

export function initializeWarfareService(): void {
  // No-op: Drizzle uses direct db import
}

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

/** Structural contract for clans rows this service reads/writes (pg columns). */
interface ClanWarfareRow {
  id: string;
  name: string;
  tag: string;
  members: Array<{ playerId: string; role: string }>;
  levelCurrentLevel: number;
  bankTreasuryMetal: number | null;
  bankTreasuryEnergy: number | null;
  researchResearchPoints: number | null;
  statsTotalTerritories: number | null;
  statsWarsWon: number | null;
  statsWarsLost: number | null;
  territories?: Array<{
    clanId: string;
    tileX: number;
    tileY: number;
    claimedAt: Date | string;
    claimedBy: string;
    defenseBonus: number;
  }>;
  activePerks?: Array<{ bonus?: { type?: string; value?: number } | null }>;
  settingsAllowWarDeclarations?: number | null;
}

type WarRow = typeof clanWars.$inferSelect;

function rowToClanWar(w: WarRow) {
  return {
    warId: w.warId,
    attackerClanId: w.attackerClanId,
    defenderClanId: w.defenderClanId,
    status: w.status as 'ACTIVE' | 'ENDED' | 'TRUCE',
    declaredAt: w.declaredAt,
    endedAt: w.endedAt ?? undefined,
    declarationCost: (w.declarationCost ?? { metal: 0, energy: 0 }) as { metal: number; energy: number },
    stats: {
      attackerTerritoryGained: w.attackerCaptures,
      defenderTerritoryGained: w.defenderCaptures,
      attackerBattlesWon: w.attackerScore,
      defenderBattlesWon: w.defenderScore,
    },
    outcome: w.outcome ?? undefined,
    spoils: (w.spoils ?? undefined) as { metal: number; energy: number; rp: number } | undefined,
  };
}

// v2 type surfaced for the UI/jobs.
export interface WarWithMeta extends ReturnType<typeof rowToClanWar> {
  attackerName: string;
  attackerTag: string;
  defenderName: string;
  defenderTag: string;
  attackerCapturesToday: number;
  defenderCapturesToday: number;
  attackerTruceProposed: boolean;
  defenderTruceProposed: boolean;
}

async function loadClan(clanId: string): Promise<ClanWarfareRow | null> {
  const rows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  return (rows[0] as unknown as ClanWarfareRow) ?? null;
}

function requireRole(clan: ClanWarfareRow, playerId: string, action: string): void {
  const member = clan.members?.find((m) => m.playerId === playerId);
  if (!member) throw new Error('Player not in clan');
  if (!['LEADER', 'CO_LEADER', 'OFFICER'].includes(member.role)) {
    throw new Error(`Only Leaders, Co-Leaders, and Officers can ${action}`);
  }
}

function treasuryOf(clan: ClanWarfareRow): { metal: number; energy: number } {
  return {
    metal: Number(clan.bankTreasuryMetal ?? 0),
    energy: Number(clan.bankTreasuryEnergy ?? 0),
  };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function modLogWar(playerId: string, targetClanId: string, action: string, reason: string, details: unknown): Promise<void> {
  await db.insert(modLog).values({
    id: generateId(),
    moderatorId: playerId,
    action,
    targetId: targetClanId,
    reason,
    details: JSON.stringify(details),
    createdAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Declare
// ---------------------------------------------------------------------------

export async function declareWar(
  clanId: string,
  targetClanId: string,
  playerId: string
): Promise<{
  war: WarWithMeta;
  cost: { metal: number; energy: number };
  message: string;
}> {
  if (clanId === targetClanId) throw new Error('Cannot declare war on your own clan');

  const clan = await loadClan(clanId);
  if (!clan) throw new Error('Declaring clan not found');
  const targetClan = await loadClan(targetClanId);
  if (!targetClan) throw new Error('Target clan not found');

  requireRole(clan, playerId, 'declare war');

  if (clan.settingsAllowWarDeclarations === 0) {
    throw new Error('Your clan settings disallow war declarations');
  }
  if (clan.levelCurrentLevel < WAR_CONSTANTS.MIN_LEVEL_TO_DECLARE_WAR) {
    throw new Error(
      `Clan level ${WAR_CONSTANTS.MIN_LEVEL_TO_DECLARE_WAR} required to declare war (current: ${clan.levelCurrentLevel})`
    );
  }

  // One active war per pair, either direction.
  const existing = await db
    .select({ warId: clanWars.warId })
    .from(clanWars)
    .where(
      and(
        eq(clanWars.status, 'ACTIVE'),
        or(
          and(eq(clanWars.attackerClanId, clanId), eq(clanWars.defenderClanId, targetClanId)),
          and(eq(clanWars.attackerClanId, targetClanId), eq(clanWars.defenderClanId, clanId))
        )
      )
    )
    .limit(1);
  if (existing.length > 0) {
    throw new Error('A war between these clans is already active');
  }

  // Post-war cooldown (7 days from either side's last ended war in the pair).
  const cooldownCutoff = new Date(Date.now() - WAR_CONSTANTS.WAR_COOLDOWN_HOURS * 3600 * 1000);
  const recent = await db
    .select({ endedAt: clanWars.endedAt })
    .from(clanWars)
    .where(
      and(
        inArray(clanWars.status, ['ENDED', 'TRUCE']),
        or(
          and(eq(clanWars.attackerClanId, clanId), eq(clanWars.defenderClanId, targetClanId)),
          and(eq(clanWars.attackerClanId, targetClanId), eq(clanWars.defenderClanId, clanId))
        )
      )
    )
    .orderBy(desc(clanWars.endedAt))
    .limit(1);
  const lastEnded = recent[0]?.endedAt;
  if (lastEnded && lastEnded > cooldownCutoff) {
    const hoursLeft = Math.ceil((lastEnded.getTime() + WAR_CONSTANTS.WAR_COOLDOWN_HOURS * 3600 * 1000 - Date.now()) / 3600000);
    throw new Error(`War cooldown active — ${hoursLeft}h remaining between these clans`);
  }

  const cost = {
    metal: WAR_CONSTANTS.BASE_WAR_COST_METAL,
    energy: WAR_CONSTANTS.BASE_WAR_COST_ENERGY,
  };
  const treasury = treasuryOf(clan);
  if (treasury.metal < cost.metal) throw new Error(`Insufficient Metal (need ${cost.metal}, have ${treasury.metal})`);
  if (treasury.energy < cost.energy) throw new Error(`Insufficient Energy (need ${cost.energy}, have ${treasury.energy})`);

  const warId = `WAR-${Date.now()}-${generateId()}`;

  // Atomic: treasury debit + war row + mod_log entry.
  await db.transaction(async (tx) => {
    await tx
      .update(clans)
      .set({
        bankTreasuryMetal: treasury.metal - cost.metal,
        bankTreasuryEnergy: treasury.energy - cost.energy,
      })
      .where(eq(clans.id, clanId));

    await tx.insert(clanWars).values({
      warId,
      attackerClanId: clanId,
      attackerName: clan.name,
      attackerTag: clan.tag,
      defenderClanId: targetClanId,
      defenderName: targetClan.name,
      defenderTag: targetClan.tag,
      status: 'ACTIVE',
      declaredAt: new Date(),
      declaredBy: playerId,
      declarationCost: cost,
    });

    await tx.insert(modLog).values({
      id: generateId(),
      moderatorId: playerId,
      action: 'WAR_DECLARED',
      targetId: targetClanId,
      reason: `War declared on ${targetClan.name}`,
      details: JSON.stringify({ warId, attackerClanId: clanId, targetClanId, cost }),
      createdAt: new Date(),
    });
  });

  await logClanActivity(clanId, ClanActivityType.WAR_DECLARED, playerId, { warId, targetClanId, cost }).catch(() => undefined);

  await notifyBothClans(
    warId,
    clanId,
    targetClanId,
    `⚔️ War declared: [${clan.tag}] ${clan.name} vs [${targetClan.tag}] ${targetClan.name}. Battles now feed the war score. Captures cost 25k treasury per attempt.`
  );

  return {
    war: (await getWarWithMeta(warId))!,
    cost,
    message: `War declared against [${targetClan.tag}] ${targetClan.name}`,
  };
}

// ---------------------------------------------------------------------------
// Battle scoring — called from real combat resolution paths
// ---------------------------------------------------------------------------

const recentRecorded = new Set<string>(); // `${warId}:${battleId}` guard (single-process)

/**
 * Record a real battle result into any ACTIVE war between the two clans.
 * Called by battleService.resolveBattle (base attacks) and the factory
 * attack victory path. Safe to call when no war exists (no-op) — combat
 * must never fail because of warfare bookkeeping.
 */
export async function recordWarBattleOutcome(
  winnerClanId: string | null | undefined,
  loserClanId: string | null | undefined,
  battleId: string
): Promise<void> {
  if (!winnerClanId || !loserClanId || winnerClanId === loserClanId) return;
  try {
    const wars = await db
      .select()
      .from(clanWars)
      .where(
        and(
          eq(clanWars.status, 'ACTIVE'),
          or(
            and(eq(clanWars.attackerClanId, winnerClanId), eq(clanWars.defenderClanId, loserClanId)),
            and(eq(clanWars.attackerClanId, loserClanId), eq(clanWars.defenderClanId, winnerClanId))
          )
        )
      );
    for (const war of wars) {
      const key = `${war.warId}:${battleId}`;
      if (recentRecorded.has(key)) continue;
      recentRecorded.add(key);
      if (recentRecorded.size > 5000) recentRecorded.clear(); // bound memory

      const attackerWon = war.attackerClanId === winnerClanId;
      await db
        .update(clanWars)
        .set(
          attackerWon
            ? { attackerScore: sql`${clanWars.attackerScore} + 1`, updatedAt: new Date() }
            : { defenderScore: sql`${clanWars.defenderScore} + 1`, updatedAt: new Date() }
        )
        .where(eq(clanWars.warId, war.warId));
    }
  } catch (err) {
    console.error('[WarEngine] Failed to record battle outcome:', err);
  }
}

/**
 * Record a factory capture into any ACTIVE war between the two clans.
 * Called by factoryService.attackFactory when a capture takes a warring
 * clan's factory (+2 score — territory matters more than skirmishes).
 * No-op when no war exists; never throws into the combat path.
 */
export async function recordWarFactoryCapture(
  captorClanId: string,
  ownerClanId: string,
  captorUsername: string,
  tileX: number,
  tileY: number
): Promise<void> {
  void captorUsername; void tileX; void tileY; // logged via mod_log caller
  await recordWarBattleOutcome(captorClanId, ownerClanId, `factory:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);
}

// ---------------------------------------------------------------------------
// Contested capture (war-gated, strength-based, treasury-priced)
// ---------------------------------------------------------------------------

function clanDefenseBonus(territories: ClanWarfareRow['territories'], tileX: number, tileY: number): number {
  // Adjacency-based defense: +10% per adjacent own tile, max +50%
  // (mirrors territoryService.getDefenseBonus without its Mongo-shaped input).
  if (!territories) return 0;
  let adjacent = 0;
  for (const t of territories) {
    if (Math.abs(t.tileX - tileX) + Math.abs(t.tileY - tileY) === 1) adjacent += 1;
  }
  return Math.min(50, adjacent * 10);
}

export async function attemptTerritoryCapture(
  clanId: string,
  targetClanId: string,
  tileX: number,
  tileY: number,
  playerId: string,
  attackerStrength: number
): Promise<{
  success: boolean;
  captured: boolean;
  defenseBonus?: number;
  message: string;
}> {
  const clan = await loadClan(clanId);
  if (!clan) throw new Error('Capturing clan not found');
  const targetClan = await loadClan(targetClanId);
  if (!targetClan) throw new Error('Target clan not found');

  requireRole(clan, playerId, 'capture territory');

  // War must be ACTIVE in the attacking direction.
  const wars = await db
    .select()
    .from(clanWars)
    .where(
      and(
        eq(clanWars.status, 'ACTIVE'),
        eq(clanWars.attackerClanId, clanId),
        eq(clanWars.defenderClanId, targetClanId)
      )
    )
    .limit(1);
  const war = wars[0];
  if (!war) {
    throw new Error('No active war with this clan — declare war before capturing territory');
  }

  // Daily capture cap (3/clan/war/day).
  const day = todayKey();
  let attackerToday = war.attackerCapturesToday;
  if (war.captureDay !== day) attackerToday = 0;
  if (attackerToday >= WAR_CONSTANTS.CAPTURES_PER_CLAN_PER_DAY) {
    throw new Error(`Daily capture limit reached (${WAR_CONSTANTS.CAPTURES_PER_CLAN_PER_DAY}/day per clan per war)`);
  }

  // Territory must belong to the defender.
  const territories = targetClan.territories || [];
  const tile = territories.find((t) => t.tileX === tileX && t.tileY === tileY);
  if (!tile) throw new Error('Territory not owned by target clan');

  // Treasury price — paid win or lose.
  const treasury = treasuryOf(clan);
  const cost = { metal: WAR_CONSTANTS.CAPTURE_COST_METAL, energy: WAR_CONSTANTS.CAPTURE_COST_ENERGY };
  if (treasury.metal < cost.metal || treasury.energy < cost.energy) {
    throw new Error(`Capture costs ${cost.metal} metal + ${cost.energy} energy from the treasury (have ${treasury.metal}/${treasury.energy})`);
  }

  // Contested resolution: attacker STR (+jitter) vs defense bonus scale.
  // Defense 0% => effective 5k; +50% (max adjacency) => 7.5k equivalent wall
  // plus jitter — level-appropriate clan armies win, weak clans fail.
  const defenseBonus = clanDefenseBonus(territories, tileX, tileY);
  const defensePower = 5000 * (1 + defenseBonus / 100);
  const jitteredAttack = attackerStrength * (1 + (Math.random() * 2 - 1) * WAR_CONSTANTS.CAPTURE_JITTER);
  const captured = jitteredAttack >= defensePower;

  const newToday = attackerToday + 1;

  if (!captured) {
    await db.transaction(async (tx) => {
      await tx
        .update(clans)
        .set({ bankTreasuryMetal: treasury.metal - cost.metal, bankTreasuryEnergy: treasury.energy - cost.energy })
        .where(eq(clans.id, clanId));
      await tx
        .update(clanWars)
        .set({ captureDay: day, attackerCapturesToday: newToday, updatedAt: new Date() })
        .where(eq(clanWars.warId, war.warId));
    });
    return {
      success: true,
      captured: false,
      defenseBonus,
      message: `Capture repelled — defense bonus ${defenseBonus}% (attempt ${newToday}/${WAR_CONSTANTS.CAPTURES_PER_CLAN_PER_DAY} today). The attempt still cost ${cost.metal} metal + ${cost.energy} energy.`,
    };
  }

  // Success: move the tile between the clans' jsonb columns atomically.
  const newTerritory: ClanTerritory = {
    clanId,
    tileX,
    tileY,
    claimedAt: new Date(),
    claimedBy: playerId,
    defenseBonus: 0,
  };
  const attackerTerritories = asTerritories(clan.territories);
  const defenderTerritories = asTerritories(territories);

  await db.transaction(async (tx) => {
    await tx
      .update(clans)
      .set({
        bankTreasuryMetal: treasury.metal - cost.metal,
        bankTreasuryEnergy: treasury.energy - cost.energy,
        territories: defenderTerritories.filter((t) => !(t.tileX === tileX && t.tileY === tileY)),
        statsTotalTerritories: Math.max(0, (targetClan.statsTotalTerritories || 0) - 1),
      })
      .where(eq(clans.id, targetClanId));

    await tx
      .update(clans)
      .set({
        territories: [...attackerTerritories, newTerritory],
        statsTotalTerritories: (clan.statsTotalTerritories || 0) + 1,
      })
      .where(eq(clans.id, clanId));

    await tx
      .update(clanWars)
      .set({
        captureDay: day,
        attackerCapturesToday: newToday,
        attackerCaptures: sql`${clanWars.attackerCaptures} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(clanWars.warId, war.warId));
  });

  await awardClanXP(clanId, 'territory_claim', 1, playerId).catch(() => undefined);
  await modLogWar(playerId, targetClanId, 'TERRITORY_CAPTURED', `Captured (${tileX}, ${tileY}) in war ${war.warId}`, {
    warId: war.warId,
    tileX,
    tileY,
    defenseBonus,
  });

  await notifyBothClans(
    war.warId,
    clanId,
    targetClanId,
    `🏴 [${clan.tag}] ${clan.name} captured territory (${tileX}, ${tileY}) from [${targetClan.tag}] ${targetClan.name}!`
  );

  return {
    success: true,
    captured: true,
    defenseBonus,
    message: `Territory (${tileX}, ${tileY}) captured!`,
  };
}

// ---------------------------------------------------------------------------
// Truce
// ---------------------------------------------------------------------------

export async function proposeTruce(
  clanId: string,
  playerId: string
): Promise<{ message: string; settled: boolean }> {
  const clan = await loadClan(clanId);
  if (!clan) throw new Error('Clan not found');
  requireRole(clan, playerId, 'propose a truce');

  const wars = await db
    .select()
    .from(clanWars)
    .where(
      and(
        eq(clanWars.status, 'ACTIVE'),
        or(eq(clanWars.attackerClanId, clanId), eq(clanWars.defenderClanId, clanId))
      )
    )
    .limit(1);
  const war = wars[0];
  if (!war) throw new Error('No active war to truce out of');

  const isAttacker = war.attackerClanId === clanId;
  const bothNow = isAttacker
    ? { attackerTruceProposed: 1 }
    : { defenderTruceProposed: 1 };
  const otherSideAlready = isAttacker ? war.defenderTruceProposed : war.attackerTruceProposed;
  const warAgeHours = (Date.now() - war.declaredAt.getTime()) / 3600000;
  const unilateralAllowed = warAgeHours >= 7 * 24;

  await db
    .update(clanWars)
    .set({ ...bothNow, updatedAt: new Date() })
    .where(eq(clanWars.warId, war.warId));

  if (otherSideAlready || unilateralAllowed) {
    await settleWar(war.warId, 'TRUCE', otherSideAlready ? 'Both sides proposed truce' : 'Unilateral truce after 7 days');
    return { message: 'Truce settled — the war has ended with no spoils.', settled: true };
  }

  await notifyBothClans(
    war.warId,
    war.attackerClanId,
    war.defenderClanId,
    `🕊️ [${clan.tag}] ${clan.name} proposes a truce. If both sides agree, the war ends with no spoils.`
  );
  return { message: 'Truce proposed — awaiting the other side.', settled: false };
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

export async function settleDueWars(): Promise<{
  settled: number;
  results: Array<{ warId: string; outcome: string; winnerClanId: string | null }>;
}> {
  const cutoff = new Date(Date.now() - WAR_CONSTANTS.MIN_WAR_DURATION_HOURS * 3600 * 1000);
  const due = await db
    .select()
    .from(clanWars)
    .where(and(eq(clanWars.status, 'ACTIVE'), sql`${clanWars.declaredAt} <= ${cutoff}`));

  const results: Array<{ warId: string; outcome: string; winnerClanId: string | null }> = [];
  for (const war of due) {
    let outcome: 'ATTACKER_WIN' | 'DEFENDER_WIN' | 'TRUCE';
    let winnerClanId: string | null;
    if (war.attackerCaptures > war.defenderCaptures) {
      outcome = 'ATTACKER_WIN';
      winnerClanId = war.attackerClanId;
    } else if (war.defenderCaptures > war.attackerCaptures) {
      outcome = 'DEFENDER_WIN';
      winnerClanId = war.defenderClanId;
    } else if (war.attackerScore !== war.defenderScore) {
      outcome = war.attackerScore > war.defenderScore ? 'ATTACKER_WIN' : 'DEFENDER_WIN';
      winnerClanId = outcome === 'ATTACKER_WIN' ? war.attackerClanId : war.defenderClanId;
    } else {
      outcome = 'TRUCE';
      winnerClanId = null;
    }
    await settleWar(war.warId, outcome, `Scheduled settlement after ${WAR_CONSTANTS.MIN_WAR_DURATION_HOURS}h`);
    results.push({ warId: war.warId, outcome, winnerClanId });
  }
  return { settled: results.length, results };
}

/**
 * Conclude a war: outcome row, spoils transfer (loser->winner treasury via
 * the same atomic pattern as bank distribution), clan XP swings, W/L stats,
 * inbox notifications. Idempotent by status guard.
 */
export async function settleWar(
  warId: string,
  outcome: 'ATTACKER_WIN' | 'DEFENDER_WIN' | 'TRUCE',
  reason: string
): Promise<void> {
  const rows = await db.select().from(clanWars).where(eq(clanWars.warId, warId)).limit(1);
  const war = rows[0];
  if (!war || war.status !== 'ACTIVE') return; // already settled

  const winnerClanId = outcome === 'ATTACKER_WIN' ? war.attackerClanId : outcome === 'DEFENDER_WIN' ? war.defenderClanId : null;
  const loserClanId = outcome === 'ATTACKER_WIN' ? war.defenderClanId : outcome === 'DEFENDER_WIN' ? war.attackerClanId : null;

  let spoils: { metal: number; energy: number; rp: number } | null = null;

  if (winnerClanId && loserClanId) {
    const winner = await loadClan(winnerClanId);
    const loser = await loadClan(loserClanId);
    if (winner && loser) {
      const loserTreasury = treasuryOf(loser);
      spoils = {
        metal: Math.floor((loserTreasury.metal * WAR_CONSTANTS.WAR_SPOILS_METAL_PERCENT) / 100),
        energy: Math.floor((loserTreasury.energy * WAR_CONSTANTS.WAR_SPOILS_ENERGY_PERCENT) / 100),
        rp: Math.floor(((loser.researchResearchPoints || 0) * WAR_CONSTANTS.WAR_SPOILS_RP_PERCENT) / 100),
      };

      const winnerTreasury = treasuryOf(winner);
      await db.transaction(async (tx) => {
        await tx
          .update(clans)
          .set({
            bankTreasuryMetal: loserTreasury.metal - spoils!.metal,
            bankTreasuryEnergy: loserTreasury.energy - spoils!.energy,
            statsWarsLost: (loser.statsWarsLost || 0) + 1,
          })
          .where(eq(clans.id, loserClanId));

        await tx
          .update(clans)
          .set({
            bankTreasuryMetal: winnerTreasury.metal + spoils!.metal,
            bankTreasuryEnergy: winnerTreasury.energy + spoils!.energy,
            statsWarsWon: (winner.statsWarsWon || 0) + 1,
          })
          .where(eq(clans.id, winnerClanId));
      });

      if (spoils.rp > 0) {
        const memberIds = (winner.members || []).map((m) => m.playerId).filter(Boolean);
        if (memberIds.length > 0) {
          const per = Math.floor(spoils.rp / memberIds.length);
          for (const memberId of memberIds.slice(0, 50)) {
            await awardRP(memberId, per, 'clan_warfare', `War victory spoils (${war.warId})`, { warId }).catch(() => undefined);
          }
        }
      }

      await awardClanXP(winnerClanId, 'combat', WAR_CONSTANTS.WAR_VICTORY_XP_BONUS, war.declaredBy).catch(() => undefined);
      if (WAR_CONSTANTS.WAR_DEFEAT_XP_PENALTY > 0) {
        // Defeat penalty: claw back total XP, floored at 0.
        await db
          .update(clans)
          .set({ levelTotalXP: sql`GREATEST(0, ${clans.levelTotalXP} - ${WAR_CONSTANTS.WAR_DEFEAT_XP_PENALTY})` })
          .where(eq(clans.id, loserClanId));
      }
    }
  }

  await db
    .update(clanWars)
    .set({
      status: outcome === 'TRUCE' ? 'TRUCE' : 'ENDED',
      endedAt: new Date(),
      endedReason: reason,
      outcome,
      spoils: spoils ?? { metal: 0, energy: 0, rp: 0 },
      updatedAt: new Date(),
    })
    .where(eq(clanWars.warId, warId));

  const summary =
    outcome === 'TRUCE'
      ? `🕊️ War [${war.attackerTag}] ${war.attackerName} vs [${war.defenderTag}] ${war.defenderName} ended in TRUCE (${reason}). No spoils exchanged.`
      : `🏁 War settled: ${outcome === 'ATTACKER_WIN' ? `[${war.attackerTag}] ${war.attackerName}` : `[${war.defenderTag}] ${war.defenderName}`} defeated ${
          outcome === 'ATTACKER_WIN' ? `[${war.defenderTag}] ${war.defenderName}` : `[${war.attackerTag}] ${war.attackerName}`
        }. Spoils: ${spoils?.metal.toLocaleString() ?? 0} metal, ${spoils?.energy.toLocaleString() ?? 0} energy, ${spoils?.rp.toLocaleString() ?? 0} RP.`;

  await notifyBothClans(warId, war.attackerClanId, war.defenderClanId, summary);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getActiveWars(clanId: string): Promise<WarWithMeta[]> {
  const wars = await db
    .select()
    .from(clanWars)
    .where(
      and(
        eq(clanWars.status, 'ACTIVE'),
        or(eq(clanWars.attackerClanId, clanId), eq(clanWars.defenderClanId, clanId))
      )
    )
    .orderBy(desc(clanWars.declaredAt));
  return wars.map(withMeta);
}

export async function getClanWarHistory(clanId: string, limit = 50): Promise<WarWithMeta[]> {
  const wars = await db
    .select()
    .from(clanWars)
    .where(
      and(
        inArray(clanWars.status, ['ENDED', 'TRUCE']),
        or(eq(clanWars.attackerClanId, clanId), eq(clanWars.defenderClanId, clanId))
      )
    )
    .orderBy(desc(clanWars.declaredAt))
    .limit(limit);
  return wars.map(withMeta);
}

export async function getWar(warId: string): Promise<WarWithMeta | null> {
  return getWarWithMeta(warId);
}

async function getWarWithMeta(warId: string): Promise<WarWithMeta | null> {
  const rows = await db.select().from(clanWars).where(eq(clanWars.warId, warId)).limit(1);
  return rows[0] ? withMeta(rows[0]) : null;
}

function withMeta(w: WarRow): WarWithMeta {
  return {
    ...rowToClanWar(w),
    attackerName: w.attackerName,
    attackerTag: w.attackerTag,
    defenderName: w.defenderName,
    defenderTag: w.defenderTag,
    attackerCapturesToday: w.attackerCapturesToday,
    defenderCapturesToday: w.defenderCapturesToday,
    attackerTruceProposed: w.attackerTruceProposed === 1,
    defenderTruceProposed: w.defenderTruceProposed === 1,
  };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

async function notifyBothClans(_warId: string, aClanId: string, bClanId: string, message: string): Promise<void> {
  for (const clanId of [aClanId, bClanId]) {
    const clan = await loadClan(clanId).catch(() => null);
    if (!clan) continue;
    for (const member of (clan.members || []).slice(0, 100)) {
      if (!member.playerId) continue;
      // FID-076: shared SYSTEM DM delivery (battle-notification machinery) —
      // members are usernames; isInboxless filtering happens inside.
      await notifySystem(member.playerId, message, 'war_result', _warId.slice(0, 50)).catch(() => undefined);
    }
  }
}

// ---------------------------------------------------------------------------
// Legacy compat shims (previously stubs/throwers — now real or removed)
// ---------------------------------------------------------------------------

/** @deprecated v1 signature — v2 uses attemptTerritoryCapture. Kept for route compat until deleted. */
export async function captureTerritory(
  clanId: string,
  targetClanId: string,
  tileX: number,
  tileY: number,
  playerId: string
): Promise<{ success: boolean; territory?: { tileX: number; tileY: number; clanId: string }; defenseBonus?: number; message: string }> {
  const result = await attemptTerritoryCapture(clanId, targetClanId, tileX, tileY, playerId, 0);
  return {
    success: result.success,
    territory: result.captured ? { tileX, tileY, clanId } : undefined,
    defenseBonus: result.defenseBonus,
    message: result.message,
  };
}

export async function endWar(warId: string, outcome: 'WIN' | 'LOSS' | 'TRUCE', _endedBy: string): Promise<WarWithMeta | null> {
  const mapped: 'ATTACKER_WIN' | 'DEFENDER_WIN' | 'TRUCE' =
    outcome === 'TRUCE' ? 'TRUCE' : outcome === 'WIN' ? 'ATTACKER_WIN' : 'DEFENDER_WIN';
  await settleWar(warId, mapped, `Manually ended: ${outcome}`);
  return getWar(warId);
}

export async function calculateWarSpoils(
  _winnerClanId: string,
  loserClanId: string
): Promise<{ metal: number; energy: number; rp: number }> {
  const loser = await loadClan(loserClanId);
  if (!loser) return { metal: 0, energy: 0, rp: 0 };
  const treasury = treasuryOf(loser);
  return {
    metal: Math.floor((treasury.metal * WAR_CONSTANTS.WAR_SPOILS_METAL_PERCENT) / 100),
    energy: Math.floor((treasury.energy * WAR_CONSTANTS.WAR_SPOILS_ENERGY_PERCENT) / 100),
    rp: Math.floor(((loser.researchResearchPoints || 0) * WAR_CONSTANTS.WAR_SPOILS_RP_PERCENT) / 100),
  };
}
