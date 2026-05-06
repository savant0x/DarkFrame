/**
 * POST /api/auth/login — Supabase Auth Login
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { withRequestLogging, createRouteLogger, createRateLimiter, ENDPOINT_RATE_LIMITS, LoginSchema, createErrorResponse, createErrorFromException, createValidationErrorResponse, ErrorCode } from '@/lib';
import type { Database } from '@/types/database';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.login);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AuthLogin');
  const endTimer = log.time('loginProcess');
  try {
    const body = await request.json();
    const validated = LoginSchema.parse(body);
    const { email, password } = validated;

    log.debug('Login attempt', { email });

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({name, value, options}) => cookieStore.set(name, value, options)) } }
    );

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      log.warn('Login failed', { email, error: authError?.message });
      return createErrorResponse(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const username = (authData.user.user_metadata?.username as string) ?? email;

    const { data: player } = await supabase
      .from('players')
      .select('username, is_admin')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      log.warn('Player record not found', { username });
      return createErrorResponse(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    log.info('Login successful', { username });

    // Create player session for online tracking
    const serviceClient = createServiceClient();
    await serviceClient.from('player_sessions').insert({
      player_username: username,
      session_id: `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      started_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, username, email: authData.user.email });
  } catch (error: unknown) {
    if (error instanceof ZodError) return createValidationErrorResponse(error);
    log.error('Login error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
