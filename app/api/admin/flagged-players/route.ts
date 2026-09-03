/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 🎯 OVERVIEW:
 * Flagged Players Admin Endpoint
 * 
 * GET /api/admin/flagged-players
 * Rate Limited: 500 req/min (admin dashboard)
 * - Returns all players with active anti-cheat flags
 * - Supports filtering by flag type and severity
 * - Admin-only access (rank >= 5)
 * - Includes flag details, evidence, and occurrence counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { playerFlags, players } from '@/lib/db/schema';
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
  const log = createRouteLogger('AdminFlaggedPlayersAPI');
  const endTimer = log.time('flagged-players');

  try {
    const user = await getAuthenticatedUser();
    if (!user || !user.rank || user.rank < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    const { searchParams } = new URL(request.url);
    const flagType = searchParams.get('flagType');
    const severity = searchParams.get('severity');
    const resolved = searchParams.get('resolved') === 'true';

    const allFlags = await db.select().from(playerFlags);

    const filteredFlags = allFlags.filter((f) => {
      const details = f.details || {};
      if (flagType && details.flagType !== flagType) return false;
      if (severity && details.severity !== severity) return false;
      if (details.resolved !== resolved) return false;
      return true;
    });

    const grouped: Record<string, any> = {};
    for (const flag of filteredFlags) {
      const username = flag.playerId;
      if (!grouped[username]) {
        grouped[username] = {
          username,
          totalFlags: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          flags: [],
          latestFlagDate: null as Date | null,
          oldestFlagDate: null as Date | null,
        };
      }
      const details = flag.details || {};
      const sev = details.severity || 'LOW';
      grouped[username].totalFlags++;
      if (sev === 'CRITICAL') grouped[username].criticalCount++;
      else if (sev === 'HIGH') grouped[username].highCount++;
      else if (sev === 'MEDIUM') grouped[username].mediumCount++;
      else grouped[username].lowCount++;

      grouped[username].flags.push({
        id: flag.id,
        flagType: details.flagType || flag.flag,
        severity: sev,
        description: details.description || '',
        evidence: details.evidence || null,
        metadata: details.metadata || null,
        occurrenceCount: details.occurrenceCount || 1,
        createdAt: flag.createdAt,
        resolved: details.resolved || false,
        resolvedBy: details.resolvedBy || null,
        resolvedAt: details.resolvedAt || null,
      });

      const createdAt = flag.createdAt;
      if (!grouped[username].latestFlagDate || (createdAt && createdAt > grouped[username].latestFlagDate)) {
        grouped[username].latestFlagDate = createdAt;
      }
      if (!grouped[username].oldestFlagDate || (createdAt && createdAt < grouped[username].oldestFlagDate)) {
        grouped[username].oldestFlagDate = createdAt;
      }
    }

    const flaggedPlayers = Object.values(grouped).sort((a: any, b: any) => {
      if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
      if (b.highCount !== a.highCount) return b.highCount - a.highCount;
      if (b.mediumCount !== a.mediumCount) return b.mediumCount - a.mediumCount;
      return b.totalFlags - a.totalFlags;
    });

    const enrichedData = await Promise.all(
      flaggedPlayers.map(async (fp: any) => {
        const playerRows = await db.select().from(players).where(eq(players.username, fp.username));
        const player = playerRows[0] || null;
        return {
          username: fp.username,
          totalFlags: fp.totalFlags,
          severityCounts: {
            critical: fp.criticalCount,
            high: fp.highCount,
            medium: fp.mediumCount,
            low: fp.lowCount,
          },
          flags: fp.flags,
          latestFlagDate: fp.latestFlagDate,
          oldestFlagDate: fp.oldestFlagDate,
          playerInfo: player ? {
            tier: player.level,
            rank: player.rank,
            resources: {
              metal: Number(player.resourcesMetal),
              energy: Number(player.resourcesEnergy),
            },
            createdAt: player.createdAt,
            lastActive: player.lastLoginDate,
          } : null,
        };
      }),
    );

    const stats = {
      totalFlaggedPlayers: flaggedPlayers.length,
      totalFlags: flaggedPlayers.reduce((sum: number, p: any) => sum + p.totalFlags, 0),
      criticalPlayers: flaggedPlayers.filter((p: any) => p.criticalCount > 0).length,
      highPlayers: flaggedPlayers.filter((p: any) => p.highCount > 0).length,
      mediumPlayers: flaggedPlayers.filter((p: any) => p.mediumCount > 0).length,
      lowPlayers: flaggedPlayers.filter((p: any) => p.lowCount > 0).length,
    };

    log.info('Flagged players retrieved', {
      totalFlaggedPlayers: stats.totalFlaggedPlayers,
      totalFlags: stats.totalFlags,
      criticalPlayers: stats.criticalPlayers,
      adminUser: user.username,
    });

    return NextResponse.json({
      success: true,
      data: enrichedData,
      stats,
      filters: {
        flagType: flagType || 'all',
        severity: severity || 'all',
        resolved,
      },
    });

  } catch (error) {
    log.error('Failed to fetch flagged players', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Fetches all flags and processes aggregation in JS
 * - Enriches data with current player stats
 * - Supports filtering by flag type, severity, and resolution status
 * - Returns summary statistics for admin dashboard
 * - Sorted by severity (CRITICAL first) then flag count
 * 
 * 🔐 SECURITY:
 * - Admin-only access (rank >= 5)
 * - No sensitive data exposure
 * - Read-only operation
 * 
 * 📊 RESPONSE STRUCTURE:
 * {
 *   success: true,
 *   data: [{ username, flags, severityCounts, playerInfo }],
 *   stats: { totalFlaggedPlayers, totalFlags, criticalPlayers, ... }
 * }
 */
