/**
 * @file app/api/achievements/progress/route.ts
 * @created 2025-01-17
 * @updated 2026-05-15 — Fixed: fetch actual player stats instead of hardcoded 0
 * @overview Get player's achievement progress and unlocked prestige units
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
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

function getStatForAchievement(achievementId: string, player: Record<string, unknown>): number {
  switch (achievementId) {
    case 'harvest_1k': case 'harvest_5k': case 'harvest_10k': case 'harvest_25k': case 'harvest_100k': case 'harvest_500k': case 'harvest_1m':
      return (player.stat_total_resources_gathered as number) || 0;
    case 'cave_100': case 'cave_500': case 'cave_2000':
      return (player.stat_caves_explored as number) || 0;
    case 'attack_10': case 'attack_50': case 'factory_5':
      return (player.stat_battles_won as number) || 0;
    case 'diggers_10': case 'diggers_50': case 'diggers_200':
      return ((player.inventory_metal_digger_count as number) || 0) + ((player.inventory_energy_digger_count as number) || 0);
    case 'referral_1': case 'referral_5': case 'referral_25':
      return (player.total_referrals as number) || 0;
    case 'streak_7': case 'streak_30': case 'streak_100':
      return (player.login_streak as number) || 0;
    default:
      return 0;
  }
}

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

    const supabase = createServiceClient();
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (playerError || !player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, {
        message: 'Player not found',
      });
    }

    const playerAchievements = ACHIEVEMENTS.map(a => {
      const currentValue = getStatForAchievement(a.id, player);
      return checkAchievementProgress(a, currentValue);
    });

    const categories = ['harvest', 'exploration', 'combat', 'collection', 'social', 'time'] as const;
    const byCategory = categories.map(cat => ({
      category: cat,
      total: getAchievementsByCategory(cat).length,
      unlocked: playerAchievements.filter(a => a.category === cat && a.completed).length,
    }));

    const completedCount = playerAchievements.filter(a => a.completed).length;

    log.info('Achievement progress retrieved', {
      username,
      totalAchievements: playerAchievements.length,
      completed: completedCount,
    });

    return NextResponse.json({
      success: true,
      data: {
        totalAvailable: ACHIEVEMENTS.length,
        totalUnlocked: completedCount,
        progressPercent: Math.round((completedCount / ACHIEVEMENTS.length) * 100),
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
