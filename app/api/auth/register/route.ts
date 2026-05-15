/**
 * POST /api/auth/register — Supabase Auth Registration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateReferralCode, createReferralRecord, generateReferralCode, generateReferralLink, checkForAbuse } from '@/lib/referralService';
import { withRequestLogging, createRouteLogger, createRateLimiter, ENDPOINT_RATE_LIMITS, RegisterSchema, createErrorResponse, createErrorFromException, createValidationErrorResponse, ErrorCode } from '@/lib';
import { ZodError } from 'zod';
import type { TablesInsert } from '@/types/database';

type PlayerInsert = TablesInsert<'players'>;

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.register);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AuthRegister');
  const endTimer = log.time('registerProcess');
  try {
    const body = await request.json();
    const validated = RegisterSchema.parse(body);
    const { username, email, password } = validated;
    const referralCode: string | null = body.referralCode ?? null;

    log.debug('Registration attempt', { username, email });

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    let referrerUsername: string | null = null;
    if (referralCode) {
      const codeValidation = await validateReferralCode(referralCode);
      if (!codeValidation.valid) {
        return NextResponse.json({ success: false, error: `Invalid referral code: ${codeValidation.error}` }, { status: 400 });
      }
      const abuseCheck = await checkForAbuse(email, ip, referralCode);
      if (!abuseCheck.allowed) {
        return NextResponse.json({ success: false, error: abuseCheck.reason }, { status: 403 });
      }
      referrerUsername = codeValidation.referrerUsername || null;
    }

    const supabase = createServiceClient();

    const { data: existingPlayer } = await supabase
      .from('players')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (existingPlayer) {
      return NextResponse.json({ success: false, error: 'Username already taken' }, { status: 409 });
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (authError) {
      log.error('Supabase auth signup failed', authError);
      return NextResponse.json({ success: false, error: 'Registration failed. Please try again or contact support.' }, { status: 400 });
    }

    let newPlayerCode = generateReferralCode();
    const { data: existingCode } = await supabase
      .from('players')
      .select('username')
      .eq('referral_code', newPlayerCode)
      .maybeSingle();
    if (existingCode) {
      newPlayerCode = generateReferralCode() + Math.random().toString(36).substring(2, 4).toUpperCase();
    }

    const newPlayerLink = generateReferralLink(newPlayerCode);

    const playerInsert: PlayerInsert = {
      username,
      email,
      password: 'supabase_auth',
      referral_code: newPlayerCode,
      referral_link: newPlayerLink,
      signup_ip: ip,
      referred_by: referralCode,
      referred_by_username: referrerUsername,
    };

    const { error: playerError } = await supabase
      .from('players')
      .insert(playerInsert);

    if (playerError) {
      log.error('Failed to create player record', playerError);
      return NextResponse.json({ success: false, error: 'Failed to create player' }, { status: 500 });
    }

    if (referralCode && authData.user) {
      try {
        await createReferralRecord(referralCode, { username, email }, ip);
      } catch (refError) {
        log.error('Referral tracking error', refError as Error);
      }
    }

    log.info('User registered', { username });

    return NextResponse.json({
      success: true,
      message: 'Registration successful. Please check your email to confirm your account.',
      user: authData.user ? { id: authData.user.id, email: authData.user.email } : null,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Registration error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
