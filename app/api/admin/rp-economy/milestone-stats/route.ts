/**
 * @file app/api/admin/rp-economy/milestone-stats/route.ts
 * @created 2025-10-20
 * @updated 2026-05-15 — Fixed auth bypass: use requireAdminAuth
 * @overview API endpoint for daily harvest milestone statistics
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
 * GET /api/admin/rp-economy/milestone-stats
 * Returns daily harvest milestone completion statistics
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/rp-economy/milestone-stats');
  const endTimer = log.time('get-milestone-stats');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    const { data: players } = await supabase
      .from('players')
      .select('username, research_points');

    const milestones: Record<string, number> = {};
    for (const p of (players || [])) {
      const rp = p.research_points || 0;
      const tier = rp >= 10000 ? '10k+' : rp >= 5000 ? '5k-9k' : rp >= 1000 ? '1k-4k' : rp >= 100 ? '100-999' : rp > 0 ? '1-99' : '0';
      milestones[tier] = (milestones[tier] || 0) + 1;
    }

    log.info('Milestone stats retrieved', { milestoneCount: Object.keys(milestones).length });

    return NextResponse.json({
      success: true,
      milestones: Object.entries(milestones).map(([tier, count]) => ({ tier, count })),
    });

  } catch (error) {
    log.error('Failed to fetch milestone stats', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
