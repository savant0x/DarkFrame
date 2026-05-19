import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { getMessageHistory, sendDirectMessage } from '@/lib/messagingService';
import { createRateLimiter, ENDPOINT_RATE_LIMITS, createErrorResponse, ErrorCode, createErrorFromException, logger } from '@/lib';

const getRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const GET = getRateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const playerId = auth.playerId;

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const limit = searchParams.get('limit');
    const before = searchParams.get('before');
    const after = searchParams.get('after');

    if (!conversationId) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'conversationId is required');
    }

    const result = await getMessageHistory({
      conversationId,
      limit: limit ? parseInt(limit) : undefined,
      before: before ? new Date(before) : undefined,
      after: after ? new Date(after) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in GET /api/messages:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});

export const POST = postRateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const senderId = auth.playerId;

    const body = await request.json();
    const { recipientId, content, contentType } = body;

    if (!recipientId || !content) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'recipientId and content are required');
    }

    const result = await sendDirectMessage(senderId, {
      recipientId,
      content,
      contentType,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error in POST /api/messages:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
