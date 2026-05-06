/**
 * POST /api/auth/logout — Supabase Auth Logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withRequestLogging, createRouteLogger, createRateLimiter, ENDPOINT_RATE_LIMITS, createErrorFromException } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.AUTH);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('LogoutAPI');
  const endTimer = log.time('logout');

  try {
    const supabase = await createServerClient();
    await supabase.auth.signOut();

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    log.error('Logout error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, 'INTERNAL_ERROR' as never);
  } finally {
    endTimer();
  }
}));
