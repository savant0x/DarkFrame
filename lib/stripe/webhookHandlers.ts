/**
 * Stripe webhook event handlers (FID-20260917-009).
 *
 * LIVES IN lib/ (not the route module): Next.js route files may only export
 * HTTP verbs — exporting handlers from app/api/stripe/webhook/route.ts fails
 * the generated route-type check (index signature `[x: string]: never`). The
 * route keeps transport + signature verification; this module owns semantics.
 *
 * FALSE-SUCCESS CONTRACT (the regression class this FID kills): a FAILED
 * money mutation — grantVIP/revokeVIP returning false (player not found) —
 * MUST throw. The route's outer catch converts that to a 500, Stripe treats
 * non-2xx as undelivered and retries with backoff. The previous code logged
 * "VIP granted successfully" with vipGranted:false and returned 200, so
 * Stripe marked the event delivered and never retried while the customer's
 * payment was captured with no VIP granted.
 */
import Stripe from 'stripe';
import { grantVIP, revokeVIP, recordPaymentTransaction } from '@/lib/stripe/subscriptionService';
import { VIPTier } from '@/types/stripe.types';
import { logger } from '@/lib/logger/productionLogger';

/**
 * Handle checkout.session.completed — the captured-payment path.
 *
 * Grant failure → throws (→ 500 → Stripe retries) and the payment transaction
 * is NOT recorded: the ledger must not contain "completed" rows for VIP that
 * was never granted.
 */
export async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  logger.info('Processing checkout completion', {
    sessionId: session.id,
    customerId: session.customer,
    paymentStatus: session.payment_status
  });

  // Only process if payment was successful
  if (session.payment_status !== 'paid') {
    logger.warn('Checkout session not paid', {
      sessionId: session.id,
      paymentStatus: session.payment_status
    });
    return;
  }

  // Extract metadata
  const userId = session.metadata?.userId;
  const username = session.metadata?.username;
  const tier = session.metadata?.tier as VIPTier;

  if (!userId || !username || !tier) {
    logger.error('Checkout session missing required metadata', undefined, {
      sessionId: session.id,
      hasUserId: !!userId,
      hasUsername: !!username,
      hasTier: !!tier
    });
    throw new Error('Missing required metadata in checkout session');
  }

  try {
    // Grant VIP to user (userId carries the username — FID-20260917-009)
    const result = await grantVIP({
      userId,
      tier,
      stripeCustomerId: session.customer as string || '',
      stripeSubscriptionId: session.subscription as string || ''
    });

    // FID-20260917-009: a false return is a FAILED grant — previously logged
    // as success and recorded the payment anyway (Stripe got 200, never
    // retried). Throwing yields non-2xx → retry; no transaction is recorded
    // for an ungranted VIP.
    if (!result) {
      logger.error('VIP grant FAILED after captured payment — refusing webhook delivery', undefined, {
        userId,
        username,
        tier,
        sessionId: session.id
      });
      throw new Error(`VIP grant failed for ${userId} after checkout ${session.id}`);
    }

    logger.info('VIP granted successfully', {
      userId,
      username,
      tier,
      vipGranted: result,
      sessionId: session.id
    });

    // Record payment transaction (only after a confirmed grant)
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
      userId,
      sessionId: session.id,
      amount: session.amount_total
    });
  } catch (error) {
    logger.error('Failed to grant VIP after payment', error instanceof Error ? error : undefined, {
      userId,
      username,
      tier,
      sessionId: session.id
    });
    throw error;
  }
}

/**
 * Handle customer.subscription.updated — the renewal path.
 *
 * FID-20260917-009: a false grant return previously fell into a catch that
 * logged and swallowed — a failed renewal grant looked like success. The
 * failure now throws (→ 500 → Stripe retries). Retry semantics: extends run
 * from current expiration, so a redelivered event extends again (accepted
 * Stripe-webhook semantics; recorded in the FID's notes).
 */
export async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  logger.info('Processing subscription update', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status
  });

  // Only process active subscriptions
  if (subscription.status !== 'active') {
    logger.info('Subscription not active, skipping', {
      subscriptionId: subscription.id,
      status: subscription.status
    });
    return;
  }

  const userId = subscription.metadata?.userId;
  const tier = subscription.metadata?.tier as VIPTier;

  if (!userId || !tier) {
    logger.warn('Subscription missing metadata', {
      subscriptionId: subscription.id,
      hasUserId: !!userId,
      hasTier: !!tier
    });
    return;
  }

  const extended = await grantVIP({
    userId,
    tier,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id
  });
  if (!extended) {
    logger.error('VIP renewal grant FAILED — refusing webhook delivery', undefined, {
      userId,
      tier,
      subscriptionId: subscription.id
    });
    throw new Error(`VIP renewal grant failed for ${userId} (subscription ${subscription.id})`);
  }

  logger.info('VIP extended for subscription renewal', {
    userId,
    tier,
    subscriptionId: subscription.id
  });
}

/**
 * Handle customer.subscription.deleted — the cancellation path.
 *
 * FID-20260917-009: a false revoke return was previously swallowed, leaving
 * paid VIP active indefinitely after cancellation. Now throws (→ 500 →
 * Stripe retries) so revocation cannot fail silently.
 */
export async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  logger.info('Processing subscription deletion', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status
  });

  const userId = subscription.metadata?.userId;
  const username = subscription.metadata?.username;

  if (!userId) {
    logger.warn('Subscription missing userId metadata', {
      subscriptionId: subscription.id
    });
    return;
  }

  const revoked = await revokeVIP(userId);
  if (!revoked) {
    logger.error('VIP revocation FAILED after cancellation — refusing webhook delivery', undefined, {
      userId,
      username,
      subscriptionId: subscription.id
    });
    throw new Error(`VIP revocation failed for ${userId} (subscription ${subscription.id})`);
  }

  logger.info('VIP revoked after subscription cancellation', {
    userId,
    username,
    subscriptionId: subscription.id
  });
}

/**
 * Handle invoice.payment_succeeded — recurring payment success.
 * VIP is already active from the subscription; transaction recording for
 * renewals rides customer.subscription.updated. Logged for analytics only.
 */
export async function handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  logger.info('Processing successful invoice payment', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amount: invoice.amount_paid
  });

  logger.info('Recurring payment successful - subscription already active', {
    invoiceId: invoice.id,
    amount: invoice.amount_paid
  });
}

/**
 * Handle invoice.payment_failed — recurring payment failure.
 * Stripe retries failed payments automatically; failure surfaced for admin
 * monitoring (Stripe Dashboard).
 */
export async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  logger.error('Invoice payment failed', undefined, {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amount: invoice.amount_due,
    attemptCount: invoice.attempt_count
  });

  logger.warn('Payment failure requires admin attention', {
    invoiceId: invoice.id,
    attemptCount: invoice.attempt_count
  });

  // TODO: Send email notification to user about failed payment
  // TODO: If final attempt and all retries exhausted, schedule VIP revocation
}
