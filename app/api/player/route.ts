/**
 * @file app/api/player/route.ts
 * @created 2025-10-16
 * @overview Player data retrieval API endpoint
 * 
 * OVERVIEW:
 * GET endpoint for fetching player data by username.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlayer } from '@/lib/playerService';
import { ApiResponse, ApiError } from '@/types';
import { calculateBalanceEffects } from '@/lib/balanceService';
import { getXPProgress } from '@/lib/xpService';
import { logger } from '@/lib/logger';
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
 * GET /api/player?username=Commander42
 * 
 * Get player data by username
 * 
 * Response:
 * ```json
 * {
 *   "success": true,
 *   "data": { ... }
 * }
 * ```
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('player-get');
  const endTimer = log.time('player-get');
  try {
    // Get username from query parameters
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    
    // Validate request
    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username parameter is required');
    }
    
    // Get player
    const player = await getPlayer(username);
    
    if (!player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }
    
    // Calculate balance effects based on current STR/DEF
    const balanceEffects = calculateBalanceEffects(
      player.totalStrength || 0,
      player.totalDefense || 0
    );
    
    // Calculate XP progress
    const xpProgress = getXPProgress(player.xp || 0);
    
    // Add balance effects and XP progress to player data
    const playerWithBalance = {
      ...player,
      balanceEffects,
      xpProgress
    };
    
    // Build response
    const successResponse: ApiResponse = {
      success: true,
      data: playerWithBalance
    };
    
    log.info('Player data retrieved', { username, level: player.level, effectivePower: balanceEffects.effectivePower });
    return NextResponse.json(successResponse);
    
  } catch (error) {
    log.error('Failed to fetch player', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// ============================================================
