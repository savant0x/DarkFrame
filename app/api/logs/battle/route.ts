import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import {
  queryBattleLogs
} from '@/lib/battleLogService';
import { BattleType, BattleOutcome } from '@/types/activityLog.types';
import { createErrorResponse, createErrorFromException, ErrorCode, createRateLimiter, ENDPOINT_RATE_LIMITS, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = req.nextUrl;

    const playerId = searchParams.get('playerId') || auth.playerId;
    const battleTypeParam = searchParams.get('battleType');
    const outcomeParam = searchParams.get('outcome');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const tileXParam = searchParams.get('tileX');
    const tileYParam = searchParams.get('tileY');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const battleType = battleTypeParam as BattleType | undefined;

    const outcome = outcomeParam as BattleOutcome | undefined;

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const tileX = tileXParam ? parseInt(tileXParam, 10) : undefined;
    const tileY = tileYParam ? parseInt(tileYParam, 10) : undefined;

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    const battles = await queryBattleLogs({
      playerId,
      battleType,
      outcome,
      startDate,
      endDate,
      tileX,
      tileY,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      battles,
      count: battles.length,
      filters: {
        playerId,
        battleType,
        outcome,
        startDate,
        endDate,
        tileX,
        tileY,
        limit,
        offset
      }
    });
  } catch (error) {
    logger.error('[API] Error querying battle logs:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
