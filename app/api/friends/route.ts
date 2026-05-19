import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { getFriends, sendFriendRequest } from '@/lib/friendService';
import { ValidationError, NotFoundError, PermissionError } from '@/lib/common/errors';
import {
  withRequestLogging,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  logger,
} from '@/lib';

const getRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const GET = withRequestLogging(getRateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const friends = await getFriends(username);

    return NextResponse.json({ success: true, friends });

  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED);
    }
    logger.error('Unexpected error in GET /api/friends:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));

export const POST = withRequestLogging(postRateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const senderId = auth.playerId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Invalid JSON in request body');
    }

    if (!body || typeof body !== 'object') {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Request body must be an object');
    }

    const { recipientId, recipientUsername, message } = body as Record<string, unknown>;

    const targetIdentifier =
      (typeof recipientId === 'string' && recipientId.trim()) ||
      (typeof recipientUsername === 'string' && recipientUsername.trim()) ||
      '';

    if (!targetIdentifier) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'recipientId or recipientUsername is required');
    }

    if (message !== undefined && typeof message !== 'string') {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'message must be a string if provided');
    }

    if (typeof message === 'string' && message.length > 200) {
      return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, 'message must be 200 characters or fewer');
    }

    const friendRequest = await sendFriendRequest(senderId, targetIdentifier, message as string | undefined);

    return NextResponse.json({ success: true, request: friendRequest }, { status: 201 });

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
    logger.error('Unexpected error in POST /api/friends:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));
