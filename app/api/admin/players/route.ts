/**
 * @file app/api/admin/players/route.ts
 * @created 2025-10-18
 * @overview Admin player list API endpoint
 * 
 * OVERVIEW:
 * Returns list of all players with basic info for admin panel.
 * Access restricted to level 10+ players.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { desc, asc } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
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
 * GET /api/admin/players
 * 
 * Get list of all players for admin panel
 * Requires level 10+
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/players');
  const endTimer = log.time('get-players');

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    if (user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }

    const playersList = await db.select({
      username: players.username,
      level: players.level,
      rank: players.rank,
      resourcesMetal: players.resourcesMetal,
      resourcesEnergy: players.resourcesEnergy,
      baseX: players.baseX,
      baseY: players.baseY,
      createdAt: players.createdAt,
    })
      .from(players)
      .orderBy(desc(players.level), asc(players.username));

    const playerList = playersList.map(p => ({
      username: p.username,
      level: p.level || 1,
      rank: p.rank || 1,
      metal: Number(p.resourcesMetal || 0),
      energy: Number(p.resourcesEnergy || 0),
      baseLocation: `(${p.baseX}, ${p.baseY})`,
      lastActive: p.createdAt ? new Date(p.createdAt).toISOString() : undefined
    }));

    log.info('Player list retrieved', {
      totalPlayers: playerList.length,
      requestedBy: user.username,
    });

    return NextResponse.json({
      success: true,
      data: playerList
    });

  } catch (error) {
    log.error('Failed to load player list', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// ============================================================
