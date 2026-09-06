/**
 * @file app/api/fast-travel/route.ts
 * @created 2025-01-18
 * 
 * OVERVIEW:
 * API endpoints for Fast Travel Network functionality.
 * 
 * ENDPOINTS:
 * - GET: Get waypoints and travel status
 * - POST: Set or travel to waypoint
 * - DELETE: Delete waypoint
 * 
 * AUTH: All endpoints require authentication
 * TECH: All endpoints require 'fast-travel-network' technology
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  setWaypoint,
  deleteWaypoint,
  travelToWaypoint,
  getFastTravelStatus,
} from '@/lib/fastTravelService';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse, 
  createValidationErrorResponse,
  createErrorFromException,
  ErrorCode
} from '@/lib';
import { FastTravelSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.FAST_TRAVEL);

/**
 * GET - Get fast travel status and waypoints
 */
export async function GET(_request: NextRequest) {
  try {
    const tokenPayload = await getAuthenticatedUser();

    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const playerRows = await db.select().from(players).where(eq(players.username, tokenPayload.username)).limit(1);
    const player = playerRows[0];

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    const status = await getFastTravelStatus(player.username);

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Error getting fast travel status:', error);
    return NextResponse.json(
      { error: 'Failed to get fast travel status' },
      { status: 500 }
    );
  }
}

/**
 * POST - Set waypoint or travel to waypoint
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('FastTravelAPI');
  const endTimer = log.time('POST /api/fast-travel');
  
  try {
    const tokenPayload = await getAuthenticatedUser();

    if (!tokenPayload) {
      log.warn('Unauthenticated fast travel attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        context: 'Fast travel requires authentication'
      });
    }

    const playerRows = await db.select().from(players).where(eq(players.username, tokenPayload.username)).limit(1);
    const player = playerRows[0];

    if (!player) {
      log.error('Player not found', undefined, { username: tokenPayload.username });
      return createErrorResponse(ErrorCode.NOT_FOUND, {
        context: 'Player not found'
      });
    }

    // Validate request body with discriminated union schema
    const validated = FastTravelSchema.parse(await request.json());
    
    log.debug('Fast travel request', { 
      action: validated.action,
      playerId: player.username,
      username: player.username
    });

    if (validated.action === 'set') {
      // Set waypoint
      log.info('Setting waypoint', { 
        name: validated.name,
        x: validated.x,
        y: validated.y,
        playerId: player.username
      });

      const result = await setWaypoint(player.username, { 
        name: validated.name, 
        x: validated.x, 
        y: validated.y 
      });

      if (!result.success) {
        log.warn('Failed to set waypoint', { 
          details: {
            message: result.message,
            playerId: player.username
          }
        });
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          context: result.message || 'Failed to set waypoint'
        });
      }

      log.info('Waypoint set successfully', { 
        name: validated.name,
        waypointCount: result.waypoints?.length || 0
      });

      return NextResponse.json({
        success: true,
        message: result.message,
        waypoints: result.waypoints,
      });
    } else {
      // Travel to waypoint (action === 'travel')
      log.info('Traveling to waypoint', { 
        name: validated.name,
        playerId: player.username
      });

      const result = await travelToWaypoint(player.username, validated.name);

      if (!result.success) {
        log.warn('Failed to travel to waypoint', { 
          details: {
            message: result.message,
            waypoint: validated.name,
            playerId: player.username
          }
        });
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          context: result.message || 'Failed to travel to waypoint'
        });
      }

      log.info('Travel successful', { 
        waypoint: validated.name,
        newPosition: result.position
      });

      return NextResponse.json({
        success: true,
        message: result.message,
        position: result.position,
      });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Validation error in fast travel');
      return createValidationErrorResponse(error);
    }
    
    log.error('Unexpected error in fast travel', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * DELETE - Delete waypoint
 */
export const DELETE = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('fast-travel-delete');
  const endTimer = log.time('fast-travel-delete');

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
    const { name } = body;

    if (!name) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Waypoint name required');
    }

    const result = await deleteWaypoint(player.username, name);

    if (!result.success) {
      log.warn('Waypoint deletion failed', { name, reason: result.message });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    log.info('Waypoint deleted', { playerId: player.username, name });

    return NextResponse.json({
      success: true,
      message: result.message,
      waypoints: result.waypoints,
    });
  } catch (error) {
    log.error('Error deleting waypoint', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 * - GET: Returns travel status, waypoints, cooldown info
 * - POST action=set: Create or update waypoint (no cooldown)
 * - POST action=travel: Teleport to waypoint (12hr cooldown)
 * - DELETE: Remove waypoint by name
 * - All endpoints require authentication
 * - Tech requirement enforced in service layer
 * - Waypoint names: 1-20 characters
 * - Coordinates: integers only
 * - Max 5 waypoints per player
 */
