/**
 * @file app/api/bot-magnet/route.ts
 * @created 2025-01-18
 * 
 * OVERVIEW:
 * API endpoints for Bot Magnet beacon deployment and management.
 * 
 * ENDPOINTS:
 * - GET: Get beacon status for authenticated player
 * - POST: Deploy new beacon (requires bot-magnet tech)
 * - DELETE: Deactivate current beacon
 * 
 * AUTH: All endpoints require authentication
 * TECH: POST requires 'bot-magnet' technology unlocked
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  deployBeacon,
  getBeaconStatus,
  deactivateBeacon,
} from '@/lib/botMagnetService';
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
 * GET - Get beacon status
 */
export const GET = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('bot-magnet-get');
  const endTimer = log.time('bot-magnet-get');

  try {
    const tokenPayload = await getAuthenticatedUser();

    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }

    // Fetch full player from database
    const playerResult = await db.select().from(players).where(eq(players.username, tokenPayload.username)).limit(1);
    const player = playerResult[0];

    if (!player || !player.username) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    const status = await getBeaconStatus(player.username);

    log.info('Bot magnet beacon status retrieved', { 
      playerId: player.username,
      hasActiveBeacon: status.hasActiveBeacon
    });

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    log.error('Error getting beacon status', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST - Deploy new beacon
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('bot-magnet-post');
  const endTimer = log.time('bot-magnet-post');

  try {
    const tokenPayload = await getAuthenticatedUser();

    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }

    // Fetch full player from database
    const playerResult = await db.select().from(players).where(eq(players.username, tokenPayload.username)).limit(1);
    const player = playerResult[0];

    if (!player || !player.username) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    // Check tech requirement
    const unlockedTechs = player.unlockedTechs || [];
    if (!unlockedTechs.includes('bot-magnet')) {
      return NextResponse.json({ error: 'Requires Bot Magnet technology' }, { status: 403 });
    }

    const body = await request.json();
    const { x, y } = body;

    // Validate coordinates
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isInteger(x) ||
      !Number.isInteger(y)
    ) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid coordinates. Must be integers.');
    }

    // Deploy beacon
    const result = await deployBeacon(
      player.username,
      player.username,
      x,
      y
    );

    if (!result.success) {
      log.warn('Beacon deployment failed', { reason: result.message, x, y });
      return NextResponse.json({ error: result.message || 'Failed to deploy beacon' }, { status: 400 });
    }

    log.info('Bot magnet beacon deployed', { 
      playerId: player.username, 
      x, 
      y 
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      beacon: result.beacon,
    });
  } catch (error) {
    log.error('Error deploying beacon', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * DELETE - Deactivate beacon
 */
export const DELETE = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('bot-magnet-delete');
  const endTimer = log.time('bot-magnet-delete');

  try {
    const tokenPayload = await getAuthenticatedUser();

    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }

    // Fetch full player from database
    const playerResult = await db.select().from(players).where(eq(players.username, tokenPayload.username)).limit(1);
    const player = playerResult[0];

    if (!player || !player.username) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    const result = await deactivateBeacon(player.username);

    if (!result.success) {
      log.warn('Beacon deactivation failed', { reason: result.message });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    log.info('Bot magnet beacon deactivated', { playerId: player.username });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    log.error('Error deactivating beacon', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 * - GET: Returns beacon status, cooldown, and deployment ability
 * - POST: Validates tech unlock, coordinates, and cooldown
 * - DELETE: Allows early beacon removal (cooldown persists)
 * - All endpoints require authentication via getAuthenticatedUser()
 * - Tech requirement: 'bot-magnet' must be in user.unlockedTechs
 * - Coordinates must be valid integers
 * - Returns appropriate error messages for all failure cases
 */
