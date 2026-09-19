# FID-20260919-010 — RP packages checkout: real Stripe one-time payments on the shop page

**Status:** `closed (2026-09-19, commit 89cc34b)`
**Session:** 2026-09-19 (065)
**Origin:** Operator directive: "File and implement the RP packages checkout FID:
real Stripe checkout sessions on the shop page, reusing the fixed VIP grant-path
plumbing, with pins and a live webhook-style probe."

## 1. Ground truth

1. **The dead button.** `app/shop/rp-packages/page.tsx:122` — every Purchase button
   sets a "🚧 Stripe integration pending" placeholder. The only "does nothing"
   button a paying player can reach (survey refresh 2, item #1).
2. **The VIP plumbing is real and was fixed by FID-20260917-009:**
   - `createCheckoutSession` (lib/stripe/stripeService.ts:114) — subscription mode,
     dashboard Price IDs, username embedded as `metadata.userId` (the keying fix).
   - `handleCheckoutCompleted` (lib/stripe/webhookHandlers.ts:29) — the honest
     contract: a FAILED grant THROWS (→ 500 → Stripe retries) and the payment
     transaction is NOT recorded; grant-before-ledger ordering.
   - `grantVIP` (subscriptionService.ts:74) — username-keyed, false on 0 rows.
   - `recordPaymentTransaction` (subscriptionService.ts:277) — raw-SQL insert into
     `paymentTransactions`; `stripeSessionId` is stored per row (dedupe key exists).
3. **The gap:** that path is subscription-only. RP packages are ONE-TIME purchases
   with no Stripe Price objects. Creating dashboard prices would add an
   out-of-repo dependency; `mode: 'payment'` with inline `price_data` keeps the
   amount authored by the server from a repo-owned package map.

## 2. Design

- **Single-source package map** (lib/stripe/rpPackages.ts): the five shop packages
  (id/name/rp/priceCents). The shop page imports the same map — client display and
  server charging can never disagree; the client sends only `packageId`.
- **New route `POST /api/stripe/rp-checkout`**: auth → username-keyed player lookup
  → validate packageId against the map → `createRpCheckoutSession` (stripeService):
  `mode: 'payment'`, inline `price_data` (unit_amount = server's cents), metadata
  `{ kind: 'rp_package', userId: username, username, packageId, rp }`, success URL
  back to `/shop/rp-packages?status=success`. Response `{ success, sessionId, url }`;
  the client redirects. No client-supplied amount exists in the API surface
  (RP-amount injection blocked by construction).
- **Webhook branch**: `handleCheckoutCompleted` dispatches on `metadata.kind`:
  `rp_package` → RP flow; absent → the existing VIP flow (unchanged, pinned guard).
  RP flow (same false-success law as FID-20260917-009):
  1. Idempotency: a prior `paymentTransactions` row with the same `stripeSessionId`
     and an `rp:` tier means this event was already processed → return (200, no
     double grant). Stripe redelivers; we must not double-credit.
  2. Resolve rp from the server map by packageId (unknown id → throw; the metadata
     `rp` value is informational only).
  3. `grantRpPackage(username, rp)` — UPDATE researchPoints + rp WHERE username;
     0 rows → false → THROW (→ 500 → Stripe retries), no ledger row.
  4. Record the transaction ONLY after a confirmed grant, tier `rp:<packageId>`.
- **Client honesty**: handlePurchase POSTs packageId; res.ok → redirect to the
  Stripe URL; otherwise the server's message surfaces (no false success).

## 3. Scope

lib/stripe/rpPackages.ts (new); createRpCheckoutSession + grantRpPackage +
hasRpTransactionForSession; webhookHandlers RP branch; /api/stripe/rp-checkout;
shop page wiring; pins; live webhook-style probe. VIP route untouched.

## 4. Acceptance

- Shop Purchase creates a real checkout session (server-owned amount) and redirects.
- Signed webhook-style replay: grant lands exactly once; replay is a no-op;
  failed grant throws with no ledger row.
- Pins for: session contract (mode/price_data/metadata/success URL), RP branch
  dispatch, idempotent replay, false-grant throw, grant-before-ledger, VIP-path
  guard. Live probe: real route + real signature verification + real DB.

## 8. Closure (2026-09-19)

- **Shipped:** lib/stripe/rpPackages (single-source map: 5 packages, id/rp/priceCents — the shop page's display list is a compile-time mirror of it, the client sends only packageId, no client-owned number exists in the surface); createRpCheckoutSession (mode 'payment', inline price_data from the map, metadata kind/userId/username/packageId/rp, success back to /shop/rp-packages); POST /api/stripe/rp-checkout (auth → username-keyed player lookup → map validation → session); webhook RP branch (idempotency probe on stripeSessionId → server-map RP resolution → username-keyed grantRpPackage → grant-before-ledger with tier rp:<packageId>); recordPaymentTransaction widened (tier: VIPTier | string, optional stripePriceId for non-dashboard-price rows); shop page real handler (redirect on success, server message surfaced on failure).
- **Pins:** 15 across two files — rpCheckout (map invariants, one-time session contract incl. server-owned unit_amount, metadata rp-is-informational, throw-on-false grant, grant-before-ledger, idempotent replay, unknown-packageId throw, VIP dispatch guard) + rpGrantKeying (real service + mocked db handle per the stripeVipKeying pattern: username keying, 0-row → false, probe-failure → not-processed).
- **Live probe:** 11/11 (scripts/e2eRpCheckoutLive.ts vs tsx server.ts:3003) — P1 real Stripe TEST-MODE session created through the real route (cs_test_…, checkout.stripe.com URL); P2 signed webhook event (real STRIPE_WEBHOOK_SECRET verification) → RP granted exactly the server-map value while metadata lied (999999999), one ledger row tier rp:boost amount 999; P3 replay → 200, no double credit, still one row; P4 nonexistent player → 500 (Stripe would retry), no ledger row; P5 legacy VIP event (tier, no kind) → VIP path intact, vip=1 tier=MONTHLY.
- **Gates at close:** suite 1215/1215 green (+15), tsc 0, eslint clean (all touched files).
- **Production note (recorded honestly):** the webhook endpoint must receive Stripe's real event deliveries (STRIPE_WEBHOOK_SECRET is configured; the probe proved signature verification + grant end to end in test mode). Going live needs only live-mode keys in env.
