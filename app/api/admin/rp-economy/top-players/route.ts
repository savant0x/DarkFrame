/**
 * @file app/api/admin/rp-economy/top-players/route.ts
 * @created 2025-10-20
 * @updated 2026-05-15 — Fixed auth bypass: use requireAdminAuth
 * @overview API endpoint for top RP earners and spenders
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

/**
 * GET /api/admin/rp-economy/top-players
 * Returns top RP earners and spenders
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/rp-economy/top-players');
  const endTimer = log.time('get-top-players');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    const supabase = createServiceClient();

    const { data: players } = await supabase
      .from('players')
      .select('username, research_points')
      .order('research_points', { ascending: false })
      .limit(limit);

    log.info('Top players retrieved', {
      playerCount: players?.length || 0,
    });

    return NextResponse.json({
      success: true,
      topPlayers: (players || []).map((p, i) => ({
        rank: i + 1,
        username: p.username,
        researchPoints: p.research_points || 0,
      })),
    });

  } catch (error) {
    log.error('Failed to fetch top players', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
