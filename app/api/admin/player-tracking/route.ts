/**
 * @file app/api/admin/player-tracking/route.ts
 * @created 2025-10-18
 * @overview Get aggregated tracking data for all players or specific player
 * 
 * OVERVIEW:
 * Returns comprehensive tracking metrics including session times, activity counts,
 * resource gains, and behavioral patterns. Used by admin dashboard for overview
 * monitoring and identifying high-activity or suspicious players.
 * 
 * Access: Admin only (rank >= 5)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players, playerActivity } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/authMiddleware';
import {
  getActivityCount,
  getTotalResourcesGained,
} from '@/lib/activityLogger';
import {
  getTotalSessionTime,
  getSessionCount,
} from '@/lib/sessionTracker';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,

  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

/**
 * GET /api/admin/player-tracking?period=24h&userId=PlayerOne
 * 
 * Get aggregated tracking metrics for players
 * 
 * Query params:
 * - period: Time period ('24h' | '7d' | '30d') - default: '24h'
 * - userId: Specific player username (optional, omit for all players)
 * - sortBy: Sort field ('activity' | 'sessionTime' | 'resources') - default: 'activity'
 * - limit: Max players to return (default: 50, max: 500)
 * 
 * Returns array of player tracking data:
 * - userId: Player username
 * - totalActions: Total activities in period
 * - sessionCount: Number of sessions in period
 * - totalSessionTime: Total time played (seconds)
 * - resourcesGained: { metal, energy }
 * - averageSessionDuration: Average session length (seconds)
 * - actionsPerSession: Average actions per session
 * - lastActivity: Most recent activity timestamp
 * 
 * @example
 * GET /api/admin/player-tracking?period=24h&sortBy=sessionTime&limit=20
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/player-tracking');
  const endTimer = log.time('get-player-tracking');

  try {
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '24h';
    const userId = searchParams.get('userId');
    const sortBy = searchParams.get('sortBy') || 'activity';
    const limitStr = searchParams.get('limit') || '50';
    const limit = Math.min(parseInt(limitStr), 500);

    const hoursMap: Record<string, number> = {
      '24h': 24,
      '7d': 168,
      '30d': 720,
    };
    const hoursAgo = hoursMap[period] || 24;

    let playersList: { username: string }[];
    if (userId) {
      playersList = [{ username: userId }];
    } else {
      const playersData = await db.select({ username: players.username }).from(players);
      playersList = playersData.map(p => ({ username: p.username }));
    }

    const trackingData = await Promise.all(
      playersList.map(async (player) => {
        const username = player.username;

        const totalActions = await getActivityCount(username, hoursAgo);
        const sessionCount = await getSessionCount(username, hoursAgo);
        const totalSessionTime = await getTotalSessionTime(username, hoursAgo);
        const resourcesGained = await getTotalResourcesGained(username, hoursAgo);

        const lastActivityResult = await db.select({
          timestamp: playerActivity.timestamp,
        }).from(playerActivity)
          .where(eq(playerActivity.playerId, username))
          .orderBy(desc(playerActivity.timestamp))
          .limit(1);

        const averageSessionDuration = sessionCount > 0 ? Math.floor(totalSessionTime / sessionCount) : 0;
        const actionsPerSession = sessionCount > 0 ? Math.floor(totalActions / sessionCount) : 0;

        return {
          userId: username,
          totalActions,
          sessionCount,
          totalSessionTime,
          resourcesGained,
          averageSessionDuration,
          actionsPerSession,
          lastActivity: lastActivityResult[0]?.timestamp || null,
        };
      })
    );

    trackingData.sort((a, b) => {
      if (sortBy === 'activity') {
        return b.totalActions - a.totalActions;
      } else if (sortBy === 'sessionTime') {
        return b.totalSessionTime - a.totalSessionTime;
      } else if (sortBy === 'resources') {
        const aTotal = a.resourcesGained.metal + a.resourcesGained.energy;
        const bTotal = b.resourcesGained.metal + b.resourcesGained.energy;
        return bTotal - aTotal;
      }
      return 0;
    });

    const limitedData = userId ? trackingData : trackingData.slice(0, limit);

    log.info('Player tracking retrieved', {
      period,
      totalPlayers: trackingData.length,
      returnedCount: limitedData.length,
      sortBy,
    });

    return NextResponse.json({
      success: true,
      period,
      players: limitedData,
      totalPlayers: trackingData.length,
    });
  } catch (error) {
    log.error('Failed to fetch player tracking data', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Admin only access (rank >= 5)
// - Supports both single player and all players view
// - Aggregates data from activity and session collections
// - Multiple sort options for different analysis needs
// - Time period filtering (24h, 7d, 30d)
// - Returns pre-computed metrics to reduce client processing
// - Used by admin dashboard overview and player comparison
// ============================================================
