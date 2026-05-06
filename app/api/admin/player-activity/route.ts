/**
 * @file app/api/admin/player-activity/route.ts
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
  const log = createRouteLogger('admin/player-activity');
  const endTimer = log.time('get-player-activity');

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
    const limitStr = searchParams.get('limit') || '50';
    const pageStr = searchParams.get('page') || '1';
    const actionFilter = searchParams.get('action');
    const hoursAgoStr = searchParams.get('hoursAgo');

    if (!userId) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'userId parameter required');
    }

    const limit = Math.min(parseInt(limitStr), 500);
    const page = Math.max(parseInt(pageStr), 1);

    let query = supabase
      .from('player_rp_history')
      .select('*', { count: 'exact' })
      .eq('player_username', userId)
      .order('created_at', { ascending: false });

    if (hoursAgoStr) {
      const hoursAgo = parseInt(hoursAgoStr);
      const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', cutoffTime);
    }

    const start = (page - 1) * limit;
    query = query.range(start, start + limit - 1);

    const { data: activities, count: totalCount, error } = await query;

    if (error) throw error;

    const totalPages = Math.ceil((totalCount || 0) / limit);

    log.info('Player activity retrieved', {
      userId,
      totalCount: totalCount || 0,
      page,
      totalPages,
      actionFilter: actionFilter || 'all',
    });

    return NextResponse.json({
      success: true,
      activities: (activities || []).map(a => ({
        userId: a.player_username,
        action: a.reason,
        timestamp: a.created_at,
        metadata: { amount: a.amount, balance: a.balance },
        _id: a.id,
      })),
      totalCount: totalCount || 0,
      page,
      totalPages,
      limit,
    });
  } catch (error) {
    log.error('Failed to fetch player activity', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
