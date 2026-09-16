/**
 * @file app/api/combat/infantry/route.ts
 * @created 2025-10-19
 * @overview Infantry Battle API - Player vs Player direct combat
 * 
 * OVERVIEW:
 * POST endpoint for initiating Infantry battles (direct player vs player combat).
 * Attacker selects units to bring, defender uses ALL units to defend.
 * Winner captures 10-15% of defeated units. Both sides earn XP.
 * 
 * REQUEST BODY:
 * {
 *   "targetUsername": string,  // Player to attack
 *   "unitIds": string[]        // Unit IDs to bring to battle
 * }
 * 
 * RESPONSE:
 * {
 *   "success": true,
 *   "message": "Battle complete message",
 *   "battleLog": BattleLog,
 *   "attackerLevelUp": boolean,
 *   "defenderLevelUp": boolean
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { executeInfantryAttack } from '@/lib/battleService';
import { verifyPresence } from '@/lib/presenceCheck';
import { protectionActive, PROTECTION_REFUSAL_REASON } from '@/lib/playerProtection'; // FID-20260916-002
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  InfantryCombatSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.battle);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('InfantryCombatAPI');
  const endTimer = log.time('infantryCombat');

  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      log.warn('Unauthenticated infantry combat attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required'
      });
    }

    const attackerId = authResult.username;

    // Parse and validate request body
    const body = await request.json();
    const validated = InfantryCombatSchema.parse(body);

    // Prevent self-attack
    if (validated.targetUsername === attackerId) {
      log.debug('Self-attack attempt blocked', { username: attackerId });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Cannot attack yourself'
      });
    }

    // FID-20260912-093: the Flag Bearer cannot INITIATE an attack on another
    // player — the doc's §5.5 restricted list covers economy; the flag design
    // keeps the bearer defenseless-by-choice: they may be challenged, but the
    // advantage engine (+25% STR/DEF, +100% harvest) is not also a sword.
    // Defense battles resolve through the challenge/steal channel instead.
    try {
      const { getFlagHolderState } = await import('@/lib/flagBonusService');
      const flagState = await getFlagHolderState();
      if (flagState.currentHolder === attackerId) {
        log.debug('Flag bearer PvP attack blocked', { attacker: attackerId, target: validated.targetUsername });
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: 'You hold the Flag — attacking other players is disabled while bearing it. Defend against challenges instead.'
        });
      }
    } catch (flagError) {
      // Never block combat because the flag check failed.
      log.warn('Flag bearer check failed (non-fatal)', flagError as Error);
    }

    // Presence: PvP requires standing on the defender's tile. Both positions
    // come from the DB — the client cannot claim a location.
    const [defenderRow] = await db
      .select({ x: players.currentPositionX, y: players.currentPositionY, protectionUntil: players.protectionUntil })
      .from(players)
      .where(eq(players.username, validated.targetUsername))
      .limit(1);
    if (!defenderRow) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Target player not found' });
    }
    // FID-20260916-002: new-player protection — protected targets refuse all
    // incoming PvP with a server reason. Base raids are bots-only by route
    // contract; outgoing WMD launches void the launcher's own window at the
    // missileService seam (FID-20260916-004 — the earlier note that
    // targetingValidator enforced this at launch was false: it has no
    // production callers and is target-side only).
    if (protectionActive(defenderRow.protectionUntil)) {
      log.debug('Infantry combat blocked: target under new-player protection', {
        attacker: attackerId,
        target: validated.targetUsername
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: PROTECTION_REFUSAL_REASON });
    }
    const presence = await verifyPresence(attackerId, { x: Number(defenderRow.x), y: Number(defenderRow.y) });
    if (!presence.ok) {
      log.debug('Infantry combat blocked: not at target location', { attacker: attackerId, at: presence.attackerPosition });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: presence.reason });
    }

    log.debug('Infantry combat initiated', { 
      attacker: attackerId, 
      target: validated.targetUsername,
      unitCount: validated.unitIds.length 
    });

    // Execute infantry battle
    const result = await executeInfantryAttack(attackerId, validated.targetUsername, validated.unitIds);

    log.info('Infantry combat completed', { 
      attacker: attackerId, 
      target: validated.targetUsername,
      attackerLevelUp: result.attackerLevelUp,
      defenderLevelUp: result.defenderLevelUp
    });

    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Infantry combat validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Infantry combat error', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
