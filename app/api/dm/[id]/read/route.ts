import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import { ValidationError, NotFoundError, PermissionError } from '@/lib/common/errors';
import type { MarkReadRequest } from '@/types/directMessage';
import { createRateLimiter, ENDPOINT_RATE_LIMITS, createErrorResponse, ErrorCode, createErrorFromException, markMessageRead, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const PATCH = rateLimiter(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.username;
    const body = await request.json().catch(() => ({}));

    const supabase = createServiceClient();
    const { id } = await context.params;
    const conversationId = id;

    const markReadRequest: MarkReadRequest = {
      conversationId,
    };

    const { messageIds } = body as Record<string, unknown>;

    if (messageIds !== undefined) {
      if (!Array.isArray(messageIds)) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'messageIds must be an array');
      }

      if (!messageIds.every((id: unknown) => typeof id === 'string')) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'All messageIds must be strings');
      }

      markReadRequest.messageIds = messageIds as string[];
    }

    const result = await markMessageRead(userId, markReadRequest);

    return NextResponse.json({
      success: true,
      markedCount: result.markedCount,
      newUnreadCount: result.newUnreadCount,
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
    logger.error('Unexpected error in PATCH /api/dm/[id]/read:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
