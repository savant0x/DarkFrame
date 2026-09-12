/**
 * @file app/api/admin/rp-economy/milestone-stats/route.ts
 * @created 2025-10-20
 * @overview API endpoint for daily harvest milestone statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authService';
import { DAILY_HARVEST_MILESTONES } from '@/lib/researchPointService';
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
export const GET = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('admin/rp-economy/milestone-stats');
  const endTimer = log.time('get-milestone-stats');

  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser?.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }

    // FID-20260912-058 Milestones v2: thresholds/amounts read from the
    // service's single table instead of a stale local copy.
    const milestoneThresholds = Object.keys(DAILY_HARVEST_MILESTONES)
      .map(Number)
      .sort((a, b) => a - b);

    const milestones = await Promise.all(
      milestoneThresholds.map(async (threshold) => {
        const result = await db.execute(sql`
          SELECT COUNT(*) as count FROM rpTransactions
          WHERE source = 'harvest_milestone'
            AND JSON_EXTRACT(metadata, '$.threshold') = ${threshold}
        `);

        const completions = (result as unknown as Array<{ count?: number }>)[0]?.count || 0;

        const rpAwarded = completions * DAILY_HARVEST_MILESTONES[threshold];

        const completionRate = completions > 0 ? (completions / Math.max(completions, 1)) * 100 : 0;

        return {
          threshold,
          completions,
          rpAwarded,
          completionRate
        };
      })
    );

    log.info('Milestone stats retrieved', { milestoneCount: milestones.length });

    return NextResponse.json({ milestones });

  } catch (error) {
    log.error('Failed to fetch milestone stats', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
