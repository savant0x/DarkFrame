/**
 * @file app/api/admin/player-sessions/route.ts
 * @created 2025-10-18
 * @updated 2026-05-15 — Fixed auth bypass: use requireAdminAuth
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

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/player-sessions');
  const endTimer = log.time('get-player-sessions');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    if (!userId) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'userId parameter required');
    }

    const limitStr = searchParams.get('limit') || '20';
    const limit = Math.min(parseInt(limitStr), 100);

    const supabase = createServiceClient();

    const { data: player, error } = await supabase
      .from('players')
      .select('username, last_login_date, login_streak')
      .eq('username', userId)
      .single();

    if (error || !player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    const sessions = [{
      userId: player.username,
      startTime: player.last_login_date || new Date().toISOString(),
      endTime: null,
      duration: 0,
      actionsCount: 0,
    }];

    log.info('Player sessions retrieved', {
      userId,
      totalSessions: 1,
      activeSessions: 1,
    });

    return NextResponse.json({
      success: true,
      sessions,
      totalSessions: 1,
      activeSessions: 1,
      totalPlayTime: 0,
      averageDuration: 0,
    });
  } catch (error) {
    log.error('Failed to fetch player sessions', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
