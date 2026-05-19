import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  acceptRequest,
  declineRequest,
  removeFriend,
  logger,
} from '@/lib';
import { ValidationError, PermissionError, NotFoundError } from '@/lib/common/errors';

const patchRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);
const deleteRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const PATCH = patchRateLimiter(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Invalid JSON in request body');
    }

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.username;

    if (!body || typeof body !== 'object') {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Request body must be an object');
    }

    const { action } = body as Record<string, unknown>;

    if (!action || typeof action !== 'string') {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'action is required and must be a string');
    }

    if (action !== 'accept' && action !== 'decline') {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'action must be either "accept" or "decline"');
    }

    const { id } = await context.params;

    if (action === 'accept') {
      const friendship = await acceptRequest(userId, id);
      return NextResponse.json({ success: true, friendship });
    } else {
      const declinedRequest = await declineRequest(userId, id);
      return NextResponse.json({ success: true, request: declinedRequest });
    }

  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED);
    }
    if (error instanceof PermissionError) {
      return createErrorResponse(ErrorCode.AUTH_FORBIDDEN);
    }
    if (error instanceof NotFoundError) {
      return createErrorResponse(ErrorCode.NOT_FOUND);
    }
    logger.error('Unexpected error in PATCH /api/friends/[id]:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});

export const DELETE = deleteRateLimiter(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const body = await request.json();
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.username;
    const { id } = await context.params;

    await removeFriend(userId, id);

    return NextResponse.json({ success: true });

  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED);
    }
    if (error instanceof NotFoundError) {
      return createErrorResponse(ErrorCode.NOT_FOUND);
    }
    logger.error('Unexpected error in DELETE /api/friends/[id]:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
