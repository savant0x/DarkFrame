/**
 * Admin Factories Endpoint — Supabase backend
 * Updated 2026-05-15: Fixed auth bypass, added pagination
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
  const log = createRouteLogger('AdminFactoriesAPI');
  const endTimer = log.time('admin-factories');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = (page - 1) * limit;

    const supabase = createServiceClient();

    const { data: factories, count } = await supabase
      .from('factories')
      .select('*', { count: 'exact' })
      .order('x', { ascending: true })
      .range(offset, offset + limit - 1);

    log.info('Admin factories list retrieved', { count: factories?.length || 0, page, limit });

    return NextResponse.json({
      success: true,
      factories: (factories || []).map(f => ({
        id: f.id,
        x: f.x,
        y: f.y,
        owner: f.owner || null,
        defense: f.defense || 0,
        slots: f.slots || 0,
        used_slots: f.used_slots || 0,
        level: f.level || 1,
        production_rate: f.production_rate || 0,
      })),
      pagination: { page, limit, total: count || 0 },
    });
  } catch (error) {
    log.error('Admin factories error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
