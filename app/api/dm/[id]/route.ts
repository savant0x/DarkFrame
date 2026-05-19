import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import { ValidationError, NotFoundError, PermissionError } from '@/lib/common/errors';
import type { GetMessagesQuery } from '@/types/directMessage';
import { createRateLimiter, ENDPOINT_RATE_LIMITS, createErrorResponse, ErrorCode, createErrorFromException, getConversationMessages, deleteConversation, logger } from '@/lib';

const getRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const deleteRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const GET = getRateLimiter(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.username;

    const { searchParams } = request.nextUrl;
    const supabase = createServiceClient();
    const { id } = await context.params;
    const conversationId = id;

    const query: GetMessagesQuery = {
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50,
      before: searchParams.get('before') || undefined,
      after: searchParams.get('after') || undefined,
    };

    if (query.limit && (query.limit < 1 || query.limit > 100)) {
      return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, 'limit must be between 1 and 100');
    }

    const result = await getConversationMessages(conversationId, userId, query);

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED);
    }
    if (error instanceof NotFoundError) {
      return createErrorResponse(ErrorCode.NOT_FOUND);
    }
    if (error instanceof PermissionError) {
      return createErrorResponse(ErrorCode.AUTH_FORBIDDEN);
    }
    logger.error('Unexpected error in GET /api/dm/[id]:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});

export const DELETE = deleteRateLimiter(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.username;

    const supabase = createServiceClient();
    const { id } = await context.params;
    const conversationId = id;

    await deleteConversation(conversationId, userId);

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully',
    });

  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED);
    }
    if (error instanceof NotFoundError) {
      return createErrorResponse(ErrorCode.NOT_FOUND);
    }
    if (error instanceof PermissionError) {
      return createErrorResponse(ErrorCode.AUTH_FORBIDDEN);
    }
    logger.error('Unexpected error in DELETE /api/dm/[id]:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
