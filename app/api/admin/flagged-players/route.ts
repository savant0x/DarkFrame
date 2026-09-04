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
    const flagTypeFilter = searchParams.get('flagType');
    const severityFilter = searchParams.get('severity');
    const resolved = searchParams.get('resolved') === 'true';

    const allFlags = await db.select().from(playerFlags);

    const filteredFlags = allFlags.filter((f) => {
      // Domain columns (migration 0007) with details-jsonb fallback for legacy rows.
      const details = (f.details || {}) as Record<string, unknown>;
      const flagType = f.flagType ?? details.flagType;
      const severity = f.severity ?? details.severity;
      const isResolved = f.resolved === 1 || details.resolved === true;
      if (flagTypeFilter && flagType !== flagTypeFilter) return false;
      if (severityFilter && severity !== severityFilter) return false;
      if (isResolved !== resolved) return false;
      return true;
    });

    interface FlagGroup {
      username: string;
      totalFlags: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      flags: Array<Record<string, unknown>>;
      latestFlagDate: Date | null;
      oldestFlagDate: Date | null;
    }

    const grouped: Record<string, FlagGroup> = {};
    for (const flag of filteredFlags) {
      const details = (flag.details || {}) as Record<string, unknown>;
      const username = flag.username ?? flag.playerId ?? 'unknown';
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
      const sev = flag.severity ?? details.severity ?? 'LOW';
      grouped[username].totalFlags++;
      if (sev === 'CRITICAL') grouped[username].criticalCount++;
      else if (sev === 'HIGH') grouped[username].highCount++;
      else if (sev === 'MEDIUM') grouped[username].mediumCount++;
      else grouped[username].lowCount++;

      grouped[username].flags.push({
        id: flag.id,
        flagType: flag.flagType ?? details.flagType ?? flag.flag,
        severity: sev,
        description: details.description || '',
        evidence: flag.evidence ?? details.evidence ?? null,
        metadata: flag.metadata ?? details.metadata ?? null,
        occurrenceCount: flag.occurrenceCount ?? details.occurrenceCount ?? 1,
        createdAt: flag.createdAt,
        resolved: flag.resolved === 1 || details.resolved === true,
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

    const flaggedPlayers = Object.values(grouped).sort((a: FlagGroup, b: FlagGroup) => {
      if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
      if (b.highCount !== a.highCount) return b.highCount - a.highCount;
      if (b.mediumCount !== a.mediumCount) return b.mediumCount - a.mediumCount;
      return b.totalFlags - a.totalFlags;
    });

    const enrichedData = await Promise.all(
      flaggedPlayers.map(async (fp: FlagGroup) => {
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
      totalFlags: flaggedPlayers.reduce((sum: number, p: FlagGroup) => sum + p.totalFlags, 0),
      criticalPlayers: flaggedPlayers.filter((p: FlagGroup) => p.criticalCount > 0).length,
      highPlayers: flaggedPlayers.filter((p: FlagGroup) => p.highCount > 0).length,
      mediumPlayers: flaggedPlayers.filter((p: FlagGroup) => p.mediumCount > 0).length,
      lowPlayers: flaggedPlayers.filter((p: FlagGroup) => p.lowCount > 0).length,
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
        flagType: flagTypeFilter || 'all',
        severity: severityFilter || 'all',
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
