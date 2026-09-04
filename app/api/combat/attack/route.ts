/**
 * @file app/api/combat/attack/route.ts
 * @created 2026-09-04
 * @overview Player attack on a Beer Base — the endpoint components/BeerBasePanel
 * already calls (`/api/combat/attack`); it previously 404'd, so every panel
 * attack failed.
 *
 * Flow: session-authenticated, presence-enforced (must stand ON the base's
 * tile), then delegates to the shared battle resolver (`/api/battle/attack`
 * semantics: resolveBattle + recordBattle + Beer Base analytics) with the
 * attacker's full army vs the base's full garrison.
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
import { resolveBattle } from '@/lib/battleService';
import { recordBattle } from '@/lib/battleTrackingService';
import { recordDefeatEvent } from '@/lib/beerBaseAnalytics';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
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

/** Sum of unit quantities — the garrison size the base defends with. */
function armySize(units: PlayerUnit[]): number {
  return units.reduce((sum, u) => sum + (u.quantity || 0), 0);
}

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('BeerBaseAttackAPI');
  const endTimer = log.time('beerBaseAttack');

  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, { message: 'Authentication required' });
    }

    const { defender } = await request.json();
    if (!defender || typeof defender !== 'string') {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Missing field: defender' });
    }

    // Load the base row for position + garrison.
    const [base] = await db.select().from(players).where(eq(players.username, defender)).limit(1);
    if (!base) {
      return NextResponse.json({ success: false, victory: false, message: 'Beer Base not found' }, { status: 404 });
    }
    if (!base.isSpecialBase) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Target is not a Beer Base' });
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

    // Garrison: bases never move, so the defender stands at the same tile.
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

    const battleLog = await resolveBattle(
      attackerUnits.flatMap((pu) => playerUnitToUnits(pu, auth.username)),
      baseUnits.flatMap((pu) => playerUnitToUnits(pu, defender)),
      auth.username,
      defender,
      BattleType.Factory,
      { x: Number(base.currentPositionX), y: Number(base.currentPositionY) }
    );

    await recordBattle({
      attacker: battleLog.attacker.username,
      defender: battleLog.defender.username,
      winner: battleLog.outcome === 'ATTACKER_WIN' ? battleLog.attacker.username : (battleLog.outcome === 'DEFENDER_WIN' ? battleLog.defender.username : ''),
      factoryLocation: battleLog.location ?? { x: Number(base.currentPositionX), y: Number(base.currentPositionY) },
      attackerPower: battleLog.attacker.totalSTR,
      defenderPower: battleLog.defender.totalDEF,
      factoryCaptured: battleLog.outcome === 'ATTACKER_WIN',
      timestamp: battleLog.timestamp,
      details: battleLog,
    });

    // Beer Base defeat analytics + rewards (mirrors /api/battle/attack handling).
    if (battleLog.outcome === 'ATTACKER_WIN') {
      try {
        const tierName = defender.match(/^b([WMSEUL])\d{12}$/)
          ? ({ W: 'WEAK', M: 'MID', S: 'STRONG', E: 'ELITE', U: 'ULTRA', L: 'LEGENDARY' } as Record<string, string>)[defender.match(/^b([WMSEUL])\d{12}$/)![1]] ?? 'WEAK'
          : defender.match(/BeerBase-(\w+)-/)?.[1] ?? 'WEAK';
        const tierMap: Record<string, number> = {
          'WEAK': 0, 'MID': 1, 'STRONG': 2, 'ELITE': 3, 'ULTRA': 4, 'LEGENDARY': 5
        };
        const tierNumber = tierMap[tierName] || 0;
        const spawnTime = base.createdAt;
        const timeAliveSeconds = Math.floor((battleLog.timestamp.getTime() - (spawnTime ? spawnTime.getTime() : Date.now())) / 1000);
        const lootMetal = Math.floor(Number(base.resourcesMetal || 0));
        const lootEnergy = Math.floor(Number(base.resourcesEnergy || 0));

        await recordDefeatEvent(
          tierNumber,
          auth.username,
          { metal: lootMetal, energy: lootEnergy },
          timeAliveSeconds
        );

        const message = `You defeated Beer Base ${defender} and looted ${lootMetal} Metal and ${lootEnergy} Energy!`;
        log.info('Beer Base defeated', { base: defender, by: auth.username, lootMetal, lootEnergy });

        return NextResponse.json({
          success: true,
          victory: true,
          message,
          rewards: { metal: lootMetal, energy: lootEnergy, experience: 50 + tierNumber * 25 },
          battle: battleLog,
        });
      } catch (analyticsError) {
        log.warn('Beer Base analytics failed (battle still resolved)', analyticsError);
      }
    }

    return NextResponse.json({
      success: true,
      victory: false,
      message: `Your attack on ${defender} was repelled! Base garrison: ${armySize(baseUnits)} units.`,
      battle: battleLog,
    });
  } catch (error) {
    log.error('Beer Base attack failed', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
