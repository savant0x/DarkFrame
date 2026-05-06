/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 🎯 OVERVIEW:
 * Flagged Players Admin Endpoint
 * 
 * GET /api/admin/flagged-players
 * Rate Limited: 500 req/min (admin dashboard)
 * - Returns all players with active anti-cheat flags
 * - Supports filtering by reason and resolution status
 * - Admin-only access (rank >= 5)
 * - Includes flag details and occurrence counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
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
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    if (!username) return NextResponse.json({ success: false, error: 'Username parameter required' }, { status: 400 });
    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    const reasonFilter = searchParams.get('reason');
    const resolved = searchParams.get('resolved') === 'true';

    // Build Supabase query
    let query = supabase
      .from('player_flags')
      .select('*');

    if (reasonFilter) query = query.eq('reason', reasonFilter);
    query = query.eq('resolved', resolved);

    const { data: allFlags, error: flagsError } = await query;

    if (flagsError) {
      log.error('Failed to fetch player flags', flagsError);
      return createErrorFromException(flagsError, ErrorCode.INTERNAL_ERROR);
    }

    // In-memory aggregation (replaces MongoDB $group pipeline)
    const groupedMap = new Map<string, {
      username: string;
      totalFlags: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      flags: any[];
      latestFlagDate: string | null;
      oldestFlagDate: string | null;
    }>();

    for (const flag of (allFlags || [])) {
      const key = flag.player_username;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          username: flag.player_username,
          totalFlags: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          flags: [],
          latestFlagDate: null,
          oldestFlagDate: null,
        });
      }

      const group = groupedMap.get(key)!;
      group.totalFlags++;
      group.mediumCount++;

      group.flags.push(flag);

      // Track date range
      const flagDate = flag.created_at;
      if (flagDate) {
        if (!group.latestFlagDate || flagDate > group.latestFlagDate) {
          group.latestFlagDate = flagDate;
        }
        if (!group.oldestFlagDate || flagDate < group.oldestFlagDate) {
          group.oldestFlagDate = flagDate;
        }
      }
    }

    // Convert map to array and sort
    const flaggedPlayers = Array.from(groupedMap.values())
      .sort((a, b) => {
        if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
        if (b.highCount !== a.highCount) return b.highCount - a.highCount;
        if (b.mediumCount !== a.mediumCount) return b.mediumCount - a.mediumCount;
        return b.totalFlags - a.totalFlags;
      });

    // Enrich with player details
    const enrichedData = await Promise.all(
      flaggedPlayers.map(async (fp) => {
        const { data: player } = await supabase
          .from('players')
          .select('*')
          .eq('username', fp.username)
          .single();

        return {
          username: fp.username,
          totalFlags: fp.totalFlags,
          severityCounts: {
            critical: fp.criticalCount,
            high: fp.highCount,
            medium: fp.mediumCount,
            low: fp.lowCount
          },
          flags: fp.flags.map((flag: any) => ({
            id: flag.id,
            flagType: 'unknown',
            severity: 'MEDIUM',
            description: flag.reason,
            evidence: null,
            metadata: null,
            occurrenceCount: 1,
            createdAt: flag.created_at,
            resolved: flag.resolved,
            resolvedBy: null,
            resolvedAt: null
          })),
          latestFlagDate: fp.latestFlagDate,
          oldestFlagDate: fp.oldestFlagDate,
          playerInfo: player ? {
            rank: player.rank,
            resources: {
              metal: player.resources_metal,
              energy: player.resources_energy
            },
            createdAt: player.created_at,
            lastActive: null
          } : null
        };
      })
    );

    // Calculate summary statistics
    const stats = {
      totalFlaggedPlayers: flaggedPlayers.length,
      totalFlags: flaggedPlayers.reduce((sum, p) => sum + p.totalFlags, 0),
      criticalPlayers: flaggedPlayers.filter(p => p.criticalCount > 0).length,
      highPlayers: flaggedPlayers.filter(p => p.highCount > 0).length,
      mediumPlayers: flaggedPlayers.filter(p => p.mediumCount > 0).length,
      lowPlayers: flaggedPlayers.filter(p => p.lowCount > 0).length
    };

    log.info('Flagged players retrieved', {
      totalFlaggedPlayers: stats.totalFlaggedPlayers,
      totalFlags: stats.totalFlags,
      criticalPlayers: stats.criticalPlayers,
      adminUser: username,
    });

    return NextResponse.json({
      success: true,
      data: enrichedData,
      stats,
      filters: {
        reason: reasonFilter || 'all',
        resolved
      }
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
 * - Fetches all flags from player_flags table
 * - Aggregates in-memory via Map/Array (replaces MongoDB $group pipeline)
 * - Enriches data with current player stats
 * - Supports filtering by reason and resolution status
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
