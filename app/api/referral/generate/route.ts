import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  requireAuth,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  generateReferralCode,
  generateReferralLink,
  logger,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const POST = rateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const username = auth.username;

    const supabase = createServiceClient();

    const { data: player } = await supabase
      .from('players')
      .select('referral_code, referral_link')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      return createErrorResponse(ErrorCode.NOT_FOUND, 'Player not found');
    }

    if (player.referral_code) {
      return NextResponse.json({
        success: true,
        data: {
          code: player.referral_code,
          link: player.referral_link || generateReferralLink(player.referral_code)
        }
      });
    }

    let code = generateReferralCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from('players')
        .select('username')
        .eq('referral_code', code)
        .maybeSingle();
      if (!existing) break;
      code = generateReferralCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to generate unique referral code');
    }

    const link = generateReferralLink(code);

    await supabase
      .from('players')
      .update({
        referral_code: code,
        referral_link: link,
      })
      .eq('username', username);

    return NextResponse.json({
      success: true,
      data: { code, link }
    });
  } catch (error) {
    logger.error('[Referral Generate] Error:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
