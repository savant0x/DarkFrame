/**
 * @file app/api/referral/validate/route.ts
 * Created: 2025-10-24
 * 
 * OVERVIEW:
 * Validate referral code during signup process.
 * This is called BEFORE account creation to check if code exists and is valid.
 * 
 * ENDPOINTS:
 * GET /api/referral/validate?code=DF-XXXXXXXX
 *   - Returns: { valid, referrerUsername, error? }
 *   - Public endpoint (no auth required - called during registration)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateReferralCode } from '@/lib/referralService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json({
        success: false,
        error: 'Referral code is required'
      }, { status: 400 });
    }
    
    const validation = await validateReferralCode(code);
    
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: validation.error
      }, { status: 200 }); // 200 but valid=false
    }
    
    return NextResponse.json({
      success: true,
      valid: true,
      referrerUsername: validation.referrerUsername,
      code: validation.code
    });
  } catch (error) {
    console.error('[Referral Validate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
