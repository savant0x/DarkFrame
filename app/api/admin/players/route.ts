/**
 * Admin Player List API — Supabase backend
 * Updated 2026-05-15: Added requireAdminAuth
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async (_req: NextRequest) => {
  const log = createRouteLogger('AdminPlayerListAPI');
  const endTimer = log.time('admin-players');

  try {
    const auth = await requireAdminAuth(_req);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    const { data: players } = await supabase
      .from('players')
      .select('username, level, rank, total_strength, total_defense, resources_metal, resources_energy, research_points, is_admin, is_bot, is_vip, clan_id, created_at, current_x, current_y')
      .order('created_at', { ascending: false })
      .limit(200);

    log.info('Admin players list retrieved', { count: players?.length || 0 });

    return NextResponse.json({
      success: true,
      data: (players || []).map(p => ({
        username: p.username,
        level: p.level || 1,
        rank: p.rank || 1,
        totalStrength: p.total_strength || 0,
        totalDefense: p.total_defense || 0,
        resources: { metal: p.resources_metal || 0, energy: p.resources_energy || 0 },
        researchPoints: p.research_points || 0,
        isAdmin: Boolean(p.is_admin),
        isBot: Boolean(p.is_bot),
        isVip: Boolean(p.is_vip),
        clanId: p.clan_id,
        createdAt: p.created_at,
        current_x: p.current_x,
        current_y: p.current_y,
      })),
    });
  } catch (error) {
    log.error('Admin players error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
