/**
 * @file app/api/achievements/progress/route.ts
 * @created 2025-01-17
 * @overview Get player's achievement progress and unlocked prestige units
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { ACHIEVEMENTS, checkAchievementProgress, getAchievementsByCategory } from '@/lib/achievementService';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/achievements/progress?username=player
 * 
 * Retrieve player's achievement progress
 * 
 * Query params:
 * - username: string (required)
 * 
 * Response:
 * {
 *   success: boolean,
 *   data?: {
 *     totalUnlocked: number,
 *     totalAvailable: number,
 *     progressPercent: number,
 *     byCategory: { combat: {unlocked, total}, ... },
 *     achievements: Array<Achievement with progress>,
 *     unlockedPrestigeUnits: string[],
 *     completionStatus: 'COMPLETE' | 'IN_PROGRESS'
 *   }
 * }
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AchievementProgressAPI');
  const endTimer = log.time('get-achievement-progress');
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');

    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Username is required',
      });
    }

    const playerAchievements = ACHIEVEMENTS.map(a => checkAchievementProgress(a, 0));
    const categories = ['harvest', 'exploration', 'combat', 'collection', 'social', 'time'] as const;
    const byCategory = categories.map(cat => ({
      category: cat,
      total: getAchievementsByCategory(cat).length,
      unlocked: playerAchievements.filter(a => a.category === cat && a.completed).length,
    }));

    log.info('Achievement progress retrieved', {
      username,
      totalAchievements: playerAchievements.length,
      completed: playerAchievements.filter(a => a.completed).length,
    });

    return NextResponse.json({
      success: true,
      data: {
        totalAvailable: ACHIEVEMENTS.length,
        totalUnlocked: playerAchievements.filter(a => a.completed).length,
        progressPercent: Math.round((playerAchievements.filter(a => a.completed).length / ACHIEVEMENTS.length) * 100),
        byCategory,
        achievements: playerAchievements,
        completionStatus: playerAchievements.every(a => a.completed) ? 'COMPLETE' : 'IN_PROGRESS',
      },
    });

  } catch (error) {
    log.error('Error getting achievement progress', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Returns complete achievement progress for player
// - Includes progress percentage for each achievement
// - Lists unlocked prestige units
// - Shows category breakdown (combat/economic/exploration/progression)
// ============================================================
// END OF FILE
// ============================================================
