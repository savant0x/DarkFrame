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
