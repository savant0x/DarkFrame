import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { ValidationError } from '@/lib/common/errors';
import { createRateLimiter, ENDPOINT_RATE_LIMITS, createErrorResponse, ErrorCode, createErrorFromException, searchUsers, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.username;
    const { searchParams } = request.nextUrl;
    const query = searchParams.get('q');
    const limitParam = searchParams.get('limit');

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Search query parameter "q" is required');
    }

    if (query.length > 50) {
      return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, 'Search query must be 50 characters or fewer');
    }

    let limit = 20;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, 'limit must be a number between 1 and 50');
      }
      limit = parsedLimit;
    }

    const results = await searchUsers(userId, query, limit);

    return NextResponse.json({ success: true, results });

  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED);
    }
    logger.error('Unexpected error in GET /api/friends/search:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
