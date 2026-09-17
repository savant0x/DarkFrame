# AUDIT — Stripe VIP × players.mongoId: the grant path is broken for 100% of players

**Date:** 2026-09-17 (session 050) · **Trigger:** operator question — "is the
mongoId mapping actually populated for pg-era players, and are VIP grants
silently failing for new accounts?" · **Method:** every mongoId use in
`lib/stripe/subscriptionService.ts` read at line level; both Stripe callers
traced; live DB cohort probes against the dev database.

## 1. Verdict

**The mapping is not populated — it is NULL for every player in the database.**
Cohort probe (66 players): `with_mongoid: 0 · mongoid_eq_username: 0 ·
mongoid_null: 66`. Nothing in the codebase writes `mongo_id` post-pivot
(registration doesn't set it; the write-side grep is empty); no backfill ever
ran.

**Consequence: `grantVIP` can never succeed for any player.** All four money
functions key their lookups on `eq(players.mongoId, params.userId)`:
`grantVIP` (:93, :123), `revokeVIP` (:173), `extendVIP` (:211, :233),
`checkVIPStatus` (:377 aliases `id` from mongoId, :420). Since `mongo_id` is
NULL for everyone, `player` is always undefined → `grantVIP` returns `false`.

## 2. The failure modes, per caller (traced, not assumed)

Checkout metadata embeds **`userId: player.username`**
(`create-checkout-session/route.ts:147`) — so the lookup is `mongo_id = '<username>'`,
false for 100% of rows.

- **`verify-session` (self-described "primary VIP activation method"):**
  `vipGranted=false` → logs error, returns **500 "Failed to activate VIP" to the
  customer who just paid**. Loud, but the payment is already captured — the
  customer sees an error and has no VIP.
- **`webhook` (backup/verification):** takes `result` from `grantVIP` and then
  **logs "VIP granted successfully" with `vipGranted: result` and proceeds** to
  `recordPaymentTransaction` — i.e. the false return is **not treated as
  failure**. Stripe receives 200, marks the event delivered, never retries.
  **This is the silent failure the operator asked about:** money captured, VIP
  never granted, no error anywhere, ledger shows a successful transaction.

## 3. Live-state corroboration

- `paymentTransactions`: **0 rows** — no Stripe checkout has ever completed in
  this environment, which is why the defect has no incident history yet. It is
  a loaded trap, not a past loss (in dev).
- The one `vip=1` player (`fame`, expires 2027-09-11, `vip_tier` NULL, no
  Stripe IDs) is fully explained by `mod_log`: `VIP_GRANT` by `fame` on
  2026-09-11 via the **admin endpoint** (`admin/vip/grant`), which — correctly —
  looks up by **username** and writes only `vip/vipExpiration`. The admin and
  referral VIP paths are healthy; only the Stripe path is dead.

## 4. Remediation (proposed FID; payment-path risk)

**Recommended — delete the indirection, don't backfill it:** checkout already
puts `username` in metadata; change all four functions' lookups from
`eq(players.mongoId, …)` to `eq(players.username, …)` (and `checkVIPStatus`'s
`id` alias off mongoId). Zero data backfill, no new invariants, the phantom
column exits the payment path entirely — consistent with Cluster D's end state.
Reject the alternative (backfill `_id = username` + set it at registration) as
perpetuating a fiction.

**Regardless of mapping choice — fix the webhook false-success:** treat
`vipGranted=false` as an error (log + non-2xx so Stripe retries) instead of
logging success and recording the transaction. Add pins: grantVIP against a
real-shaped row (`mongo_id` NULL, username match) grants; webhook refuses on
false.

**Urgency reframe for Cluster D:** this was queued as "legacy cleanup, after
the Stripe mapping sub-FID". The sub-FID is now proven to be **the only thing
standing between every future paying customer and a silent loss** — it should
jump the queue ahead of Clusters B/C.

## 5. Provenance

- Cohort + holder probes: `mongo_id` column (drizzle attr `mongoId`, physical
  name `_id`) — the first probe's `column "mongo_id" does not exist` error was
  itself evidence of the attr/column naming trap.
- Code: subscriptionService lines cited above; webhook :197-215;
  verify-session :142-166; create-checkout-session :147; admin grant :30-75;
  referralService :583 (healthy comparator).
