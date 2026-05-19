import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import { getActivityLogStats, getActionCountForPeriod } from '@/lib/activityLogService';
import { getBattleLogStats, getPlayerCombatStatistics } from '@/lib/battleLogService';
import { createErrorResponse, createErrorFromException, ErrorCode, createRateLimiter, ENDPOINT_RATE_LIMITS, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (req: NextRequest) => {
  try {
    const auth = await requireAdminAuth(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = req.nextUrl;

    const type = searchParams.get('type') || 'activity';
    const playerId = searchParams.get('playerId') || undefined;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    switch (type) {
      case 'activity': {
        const stats = await getActivityLogStats({
          startDate,
          endDate
        });

        const actionsLast1Hour = await getActionCountForPeriod(1);
        const actionsLast24Hours = await getActionCountForPeriod(24);
        const actionsLast7Days = await getActionCountForPeriod(24 * 7);

        return NextResponse.json({
          success: true,
          type: 'activity',
          stats,
          periodStats: {
            last1Hour: actionsLast1Hour,
            last24Hours: actionsLast24Hours,
            last7Days: actionsLast7Days,
            actionsPerHour: actionsLast24Hours / 24,
            actionsPerDay: actionsLast7Days / 7
          },
          dateRange: { startDate, endDate }
        });
      }

      case 'battle': {
        const stats = await getBattleLogStats({
          startDate,
          endDate
        });

        return NextResponse.json({
          success: true,
          type: 'battle',
          stats,
          dateRange: { startDate, endDate }
        });
      }

      case 'player': {
        if (!playerId) {
          return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'playerId parameter required for player statistics');
        }

        if (!playerId) {
          return createErrorResponse(ErrorCode.AUTH_FORBIDDEN, 'Forbidden: Can only view your own statistics');
        }

        const activityStats = await getActivityLogStats({
          playerId,
          startDate,
          endDate
        });

        const combatStats = await getPlayerCombatStatistics(playerId);

        return NextResponse.json({
          success: true,
          type: 'player',
          playerId,
          stats: {
            activity: activityStats,
            combat: combatStats
          },
          dateRange: { startDate, endDate }
        });
      }

      default: {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, `Invalid type parameter: ${type}. Must be 'activity', 'battle', or 'player'`);
      }
    }
  } catch (error) {
    logger.error('[API] Error retrieving log statistics:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
