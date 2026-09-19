/**
 * Admin Achievement Stats Endpoint
 * Created: 2025-01-18
 * Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * Rewritten: 2026-09-18 (FID-20260917-017 slice 4: Mongo shim → direct drizzle/pg)
 *
 * OVERVIEW:
 * Returns aggregated achievement unlock statistics for admin analytics.
 * Provides comprehensive data about achievement unlocks, player progress,
 * and achievement popularity.
 *
 * Endpoint: GET /api/admin/achievement-stats
 * Auth Required: Admin (isAdmin flag)
 * Rate Limited: 500 req/min (admin analytics)
 *
 * PERSISTENCE (PostgreSQL): the `achievements` table (one row per unlock:
 * player_id, achievement_id, name, category, rarity, unlocked_at) — this is
 * the table the shim's `playerAchievements` collection name always resolved
 * to via TABLE_ALIASES. The unlock rollup is one indexed GROUP BY.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { achievements, players } from '@/lib/db/schema';
import { count, min, max, eq } from 'drizzle-orm';
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

/**
 * GET handler - Fetch achievement statistics
 *
 * Admin-only endpoint that aggregates achievement unlock data.
 * Returns stats for all achievements with unlock counts and percentages.
 */
export const GET = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('AdminAchievementStatsAPI');
  const endTimer = log.time('fetch-achievement-stats');

  try {
    // Check admin authentication
    const { getAuthenticatedUser } = await import('@/lib/authMiddleware');
    const user = await getAuthenticatedUser();

    if (!user) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    // Check admin access (isAdmin flag required)
    if (user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }

    // Total player count — the percentage denominator (bot players excluded;
    // the prior countDocuments({}) counted them, skewing percentages).
    const [{ n: totalPlayers }] = await db
      .select({ n: count() })
      .from(players)
      .where(eq(players.isBot, 0));

    // Rollup: unlock count + first/last unlock per achievement (the shim's
    // $group pipeline, now real SQL).
    const unlockStats = await db
      .select({
        achievementId: achievements.achievementId,
        unlockCount: count(),
        firstUnlock: min(achievements.unlockedAt),
        lastUnlock: max(achievements.unlockedAt),
      })
      .from(achievements)
      .groupBy(achievements.achievementId);

    const unlockMap = new Map(
      unlockStats.map((stat) => [
        stat.achievementId,
        {
          count: stat.unlockCount,
          firstUnlock: stat.firstUnlock ? new Date(stat.firstUnlock).toISOString() : undefined,
          lastUnlock: stat.lastUnlock ? new Date(stat.lastUnlock).toISOString() : undefined,
        },
      ])
    );

    // Achievement display metadata (static catalog; DB rows carry name/category
    // per unlock, but the catalog defines the full reported set).
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

    // Combine metadata with unlock stats — every catalog achievement is
    // reported (zero unlocks included), sorted by rarity of achievement.
    const achievementsOut = achievementMetadata.map((achievement) => {
      const unlocks = unlockMap.get(achievement.id) ?? { count: 0, firstUnlock: undefined, lastUnlock: undefined };
      const unlockCount = unlocks.count;
      const unlockPercentage = totalPlayers > 0 ? (unlockCount / totalPlayers) * 100 : 0;

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
      totalAchievements: achievementsOut.length,
      totalPlayers,
      adminUser: user.username,
    });

    return NextResponse.json({
      success: true,
      achievements: achievementsOut,
      totalPlayers,
    });
  } catch (error) {
    log.error('Failed to fetch achievement stats', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 *
 * - One count + one GROUP BY (the aggregate pipeline's SQL equivalent)
 * - Percentage denominator excludes bots (semantic correction, recorded)
 * - Consider caching results (refresh every 5-10 minutes) if the admin
 *   dashboard polls this frequently
 */
