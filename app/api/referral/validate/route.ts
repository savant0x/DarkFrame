import { NextRequest, NextResponse } from 'next/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  validateReferralCode,
  logger,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Referral code is required');
    }

    const validation = await validateReferralCode(code);

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: validation.error
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      valid: true,
      referrerUsername: validation.referrerUsername,
      code: validation.code
    });
  } catch (error) {
    logger.error('[Referral Validate] Error:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
