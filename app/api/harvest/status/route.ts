/**
 * @file app/api/harvest/status/route.ts
 * @created 2025-10-16
 * @updated 2025-10-24 - Phase 2: Production infrastructure - validation, errors, rate limiting
 * @overview API endpoint to check harvest availability for current tile
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlayer } from '@/lib/playerService';
import { getTileAt } from '@/lib/movementService';
import { getHarvestStatus } from '@/lib/harvestService';
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
 * GET /api/harvest/status
 * 
 * Query Parameters:
 * - username: Player username
 * 
 * Returns harvest availability status for current tile
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('HarvestStatusAPI');
  const endTimer = log.time('harvest-status');
  
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    
    if (!username) {
      log.warn('Missing username parameter');
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, {
        message: 'Username parameter is required'
      });
    }
    
    // Get player
    const player = await getPlayer(username);
    if (!player) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, {
        message: 'Player not found'
      });
    }
    
    // Get current tile
    const tile = await getTileAt(
      player.currentPosition.x,
      player.currentPosition.y
    );
    
    if (!tile) {
      log.error('Tile not found', undefined, { position: player.currentPosition });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Tile not found at current position'
      });
    }
    
    // Get harvest status
    const status = await getHarvestStatus(player.username, tile);
    
    // Calculate next reset time as Date
    const nextResetTime = new Date(Date.now() + status.timeUntilReset);
    
    log.info('Harvest status retrieved', { 
      username, 
      canHarvest: status.canHarvest, 
      timeUntilReset: status.timeUntilReset 
    });
    
    return NextResponse.json({
      success: true,
      canHarvest: status.canHarvest,
      resetPeriod: status.resetPeriod,
      timeUntilReset: status.timeUntilReset,
      nextResetTime: nextResetTime.toISOString()
    });
    
  } catch (error) {
    log.error('Harvest status check failed', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// ============================================================
