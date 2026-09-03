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
import clientPromise from '@/lib/mongodb';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
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

    // Connect to database
    const client = await clientPromise;
    const db = client.db('darkframe');
    const playersCollection = db.collection('players');

    // Determine sort field
    let sortField: { [key: string]: 1 | -1 } = {};
    switch (sortBy) {
      case 'level':
        sortField = { level: -1 };
        break;
      case 'metal':
        sortField = { 'resources.metal': -1 };
        break;
      case 'power':
      default:
        sortField = { totalPower: -1 };
        break;
    }

    // Fetch top 10 players
    const topPlayersRaw = await playersCollection
      .find({})
      .sort(sortField as any)
      .limit(10)
      .project({
        username: 1,
        level: 1,
        totalPower: 1,
        totalStrength: 1,
        totalDefense: 1,
        'resources.metal': 1,
        'resources.energy': 1,
        rank: 1,
      })
      .toArray();

    // Flatten resources for easier frontend consumption
    const topPlayers = topPlayersRaw.map((player: any) => ({
      _id: player._id,
      username: player.username,
      level: player.level,
      totalPower: player.totalPower,
      totalStrength: player.totalStrength,
      totalDefense: player.totalDefense,
      metal: player.resources?.metal || 0,
      energy: player.resources?.energy || 0,
      rank: player.rank,
    }));

    // Calculate global statistics
    const [statsResult] = await playersCollection
      .aggregate([
        {
          $group: {
            _id: null,
            totalPlayers: { $sum: 1 },
            totalMetal: { $sum: '$resources.metal' },
            totalEnergy: { $sum: '$resources.energy' },
            totalPower: { $sum: '$totalPower' },
            averageLevel: { $avg: '$level' },
          },
        },
      ])
      .toArray();

    const gameStats = {
      totalPlayers: statsResult?.totalPlayers || 0,
      totalMetal: statsResult?.totalMetal || 0,
      totalEnergy: statsResult?.totalEnergy || 0,
      totalPower: statsResult?.totalPower || 0,
      averageLevel: statsResult?.averageLevel || 0,
      totalBattles: 0, // TODO: Implement battle tracking
      totalTerritories: 0, // TODO: Implement territory tracking
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
// - Supports sorting by power, level, metal, or energy
// - Returns top 10 players based on sort criteria
// - Calculates global statistics using MongoDB aggregation
// - Projects only necessary fields for performance
// - Uses resources.metal and resources.energy (ECHO compliant)
// - TODO: Add battle and territory tracking for complete stats
// ============================================================
// END OF FILE
// ============================================================
