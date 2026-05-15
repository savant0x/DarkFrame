/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2026-05-15 — Fixed auth bypass: use requireAdminAuth; proper types
 * 🎯 OVERVIEW:
 * Flagged Players Admin Endpoint
 * 
 * GET /api/admin/flagged-players
 * Rate Limited: 500 req/min (admin dashboard)
 * - Returns all players with active anti-cheat flags
 * - Supports filtering by reason and resolution status
 * - Admin-only access
 * - Includes flag details and occurrence counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import type { Database } from '@/types/database';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

type PlayerFlag = Database['public']['Tables']['player_flags']['Row'];
type PlayerRow = Database['public']['Tables']['players']['Row'];

interface FlagGroup {
  username: string;
  totalFlags: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  flags: PlayerFlag[];
  latestFlagDate: string | null;
  oldestFlagDate: string | null;
}

interface FlagResponse {
  id: string;
  flagType: string;
  severity: string;
  description: string;
  evidence: null;
  metadata: null;
  occurrenceCount: number;
  createdAt: string;
  resolved: boolean;
  resolvedBy: null;
  resolvedAt: null;
}

interface EnrichedPlayerData {
  username: string;
  totalFlags: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  flags: FlagResponse[];
  latestFlagDate: string | null;
  oldestFlagDate: string | null;
  playerInfo: {
    rank: number | null;
    resources: {
      metal: number | null;
      energy: number | null;
    };
    createdAt: string | null;
    lastActive: null;
  } | null;
}

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminFlaggedPlayersAPI');
  const endTimer = log.time('flagged-players');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const reasonFilter = searchParams.get('reason');
    const resolved = searchParams.get('resolved') === 'true';

    const supabase = createServiceClient();

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

    const groupedMap = new Map<string, FlagGroup>();

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

    const flaggedPlayers = Array.from(groupedMap.values())
      .sort((a, b) => {
        if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
        if (b.highCount !== a.highCount) return b.highCount - a.highCount;
        if (b.mediumCount !== a.mediumCount) return b.mediumCount - a.mediumCount;
        return b.totalFlags - a.totalFlags;
      });

    const enrichedData: EnrichedPlayerData[] = await Promise.all(
      flaggedPlayers.map(async (fp): Promise<EnrichedPlayerData> => {
        const { data: player } = await supabase
          .from('players')
          .select('*')
          .eq('username', fp.username)
          .single();

        const flags: FlagResponse[] = fp.flags.map((flag): FlagResponse => ({
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
          resolvedAt: null,
        }));

        const playerInfo = player ? {
          rank: player.rank,
          resources: {
            metal: player.resources_metal,
            energy: player.resources_energy,
          },
          createdAt: player.created_at,
          lastActive: null,
        } : null;

        return {
          username: fp.username,
          totalFlags: fp.totalFlags,
          severityCounts: {
            critical: fp.criticalCount,
            high: fp.highCount,
            medium: fp.mediumCount,
            low: fp.lowCount,
          },
          flags,
          latestFlagDate: fp.latestFlagDate,
          oldestFlagDate: fp.oldestFlagDate,
          playerInfo,
        };
      }),
    );

    const stats = {
      totalFlaggedPlayers: flaggedPlayers.length,
      totalFlags: flaggedPlayers.reduce((sum, p) => sum + p.totalFlags, 0),
      criticalPlayers: flaggedPlayers.filter(p => p.criticalCount > 0).length,
      highPlayers: flaggedPlayers.filter(p => p.highCount > 0).length,
      mediumPlayers: flaggedPlayers.filter(p => p.mediumCount > 0).length,
      lowPlayers: flaggedPlayers.filter(p => p.lowCount > 0).length,
    };

    log.info('Flagged players retrieved', {
      totalFlaggedPlayers: stats.totalFlaggedPlayers,
      totalFlags: stats.totalFlags,
      criticalPlayers: stats.criticalPlayers,
      adminUser: auth.username,
    });

    return NextResponse.json({
      success: true,
      data: enrichedData,
      stats,
      filters: {
        reason: reasonFilter || 'all',
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
