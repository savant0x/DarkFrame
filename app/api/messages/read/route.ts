import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { markMessagesAsRead } from '@/lib/messagingService';
import { createRateLimiter, ENDPOINT_RATE_LIMITS, createErrorResponse, ErrorCode, createErrorFromException, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const POST = rateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const playerId = auth.playerId;

    const body = await request.json();
    const { conversationId, messageIds } = body;

    if (!conversationId) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'conversationId is required');
    }

    const result = await markMessagesAsRead(
      conversationId,
      playerId,
      messageIds
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in POST /api/messages/read:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
