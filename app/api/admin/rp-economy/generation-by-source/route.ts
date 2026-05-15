/**
 * @file app/api/admin/rp-economy/generation-by-source/route.ts
 * @created 2025-10-20
 * @updated 2026-05-15 — Fixed auth bypass: use requireAdminAuth
 * @overview API endpoint for RP generation breakdown by source
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
 * GET /api/admin/rp-economy/generation-by-source
 * Returns RP generation breakdown by source type
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/rp-economy/generation-by-source');
  const endTimer = log.time('get-generation-by-source');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7d';

    const supabase = createServiceClient();

    const { data: players } = await supabase
      .from('players')
      .select('username, research_points');

    const totalRP = (players || []).reduce((sum: number, p: { research_points: number | null }) => sum + (p.research_points || 0), 0);

    log.info('RP generation by source retrieved', {
      totalRP,
      playerCount: players?.length || 0,
      period,
    });

    return NextResponse.json({
      success: true,
      totalRP,
      playerCount: players?.length || 0,
      period,
    });

  } catch (error) {
    log.error('Failed to fetch generation by source', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
