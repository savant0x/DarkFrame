/**
 * @file app/api/admin/rp-economy/generation-by-source/route.ts
 * @created 2025-10-20
 * @overview API endpoint for RP generation breakdown by source
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql, type SQL } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authService';
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
    const adminUser = await getAuthenticatedUser();
    if (!adminUser?.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7d';

    const now = new Date();
    let dateFilter: Date | null = null;
    
    if (period === '24h') {
      dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === '7d') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // FID-20260906-003 S4: pg-dialect rewrite. The Mongo-era version built a
    // MySQL-style 'timestamp >= ?' filter and interpolated it with sql.raw —
    // the ? never binds under drizzle/postgres, so every dated period 500'd.
    // Bound parameters now ride in the sql template (sibling pattern from the
    // transactions route); the table is the lowercase rptransactions (0009).
    const conditions: SQL[] = [sql`amount > 0`];
    if (dateFilter) {
      conditions.push(sql`"timestamp" >= ${dateFilter.toISOString()}`);
    }
    const whereClause = sql` WHERE ${sql.join(conditions, sql` AND `)}`;

    const result = await db.execute(sql`
      SELECT source, SUM(amount) as "totalRP", COUNT(*) as "transactionCount", AVG(amount) as "averageAmount"
      FROM rptransactions${whereClause}
      GROUP BY source
      ORDER BY "totalRP" DESC
    `);

    const resultRows = result as unknown as { rows?: Array<{ source: string; totalRP: string | number; transactionCount: string | number; averageAmount: string | number }> };
    const rows = (resultRows.rows ?? []).map((r) => ({
      source: r.source,
      totalRP: Number(r.totalRP),
      transactionCount: Number(r.transactionCount),
      averageAmount: Number(r.averageAmount),
      players: 0,
    }));
    const totalGeneration = rows.reduce((sum, item) => sum + item.totalRP, 0);

    const sources = rows.map((item) => ({
      source: item.source,
      totalRP: Number(item.totalRP),
      transactionCount: Number(item.transactionCount),
      averageAmount: Math.round(Number(item.averageAmount)),
      percentOfTotal: totalGeneration > 0 ? (Number(item.totalRP) / totalGeneration) * 100 : 0
    }));

    log.info('RP generation by source retrieved', {
      sourceCount: sources.length,
      totalGeneration,
      period,
    });

    return NextResponse.json({ sources });

  } catch (error) {
    log.error('Failed to fetch generation by source', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
