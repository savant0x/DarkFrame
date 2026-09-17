/**
 * Stripe Webhook Handler (route = transport only)
 *
 * OVERVIEW:
 * Receives and processes webhook events from Stripe for automated VIP management.
 * FID-20260917-009: ALL event semantics live in lib/stripe/webhookHandlers.ts —
 * Next.js route modules may only export HTTP verbs (the generated route-type
 * check enforces `[x: string]: never` on extra exports), and moving the handlers
 * to lib/ makes them directly importable for behavioral pins. This module keeps
 * signature verification and dispatch; failed mutations thrown by handlers
 * propagate to the outer catch → 500 → Stripe retries with backoff.
 *
 * WEBHOOK EVENTS HANDLED:
 * - checkout.session.completed: New purchase, grant VIP
 * - customer.subscription.updated: Renewal or plan change
 * - customer.subscription.deleted: Cancellation, revoke VIP
 * - invoice.payment_succeeded: Recurring payment success
 * - invoice.payment_failed: Recurring payment failure
 *
 * SECURITY:
 * - Stripe signature verification (HMAC SHA-256)
 * - Raw body parsing required for signature validation
 * - Webhook secret from environment variables
 * - Rejects invalid signatures with 400 status
 *
 * Created: 2025-10-24
 * Feature: FID-20251024-STRIPE
 * Remediation: FID-20260917-009 (handlers → lib; false-success contract)
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { verifyWebhookSignature } from '@/lib/stripe/stripeService';
import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
} from '@/lib/stripe/webhookHandlers';
import { logger } from '@/lib/logger/productionLogger';

/**
 * POST handler for Stripe webhook events
 *
 * Receives webhook events from Stripe, verifies signatures, and dispatches
 * to lib/stripe/webhookHandlers. Any error thrown by a handler (including
 * the FID-20260917-009 failed-grant/refusal throws) surfaces as 500 so
 * Stripe retries the delivery.
 *
 * @param request - Next.js request with raw webhook payload
 * @returns Response with 200 (success), 400 (invalid), or 500 (error)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get raw body for signature verification
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      logger.error('Webhook signature missing', undefined, {
        headers: Object.fromEntries(headersList.entries())
      });
      return NextResponse.json(
        { success: false, message: 'Webhook signature missing' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event | null;
    try {
      event = verifyWebhookSignature(body, signature);
      if (!event) {
        throw new Error('Webhook verification returned null');
      }
    } catch (err) {
      logger.error('Webhook signature verification failed', err instanceof Error ? err : undefined, {
        signature: signature.substring(0, 20) + '...',
        bodyLength: body.length
      });
      return NextResponse.json(
        { success: false, message: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    logger.info('Webhook event received', {
      type: event.type,
      id: event.id,
      created: event.created
    });

    // Process event based on type (semantics in lib/stripe/webhookHandlers.ts)
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event);
        break;

      default:
        logger.info('Unhandled webhook event type', { type: event.type });
    }

    const processingTime = Date.now() - startTime;
    logger.info('Webhook processed successfully', {
      type: event.type,
      processingTime: `${processingTime}ms`
    });

    return NextResponse.json({ received: true });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Webhook processing error', error instanceof Error ? error : undefined, {
      processingTime: `${processingTime}ms`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { success: false, message: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
