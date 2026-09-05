-- Migration 0012: paymentTransactions backing table (FID-20260904-005 Phase 4)
--
-- lib/stripe/subscriptionService.ts writes payment records with raw SQL
-- (recordPaymentTransaction :294) and reads them (getUserPaymentHistory :342),
-- but the table never existed — every Stripe payment record silently failed.
-- Columns derived EXACTLY from the INSERT statement + PaymentTransaction type
-- (types/stripe.types.ts). Quoted identifier is preserved because both call
-- sites use the camelCase name verbatim.

CREATE TABLE IF NOT EXISTS "paymentTransactions" (
  id serial PRIMARY KEY,
  "userId" varchar(24) NOT NULL,
  username varchar(20) NOT NULL,
  "stripeCustomerId" varchar(255) NOT NULL,
  "stripeSessionId" varchar(255),
  "stripeSubscriptionId" varchar(255),
  "stripePriceId" varchar(255) NOT NULL,
  amount integer NOT NULL,
  tier varchar(20) NOT NULL,
  status varchar(20) NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "completedAt" timestamptz,
  "refundedAt" timestamptz,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS paymenttransactions_userid_created_idx
  ON "paymentTransactions" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS paymenttransactions_created_idx
  ON "paymentTransactions" ("createdAt" DESC);
