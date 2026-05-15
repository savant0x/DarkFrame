/**
 * Admin Bot Leaderboard API
 * Updated: 2026-05-15 — Fixed auth bypass: use requireAdminAuth
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
  const log = createRouteLogger('AdminBotLeaderboardAPI');
  const endTimer = log.time('bot-leaderboard');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = request.nextUrl;
    const metric = searchParams.get('metric') || 'strength';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    let sortColumn: string;
    switch (metric) {
      case 'resources': sortColumn = 'resources_metal'; break;
      case 'defeats': sortColumn = 'defeated_count'; break;
      case 'reputation': sortColumn = 'reputation'; break;
      default: sortColumn = 'total_strength'; break;
    }

    const supabase = createServiceClient();

    const { data: bots, error } = await supabase
      .from('bots')
      .select('username, tier, specialization, total_strength, total_defense, resources_metal, resources_energy, defeated_count, reputation')
      .order(sortColumn, { ascending: false })
      .limit(limit);

    if (error) throw error;

    const leaderboard = (bots || []).map((bot, index) => ({
      rank: index + 1,
      username: bot.username,
      tier: bot.tier,
      specialization: bot.specialization,
      totalStrength: bot.total_strength,
      totalDefense: bot.total_defense,
      metal: bot.resources_metal,
      energy: bot.resources_energy,
      defeatedCount: bot.defeated_count,
      reputation: bot.reputation,
    }));

    log.info('Bot leaderboard retrieved', { metric, limit, count: leaderboard.length });

    return NextResponse.json({ success: true, leaderboard, metric });
  } catch (error) {
    log.error('Failed to fetch bot leaderboard', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
