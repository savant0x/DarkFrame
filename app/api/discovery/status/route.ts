/**
 * @file app/api/discovery/status/route.ts
 * @created 2025-01-17
 * @overview Get player's discovery progress and statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDiscoveryProgress } from '@/lib/discoveryService';
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
 * GET /api/discovery/status?username=player
 * 
 * Retrieve player's discovery progress
 * 
 * Query params:
 * - username: string (required)
 * 
 * Response:
 * {
 *   success: boolean,
 *   data?: {
 *     totalDiscovered: number,
 *     totalAvailable: number,
 *     progressPercent: number,
 *     byCategory: { industrial: number, combat: number, strategic: number },
 *     discoveries: Array<Discovery>,
 *     undiscovered: Array<{id, name, category, icon, description}>,
 *     completionStatus: 'COMPLETE' | 'IN_PROGRESS'
 *   }
 * }
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('discovery-status');
  const endTimer = log.time('discovery-status');
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');

    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username parameter is required');
    }

    const progress = await getDiscoveryProgress(username);

    if (!progress) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    log.info('Discovery status retrieved', { username, totalDiscovered: progress.totalDiscovered });
    return NextResponse.json({
      success: true,
      data: progress
    });

  } catch (error) {
    log.error('Failed to get discovery status', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Returns complete discovery progress for player
// - Includes both discovered and undiscovered technologies
// - Categorizes discoveries by type (industrial/combat/strategic)
// - Shows progress percentage toward 15/15 completion
// ============================================================
// END OF FILE
// ============================================================
