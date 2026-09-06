/**
 * @fileoverview Admin Bot Statistics API - Bot population analytics
 * @module app/api/admin/bot-stats/route
 * @created 2025-10-18
 * @updated 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 
 * OVERVIEW:
 * Admin-only endpoint for viewing comprehensive bot population statistics.
 * Provides breakdown by specialization, tier, zone distribution, and activity metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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

// ============================================================================
// GET - Bot Population Statistics
// ============================================================================

/**
 * GET /api/admin/bot-stats
 * Rate Limited: 500 req/min (admin dashboard)
 * Returns comprehensive bot population analytics
 * Requires admin privileges (rank >= 5)
 */
export const GET = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('AdminBotStatsAPI');
  const endTimer = log.time('bot-stats');

  try {
    // Authenticate user
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    // Check admin privileges
    if (tokenPayload.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin privileges required',
      });
    }

    // Get all bots
    const bots = await db.select()
      .from(players)
      .where(eq(players.isBot, 1));

    // Calculate statistics
    const stats = {
      total: bots.length,
      bySpecialization: {
        Hoarder: 0,
        Fortress: 0,
        Raider: 0,
        Balanced: 0,
        Ghost: 0,
      },
      byTier: {
        tier1: 0,
        tier2: 0,
        tier3: 0,
        tier4: 0,
        tier5: 0,
        tier6: 0,
      },
      specialBases: 0,
      totalResources: {
        metal: 0,
        energy: 0,
      },
      averageResources: {
        metal: 0,
        energy: 0,
      },
      zoneDistribution: {} as Record<string, number>,
    };

    // Process each bot
    for (const bot of bots) {
      const spec = bot.botConfig?.specialization;
      const tier = bot.botConfig?.tier;
      const metal = bot.resourcesMetal;      // FID-20260905-001 M2: real columns
      const energy = bot.resourcesEnergy;
      const position = { x: bot.currentPositionX, y: bot.currentPositionY };

      // Specialization count
      if (spec && spec in stats.bySpecialization) {
        const specKey = spec as unknown as keyof typeof stats.bySpecialization;
        stats.bySpecialization[specKey]++;
      }

      // Tier count
      if (tier && tier >= 1 && tier <= 6) {
        const tierKey = `tier${tier}` as keyof typeof stats.byTier;
        stats.byTier[tierKey]++;
      }

      // Special bases
      if (bot.botConfig?.isSpecialBase) {
        stats.specialBases++;
      }

      // Total resources
      stats.totalResources.metal += metal;
      stats.totalResources.energy += energy;

      // Zone distribution (500x500 zones)
      if (position) {
        const zoneX = Math.floor(((position).x || 0) / 500);
        const zoneY = Math.floor(((position).y || 0) / 500);
        const zoneKey = `${zoneX},${zoneY}`;
        stats.zoneDistribution[zoneKey] = (stats.zoneDistribution[zoneKey] || 0) + 1;
      }
    }

    // Calculate averages
    if (stats.total > 0) {
      stats.averageResources.metal = Math.floor(stats.totalResources.metal / stats.total);
      stats.averageResources.energy = Math.floor(stats.totalResources.energy / stats.total);
    }

    log.info('Bot statistics retrieved', {
      totalBots: stats.total,
      specialBases: stats.specialBases,
      adminUser: tokenPayload.username,
    });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log.error('Failed to fetch bot statistics', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * ADMIN PERMISSIONS:
 * - Requires rank >= 5 to access
 * - Stats refreshed on each request (no caching)
 * - Safe to call frequently (optimized queries)
 * 
 * FUTURE ENHANCEMENTS:
 * - Historical trends (bot population over time)
 * - Activity heatmaps
 * - Reputation distribution
 * - Combat statistics
 */
