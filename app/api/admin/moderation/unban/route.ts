/**
 * Admin Unban User API
 * Updates player is_banned field and logs to admin_logs.
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
  const log = createRouteLogger('AdminUnbanAPI');
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { targetUsername } = body;

    if (!targetUsername) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'targetUsername is required' });
    }

    const supabase = createServiceClient();

    const { error: updateError } = await supabase
      .from('players')
      .update({ is_banned: false })
      .eq('username', targetUsername);

    if (updateError) {
      log.error('Failed to unban user', updateError);
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, { message: 'Failed to unban user' });
    }

    await supabase.from('admin_logs').insert({
      admin_username: auth.username,
      action: 'UNBAN',
      target: targetUsername,
      details: { unbannedAt: new Date().toISOString() },
    });

    log.info('User unbanned', { admin: auth.username, target: targetUsername });
    return NextResponse.json({ success: true, message: `Unbanned ${targetUsername}` });
  } catch (error) {
    log.error('Error unbanning user', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));
