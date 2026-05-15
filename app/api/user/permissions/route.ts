/**
 * User permissions route
 * Updated: 2026-05-15 — Added auth and rate limiting
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import {
  withRequestLogging,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const targetUsername = request.nextUrl.searchParams.get('username') || auth.playerId;

  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from('players').select('is_admin, rank').eq('username', targetUsername).single();
    return NextResponse.json({
      success: true,
      isAdmin: data?.is_admin || false,
      rank: data?.rank || 0,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}));
