/**
 * Admin Moderation Dashboard API
 * Returns all moderation data: active bans, admin logs for moderation actions.
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

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminModerationAPI');
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    const [bansRes, logsRes] = await Promise.all([
      supabase.from('players').select('username, is_banned').eq('is_banned', true).limit(100),
      supabase.from('admin_logs').select('*').in('action', ['MUTE', 'UNMUTE', 'BAN', 'UNBAN', 'BLACKLIST_ADD', 'BLACKLIST_REMOVE']).order('created_at', { ascending: false }).limit(100),
    ]);

    return NextResponse.json({
      success: true,
      mutes: [],
      bans: bansRes.data || [],
      blacklist: [],
      logs: logsRes.data || [],
    });
  } catch (error) {
    log.error('Error fetching moderation data', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));
