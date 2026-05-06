/**
 * GET /api/auth/session — Validate Supabase session and return username
 * Used by GameContext to restore session on page load.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withRequestLogging, createRouteLogger, createRateLimiter, ENDPOINT_RATE_LIMITS } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('SessionValidationAPI');
  const endTimer = log.time('validate-session');

  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const username = (user.user_metadata?.username as string) ?? user.email!;

    return NextResponse.json({ success: true, username });
  } catch (error) {
    log.error('Session validation failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false }, { status: 401 });
  } finally {
    endTimer();
  }
}));
