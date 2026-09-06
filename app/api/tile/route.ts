/**
 * @file app/api/tile/route.ts
 * @created 2025-10-16
 * @overview Tile data retrieval API endpoint
 * 
 * OVERVIEW:
 * GET endpoint for fetching tile data by coordinates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTileAt } from '@/lib/movementService';
import { ApiResponse } from '@/types';
import type { Player } from '@/types/game.types';
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
 * GET /api/tile?x=75&y=100
 * 
 * Get tile data by coordinates
 * 
 * Response:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "x": 75,
 *     "y": 100,
 *     "terrain": "Metal",
 *     "occupiedByBase": false
 *   }
 * }
 * ```
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('tile-get');
  const endTimer = log.time('tile-get');
  try {
    // Get coordinates from query parameters
    const { searchParams } = new URL(request.url);
    const xParam = searchParams.get('x');
    const yParam = searchParams.get('y');
    
    // Validate request
    if (!xParam || !yParam) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Coordinates (x, y) are required');
    }
    
    const x = parseInt(xParam, 10);
    const y = parseInt(yParam, 10);
    
    // Validate coordinate ranges
    if (isNaN(x) || isNaN(y) || x < 1 || x > 150 || y < 1 || y > 150) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Coordinates must be numbers between 1 and 150');
    }
    
    // Get tile
    const tile = await getTileAt(x, y);
    
    if (!tile) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Tile not found');
    }
    
    // If tile is occupied by a base, fetch the owner's username
    if (tile.occupiedByBase) {
      try {
        const { getDatabase } = await import('@/lib/mongodb');
        const db = await getDatabase();
        const playersCollection = db.collection<Player>('players');
        
        const baseOwner = await playersCollection.findOne(
          { 'base.x': x, 'base.y': y },
          { projection: { username: 1, baseGreeting: 1 } }
        );
        
        if (baseOwner) {
          (tile as unknown as { baseOwner: string; baseGreeting?: string }).baseOwner = baseOwner.username;
          (tile as unknown as { baseOwner: string; baseGreeting?: string }).baseGreeting = baseOwner.baseGreeting || '';
        }
      } catch (error) {
        log.error('Error fetching base owner', error instanceof Error ? error : new Error(String(error)));
        // Continue without base owner - non-critical
      }
    }

    // Check if Flag Bearer is on this tile or if tile has trail
    // (Postgres-native via lib/flagState — the holder's position lives on their
    // players row; trail entries live in flag_trail. FID-20260905-001 §7.2.)
    try {
      const { getFlagState, getTrailInfoAt } = await import('@/lib/flagState');
      const flagState = await getFlagState();

      if (flagState) {
        // Check if bearer is on this exact tile
        if (flagState.position.x === x && flagState.position.y === y) {
          (tile as { hasFlagBearer?: boolean }).hasFlagBearer = true;
        }

        // Check if this tile has a live trail entry (not expired)
        if (!tile.hasFlagBearer) {
          const trailInfo = await getTrailInfoAt(x, y);
          if (trailInfo.hasTrail) {
            (tile as { hasTrail?: boolean }).hasTrail = true;
            (tile as { trailExpiresAt?: Date }).trailExpiresAt = trailInfo.trailExpiresAt;
          }
        }
      }
    } catch (error) {
      log.error('Error checking flag bearer/trail', error instanceof Error ? error : new Error(String(error)));
      // Continue without flag data - non-critical
    }
    
    // Build response
    const successResponse: ApiResponse = {
      success: true,
      data: tile
    };
    
    log.info('Tile data retrieved', { x, y, terrain: tile.terrain, occupiedByBase: tile.occupiedByBase });
    return NextResponse.json(successResponse);
    
  } catch (error) {
    log.error('Failed to fetch tile', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// ============================================================
