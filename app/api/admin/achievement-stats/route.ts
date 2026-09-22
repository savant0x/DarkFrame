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
 * PERSISTENCE (PostgreSQL): players.achievements (jsonb array of unlock
 * records). FID-20260919-017 retired the separate relational `achievements`
 * table: it had no writer anywhere, so it could never fill — the jsonb has been
 * the live store all along (every player-facing read uses it). The rollup
 * unnests the jsonb across players and groups by achievement id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { players } from '@/lib/db/schema';
import { count, eq, sql } from 'drizzle-orm';
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

    // Rollup over the live jsonb store (FID-20260919-017). Elements carry the
    // id as `id`, except tutorial grants which use `achievementId`; both are
    // accepted. Bots are excluded to match the denominator above.
    const rollup = (await db.execute(sql`
      SELECT COALESCE(elem->>'id', elem->>'achievementId') AS achievement_id,
             count(*)::int AS unlock_count,
             min(elem->>'unlockedAt') AS first_unlock,
             max(elem->>'unlockedAt') AS last_unlock
      FROM players, jsonb_array_elements(
        CASE WHEN jsonb_typeof(players.achievements) = 'array'
             THEN players.achievements ELSE '[]'::jsonb END
      ) AS elem
      WHERE players.is_bot = 0
      GROUP BY 1
    `)) as unknown as {
      rows: Array<{
        achievement_id: string;
        unlock_count: number;
        first_unlock: string | null;
        last_unlock: string | null;
      }>;
    };

    const unlockMap = new Map(
      rollup.rows.map((stat) => [
        stat.achievement_id,
        {
          count: Number(stat.unlock_count),
          firstUnlock: stat.first_unlock ? new Date(stat.first_unlock).toISOString() : undefined,
          lastUnlock: stat.last_unlock ? new Date(stat.last_unlock).toISOString() : undefined,
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
