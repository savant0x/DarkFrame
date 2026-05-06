/**
 * @file app/api/admin/player-sessions/route.ts
 * @created 2025-10-18
 * @updated 2026-05-03 — Migrated to Supabase
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
  const log = createRouteLogger('admin/player-sessions');
  const endTimer = log.time('get-player-sessions');

  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username parameter required');

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, 'Admin access required (rank 5+)');
    }

    const userId = searchParams.get('userId');
    const limitStr = searchParams.get('limit') || '20';

    if (!userId) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'userId parameter required');
    }

    const limit = Math.min(parseInt(limitStr), 100);

    const { data: player, error } = await supabase
      .from('players')
      .select('username, last_login_date, login_streak')
      .eq('username', userId)
      .single();

    if (error || !player) {
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Player not found');
    }

    const sessions = [{
      userId: player.username,
      startTime: player.last_login_date || new Date().toISOString(),
      endTime: null,
      duration: 0,
      actionsCount: 0,
    }];

    const totalSessions = 1;
    const activeSessions = 1;
    const totalPlayTime = 0;
    const averageDuration = 0;

    log.info('Player sessions retrieved', {
      userId,
      totalSessions,
      activeSessions,
      averageDuration,
    });

    return NextResponse.json({
      success: true,
      sessions,
      totalSessions,
      activeSessions,
      totalPlayTime,
      averageDuration,
    });
  } catch (error) {
    log.error('Failed to fetch player sessions', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
