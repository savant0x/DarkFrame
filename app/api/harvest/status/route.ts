/**
 * @file app/api/harvest/status/route.ts
 * @created 2025-10-16
 * @updated 2026-05-03 (FID-20260503-SUPABASE: snake_case properties)
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

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('HarvestStatusAPI');
  const endTimer = log.time('harvest-status');
  
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    
    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, {
        message: 'Username parameter is required'
      });
    }
    
    const player = await getPlayer(username);
    if (!player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, {
        message: 'Player not found'
      });
    }
    
    const tile = await getTileAt(player.current_x, player.current_y);
    
    if (!tile) {
      log.error('Tile not found', undefined, { position: { x: player.current_x, y: player.current_y } });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Tile not found at current position'
      });
    }
    
    const status = await getHarvestStatus(player.username, { x: tile.x, y: tile.y, terrain: tile.terrain });
    
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
