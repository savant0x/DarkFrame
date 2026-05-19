import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { ValidationError } from '@/lib/common/errors';
import { createRateLimiter, ENDPOINT_RATE_LIMITS, createErrorResponse, ErrorCode, createErrorFromException, getPendingRequests, getSentRequests, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.username;

    const [received, sent] = await Promise.all([
      getPendingRequests(userId),
      getSentRequests(userId),
    ]);

    return NextResponse.json({ success: true, received, sent });

  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED);
    }
    logger.error('Unexpected error in GET /api/friends/requests:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
