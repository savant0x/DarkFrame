import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { getConversations } from '@/lib/messagingService';
import { createRateLimiter, ENDPOINT_RATE_LIMITS, createErrorFromException, ErrorCode, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const playerId = auth.playerId;

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const includeArchived = searchParams.get('includeArchived');
    const sortBy = searchParams.get('sortBy') as 'recent' | 'unread' | 'pinned' | undefined;

    const result = await getConversations({
      playerId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      includeArchived: includeArchived === 'true',
      sortBy,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in GET /api/messages/conversations:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
