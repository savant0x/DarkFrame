/**
 * @file app/api/admin/active-sessions/route.ts
 * @created 2025-10-18
 * @updated 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
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
  const log = createRouteLogger('AdminActiveSessionsAPI');
  const endTimer = log.time('fetch-active-sessions');

  try {
    const { searchParams } = request.nextUrl;
    const username = searchParams.get('username');
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username parameter required');

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    const { data: players, error } = await supabase
      .from('players')
      .select('username, last_login_date')
      .not('last_login_date', 'is', null)
      .order('last_login_date', { ascending: false })
      .limit(1000);

    if (error) throw error;

    const now = Date.now();
    const sessions = (players || []).map(player => {
      const lastLogin = player.last_login_date ? new Date(player.last_login_date).getTime() : 0;
      const currentDuration = Math.floor(Math.max(0, now - lastLogin) / 1000);
      return {
        userId: player.username,
        startTime: player.last_login_date,
        endTime: null,
        actionsCount: 0,
        duration: currentDuration,
        currentDuration,
      };
    });

    const totalActive = sessions.length;
    const longestSession = sessions.length > 0
      ? Math.max(...sessions.map(s => s.currentDuration))
      : 0;
    const totalActions = 0;
    const averageDuration = sessions.length > 0
      ? Math.floor(sessions.reduce((sum, s) => sum + s.currentDuration, 0) / sessions.length)
      : 0;

    const abusiveSessions = sessions.filter(s => s.currentDuration > 14 * 60 * 60);

    log.info('Active sessions fetched successfully', {
      totalActive,
      longestSessionHours: Math.floor(longestSession / 3600),
      abusiveCount: abusiveSessions.length,
      adminUser: username,
    });

    return NextResponse.json({
      success: true,
      sessions,
      totalActive,
      longestSession,
      totalActions,
      averageDuration,
      abusiveSessions: abusiveSessions.map(s => ({
        userId: s.userId,
        duration: s.currentDuration,
        hours: Math.floor(s.currentDuration / 3600),
      })),
    });
  } catch (error) {
    log.error('Failed to fetch active sessions', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
