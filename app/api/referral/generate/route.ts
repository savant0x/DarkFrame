/**
 * @file app/api/referral/generate/route.ts
 * Created: 2025-10-24
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * API endpoint to generate unique referral code for authenticated player.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateReferralCode, generateReferralLink } from '@/lib/referralService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = body.username;
    if (!username) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });

    const supabase = createServiceClient();
    
    const { data: player } = await supabase
      .from('players')
      .select('referral_code, referral_link')
      .eq('username', username)
      .maybeSingle();
    
    if (!player) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
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
      return NextResponse.json({ success: false, error: 'Failed to generate unique referral code' }, { status: 500 });
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
    console.error('[Referral Generate] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
