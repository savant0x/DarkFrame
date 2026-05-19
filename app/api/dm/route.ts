import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { ValidationError, NotFoundError } from '@/lib/common/errors';
import type { SendMessageRequest, SendMessageResponse } from '@/types/directMessage';
import { createRateLimiter, ENDPOINT_RATE_LIMITS, createErrorResponse, ErrorCode, createErrorFromException, sendDirectMessage, logger } from '@/lib';

const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);
const getRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const POST = postRateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.playerId;

    const body = await request.json();
    const { recipientId, content } = body as { recipientId: string; content: string };

    if (!recipientId || typeof recipientId !== 'string') {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'recipientId is required and must be a string');
    }

    if (!content || typeof content !== 'string') {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'content is required and must be a string');
    }

    const messageRequest: SendMessageRequest = {
      recipientId,
      content,
    };

    const result = await sendDirectMessage(userId, messageRequest);

    const response: SendMessageResponse = {
      message: result.message,
      conversationId: result.conversationId,
    };

    return NextResponse.json({
      success: true,
      ...response,
    });

  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED);
    }
    if (error instanceof NotFoundError) {
      return createErrorResponse(ErrorCode.NOT_FOUND);
    }
    logger.error('Unexpected error in POST /api/dm:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
