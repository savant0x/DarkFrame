# FID-20260917-009 — Stripe VIP remediation: username-keyed lookups + webhook false-success fix

**Status:** `loop-complete (filed + implemented same session, queue-jumped on operator directive)`
**Session:** 2026-09-17 (051)
**Origin:** Operator directive following the Stripe×mongoId audit (session 050,
SCOPE row 85) — "File and implement the Stripe VIP remediation FID:
username-keyed lookups, webhook false-success fix, pins — queue-jumped ahead of
the other clusters."

## 1. Goal (the two defects, established by audit)

1. **Dead lookup key.** All four money functions key on
   `eq(players.mongoId, params.userId)`, but the `mongo_id` column is NULL for
   100% of players (66/66, nothing writes it post-pivot), and checkout embeds
   **username** as `userId`. `grantVIP` returns `false` for every customer.
2. **The webhook converts failure into fiction.** On `grantVIP → false` it logs
   "VIP granted successfully" with `vipGranted: false` and records the payment
   transaction anyway — Stripe receives 200 and never retries. Money captured,
   VIP never granted, no error anywhere.

## 2. Loop / design decisions (open questions resolved before implementation)

- **Delete the indirection, don't backfill the fiction.** The audit rejected
  `_id = username` backfill + registration writes: it perpetuates a phantom
  Mongo-era key to preserve a layer that no longer exists. `userId` in every
  signature keeps its name (it *means* "player key"; the callers pass username
  today) but the JSDoc now says `maps to players.username`. mongoId column
  retirement itself stays in Cluster D — this FID only removes it from the
  money path.
- **Failure semantics per site, matched to Stripe's retry model:**
  - `handleCheckoutCompleted` (payment captured): `false` → error log + throw →
    non-2xx → Stripe retries with backoff. **Payment transaction NOT recorded
    while VIP is not granted** — the ledger must not contain "completed" rows
    for ungranted VIP.
  - `handleSubscriptionUpdated` (renewal): `false` → error log + throw (was:
    swallowed). Retry is safe: extend is idempotent-per-delivery-day (extends
    from current expiration; a redelivered event extends again — accepted
    Stripe-webhook semantics, recorded in §7).
  - `handleSubscriptionDeleted` (cancellation): `false` → error log + throw
    (was: swallowed). Revocation failing silently would leave paid VIP active
    after cancellation.
- **`checkVIPStatus` auto-revoke inside a read** stays as-is (pre-existing
  behavior, now actually able to find the player).
- **`getUserByStripeCustomerId`**: the `id` projection was aliased off the NULL
  mongoId with a `row.id || row.username` fallback — now aliased off
  `players.username` directly (the fallback existed precisely because mongoId
  was empty; the alias was lying about which key it returned).

## 3. Implementation (GREEN)

`lib/stripe/subscriptionService.ts`:
- `grantVIP` :93 lookup → `eq(players.username, params.userId)`; :123 update
  where → username; log field `playerId: player.mongoId` → `player.username`.
- `revokeVIP` :173 → username.
- `extendVIP` :211 lookup + :233 update → username.
- `checkVIPStatus` :420 → username.
- `getUserByStripeCustomerId` :377 alias → `id: players.username`.
- JSDoc `@param userId` lines: "(maps to players.username)" ×4.

`app/api/stripe/webhook/route.ts` + `lib/stripe/webhookHandlers.ts`:
- ALL five event handlers moved out of the route module into
  `lib/stripe/webhookHandlers.ts` — Next.js route files may only export HTTP
  verbs (the generated route-type check enforces `[x: string]: never`; the
  first attempt to export `handleCheckoutCompleted` for pins failed tsc with
  TS2344). The route keeps transport + signature verification + dispatch and
  imports the handlers from lib/, where they are directly pin-importable.
- `handleCheckoutCompleted`: on `result === false` → `logger.error` + `throw`
  (skip transaction recording). Success path unchanged.
- `handleSubscriptionUpdated`: capture result, throw on false — **and its
  catch-and-swallow removed**: the old `try { ... } catch { logger.error }`
  would have eaten the new throw and returned 200 anyway. Same for
  `handleSubscriptionDeleted`. The route's outer catch converts handler throws
  to 500 → Stripe retries. (Discovered reading the route for the §8 fix: the
  false-success disease had three sites, not one.)

## 3b. Probe-authored fixes (caught by gates, disclosed)

1. Route-module export TS2344 → handler relocation to lib/ (above).
2. Live probe's clone INSERT died on `email_unique` (fame's email rode along
   verbatim) — and the fix made the probe STRONGER: the clone now strips
   email/referral uniqueness and pins `mongoId: null`, modeling the audited
   pg-era cohort exactly. The lifecycle is proven under the production
   failure condition, not a convenient seed.
3. drizzle version exports `PgColumn`, not `Column` (TS2724 in the pin).

## 4. Pins (13: service ×6, webhook ×5, double-run oracle ×2)

Service layer (real drizzle against the mocked `@/lib/db` handle — asserting
**the WHERE key itself**, not just outcomes):
1. `grantVIP` filters on `username` (and not on the `mongoId` attribute).
2. grant returns false + no update when the player row is missing.
3. `revokeVIP` filters on `username`; row-count 0 → false.
4. `extendVIP` extends from an existing future expiration (Date arithmetic
   pinned) and filters on username.
5. `checkVIPStatus` filters on username; active VIP echoed.
6. `getUserByStripeCustomerId` projects `username` as `id`.

Webhook behavior (service partial-mocked; handlers imported from lib/):
7. checkout grant=false → THROWS and does NOT record the payment transaction
   (the false-success regression pin); grant=true → records exactly one.
8. renewal grant=false → THROWS (previously swallowed by catch).
9. cancellation revoke=false → THROWS (previously swallowed by catch).
10. cancellation revoke=true → resolves, records nothing.
11. (pin 10 doubles as the no-transaction-on-cancellation contract.)

**Double-run oracle** (`stripeCheckoutOracle.test.ts`, ×2) — the
state-level regression replay: real handlers → real service → real drizzle
expressions evaluated by an in-memory db engine that executes the service's
actual WHERE clauses against a seeded player store (fail-closed: any
unprovable expression shape throws, so a money-path query change breaks the
oracle loudly instead of passing vacuously). Proves: the grant LANDS in
state on delivery (vip/tier/Stripe IDs/expiration ≈ now+duration, mongoId
null throughout); a Stripe redelivery leaves the grant landed; a bystander
seeded beside the target is never touched; every captured expression is
username-keyed and mongoId-free; unknown player → throw + empty ledger. The
§7 redelivery caveat (ledger re-recorded) is pinned as documented truth.

## 5. Live probe (real DB, clone-row method)

`scripts/e2eStripeVipKeying.ts` — inserts a disposable clone of `fame`
(`__vipprobe_<ts>`; fame's row has many NOT NULLs, so the driver binds to a
real-shaped row rather than hand-seeding), **with `mongoId: null` and
uniqueness stripped (email, referral) — the clone models the audited pg-era
cohort exactly**, then:
1. `grantVIP({userId: clone})` → true; row shows vip=1 + tier + Stripe IDs +
   expiration ≈ now+duration; **fame untouched** (isolation assertion).
2. `checkVIPStatus(clone)` → isVIP true, tier echo.
3. `extendVIP` → expiration strictly advanced.
4. `revokeVIP` → vip=0, expirations nulled.
5. Clone deleted; **asserting zero residual rows** (probe hygiene).
No real payment data is created; no Stripe network calls.

## 6. Gates

tsc 0 · eslint 0 (6 files) · vitest 1015 passed + 1 skip (was 1004; +11 pins) ·
live probe 5/5 exit 0 (mongoId-NULL clone) · census exit 0 (push gate intact).

## 7. Notes

- Idempotency caveat recorded: Stripe redelivery of a renewal event extends
  expiration twice (pre-existing semantics, unchanged). A dedupe key
  (event.id ledger) is the proper fix if renewal volume ever justifies it.
- Remaining mongoId consumers after this FID: none in lib/stripe. The column's
  other consumers (none found outside schema + Stripe) → Cluster D can now
  drop the column entirely.

## 8. Closure

- **Gates:** — filled at closure on operator go-ahead.
- **Commit hash (G2):** — filled at closure.
- **Post-commit:** FID archived; SCOPE row 86 → Closed; CHANGELOG; VERSION.
