/**
 * Chat Block User API
 * Tracks blocks via admin_logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter({ maxRequests: 20, windowMs: 60 * 1000, message: 'Too many block attempts. Please wait.' });

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('ChatBlockAPI');
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { targetUsername } = body;

    if (!targetUsername) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'targetUsername is required' });
    }

    if (targetUsername === auth.username) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'You cannot block yourself' });
    }

    const supabase = createServiceClient();

    await supabase.from('admin_logs').insert({
      admin_username: auth.username,
      action: 'CHAT_BLOCK',
      target: targetUsername,
      details: { blockedAt: new Date().toISOString() },
    });

    log.info('User blocked', { blocker: auth.username, blocked: targetUsername });
    return NextResponse.json({ success: true, message: `Blocked ${targetUsername}` });
  } catch (error) {
    log.error('Error blocking user', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));
