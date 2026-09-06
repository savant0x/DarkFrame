/**
 * Admin Achievement Stats Endpoint
 * Created: 2025-01-18
 * Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
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
 * Returns:
 * {
 *   achievements: AchievementStat[],
 *   totalPlayers: number
 * }
 * 
 * Achievement Stat Structure:
 * - achievementId: Unique achievement identifier
 * - name: Achievement name
 * - description: Achievement description
 * - category: Achievement category (combat, resource, etc.)
 * - unlockCount: Number of players who unlocked
 * - unlockPercentage: Percentage of players who unlocked
 * - firstUnlock: Earliest unlock timestamp (optional)
 * - lastUnlock: Most recent unlock timestamp (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
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

    // Get collections
    const playersCollection = await getCollection('players');
    const achievementsCollection = await getCollection('playerAchievements');

    // Get total player count
    const totalPlayers = await playersCollection.countDocuments({});

    // Define achievement metadata (this should match your game's achievements)
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

    // Aggregate achievement unlocks
    const unlockStats = await achievementsCollection
      .aggregate([
        {
          $group: {
            _id: '$achievementId',
            unlockCount: { $sum: 1 },
            firstUnlock: { $min: '$unlockedAt' },
            lastUnlock: { $max: '$unlockedAt' },
          }
        }
      ])
      .toArray() as unknown as Array<{ _id: string; unlockCount: number; firstUnlock?: Date; lastUnlock?: Date }>;

    // Create stats object from aggregation results
    const unlockMap = new Map(
      unlockStats.map((stat) => [
        stat._id,
        {
          count: stat.unlockCount,
          firstUnlock: stat.firstUnlock ? new Date(stat.firstUnlock).toISOString() : undefined,
          lastUnlock: stat.lastUnlock ? new Date(stat.lastUnlock).toISOString() : undefined,
        }
      ])
    );

    // Combine metadata with unlock stats
    const achievements = achievementMetadata.map((achievement) => {
      const unlocks = unlockMap.get(achievement.id) || { count: 0, firstUnlock: undefined, lastUnlock: undefined };
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
      totalAchievements: achievements.length,
      totalPlayers,
      adminUser: user.username,
    });

    return NextResponse.json({
      success: true,
      achievements,
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
 * Database Schema Assumptions:
 * - playerAchievements collection with fields:
 *   * username: string
 *   * achievementId: string
 *   * unlockedAt: Date
 * - players collection for total player count
 * 
 * Achievement Metadata:
 * - Hardcoded list of achievements (15 examples)
 * - In production, this should come from a central achievements config file
 * - Or from an achievements collection in the database
 * 
 * Aggregation:
 * - Uses MongoDB aggregation to count unlocks per achievement
 * - Calculates first and last unlock timestamps
 * - Efficient for large datasets
 * 
 * Percentage Calculation:
 * - unlockPercentage = (unlockCount / totalPlayers) * 100
 * - Provides insight into achievement difficulty and popularity
 * 
 * Future Enhancements:
 * - Load achievement metadata from database or config file
 * - Add unlock velocity calculations (unlocks per day/week)
 * - Category-based statistics
 * - Player progress distribution (how many have X% achievements)
 * - Time-based analysis (unlock trends over time)
 * 
 * Performance:
 * - Aggregation is efficient for large datasets
 * - Consider caching results (refresh every 5-10 minutes)
 * - Index on achievementId for faster aggregation
 */
