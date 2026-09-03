// @ts-nocheck
/**
 * @file app/api/admin/stats/route.ts
 * @created 2025-10-18
 * @overview Admin statistics API endpoint
 * 
 * OVERVIEW:
 * Returns game-wide statistics for admin dashboard.
 * Access restricted to level 10+ players.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players, tiles, factories } from '@/lib/db/schema';
import { eq, gte, sql } from 'drizzle-orm';
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

async function countTableWhere(table: any, condition: any): Promise<number> {
  const result = await db.select({ count: sql`count(*)` }).from(table).where(condition);
  return Number(result[0]?.count) || 0;
}

async function countTable(table: any): Promise<number> {
  const result = await db.select({ count: sql`count(*)` }).from(table);
  return Number(result[0]?.count) || 0;
}

/**
 * GET /api/admin/stats
 * 
 * Get game statistics for admin panel
 * Requires level 10+
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/stats');
  const endTimer = log.time('get-admin-stats');

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    if (user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }

    const [
      totalPlayers,
      totalBases,
      totalFactories,
      wastelands,
      metal,
      energy,
      caves,
      forests,
      banks,
      shrines
    ] = await Promise.all([
      countTable(players),
      countTableWhere(tiles, eq(tiles.occupiedByBase, 1)), // occupied_by_base is smallint; 1 = occupied
      countTable(factories),
      countTableWhere(tiles, eq(tiles.terrain, 'Wasteland')),
      countTableWhere(tiles, eq(tiles.terrain, 'Metal')),
      countTableWhere(tiles, eq(tiles.terrain, 'Energy')),
      countTableWhere(tiles, eq(tiles.terrain, 'Cave')),
      countTableWhere(tiles, eq(tiles.terrain, 'Forest')),
      countTableWhere(tiles, eq(tiles.terrain, 'Bank')),
      countTableWhere(tiles, eq(tiles.terrain, 'Shrine'))
    ]);

    const now = new Date();
    const cutoff1h = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [activePlayers1h, activePlayers24h, activePlayers7d] = await Promise.all([
      countTableWhere(players, gte(players.lastLoginDate, cutoff1h)),
      countTableWhere(players, gte(players.lastLoginDate, cutoff24h)),
      countTableWhere(players, gte(players.lastLoginDate, cutoff7d))
    ]);

    const stats = {
      totalPlayers,
      totalBases,
      totalFactories,
      activePlayers1h,
      activePlayers24h,
      activePlayers7d,
      mapStats: {
        wastelands,
        metal,
        energy,
        caves,
        forests,
        banks,
        shrines
      }
    };

    log.info('Admin stats retrieved', {
      totalPlayers,
      activePlayers24h,
      totalBases,
      totalFactories,
    });

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    log.error('Failed to load admin stats', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// ============================================================
