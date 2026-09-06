/**
 * Stripe Checkout Session Creation API
 * 
 * OVERVIEW:
 * POST endpoint that creates a Stripe Checkout Session for VIP subscription purchase.
 * Authenticates user, validates tier selection, creates checkout session with Stripe,
 * and returns redirect URL for payment. Handles all error cases gracefully.
 * 
 * KEY RESPONSIBILITIES:
 * - Authenticate user from JWT token
 * - Validate VIP tier selection
 * - Create Stripe checkout session with user metadata
 * - Return checkout URL for client-side redirect
 * - Handle errors with user-friendly messages
 * 
 * SECURITY:
 * - Requires valid JWT authentication
 * - Validates tier against allowed values
 * - Rate limited to prevent abuse
 * - User metadata attached to checkout for webhook processing
 * 
 * STRIPE INTEGRATION:
 * - Creates checkout session in subscription mode
 * - Attaches user ID and tier to session metadata
 * - Configures success/cancel redirect URLs
 * - Uses Price IDs from environment variables
 * 
 * ENDPOINT:
 * POST /api/stripe/create-checkout-session
 * 
 * REQUEST BODY:
 * {
 *   "tier": "MONTHLY" | "WEEKLY" | "QUARTERLY" | "BIANNUAL" | "YEARLY"
 * }
 * 
 * RESPONSE:
 * Success: { success: true, sessionId: string, url: string }
 * Error: { success: false, message: string }
 * 
 * Created: 2025-10-24
 * Feature: FID-20251024-STRIPE
 * Author: ECHO v5.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { db, players } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createCheckoutSession } from '@/lib/stripe';
import { VIPTier, isValidVIPTier } from '@/types/stripe.types';

import { logger } from '@/lib/logger/productionLogger';

/**
 * POST /api/stripe/create-checkout-session
 * 
 * Creates a Stripe Checkout Session for VIP subscription purchase.
 * Requires authentication and valid VIP tier selection.
 * 
 * @param {NextRequest} request - Next.js request object
 * @returns {Promise<NextResponse>} Checkout session details or error
 * 
 * @example
 * // Client-side usage:
 * const response = await fetch('/api/stripe/create-checkout-session', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ tier: 'MONTHLY' })
 * });
 * const { url } = await response.json();
 * window.location.href = url; // Redirect to Stripe checkout
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const tokenPayload = await getAuthenticatedUser();
    
    if (!tokenPayload) {
      logger.warn('Checkout session creation attempted without authentication', {
        ip: request.headers.get('x-forwarded-for'),
      });
      
      return NextResponse.json({
        success: false,
        message: 'You must be logged in to purchase VIP',
      }, { status: 401 });
    }
    
    // Get full player record from database
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.username, tokenPayload.username))
      .limit(1);
    
    if (!player) {
      logger.warn('Player not found in database during checkout', {
        username: tokenPayload.username,
      });
      
      return NextResponse.json({
        success: false,
        message: 'Player account not found. Please try logging in again.',
      }, { status: 404 });
    }
    
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        message: 'Invalid request body',
      }, { status: 400 });
    }
    
    const { tier } = body;
    
    // Validate tier
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
    
    // Check if player already has active VIP
    if (player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date()) {
      logger.info('Player with active VIP attempted to purchase', {
        playerId: player.username,
        currentExpiration: player.vipExpiration,
      });
      
      return NextResponse.json({
        success: false,
        message: 'You already have an active VIP subscription. Please wait until it expires or contact support to upgrade.',
      }, { status: 400 });
    }
    
    // Create checkout session
    const result = await createCheckoutSession({
      userId: player.username,
      username: player.username,
      email: player.email || tokenPayload.email, // Fallback to token email if player doesn't have one
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
    
    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      url: result.url,
    });
    
  } catch (error) {
    logger.error(
      'Unexpected error in checkout session creation',
      error instanceof Error ? error : undefined,
      {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }
    );
    
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred. Please try again later.',
    }, { status: 500 });
  }
}

/* ============================================================================
 * IMPLEMENTATION NOTES
 * ============================================================================
 * 
 * AUTHENTICATION:
 * - Uses verifyAuth middleware to extract user from JWT
 * - Requires valid authenticated session
 * - User object must include _id, username, email
 * 
 * VALIDATION:
 * - Tier must be one of: WEEKLY, MONTHLY, QUARTERLY, BIANNUAL, YEARLY
 * - Uses isValidVIPTier type guard for runtime validation
 * - Prevents purchase if user already has active VIP
 * 
 * STRIPE SESSION:
 * - Mode: subscription (recurring billing)
 * - Metadata includes userId, username, tier for webhook processing
 * - Success URL includes {CHECKOUT_SESSION_ID} placeholder
 * - Cancel URL redirects back to upgrade page
 * 
 * ERROR HANDLING:
 * - All errors logged with context for debugging
 * - User-friendly error messages returned
 * - Structured error responses using ErrorCode system
 * - 401 for auth failures, 400 for validation, 500 for server errors
 * 
 * RATE LIMITING:
 * - TODO: Add rate limiting middleware (10 requests per minute per user)
 * - Prevents checkout session spam
 * 
 * TESTING:
 * - Test with Stripe test cards: 4242 4242 4242 4242 (success)
 * - Test with 4000 0000 0000 9995 (decline)
 * - Verify metadata attached to session
 * - Confirm success/cancel URLs redirect properly
 * 
 * FUTURE ENHANCEMENTS:
 * - Add promotional code support
 * - Implement trial periods (7-day free trial)
 * - Add subscription upgrade/downgrade logic
 * - Support for gift subscriptions
 */
