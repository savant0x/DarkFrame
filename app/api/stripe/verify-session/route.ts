/**
 * Stripe Session Verification & VIP Activation API
 * 
 * OVERVIEW:
 * Verifies a Stripe checkout session and immediately grants VIP if payment succeeded.
 * Called from success page to provide instant VIP activation without waiting for webhooks.
 * This is the primary VIP activation method - webhooks serve as backup/verification.
 * 
 * BUSINESS LOGIC:
 * 1. Retrieve checkout session from Stripe
 * 2. Verify payment_status === 'paid'
 * 3. Extract user metadata (userId, username, tier)
 * 4. Grant VIP immediately with grantVIP()
 * 5. Record payment transaction
 * 6. Return success with VIP details
 * 
 * WHY THIS APPROACH:
 * - Webhooks can be delayed or fail in development
 * - Users expect instant VIP activation after payment
 * - Session verification is authoritative (direct from Stripe)
 * - Idempotent: safe to call multiple times
 * 
 * Created: 2025-10-24
 * Feature: FID-20251024-STRIPE-VIP-ACTIVATION
 * Author: ECHO v5.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { retrieveCheckoutSession } from '@/lib/stripe/stripeService';
import { grantVIP, recordPaymentTransaction } from '@/lib/stripe/subscriptionService';
import { VIPTier } from '@/types/stripe.types';
import { logger } from '@/lib/logger/productionLogger';

/**
 * POST /api/stripe/verify-session
 * 
 * Verifies a checkout session and activates VIP immediately if payment succeeded.
 * 
 * @param {object} request.body - Request body
 * @param {string} request.body.sessionId - Stripe checkout session ID
 * @returns {object} Success status with VIP details or error message
 * 
 * @example
 * POST /api/stripe/verify-session
 * { "sessionId": "cs_test_..." }
 * 
 * Response:
 * {
 *   "success": true,
 *   "vipActivated": true,
 *   "tier": "basic",
 *   "expiresAt": "2025-11-24T..."
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // FID-20260904-005 §5.1: this route ACTIVATES VIP for whoever the checkout metadata
    // names — it must never run without a session, and the session user must BE the
    // checkout's buyer (otherwise any authenticated user could activate someone else's
    // VIP, or an anonymous caller could probe arbitrary session IDs).
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { sessionId } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'Session ID required' },
        { status: 400 }
      );
    }
    
    logger.info('Verifying checkout session', { sessionId });
    
    // Retrieve session from Stripe
    const session = await retrieveCheckoutSession(sessionId);
    
    if (!session) {
      logger.error('Failed to retrieve checkout session', undefined, { sessionId });
      return NextResponse.json(
        { success: false, message: 'Invalid session ID' },
        { status: 404 }
      );
    }
    
    // Verify payment succeeded
    if (session.payment_status !== 'paid') {
      logger.warn('Session payment not completed', {
        sessionId,
        paymentStatus: session.payment_status
      });
      return NextResponse.json(
        { 
          success: false, 
          message: 'Payment not completed',
          paymentStatus: session.payment_status
        },
        { status: 400 }
      );
    }
    
    // Extract metadata + verify the buyer matches the session user (identity binding).
    const userId = session.metadata?.userId;
    const username = session.metadata?.username;
    const tier = session.metadata?.tier as VIPTier;
    
    if (username !== authUser.username) {
      logger.warn('Checkout session buyer does not match session user', { sessionId, sessionUser: username, authUser: authUser.username });
      return NextResponse.json(
        { success: false, message: 'Checkout session does not belong to this account' },
        { status: 403 }
      );
    }
    
    if (!userId || !username || !tier) {
      logger.error('Session missing required metadata', undefined, {
        sessionId,
        hasUserId: !!userId,
        hasUsername: !!username,
        hasTier: !!tier
      });
      return NextResponse.json(
        { success: false, message: 'Invalid session metadata' },
        { status: 400 }
      );
    }
    
    logger.info('Session verified, granting VIP', {
      sessionId,
      userId,
      username,
      tier
    });
    
    // Grant VIP immediately
    const vipGranted = await grantVIP({
      userId,
      tier,
      stripeCustomerId: session.customer as string || '',
      stripeSubscriptionId: session.subscription as string || ''
    });
    
    if (!vipGranted) {
      logger.error('Failed to grant VIP', undefined, {
        sessionId,
        userId,
        tier
      });
      return NextResponse.json(
        { success: false, message: 'Failed to activate VIP' },
        { status: 500 }
      );
    }
    
    logger.info('VIP granted successfully', {
      sessionId,
      userId,
      username,
      tier
    });
    
    // Record payment transaction
    await recordPaymentTransaction({
      userId,
      username,
      tier,
      amount: session.amount_total || 0,
      stripeSessionId: session.id,
      stripeCustomerId: session.customer as string || '',
      stripeSubscriptionId: session.subscription as string || '',
      status: 'completed'
    });
    
    logger.info('Payment transaction recorded', {
      sessionId,
      userId,
      amount: session.amount_total
    });
    
    return NextResponse.json({
      success: true,
      vipActivated: true,
      tier,
      message: 'VIP activated successfully'
    });
    
  } catch (error) {
    logger.error('Session verification failed', error instanceof Error ? error : undefined, {
      error: 'Unable to complete the request. Please try again.'
    });
    
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Verification failed' 
      },
      { status: 500 }
    );
  }
}

/* ============================================================================
 * IMPLEMENTATION NOTES
 * ============================================================================
 * 
 * ACTIVATION STRATEGY:
 * - Success page calls this endpoint immediately after redirect
 * - Direct session verification is authoritative (not relying on webhooks)
 * - Webhooks still process as backup for redundancy
 * - Idempotent: grantVIP checks if user already has active VIP
 * 
 * ERROR HANDLING:
 * - Invalid session ID: 404 (user may have manipulated URL)
 * - Unpaid session: 400 (payment didn't complete)
 * - Missing metadata: 400 (checkout session created incorrectly)
 * - Database errors: 500 (logged for investigation)
 * 
 * SECURITY:
 * - Session verification happens server-side via Stripe API
 * - Cannot be spoofed (requires valid Stripe session ID)
 * - All VIP grants logged for audit trail
 * - Metadata validated before VIP activation
 * 
 * PERFORMANCE:
 * - Single Stripe API call + 2 database operations
 * - Typically completes in < 500ms
 * - Success page can poll this endpoint if initial call fails
 */
