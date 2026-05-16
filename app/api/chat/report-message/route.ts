/**
 * Chat Message Report API
 * Tracks reports via admin_logs for moderation review.
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

const rateLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60 * 1000, message: 'Too many reports. Please wait.' });

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('ChatReportAPI');
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { messageId, reason } = body;

    if (!messageId) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'messageId is required' });
    }

    const supabase = createServiceClient();

    await supabase.from('admin_logs').insert({
      admin_username: auth.username,
      action: 'CHAT_REPORT',
      target: messageId,
      details: { reason: reason || 'inappropriate_content', reportedAt: new Date().toISOString() },
    });

    log.info('Message reported', { reporter: auth.username, messageId });
    return NextResponse.json({ success: true, message: 'Message reported to moderators' });
  } catch (error) {
    log.error('Error reporting message', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));
