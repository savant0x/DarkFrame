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
import { requireAdminAuth } from '@/lib/authMiddleware';
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
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { username } = await context.params;
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username required');

    const supabase = createServiceClient();

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
