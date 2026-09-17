/**
 * FID — dependency-modernization smoke (batch 5 gate): Stripe SDK v22.
 *
 * Creates a real checkout-session in Stripe TEST mode using the pinned
 * apiVersion '2026-08-26.dahlia' from lib/stripe/stripeService.ts, then
 * GETs it back. Proves: SDK 22 constructs, the pinned API version is
 * accepted by the live API, request/response shapes still compile-fit
 * at runtime. No webhooks fired, no charges possible (test key, session
 * never completed).
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import Stripe from 'stripe';

function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('STRIPE_SECRET_KEY missing');
    process.exit(1);
  }
  if (!key.startsWith('sk_test')) {
    console.error('refusing: not a test key');
    process.exit(1);
  }

  const stripe = new Stripe(key, {
    apiVersion: '2026-08-26.dahlia',
  } as Stripe.StripeConfig);

  stripe.checkout.sessions
    .create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 100,
            product_data: { name: 'reconciliation smoke (never completed)' },
          },
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:3000/?smoke=ok',
      cancel_url: 'http://localhost:3000/?smoke=cancel',
    })
    .then(async (session) => {
      console.log(`created: ${session.id} status=${session.status}`);
      const got = await stripe.checkout.sessions.retrieve(session.id);
      if (got.id !== session.id) throw new Error('round-trip mismatch');
      console.log(`retrieved: ${got.id} payment_status=${got.payment_status}`);
      console.log('STRIPE-SMOKE-PASS');
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error('STRIPE-SMOKE-FAIL:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}

main();
