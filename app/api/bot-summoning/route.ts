/**
 * @file app/api/bot-summoning/route.ts
 * @created 2025-01-18
 * 
 * OVERVIEW:
 * API endpoints for Bot Summoning Circle functionality.
 * 
 * ENDPOINTS:
 * - GET: Get summoning cooldown status
 * - POST: Summon bots of chosen specialization
 * 
 * AUTH: All endpoints require authentication
 * TECH: POST requires 'bot-summoning-circle' technology
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { BotSpecialization } from '@/types/game.types';
import {
  summonBots,
  getSummoningStatus,
} from '@/lib/botSummoningService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET - Get summoning status
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('bot-summoning-get');
  const endTimer = log.time('bot-summoning-get');

  try {
    const tokenPayload = await getAuthenticatedUser();

    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }

    const playerRows = await db.select().from(players).where(eq(players.username, tokenPayload.username)).limit(1);
    const player = playerRows[0];

    if (!player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    const status = await getSummoningStatus(player.username);

    log.info('Bot summoning status retrieved', { playerId: player.username });

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    log.error('Error getting summoning status', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST - Summon bots
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('bot-summoning-post');
  const endTimer = log.time('bot-summoning-post');

  try {
    const tokenPayload = await getAuthenticatedUser();

    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }

    const playerRows = await db.select().from(players).where(eq(players.username, tokenPayload.username)).limit(1);
    const player = playerRows[0];

    if (!player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    const body = await request.json();
    const { specialization } = body;

    // Validate specialization
    const validSpecializations: BotSpecialization[] = [
      BotSpecialization.Hoarder,
      BotSpecialization.Fortress,
      BotSpecialization.Raider,
      BotSpecialization.Balanced,
      BotSpecialization.Ghost,
    ];

    if (!specialization || !validSpecializations.includes(specialization)) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid specialization. Must be: Hoarder, Fortress, Raider, Balanced, or Ghost');
    }

    // Get player position
    const playerPosition = { x: player.currentPositionX || player.baseX, y: player.currentPositionY || player.baseY };

    if (!playerPosition.x || !playerPosition.y) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Player position not found');
    }

    // Summon bots
    const result = await summonBots(
      player.username,
      playerPosition,
      specialization
    );

    if (!result.success) {
      log.warn('Bot summoning failed', { reason: result.message, specialization });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    log.info('Bots summoned', { 
      playerId: player.username,
      specialization,
      botCount: result.bots?.length || 0
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      bots: result.bots,
    });
  } catch (error) {
    log.error('Error summoning bots', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 * - GET: Returns cooldown status (canSummon, hoursRemaining, lastSummon, nextSummonTime)
 * - POST: Validates specialization, player position, tech unlock, cooldown
 * - Specializations: Hoarder, Fortress, Raider, Balanced, Ghost
 * - Uses player.currentPosition or player.base as spawn center
 * - Returns array of spawned bot info (username, position)
 * - All validation and business logic in botSummoningService.ts
 * - Tech requirement checked in service layer
 */
