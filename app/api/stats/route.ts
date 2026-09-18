// ============================================================
// FILE: app/api/stats/route.ts
// CREATED: 2025-01-18
// LAST MODIFIED: 2025-10-18
// ============================================================
// OVERVIEW:
// API endpoint for retrieving game statistics including top players
// and global game metrics. Supports sorting by power, level, or metal.
// Protected by middleware - authentication is handled at the middleware level.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players, battleLogs, tiles } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,

  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

// ============================================================
// GET HANDLER
// ============================================================

/**
 * GET /api/stats
 * 
 * Retrieves game statistics including:
 * - Top 10 players (sortable by power, level, or metal)
 * - Global game metrics (total players, metal, energy, average level)
 * 
 * Query Parameters:
 * - sortBy: 'power' | 'level' | 'metal' (default: 'power')
 * 
 * Note: Authentication handled by Next.js middleware
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('stats-get');
  const endTimer = log.time('stats-get');
  try {
    // Authentication is handled by middleware - no need to check here

    // Get sort parameter
    const searchParams = request.nextUrl.searchParams;
    const sortBy = searchParams.get('sortBy') || 'power';

    // FID-20260917-015 (Cluster B batch 1): pg rewrite. Power is DERIVED -
    // total_power is not a pg column; rankingService defines it as
    // totalStrength + totalDefense (lib/rankingService.ts:123), so the SQL
    // sort/sum use that same expression (loop decision D1).
    const powerExpr = sql`(${players.totalStrength} + ${players.totalDefense})`;
    const orderByExpr =
      sortBy === 'level' ? desc(players.level)
      : sortBy === 'metal' ? desc(players.resourcesMetal)
      : desc(powerExpr);

    // Top 10 - sorted in SQL (the census's noted perf win over fetch-then-sort)
    const topRows = await db.select({
      username: players.username,
      level: players.level,
      totalStrength: players.totalStrength,
      totalDefense: players.totalDefense,
      metal: players.resourcesMetal,
      energy: players.resourcesEnergy,
      rank: players.rank,
    }).from(players).orderBy(orderByExpr).limit(10);

    // Same wire shape the Mongo projection produced (consumers: app/stats/page.tsx,
    // components/StatsViewWrapper.tsx). _id was only a React key - username serves.
    const topPlayers = topRows.map((player) => ({
      _id: player.username,
      username: player.username,
      level: player.level,
      totalPower: player.totalStrength + player.totalDefense,
      totalStrength: player.totalStrength,
      totalDefense: player.totalDefense,
      metal: player.metal || 0,
      energy: player.energy || 0,
      rank: player.rank,
    }));

    // Global statistics - one SQL aggregate (was a Mongo $group pipeline)
    const statsRows = await db.select({
      totalPlayers: sql<number>`COUNT(*)::int`,
      totalMetal: sql<number>`COALESCE(SUM(${players.resourcesMetal}), 0)`,
      totalEnergy: sql<number>`COALESCE(SUM(${players.resourcesEnergy}), 0)`,
      totalPower: sql<number>`COALESCE(SUM(${powerExpr}), 0)`,
      averageLevel: sql<number>`COALESCE(AVG(${players.level}), 0)::float8`,
    }).from(players);
    const statsResult = statsRows[0];

    // FID-20260912-070: real counters — battle_logs is the battle ledger that
    // combat writes; occupied base tiles are the territories.
    const [battleRows, territoryRows] = await Promise.all([
      db.select({ n: sql<number>`COUNT(*)::int` }).from(battleLogs),
      db.select({ n: sql<number>`COUNT(*)::int` }).from(tiles).where(eq(tiles.occupiedByBase, 1)),
    ]);

    const gameStats = {
      totalPlayers: statsResult?.totalPlayers || 0,
      totalMetal: Number(statsResult?.totalMetal ?? 0),
      totalEnergy: Number(statsResult?.totalEnergy ?? 0),
      totalPower: Number(statsResult?.totalPower ?? 0),
      averageLevel: statsResult?.averageLevel || 0,
      totalBattles: battleRows[0]?.n ?? 0,
      totalTerritories: territoryRows[0]?.n ?? 0,
    };

    log.info('Statistics retrieved', { 
      topPlayerCount: topPlayers.length, 
      totalPlayers: gameStats.totalPlayers, 
      sortBy 
    });
    return NextResponse.json({
      success: true,
      topPlayers,
      gameStats,
      sortBy,
    });
  } catch (error) {
    log.error('Failed to fetch statistics', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Authentication handled by Next.js middleware
// - Supports sorting by power, level, or metal
// - Returns top 10 players based on sort criteria (SQL orderBy - indexed)
// - Calculates global statistics with a SQL aggregate (FID-20260917-015;
//   was a Mongo $group pipeline)
// - totalPower is derived: totalStrength + totalDefense (D1, matches
//   rankingService) - there is no total_power column in pg
// ============================================================
// END OF FILE
// ============================================================
