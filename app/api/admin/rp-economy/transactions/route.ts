/**
 * @file app/api/admin/rp-economy/transactions/route.ts
 * @created 2025-10-20
 * @overview API endpoint for RP transaction history
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
 * GET /api/admin/rp-economy/transactions
 * Returns filtered RP transaction history
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/rp-economy/transactions');
  const endTimer = log.time('get-rp-transactions');

  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser?.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7d';
    const source = searchParams.get('source') || 'all';
    const username = searchParams.get('username') || '';

    const now = new Date();
    let dateFilter: Date | null = null;
    
    if (period === '24h') {
      dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === '7d') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // FID-20260904-005 §5.2a: pg-dialect rewrite. The Mongo-era version used MySQL
    // `?` placeholders that never bound under drizzle (500 on every call), and named
    // the CamelCase table. Bound parameters now ride in the sql template; the table
    // is the lowercase `rptransactions` created by migration 0009.
    const conditions: SQL[] = [];

    if (dateFilter) {
      conditions.push(sql`timestamp >= ${dateFilter.toISOString()}`);
    }
    if (source !== 'all') {
      conditions.push(sql`source = ${source}`);
    }
    if (username) {
      conditions.push(sql`playerusername ILIKE ${`%${username}%`}`);
    }

    const whereClause = conditions.length > 0 ? sql` WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const result = await db.execute(sql`
      SELECT * FROM rptransactions${whereClause}
      ORDER BY timestamp DESC
      LIMIT 100
    `);

    // FID-20260904-005 §5.2a: Postgres folds the unquoted identifiers to lower-case,
    // so SELECT * returns lower-case keys — project them back to the API's camelCase.
    const transactions = ((result as any).length > 0 ? (result as any) : []).map((r: Record<string, unknown>) => ({
      ...r,
      playerUsername: r.playerusername ?? r.playerUsername,
      vipBonus: Boolean(r.vipbonus ?? r.vipBonus),
      balanceAfter: r.balanceafter ?? r.balanceAfter,
    }));

    log.info('RP transactions retrieved', {
      transactionCount: transactions.length,
      period,
      source,
      usernameFilter: username || 'none',
    });

    return NextResponse.json({ transactions });

  } catch (error) {
    log.error('Failed to fetch RP transactions', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
