/**
 * @file app/api/admin/rp-economy/stats/route.ts
 * @created 2025-10-20
 * @overview API endpoint for RP economy statistics
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

/**
 * GET /api/admin/rp-economy/stats
 * Returns overall RP economy statistics
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/rp-economy/stats');
  const endTimer = log.time('get-rp-economy-stats');

  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username parameter required');

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }

    // Fetch all players — only columns that exist in the players table
    const { data: players, error } = await supabase
      .from('players')
      .select('research_points, is_vip, vip_expiration');

    if (error) {
      throw error;
    }

    if (!players || players.length === 0) {
      return NextResponse.json({
        totalRP: 0,
        totalGenerated: 0,
        totalSpent: 0,
        dailyGeneration: 0,
        activeEarners24h: 0,
        averageBalance: 0,
        medianBalance: 0,
        vipPlayers: 0,
      });
    }

    const totalRP = players.reduce((sum, p) => sum + (p.research_points || 0), 0);

    const now = new Date();
    const vipPlayers = players.filter(
      (p) => p.is_vip && p.vip_expiration && new Date(p.vip_expiration) > now
    ).length;

    // Calculate average and median balance from research_points
    const balances = players
      .map((p) => p.research_points || 0)
      .sort((a, b) => a - b);

    const averageBalance = Math.round(totalRP / players.length);
    const medianBalance =
      balances.length > 0 ? balances[Math.floor(balances.length / 2)] : 0;

    log.info('RP economy stats retrieved', {
      totalRP,
      dailyGeneration: 0,
      activeEarners24h: 0,
      vipPlayers,
    });

    return NextResponse.json({
      totalRP,
      totalGenerated: 0,
      totalSpent: 0,
      dailyGeneration: 0,
      activeEarners24h: 0,
      averageBalance,
      medianBalance,
      vipPlayers,
    });

  } catch (error) {
    log.error('Failed to fetch RP economy stats', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
