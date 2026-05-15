/**
 * @file app/api/admin/player-activity/route.ts
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
  const log = createRouteLogger('admin/player-activity');
  const endTimer = log.time('get-player-activity');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    if (!userId) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'userId parameter required');
    }

    const limitStr = searchParams.get('limit') || '50';
    const pageStr = searchParams.get('page') || '1';
    const hoursAgoStr = searchParams.get('hoursAgo');

    const limit = Math.min(parseInt(limitStr), 500);
    const page = Math.max(parseInt(pageStr), 1);

    const supabase = createServiceClient();

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
