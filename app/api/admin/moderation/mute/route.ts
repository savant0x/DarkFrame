/**
 * Admin Mute/Unmute User API
 * Tracks mute actions via admin_logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminMuteAPI');
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { targetUsername, durationMinutes, reason, action } = body;

    if (!targetUsername) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'targetUsername is required' });
    }

    const supabase = createServiceClient();

    if (action === 'unmute') {
      await supabase.from('admin_logs').insert({
        admin_username: auth.username,
        action: 'UNMUTE',
        target: targetUsername,
        details: { reason: reason || 'Manual unmute', unmutedAt: new Date().toISOString() },
      });
      log.info('User unmuted', { admin: auth.username, target: targetUsername });
      return NextResponse.json({ success: true, message: `Unmuted ${targetUsername}` });
    }

    await supabase.from('admin_logs').insert({
      admin_username: auth.username,
      action: 'MUTE',
      target: targetUsername,
      details: { reason: reason || 'Violation of chat rules', durationMinutes, mutedAt: new Date().toISOString() },
    });

    log.info('User muted', { admin: auth.username, target: targetUsername, durationMinutes });
    return NextResponse.json({ success: true, message: `Muted ${targetUsername}${durationMinutes ? ` for ${durationMinutes} minutes` : ' permanently'}` });
  } catch (error) {
    log.error('Error muting/unmuting user', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));
