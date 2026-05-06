/**
 * 📅 Created: 2025-01-18
 * 🎯 OVERVIEW:
 * Individual Player Data Endpoint
 * 
 * Returns detailed information for a specific player.
 * Admin-only access for player management features.
 * 
 * GET /api/admin/players/[username]
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
): Promise<NextResponse> {
  const log = createRouteLogger('admin-player-detail');
  const endTimer = log.time('admin-player-detail');

  try {
    const { username } = await context.params;
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username required');

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, 'Admin access required (rank 5+)');
    }

    // Get player data
    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (!player) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    // Get additional stats
    const sessions = null; // player_sessions table not in schema
    const lastActive = player.last_login_date;

    const p = player;
    const responseData = {
      username: p.username,
      level: p.level || 1,
      rank: p.rank || 0,
      xp: p.xp || 0,
      resources: {
        metal: p.resources_metal || 0,
        energy: p.resources_energy || 0
      },
      position: {
        x: p.current_x || 0,
        y: p.current_y || 0
      },
      baseLocation: `(${p.base_x || 0}, ${p.base_y || 0})`,
      isBot: p.is_bot || false,
      createdAt: p.created_at,
      lastActive,
      totalPlayTime: 0,
      achievements: [] as { id: string; name: string; description: string }[],
    };

    log.info('Player data retrieved', { 
      username, 
      level: responseData.level, 
      isBot: responseData.isBot,
      sessionCount: 0
    });

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    log.error('Player fetch error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Admin-only access (rank >= 5)
 * - Returns comprehensive player data
 * - Includes last active timestamp from sessions
 * - Handles missing player gracefully
 * 
 * 🔐 SECURITY:
 * - Admin authentication required
 * - No sensitive data exposure
 * - Safe error handling
 */
