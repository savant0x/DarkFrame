import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  requireAuth,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  logger,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    if (!query) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Search query parameter "q" is required');
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, `Search query must be at least ${2} character(s)`);
    }

    if (trimmedQuery.length > 50) {
      return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, `Search query must not exceed ${50} characters`);
    }

    const supabase = createServiceClient();

    const { data: players } = await supabase
      .from('players')
      .select('username, level, is_vip, clan_name')
      .ilike('username', `%${trimmedQuery}%`)
      .neq('username', username)
      .order('level', { ascending: false })
      .limit(20);

    const results = (players || []).map(player => ({
      _id: player.username,
      username: player.username,
      level: player.level || 1,
      vip: player.is_vip || false,
      clanTag: player.clan_name || undefined,
    }));

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    logger.error('[API] Player search error:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
