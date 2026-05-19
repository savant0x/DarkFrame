import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import { queryActivityLogs } from '@/lib/activityLogService';
import { queryBattleLogs, getPlayerCombatStatistics } from '@/lib/battleLogService';
import { createErrorResponse, createErrorFromException, ErrorCode, createRateLimiter, ENDPOINT_RATE_LIMITS, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const auth = await requireAdminAuth(req);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const targetPlayerId = id;

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all';
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (startDateStr) {
      startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid startDate format. Use ISO 8601 format.');
      }
    }
    if (endDateStr) {
      endDate = new Date(endDateStr);
      if (isNaN(endDate.getTime())) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid endDate format. Use ISO 8601 format.');
      }
    }

    if (!['activity', 'battle', 'all'].includes(type)) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid type. Must be "activity", "battle", or "all".');
    }

    const responseData: {
      playerId: string;
      activityLogs?: Record<string, unknown>[];
      activityCount?: number;
      battleLogs?: Record<string, unknown>[];
      battleCount?: number;
      combatStats?: Record<string, unknown>;
      period: {
        startDate?: string;
        endDate?: string;
      };
      pagination: {
        limit: number;
        offset: number;
      };
    } = {
      playerId: targetPlayerId,
      period: {
        startDate: startDateStr || undefined,
        endDate: endDateStr || undefined,
      },
      pagination: {
        limit,
        offset,
      },
    };

    if (type === 'activity' || type === 'all') {
      const activityLogs = await queryActivityLogs({
        playerId: targetPlayerId,
        startDate,
        endDate,
        limit,
        offset,
      });

      responseData.activityLogs = activityLogs;
      responseData.activityCount = activityLogs.length;
    }

    if (type === 'battle' || type === 'all') {
      const battleLogs = await queryBattleLogs({
        playerId: targetPlayerId,
        startDate,
        endDate,
        limit,
        offset,
      });

      responseData.battleLogs = battleLogs;
      responseData.battleCount = battleLogs.length;

      const combatStats = await getPlayerCombatStatistics(targetPlayerId);
      responseData.combatStats = combatStats;
    }

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    logger.error('Error fetching player logs:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
