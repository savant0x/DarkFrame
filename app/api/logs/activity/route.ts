import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { queryActivityLogs, getPlayerActivityLogs } from '@/lib/activityLogService';
import { ActionType, ActionCategory } from '@/types/activityLog.types';
import { createErrorResponse, createErrorFromException, ErrorCode, createRateLimiter, ENDPOINT_RATE_LIMITS, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = req.nextUrl;

    const playerId = searchParams.get('playerId') || auth.playerId;
    const username = searchParams.get('username') || auth.username;
    const actionTypeParam = searchParams.get('actionType');
    const categoryParam = searchParams.get('category');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const successParam = searchParams.get('success');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const sortBy = searchParams.get('sortBy') as 'timestamp' | 'executionTimeMs' | null;
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null;

    const effectivePlayerId = playerId || undefined;

    // Authorization: non-admin users can only view their own logs
    if (effectivePlayerId && effectivePlayerId !== auth.playerId && !auth.isAdmin) {
      return createErrorResponse(ErrorCode.AUTH_FORBIDDEN, 'Can only view own logs');
    }

    let actionType: ActionType | ActionType[] | undefined;
    if (actionTypeParam) {
      const types = actionTypeParam.split(',').map(t => t.trim() as ActionType);
      actionType = types.length === 1 ? types[0] : types;
    }

    let category: ActionCategory | ActionCategory[] | undefined;
    if (categoryParam) {
      const categories = categoryParam.split(',').map(c => c.trim() as ActionCategory);
      category = categories.length === 1 ? categories[0] : categories;
    }

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const success = successParam !== null ? successParam === 'true' : undefined;

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    const logs = await queryActivityLogs({
      playerId: effectivePlayerId,
      username,
      actionType,
      category,
      startDate,
      endDate,
      success,
      limit,
      offset,
      sortBy: sortBy || 'timestamp',
      sortOrder: sortOrder || 'desc'
    });

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      filters: {
        playerId: effectivePlayerId,
        username,
        actionType,
        category,
        startDate,
        endDate,
        success,
        limit,
        offset
      }
    });
  } catch (error) {
    logger.error('[API] Error querying activity logs:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
