/**
 * @file app/api/admin/rp-economy/transactions/route.ts
 * @created 2025-10-20
 * @updated 2026-05-15 — Fixed auth bypass: use requireAdminAuth
 * @overview API endpoint for RP transaction history
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
 * GET /api/admin/rp-economy/transactions
 * Returns filtered RP transaction history
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/rp-economy/transactions');
  const endTimer = log.time('get-rp-transactions');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const searchParams = request.nextUrl.searchParams;
    const targetUsername = searchParams.get('target');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = (page - 1) * limit;

    const supabase = createServiceClient();

    let query = supabase
      .from('player_rp_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (targetUsername) {
      query = query.eq('player_username', targetUsername);
    }

    const { data: transactions, count, error } = await query;

    if (error) {
      throw error;
    }

    log.info('RP transactions retrieved', {
      transactionCount: transactions?.length || 0,
      targetUsername: targetUsername || 'all',
    });

    return NextResponse.json({
      success: true,
      transactions: transactions || [],
      pagination: { page, limit, total: count || 0 },
    });

  } catch (error) {
    log.error('Failed to fetch RP transactions', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
