# FID-20260912-062 — B3: Global Daily RP Cap (25k/day Backstop)

**Date:** 2026-09-12 · **Follows:** FID-060 (income audit — B3 proposal), FID-061
(bot-level audit) · **Implements:** FID-060 §5 **B3** as proposed — a global
safety backstop on RP income, all sources.

## Decision

`awardRP()` now clamps total **BASE** RP earned per player per **UTC day** to
**`DAILY_RP_CAP = 25,000`** across every source. Chosen deliberately as a
*backstop*, not a pacing tool:

- The v2 economy's intended best case (FID-058) is **12,900/day** stacked
  (milestones 4,300 × VIP × flag) — the cap sits at ~2× that, so it never
  binds in normal or even heavy intended play. It only fires on the
  unbounded raid loop FID-060 flagged (B1/B2 still pending) or any future
  runaway income source.

## Mechanics (as implemented)

| Property | Behavior |
|---|---|
| Scope | All `awardRP` sources **except `admin`** (operators grant exact amounts) |
| Clamp target | **BASE amount** — clamped first, then VIP ×1.5 and flag-bearer ×2 apply to the granted amount (stacking still rewards, but on what passes) |
| At cap | Award **refused** (`success: false`, message names the cap + reset time) |
| Partial room | Award **clamped** to the remaining envelope |
| Ledger | `rp_daily_totals` (migration 0026): `(playerusername, daykey)` unique, idempotent `ON CONFLICT` upsert, accumulates granted base |
| Day boundary | UTC `YYYY-MM-DD` key (`getRPDayKey()`) — deterministic across server timezones; milestones own the AM/PM gameplay rhythm, the cap is fair-use insurance |
| Fail-open | Ledger read or write failure **never blocks an award** (logs, proceeds) |
| Spend unaffected | Cap throttles income only |
| Audit | `rptransactions.bypasseddailycap = 1` tags admin grants that skipped the cap |
| Callers | Result gains `dailyCapRemaining` (base RP left **after** this award; absent on fail-open/admin) |

## Consistency fix riding along

`checkDailyHarvestMilestone` bookkept `totalRPEarned` as the **configured**
milestone amount regardless of what `awardRP` actually granted — harmless
while awards always succeeded in full, wrong the moment any clamp or failure
intervenes. It now records `awardResult.rpAwarded` (the real granted amount).

## Tests (8, all passing)

`__tests__/lib/rpDailyCap.test.ts` — statement-level `@/lib/db` mock (drizzle
`sql` template renderer, v0.45 `queryChunks` shape):

1. Under-cap award records base earnings in the ledger
2. Partial clamp to the remaining envelope (ledger lands exactly at cap)
3. At-cap refusal — nothing persisted (no balance write, no upsert, no audit row)
4. VIP multiplier applies to the clamped amount, ledger tracks BASE only
5. Admin bypass — no ledger traffic, audit row tagged
6. Fail-open on ledger outage — award succeeds, post-award write still attempted
7. UTC day rollover resets the envelope
8. Cross-source accumulation into one shared envelope (battle + login + milestone)

**The test run caught two real bugs in my first implementation**, both fixed:
the clamp mutated `amount` *after* `finalAmount` was computed (the cap would
have been decorative — the exact failure mode these audits exist to prevent),
and `dailyCapRemaining` was missing from the success return.

## Migration 0026 (applied to live DB)

- `rp_daily_totals` (id, playerusername, daykey, baserpedtoday, updatedat,
  UNIQUE(playerusername, daykey), day index) — lowercase physical names per
  the 0009/0024 unquoted-fold convention.
- `rptransactions.bypasseddailycap` integer default 0.

Verified live: table + column present post-apply. **No live player is anywhere
near the cap** (52 bots don't earn RP; humans' lifetime RP is a small fraction
of 25k), so the cap's live effect today is zero by design.

## Gates

tsc 0 · eslint 0 · vitest **545 passed / 1 skipped** (8 new) · `npm run build`
exit 0 · sim unaffected (12,900 best-case < 25,000 cap — verdicts unchanged).

## Status board (FID-060 §5)

| Proposal | Status |
|---|---|
| B3 global cap | **Shipped (this FID)** |
| B1 battle envelope + B2 saturating level term | Pending your call — with B3 live they become pacing polish rather than containment |
| B4 defense-RP gate | Optional, pending |
