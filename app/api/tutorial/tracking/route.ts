import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  getActionTracking,
  logger,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const playerId = auth.playerId;

    const { searchParams } = new URL(request.url);
    const stepId = searchParams.get('stepId');

    if (!stepId) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Missing stepId parameter');
    }

    const tracking = await getActionTracking(playerId, stepId);

    if (!tracking) {
      return NextResponse.json({});
    }

    // Access optional coordinate/move tracking fields that may be stored alongside core tracking data
    const trackingWithCoords = tracking as typeof tracking & {
      targetX?: number;
      targetY?: number;
      startX?: number;
      startY?: number;
      moveCount?: number;
    };

    return NextResponse.json({
      targetX: trackingWithCoords.targetX,
      targetY: trackingWithCoords.targetY,
      startX: trackingWithCoords.startX,
      startY: trackingWithCoords.startY,
      moveCount: trackingWithCoords.moveCount,
      currentCount: tracking.currentCount,
    });

  } catch (error) {
    logger.error('Tutorial tracking fetch error:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
