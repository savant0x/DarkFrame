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
import { verifyPresence } from '@/lib/presenceCheck';
import { logAttack } from '@/lib/activityLogger';
import { resolveBattle, persistBattleLog } from '@/lib/battleService';
import { recordDefeatEvent } from '@/lib/beerBaseAnalytics';
import { getBeerBaseConfig, removeBeerBase } from '@/lib/beerBaseService';
import { updateReputation } from '@/lib/botCombatService';
import { awardXP, XPAction } from '@/lib/xpService';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import type { BotConfig } from '@/types/game.types';
import { eq } from 'drizzle-orm';
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
 * (botService tiers T1→T7 write 150→9600 before spec multipliers). Capped so an
 * anomalous row can't spawn an unbounded army.
 * Takes the drizzle players row (loosely typed — the DB projection is the truth).
 */
function synthesizeGarrison(
  base: { username: string; totalDefense?: number | null; currentPositionX?: number | null; currentPositionY?: number | null; createdAt?: Date | null } & Record<string, unknown>,
  baseUnits: PlayerUnit[]
): Unit[] {
  if (baseUnits.length > 0) return baseUnits.flatMap((pu) => playerUnitToUnits(pu, base.username));
  const totalDefense = Number(base.totalDefense) || 150; // T1 scalar default (botService getBotDefenseForTier)
  const unitCount = Math.max(1, Math.min(Math.ceil(totalDefense / 20), 500));
  return Array.from({ length: unitCount }, (_, i) => ({
    id: `${base.username}-garrison-${i}`,
    type: UnitType.T1_Rifleman,
    strength: 0,
    defense: 20,
    producedAt: { x: Number(base.currentPositionX) || 0, y: Number(base.currentPositionY) || 0 },
    producedDate: base.createdAt ?? new Date(),
    owner: base.username,
  }));
}

/** Tier index from the base username marker (bW/bM/bS/bE/bU/bL). */
function baseTierIndex(username: string): number {
  const t = (/^b([WMSEUL])\d{12}$/.exec(username)?.[1] ?? 'W');
  return { W: 1, M: 2, S: 3, E: 4, U: 5, L: 6 }[t] ?? 1;
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

    // Presence: must be standing on the base's tile (DB position).
    const presence = await verifyPresence(auth.username, {
      x: Number(base.currentPositionX),
      y: Number(base.currentPositionY),
    });
    if (!presence.ok) {
      log.debug('Beer Base attack blocked: not at base location', { attacker: auth.username, base: defender });
      return NextResponse.json({ success: false, victory: false, message: presence.reason }, { status: 403 });
    }

    // Garrison: real units if present, else synthesized from totalDefense (FID-006a R2).
    const baseUnits = (base.units ?? []) as PlayerUnit[];
    const garrisonUnits = synthesizeGarrison(base, baseUnits);
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

    const battleLog = await resolveBattle(
      attackerUnits.flatMap((pu) => playerUnitToUnits(pu, auth.username)),
      garrisonUnits,
      auth.username,
      defender,
      BattleType.Factory,
      { x: Number(base.currentPositionX), y: Number(base.currentPositionY) }
    );

    // FID-20260906-004 D1: persist the FULL battle log (was: zero-filled
    // shadow row via recordBattle) + defender notification.
    await persistBattleLog(battleLog);

    // FID-20260906-006a R1/R3/R5: real crediting, base removal, doc-faithful XP.
    if (battleLog.outcome === 'ATTACKER_WIN') {
      // 1) Loot = base resources × multiplier. Beer Bases keep the doc's
      //    premium 3× (config-driven); regular bot bases pay the plain 1× loot.
      //    FID-038 D4: the raid's declared resource (metal/energy) selects the
      //    stockpile — the other one is left untouched for the next raider.
      const isBeerBase = base.isSpecialBase === 1;
      const config = await getBeerBaseConfig();
      const multiplier = isBeerBase ? Math.max(1, config.resourceMultiplier || 3) : 1;
      const lootMetal = resource && resource !== 'metal' ? 0 : Math.floor(Number(base.resourcesMetal || 0) * multiplier);
      const lootEnergy = resource && resource !== 'energy' ? 0 : Math.floor(Number(base.resourcesEnergy || 0) * multiplier);
      const tierNumber = baseTierIndex(defender);

      // 2) Credit the attacker (codebase pattern: BigInt math, Number() write —
      //    schema columns are drizzle integer(); harvest + factory use the same).
      const atkRow = attackerPlayer as unknown as { resourcesMetal?: number; resourcesEnergy?: number };
      await db.update(players)
        .set({
          resourcesMetal: Number(BigInt(Math.max(0, Number(atkRow.resourcesMetal || 0))) + BigInt(lootMetal)),
          resourcesEnergy: Number(BigInt(Math.max(0, Number(atkRow.resourcesEnergy || 0))) + BigInt(lootEnergy)),
        })
        .where(eq(players.username, auth.username));

      // 3) Post-victory base state. Beer Bases are removed entirely (tile
      //    claim released — FID-20260909-030). Regular bots are Full
      //    Permanence: resources zeroed, defeat/reputation bookkeeping, and
      //    the regen timer reset so the growth cycle rebuilds them.
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
              resourcesMetal: 0,
              resourcesEnergy: 0,
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

      // 5) Doc-faithful XP: BASE_ATTACK_WIN = 400 (awardXP applies flag doubling).
      let xpAwarded = 0;
      try {
        const xpResult = await awardXP(auth.username, XPAction.BASE_ATTACK_WIN);
        xpAwarded = xpResult.xpAwarded;
      } catch (xpError) {
        log.warn('Beer Base win XP failed (loot already credited)', xpError as Error);
      }

      // FID-20260911-044: PvE battles now pay battle RP — the RP overhaul
      // (FID-20251020-RP-OVERHAUL) listed battle rewards as a core source, but
      // only the PvP infantry path ever awarded it; raiding bots/Beer Bases
      // (the dominant combat activity) paid zero RP. Scale by base level:
      // 100 base + 20 per defender level (same shape as the PvP formula).
      try {
        const { awardRP } = await import('@/lib/researchPointService');
        const rpResult = await awardRP(
          auth.username,
          100 + (base.level ?? 1) * 20,
          'battle',
          `Victory against ${defender} (Base Raid)`,
          { battleType: 'base', defenderLevel: base.level ?? 1, beerBase: isBeerBase }
        );
        if (rpResult.success) {
          log.debug('Raid RP awarded', { by: auth.username, base: defender, rp: rpResult.rpAwarded });
        }
      } catch (rpError) {
        log.warn('Raid RP award failed (loot already credited)', rpError as Error);
      }

      // Achievement feed: battlesWon is an achievement axis that bot raids
      // never incremented — wire the same tracker the PvP path uses.
      try {
        const { trackBattleWon } = await import('@/lib/statTrackingService');
        await trackBattleWon(auth.username);
      } catch (trackError) {
        log.warn('battle-won stat tracking failed (non-fatal)', trackError as Error);
      }

      // FID-038 D4: message reflects the declared raid resource (both → legacy phrasing).
      const lootPhrase = resource === 'metal'
        ? `${lootMetal.toLocaleString()} Metal`
        : resource === 'energy'
          ? `${lootEnergy.toLocaleString()} Energy`
          : `${lootMetal.toLocaleString()} Metal and ${lootEnergy.toLocaleString()} Energy`;
      const message = isBeerBase
        ? `You defeated Beer Base ${defender} and looted ${lootPhrase}!`
        : `You defeated ${defender}'s base and looted ${lootPhrase}! The garrison was routed — the base will regather resources.`;
      log.info('Bot base defeated + looted', { base: defender, beer: isBeerBase, by: auth.username, lootMetal, lootEnergy, xpAwarded });

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
        rewards: { metal: lootMetal, energy: lootEnergy, experience: xpAwarded },
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
