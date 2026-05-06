/**
 * Admin Achievement Stats Endpoint
 * Created: 2025-01-18
 * Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * Updated: 2026-05-03 — Migrated to Supabase
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

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminAchievementStatsAPI');
  const endTimer = log.time('fetch-achievement-stats');

  try {
    const { getAuthenticatedUser } = await import('@/lib/authMiddleware');
    const user = await getAuthenticatedUser();

    if (!user) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    if (user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }

    const supabase = createServiceClient();

    const { count: totalPlayers, error: countError } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    const { data: achievements, error } = await supabase
      .from('player_achievements')
      .select('*');

    if (error) throw error;

    const achievementMetadata = [
      { id: 'first_blood', name: 'First Blood', description: 'Win your first battle', category: 'combat' },
      { id: 'conqueror', name: 'Conqueror', description: 'Win 100 battles', category: 'combat' },
      { id: 'resource_hoarder', name: 'Resource Hoarder', description: 'Collect 100,000 resources', category: 'resource' },
      { id: 'explorer', name: 'Explorer', description: 'Visit 50 different tiles', category: 'exploration' },
      { id: 'builder', name: 'Builder', description: 'Construct 10 factories', category: 'progression' },
      { id: 'clan_founder', name: 'Clan Founder', description: 'Create a clan', category: 'social' },
      { id: 'tech_master', name: 'Tech Master', description: 'Unlock all tech tree nodes', category: 'progression' },
      { id: 'cave_explorer', name: 'Cave Explorer', description: 'Discover a cave', category: 'exploration' },
      { id: 'level_10', name: 'Veteran', description: 'Reach level 10', category: 'progression' },
      { id: 'level_20', name: 'Elite', description: 'Reach level 20', category: 'progression' },
      { id: 'level_30', name: 'Master', description: 'Reach level 30', category: 'progression' },
      { id: 'rich', name: 'Wealthy', description: 'Own 1,000,000 metal', category: 'resource' },
      { id: 'energized', name: 'Energized', description: 'Own 1,000,000 energy', category: 'resource' },
      { id: 'shrine_visitor', name: 'Shrine Visitor', description: 'Visit a shrine', category: 'exploration' },
      { id: 'banker', name: 'Banker', description: 'Use the bank 10 times', category: 'resource' },
    ];

    const unlockMap = new Map<string, { count: number; firstUnlock?: string; lastUnlock?: string }>();
    for (const a of (achievements || [])) {
      const existing = unlockMap.get(a.achievement_id);
      unlockMap.set(a.achievement_id, {
        count: (existing?.count || 0) + 1,
        firstUnlock: !existing?.firstUnlock ? a.unlocked_at : existing.firstUnlock,
        lastUnlock: a.unlocked_at,
      });
    }

    const achievementsList = achievementMetadata.map((achievement) => {
      const unlocks = unlockMap.get(achievement.id) || { count: 0 };
      const unlockCount = unlocks.count;
      const unlockPercentage = (totalPlayers || 0) > 0 ? (unlockCount / (totalPlayers || 1)) * 100 : 0;

      return {
        achievementId: achievement.id,
        name: achievement.name,
        description: achievement.description,
        category: achievement.category,
        unlockCount,
        unlockPercentage,
        firstUnlock: unlocks.firstUnlock,
        lastUnlock: unlocks.lastUnlock,
      };
    });

    log.info('Achievement stats fetched successfully', {
      totalAchievements: achievementsList.length,
      totalPlayers,
      adminUser: user.username,
    });

    return NextResponse.json({
      success: true,
      achievements: achievementsList,
      totalPlayers: totalPlayers || 0,
    });
  } catch (error) {
    log.error('Failed to fetch achievement stats', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
