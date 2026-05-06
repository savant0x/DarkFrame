/**
 * Stripe Checkout Session Creation API
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe';
import { VIPTier, isValidVIPTier } from '@/types/stripe.types';
import { ErrorCode } from '@/lib/errors/codes';
import { logger } from '@/lib/logger/productionLogger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = body.username;
    if (!username) return NextResponse.json({ success: false, message: 'Username required' }, { status: 400 });
    const { tier } = body;
    
    const supabase = createServiceClient();
    const { data: player } = await supabase
      .from('players')
      .select('username, is_vip, vip_expiration, email, stripe_customer_id')
      .eq('username', username)
      .maybeSingle();
    
    if (!player) {
      return NextResponse.json({ success: false, message: 'Player not found' }, { status: 404 });
    }

    if (!tier || !isValidVIPTier(tier)) {
      logger.warn('Invalid VIP tier selected for checkout', {
        playerId: player.username,
        tier,
      });
      
      return NextResponse.json({
        success: false,
        message: 'Invalid VIP tier selected. Please choose a valid subscription option.',
      }, { status: 400 });
    }
    
    if (player.is_vip && player.vip_expiration && new Date(player.vip_expiration) > new Date()) {
      logger.info('Player with active VIP attempted to purchase', {
        playerId: player.username,
        currentExpiration: player.vip_expiration,
      });
      
      return NextResponse.json({
        success: false,
        message: 'You already have an active VIP subscription. Please wait until it expires or contact support to upgrade.',
      }, { status: 400 });
    }
    
    const result = await createCheckoutSession({
      userId: player.username,
      username: player.username,
      email: player.email || username,
      tier: tier as VIPTier,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/game/vip-upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/game/vip-upgrade/cancel`,
    });
    
    if (!result.success) {
      logger.error('Stripe checkout session creation failed', undefined, {
        playerId: player.username,
        tier,
        errorMessage: result.message,
      });
      
      return NextResponse.json({
        success: false,
        message: result.message || 'Failed to create checkout session. Please try again.',
      }, { status: 500 });
    }
    
    logger.info('Checkout session created successfully', {
      playerId: player.username,
      tier,
      sessionId: result.sessionId,
    });
    
    return NextResponse.json({ success: true, sessionId: result.sessionId, url: result.url });
    
  } catch (error) {
    logger.error('Unexpected error in checkout session creation', error instanceof Error ? error : undefined, {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred. Please try again later.',
    }, { status: 500 });
  }
}
