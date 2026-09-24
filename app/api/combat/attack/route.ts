/**
 * @file app/api/combat/attack/route.ts
 * @created 2026-09-04
 * @updated 2026-09-06 (FID-20260906-006a: real garrison, loot crediting, doc rewards)
 * @overview Player attack on a Beer Base — the endpoint components/BeerBasePanel
 * already calls (`/api/combat/attack`).
 *
 * FID-20260906-006a repairs the PvE loop for Beer Bases:
 *  - synthesized garrison from the base's totalDefense (bots spawn with units: [])
 *  - attacker actually CREDITED floor(baseResources × resourceMultiplier) on win
 *  - base row removed on defeat (drizzle, gated isBot+isSpecialBase)
 *  - win/loss XP = doc-faithful BASE_ATTACK_WIN/LOSS via awardXP
 *  - the 3× multiplier comes from the repaired drizzle getBeerBaseConfig()
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
// FID-20260923-002: the period guard lives in lib/raidPeriod.ts so the route and
// __tests__/lib/baseRaidFidelity.test.ts exercise ONE implementation (the test
// previously pinned a hand-copied duplicate that could never detect drift).
import { getRaidPeriodStart } from '@/lib/raidPeriod';
import { verifyPresence } from '@/lib/presenceCheck';
import { resolveBaseTilePosition } from '@/lib/baseTilePosition';
import { logAttack } from '@/lib/activityLogger';
import { resolveBattle, persistBattleLog, applyAttackerCasualties } from '@/lib/battleService';
import { recordDefeatEvent } from '@/lib/beerBaseAnalytics';
import { getBeerBaseConfig, removeBeerBase } from '@/lib/beerBaseService';
import { updateReputation } from '@/lib/botCombatService';
import { awardXP, XPAction } from '@/lib/xpService';
import { recordTutorialBeerBaseFound, recordTutorialBaseAttack } from '@/lib/tutorialService';
import { db } from '@/lib/db';
import { players, battleLogs } from '@/lib/db/schema';
import type { BotConfig } from '@/types/game.types';
import { eq, and, gte } from 'drizzle-orm';
import { BattleType, UnitType } from '@/types';
import type { Player, PlayerUnit, Unit } from '@/types/game.types';


const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.battle);

/**
 * PlayerUnits → battle-resolver Unit[] — same conversion the infantry service
 * uses (playerUnitToUnits): one Unit per copy, real per-unit STR/DEF values.
 */
function playerUnitToUnits(playerUnit: PlayerUnit, owner: string): Unit[] {
  const units: Unit[] = [];
  for (let i = 0; i < playerUnit.quantity; i++) {
    units.push({
      id: `${playerUnit.unitType}-${i}`,
      type: playerUnit.unitType as UnitType,
      strength: playerUnit.strength,
      defense: playerUnit.defense,
      producedAt: { x: 0, y: 0 },
      producedDate: playerUnit.createdAt,
      owner,
    });
  }
  return units;
}

/** Sum of unit quantities — kept for real-unit bases reporting their size. */
function _armySize(units: PlayerUnit[]): number {
  return units.reduce((sum, u) => sum + (u.quantity || 0), 0);
}

/**
 * FID-20260906-006a R2: bots spawn with `units: []` — a raw garrison read fights
 * with 0 HP. Synthesize a defense-only garrison proportional to the base's stored
 * scalar totalDefense: DEF 20/unit, HP 15/DEF-unit (battleService constants).
 * Difficulty therefore scales with whatever totalDefense the spawner wrote
 * (botService tiers T1→T7 write 15→2880 before spec multipliers — corrected
 * FID-20260915-006a; the old comment quoted pre-scale values). Capped so an
 * anomalous row can't spawn an unbounded army.
 * Takes the drizzle players row (loosely typed — the DB projection is the truth).
 */
/**
 * FID-20260914-002: garrison balance knobs — docs/design/BASE_RAID_BALANCE.md
 * is the tuning source of truth (edit the doc + these constants together).
 * The weight-class floor is load-bearing: the damage formula's defender term is
 * `defenderDEF − attackerSTR/2` (battleService.calculateDamage is called with
 * the DEFENSE stat as the defender's damage source — garrison STR never
 * counters), so a fixed-DEF garrison can never hurt a larger attacker beyond
 * the 5-damage floor. The floor must therefore land on DEF, and exceed 0.5 ×
 * attackerSTR before the counter rises above the floor at all:
 *   counter/round = (DEF_RATIO − 0.5) × attackerSTR  →  0.15 × attackerSTR
 * GARRISON_STR_RATIO pads the HP pool only (per-unit HP = strength + defense).
 * FID-20260915 tier-sim (dev/audits/COMBAT-TIER-SIM-2026-09-15.md Flag 1): the
 * pre-fix floor routed the full ratio into STR, which only inflated garrison
 * HP — synthesized-garrison raids were free wins at every tier mismatch.
 */
const GARRISON_DEF = 20;
const GARRISON_STR = 10;
const GARRISON_SIZE_DIVISOR = 20;
const GARRISON_SIZE_FLOOR = 8;
const GARRISON_SIZE_CAP = 60;
const GARRISON_STR_RATIO = 0.2;
const GARRISON_DEF_RATIO = 0.65;
/**
 * FID-20260915-003 (endgame pacing): tier multiplier ladder on the weight
 * floor. Measured tuning curve (scripts/simulateCombatTiers.ts Matrix 4 —
 * 220k STR endgame raider vs fresh top-tier synth): ×1.0–1.3 → 2-round wins
 * at 15–33% losses; ×1.4–1.5 → the multi-round band (3 rounds, 80–95%
 * losses); ≥×1.6 → the raider is annihilated. The ladder keeps low tiers
 * near flat and lands the top markers (bU/bL) in the multi-round band.
 * NOTE: GARRISON_SIZE_CAP was swept for this same goal and proved cosmetic —
 * the weight floor distributes across ANY unit count, so cap 60/150/300/600
 * produced byte-identical outcomes (only per-unit stats shrink). Difficulty
 * is tuned by this ladder, not by the cap.
 */
const GARRISON_TIER_MULT: Record<number, number> = { 1: 1.0, 2: 1.05, 3: 1.1, 4: 1.2, 5: 1.35, 6: 1.5 };

function synthesizeGarrison(
  base: { username: string; totalDefense?: number | null; currentPositionX?: number | null; currentPositionY?: number | null; createdAt?: Date | null } & Record<string, unknown>,
  baseUnits: PlayerUnit[],
  attackerSTR: number
): Unit[] {
  if (baseUnits.length > 0) return reinforceRealGarrison(base, baseUnits, attackerSTR);
  const totalDefense = Number(base.totalDefense) || 150; // T1 scalar default (botService getBotDefenseForTier)
  const unitCount = Math.min(GARRISON_SIZE_CAP, Math.max(GARRISON_SIZE_FLOOR, Math.ceil(totalDefense / GARRISON_SIZE_DIVISOR)));
  // Weight-class floor: DEF ≥ ceil(attackerSTR × DEF_RATIO) drives the
  // counter-attack (see the knob comment); STR ≥ ceil(attackerSTR × STR_RATIO)
  // pads the HP pool so the fight lasts ~2 rounds. Both redistributed across
  // the units, scaled by the base's tier ladder (docs/design/BASE_RAID_BALANCE.md).
  const tierIdx = resolveBotTier(base);
  const tierMult = GARRISON_TIER_MULT[tierIdx] ?? 1;
  const strengthFloor = Math.ceil(attackerSTR * GARRISON_STR_RATIO * tierMult);
  const defenseFloor = Math.ceil(attackerSTR * GARRISON_DEF_RATIO * tierMult);
  const perUnitSTR = Math.max(GARRISON_STR, Math.ceil(strengthFloor / unitCount));
  const perUnitDEF = Math.max(GARRISON_DEF, Math.ceil(defenseFloor / unitCount));
  return Array.from({ length: unitCount }, (_, i) => ({
    id: `${base.username}-garrison-${i}`,
    type: UnitType.T1_Rifleman,
    strength: perUnitSTR,
    defense: perUnitDEF,
    producedAt: { x: Number(base.currentPositionX) || 0, y: Number(base.currentPositionY) || 0 },
    producedDate: base.createdAt ?? new Date(),
    owner: base.username,
  }));
}

/**
 * FID-20260915-004 Fix B: real regrown garrisons get the SAME weight-class
 * treatment as synthesized ones. Pre-fix, a real garrison's DEF was fixed at
 * spawn+regrowth — an overmatched raider killed it inside his own strike phase
 * and sequential resolution meant it NEVER countered (dead defenders don't
 * strike) — live proof: BATTLE 12:56 raid, garrison DEF 184,090, counter 0.
 * Supplemental reinforcement units (ephemeral, battle-scoped, never persisted)
 * bring total DEF up to the ladder target; STR deficit gets a small pad.
 */
function reinforceRealGarrison(
  base: { username: string } & Record<string, unknown>,
  baseUnits: PlayerUnit[],
  attackerSTR: number
): Unit[] {
  const units = baseUnits.flatMap((pu) => playerUnitToUnits(pu, base.username));
  const tierIdx = resolveBotTier(base);
  const mult = GARRISON_TIER_MULT[tierIdx] ?? 1;
  const defTarget = Math.ceil(attackerSTR * GARRISON_DEF_RATIO * mult);
  const strTarget = Math.ceil(attackerSTR * GARRISON_STR_RATIO * mult);
  const curDEF = units.reduce((t, u) => t + u.defense, 0);
  const curSTR = units.reduce((t, u) => t + u.strength, 0);
  const produced = { x: Number(base.currentPositionX) || 0, y: Number(base.currentPositionY) || 0 };
  const producedDate = (base as { createdAt?: Date | null }).createdAt ?? new Date();
  const defDeficit = Math.max(0, defTarget - curDEF);
  const strDeficit = Math.max(0, strTarget - curSTR);
  // Folded T1 walls (DEF 100) / militia (STR 90) — canonical catalog stats.
  if (defDeficit > 0) {
    const n = Math.ceil(defDeficit / 100);
    for (let i = 0; i < n; i++) {
      units.push({ id: `${base.username}-reinforce-d${i}`, type: UnitType.T1_Barricade, strength: 0, defense: 100, producedAt: produced, producedDate, owner: base.username });
    }
  }
  if (strDeficit > 0) {
    const n = Math.ceil(strDeficit / 90);
    for (let i = 0; i < n; i++) {
      units.push({ id: `${base.username}-reinforce-s${i}`, type: UnitType.T1_Militia, strength: 90, defense: 0, producedAt: produced, producedDate, owner: base.username });
    }
  }
  return units;
}

/** Tier index from the base username marker (bW/bM/bS/bE/bU/bL). */
function baseTierIndex(username: string): number {
  const t = (/^b([WMSEUL])\d{12}$/.exec(username)?.[1] ?? 'W');
  return { W: 1, M: 2, S: 3, E: 4, U: 5, L: 6 }[t] ?? 1;
}

/**
 * FID-20260915-003: canonical bot tier — `bot_config.tier` is the spawner's
 * field (beerBaseService sets tier = rank, clamped 1..6; botTierResync maintains
 * it). The b[WMSEUL] username marker is the legacy encoding and matches NOTHING
 * on the live map (bot usernames are name-shaped, e.g. "Rusted_Depot"), so the
 * marker path silently degraded every live bot to tier 1 — both for the pacing
 * ladder and for tier-scaled XP/RP. Marker stays as fallback for rows that
 * somehow predate bot_config.
 */
function resolveBotTier(base: { username: string; botConfig?: unknown }): number {
  const cfgTier = Number((base.botConfig as Record<string, unknown> | null | undefined)?.tier);
  if (Number.isFinite(cfgTier) && cfgTier >= 1) return Math.min(6, Math.round(cfgTier));
  return baseTierIndex(base.username);
}

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('BeerBaseAttackAPI');
  const endTimer = log.time('beerBaseAttack');

  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, { message: 'Authentication required' });
    }

    const { defender, resource } = await request.json();
    if (!defender || typeof defender !== 'string') {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Missing field: defender' });
    }
    // FID-20260910-038 D4 (design: dev/archive/FID-20251017-023): a base raid
    // declares WHICH stockpile it is looting — metal or energy. Optional on
    // the wire (absent = legacy loot-both behavior) but the UI always sends it.
    if (resource !== undefined && resource !== 'metal' && resource !== 'energy') {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'resource must be "metal" or "energy"' });
    }

    // Load the base row for position + garrison.
    // FID-20260909-037: any bot base is attackable — Beer Bases (special)
    // AND the regular specializations (Hoarder/Fortress/Raider/Ghost/
    // Balanced/Boss). Regular bots follow the doc's Full Permanence model:
    // defeat strips their resources but they remain on the map and regrow
    // (lib/botCombatService.processBotAttack implements the same semantics).
    const [base] = await db.select().from(players).where(eq(players.username, defender)).limit(1);
    if (!base) {
      return NextResponse.json({ success: false, victory: false, message: 'Base not found' }, { status: 404 });
    }
    if (!base.isBot) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Target is not a hostile base' });
    }

    // FID-090: the base's location is its TILE (tiles.base_owner) — the thing
    // the player sees on the map and walks to. The players row's currentPosition
    // is bot-agent state that drifts; verifying against it 403s attacks from the
    // real base tile.
    const baseFallback = { x: Number(base.currentPositionX) || 0, y: Number(base.currentPositionY) || 0 };
    const basePos = await resolveBaseTilePosition(defender, baseFallback);

    // Presence: must be standing on the base's tile (DB position).
    const presence = await verifyPresence(auth.username, basePos);
    if (!presence.ok) {
      log.debug('Beer Base attack blocked: not at base location', { attacker: auth.username, base: defender, tile: basePos });
      return NextResponse.json({ success: false, victory: false, message: presence.reason }, { status: 403 });
    }

    // FID-20260912-093: one raid per base per reset period. A raid counts
    // whether it won or lost — the garrison knows who came. Any log row
    // (including losses) inside the current period blocks a re-attack.
    const periodStart = getRaidPeriodStart(basePos.x);
    const [priorRaid] = await db
      .select({ battleId: battleLogs.battleId })
      .from(battleLogs)
      .where(
        and(
          eq(battleLogs.attackerUsername, auth.username),
          eq(battleLogs.defenderUsername, defender),
          gte(battleLogs.timestamp, periodStart)
        )
      )
      .limit(1);
    if (priorRaid) {
      return NextResponse.json(
        { success: false, victory: false, message: `You already raided ${defender} this reset period. The garrison has locked the gates until the next reset.` },
        { status: 429 }
      );
    }

    // Garrison: real units if present, else synthesized from totalDefense (FID-006a R2).
    const baseUnits = (base.units ?? []) as PlayerUnit[];
    const attackerRow = await db.select().from(players).where(eq(players.username, auth.username)).limit(1);
    const attackerPlayer = attackerRow[0] as unknown as Player | undefined;
    if (!attackerPlayer) {
      return NextResponse.json({ success: false, victory: false, message: 'Attacker not found' }, { status: 404 });
    }
    const attackerUnits = ((attackerPlayer.units ?? []) as PlayerUnit[]).filter((u) => (u.quantity || 0) > 0);
    if (attackerUnits.length === 0) {
      return NextResponse.json({
        success: false,
        victory: false,
        message: 'You have no units to attack with',
      });
    }

    // FID-20260914-002: the garrison is built AFTER the attacker's army is
    // known — the weight-class floor needs the attacker's total STR.
    const attackerSTR = attackerUnits.reduce(
      (sum, u) => sum + (u.strength || 0) * (u.quantity || 0),
      0
    );
    const garrisonUnits = synthesizeGarrison(base, baseUnits, attackerSTR);

    // FID-20260912-093: real battle, honestly labeled. Was BattleType.Factory
    // — every notification/feed/headline called base raids FACTORY. Levels
    // feed the level-gap damage protection; applyCasualties:false keeps the
    // dead garrison OUT of the attacker's army (loot is the reward).
    const battleLog = await resolveBattle(
      attackerUnits.flatMap((pu) => playerUnitToUnits(pu, auth.username)),
      garrisonUnits,
      auth.username,
      defender,
      BattleType.BaseRaid,
      { x: basePos.x, y: basePos.y },
      {
        attackerLevel: attackerPlayer.level ?? 1,
        defenderLevel: base.level ?? 1,
        applyCasualties: false,
      }
    );

    // FID-20260912-093: real casualties — the attacker's losses come OFF
    // their army (per unit type, totals recomputed). Previously raid
    // casualties were cosmetic: the log said 1,013 dead, the army kept all.
    if (battleLog.attacker.unitsLost > 0) {
      try {
        await applyAttackerCasualties(battleLog);
      } catch (casualtyError) {
        log.warn('Attacker casualty application failed (battle still resolved)', casualtyError as Error);
      }
    }

    // FID-20260912-090b: feed the tutorial's combat quest. Presence at the
    // base completes 'Find a Beer Base'; a resolved raid completes
    // 'Attack the Base'. Non-throwing hooks (Law 14) — never block the raid.
    try {
      await recordTutorialBeerBaseFound(auth.username);
      await recordTutorialBaseAttack(auth.username, battleLog.outcome === 'ATTACKER_WIN');
    } catch (tutorialError) {
      log.warn('Tutorial combat tracking failed (non-fatal)', tutorialError as Error);
    }

    // FID-090 loot BEFORE persist: the theft goes ON the battleLog (so the
    // history row carries it) and is credited in the same step — previously the
    // credit happened after the insert and never touched the log, so every raid
    // log rendered "No resources gained/lost" forever.
    const isBeerBase = base.isSpecialBase === 1;
    let lootMetal = 0;
    let lootEnergy = 0;
    let xpAwarded = 0;
    // FID-20260914-002: hoisted — assigned in the first victory block, stated
    // in the victory message + rewards response (the second victory block,
    // after persist, consumes them for the return).
    let raidRP = 0;
    let message = '';

    if (battleLog.outcome === 'ATTACKER_WIN') {
      // Loot = base resources × multiplier. Beer Bases keep the doc's premium
      // 3× (config-driven); regular bot bases pay the plain 1× loot.
      // FID-038 D4: the raid's declared resource selects the stockpile.
      const config = await getBeerBaseConfig();
      const multiplier = isBeerBase ? Math.max(1, config.resourceMultiplier || 3) : 1;
      // FID-20260915-004 Fix C: loot cap. Uncapped vault × multiplier produced
      // the 452M single-raid payout; cap per-resource loot at the bot's own tier
      // ceiling × the beer multiplier so the multiplier stays but the vault
      // scale can't. Ceiling shared with the growth-engine vault cap (2×
      // spawner max) — an at-cap vault pays exactly its cap × multiplier.
      let vaultCap = Number.POSITIVE_INFINITY;
      try {
        const { getVaultCap } = await import('@/lib/botService');
        vaultCap = getVaultCap(
          ((base.botConfig as Record<string, unknown> | null)?.specialization as Parameters<typeof getVaultCap>[0]) ?? 'Balanced',
          Number((base.botConfig as Record<string, unknown> | null)?.tier) || 1
        ); // FID-20260915-006: shared cap (2×; hoarders 3×) — agrees with regen/growth clamps
      } catch { /* uncapped fallback (never fail the raid on a config read) */ }
      lootMetal = resource && resource !== 'metal' ? 0 : Math.floor(Math.min(Number(base.resourcesMetal || 0), vaultCap) * multiplier);
      lootEnergy = resource && resource !== 'energy' ? 0 : Math.floor(Math.min(Number(base.resourcesEnergy || 0), vaultCap) * multiplier);
      const stolen = lootMetal + lootEnergy;
      if (stolen > 0) {
        battleLog.resourcesStolen = {
          resourceType: (lootMetal > 0 ? 'metal' : 'energy') as 'metal' | 'energy',
          amount: stolen,
        };
      }

      // Doc-faithful XP recorded on the log too (BASE_ATTACK_WIN = 400).
      try {
        const xpResult = await awardXP(auth.username, XPAction.BASE_ATTACK_WIN);
        xpAwarded = xpResult.xpAwarded;
        battleLog.attackerXP = xpAwarded;
        battleLog.attacker = { ...battleLog.attacker, xpEarned: xpAwarded };
      } catch (xpError) {
        log.warn('Beer Base win XP failed (loot still credited)', xpError as Error);
      }

      // FID-20260911-044: PvE battles now pay battle RP — the RP overhaul
      // (FID-20251020-RP-OVERHAUL) listed battle rewards as a core source, but
      // only the PvP infantry path ever awarded it; raiding bots/Beer Bases
      // (the dominant combat activity) paid zero RP. FID-20260912-060 B2:
      // saturating level term (100 + 200×(1−e^(−L/20))) — max-level bots stop
      // being a lottery while low tiers stay meaningful.
      // FID-20260914-002: awarded BEFORE persist so the report can state it
      // (it previously happened after persist — the winner received RP no
      // report ever mentioned).
      try {
        const { awardRP, saturatingBattleRP } = await import('@/lib/researchPointService');
        const rpResult = await awardRP(
          auth.username,
          saturatingBattleRP(base.level ?? 1),
          'battle',
          `Victory against ${defender} (Base Raid)`,
          { battleType: 'base', defenderLevel: base.level ?? 1, beerBase: isBeerBase }
        );
        if (rpResult.success) {
          raidRP = rpResult.rpAwarded;
          log.debug('Raid RP awarded', { by: auth.username, base: defender, rp: rpResult.rpAwarded });
        }
      } catch (rpError) {
        log.warn('Raid RP award failed (loot still credited)', rpError as Error);
      }

      // FID-038 D4: message reflects the declared raid resource (both → legacy phrasing).
      // FID-20260914-002: the message states EVERY reward — loot, XP, RP — and
      // is set on the battleLog BEFORE persist, so the battle report's info
      // line carries it and the winner never receives unstated resources.
      const lootPhrase = resource === 'metal'
        ? `${lootMetal.toLocaleString()} Metal`
        : resource === 'energy'
          ? `${lootEnergy.toLocaleString()} Energy`
          : `${lootMetal.toLocaleString()} Metal and ${lootEnergy.toLocaleString()} Energy`;
      message = isBeerBase
        ? `You defeated Beer Base ${defender} and looted ${lootPhrase}! (+${xpAwarded} XP, +${raidRP} RP)`
        : `You defeated ${defender}'s base and looted ${lootPhrase}! The garrison was routed — the base will regather resources. (+${xpAwarded} XP, +${raidRP} RP)`;
      battleLog.message = message;
    }

    // FID-20260906-004 D1: persist the FULL battle log (now loot-complete)
    // + defender notification.
    await persistBattleLog(battleLog);

    // FID-20260906-006a R1/R3/R5: real crediting, base removal, doc-faithful XP.
    if (battleLog.outcome === 'ATTACKER_WIN') {
      // FID-090: loot + XP were computed and stamped onto the battleLog BEFORE
      // persist (above); here we only credit and do the post-victory state.
      const tierNumber = resolveBotTier(base as { username: string; botConfig?: unknown });

      // Credit the attacker (codebase pattern: BigInt math, Number() write —
      // schema columns are drizzle integer(); harvest + factory use the same).
      const atkRow = attackerPlayer as unknown as { resourcesMetal?: number; resourcesEnergy?: number };
      await db.update(players)
        .set({
          resourcesMetal: Number(BigInt(Math.max(0, Number(atkRow.resourcesMetal || 0))) + BigInt(lootMetal)),
          resourcesEnergy: Number(BigInt(Math.max(0, Number(atkRow.resourcesEnergy || 0))) + BigInt(lootEnergy)),
        })
        .where(eq(players.username, auth.username));

      // 3) Post-victory base state. Beer Bases are removed entirely (tile
      //    claim released — FID-20260909-030). Regular bots are Full
      //    Permanence: only the stockpiles the raid actually took are zeroed
      //    (FID-20260915-005 — mirrors the loot rule above: declared resource
      //    or both when undeclared), defeat/reputation bookkeeping, and the
      //    regen timer reset so the growth cycle rebuilds them.
      if (isBeerBase) {
        try {
          await removeBeerBase(defender);
        } catch (removeError) {
          log.warn('Beer Base removal after victory failed (loot already credited)', removeError as Error);
        }
      } else {
        try {
          const bot = (base.botConfig ?? {}) as unknown as { defeatedCount?: number } & Record<string, unknown>;
          const defeatedCount = (bot.defeatedCount ?? 0) + 1;
          const botConfig = {
            ...bot,
            lastDefeated: new Date(),
            defeatedCount,
            reputation: updateReputation(defeatedCount),
            revengeTarget: auth.username,
            lastResourceRegen: new Date(),
          } as unknown as BotConfig;
          await db.update(players)
            .set({
              // FID-20260915-005: zero ONLY the looted stockpile. lootMetal/
              // lootEnergy are min(vault, cap) × mult per resource, so
              // lootX > 0 ⟺ that stockpile was raided; the untouched one
              // keeps its value (previously BOTH were wiped regardless of
              // the declared resource).
              resourcesMetal: lootMetal > 0 ? 0 : Number(base.resourcesMetal || 0),
              resourcesEnergy: lootEnergy > 0 ? 0 : Number(base.resourcesEnergy || 0),
              botConfig,
            })
            .where(eq(players.username, defender));
        } catch (updateError) {
          log.warn('Regular bot defeat bookkeeping failed (loot already credited)', updateError as Error);
        }
      }

      // 4) Analytics (Beer funnel only — regular bots have no spawn funnel).
      if (isBeerBase) {
        try {
          const spawnTime = base.createdAt;
          const timeAliveSeconds = Math.floor((battleLog.timestamp.getTime() - (spawnTime ? spawnTime.getTime() : Date.now())) / 1000);
          await recordDefeatEvent(tierNumber - 1, auth.username, { metal: lootMetal, energy: lootEnergy }, timeAliveSeconds);
        } catch (analyticsError) {
          log.warn('Beer Base analytics failed (battle still resolved)', analyticsError as Error);
        }
      }

      // Achievement feed: battlesWon is an achievement axis that bot raids
      // never incremented — wire the same tracker the PvP path uses.
      try {
        const { trackBattleWon } = await import('@/lib/statTrackingService');
        await trackBattleWon(auth.username);
      } catch (trackError) {
        log.warn('battle-won stat tracking failed (non-fatal)', trackError as Error);
      }

      log.info('Bot base defeated + looted', { base: defender, beer: isBeerBase, by: auth.username, lootMetal, lootEnergy, xpAwarded, raidRP });

      // FID-20260909-029 §2.4: anti-cheat telemetry (was: logger defined,
      // never wired). Logging failures are swallowed inside the logger.
      await logAttack(
        auth.username,
        request.cookies.get('sessionId')?.value || 'unknown',
        defender,
        'success',
        { metal: lootMetal, energy: lootEnergy }
      );

      return NextResponse.json({
        success: true,
        victory: true,
        message,
        rewards: { metal: lootMetal, energy: lootEnergy, experience: xpAwarded, rp: raidRP },
        battle: battleLog,
      });
    }

    // Loss: doc-faithful BASE_ATTACK_LOSS = 60 XP; no base mutation.
    try {
      await awardXP(auth.username, XPAction.BASE_ATTACK_LOSS);
    } catch {
      // Non-fatal — the repel message is the primary response.
    }
    await logAttack(
      auth.username,
      request.cookies.get('sessionId')?.value || 'unknown',
      defender,
      'failure'
    );

    return NextResponse.json({
      success: true,
      victory: false,
      message: `Your attack on ${defender} was repelled! Base garrison: ${garrisonUnits.length} units.`,
      battle: battleLog,
    });
  } catch (error) {
    log.error('Beer Base attack failed', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
