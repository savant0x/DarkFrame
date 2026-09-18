# FID-20260917-014 - Wire pg referral validation on login (row 92)

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-17 (055)
**Origin:** SCOPE row 92 candidate, created by work-order item 6 after the referral
cron decoy deletion. Operator directive: file the FID and run its Perfection Loop
to loop-complete.

## 1. Goal

Nothing validates pg referrals: `checkReferralValidation` (7-day + 4-login
criteria) and `validateReferral` (full reward distribution) have zero automated
callers since the decoy cron was deleted; `referrals.loginCount` is written
exactly once, at referral creation (referralService.ts:435), so the 4-login
criterion could never be met even with a trigger. This FID wires a real
on-login trigger and makes the criteria reachable.

## 2. Scope

- `lib/referralService.ts`: new `processLoginReferralEvents(username)` - finds
  the player's pending referrals (validated=0, invalidated=0, flaggedForAbuse=0),
  increments `loginCount` + stamps `lastLogin` per successful login, then runs
  the existing `checkReferralValidation` -> `validateReferral` chain when
  criteria are met. Never throws (login must not break).
- `validateReferral` idempotency hardening: the validated-flag flip becomes a
  conditional claim (`UPDATE ... WHERE id = ? AND validated = 0 ... RETURNING`);
  a lost claim returns false before any reward writes. Needed because concurrent
  logins (multi-device) are now realistic; admin route contract (boolean) unchanged.
- `app/api/auth/login/route.ts`: the post-auth hook call replaces the dead
  Mongo-era `lastActive` write (a silent no-op since the pg pivot - Cluster-B-class
  residue removed in passing; recorded for the Mongo census).
- No schema changes: `loginCount`/`lastLogin`/`invalidated`/`flaggedForAbuse` all exist.

## 3. Loop decisions

- **D1 - count semantics:** every successful password-gated login increments
  `loginCount` (no per-day dedupe). The 7-day criterion bounds any inflation;
  the field name matches the semantics.
- **D2 - exclusion set:** invalidated (migration 0011 admin marker) and
  abuse-flagged referrals are excluded from AUTO-validation; admin manual
  validation stays available for both.
- **D3 - claim atomics:** conditional-claim on the validated flip (D above)
  rather than trusting the pre-read check.
- **D4 - dead Mongo block:** replaced by the hook; the login route imports
  nothing from lib/mongodb afterward.

## 4. Verification

- Pins (`__tests__/api/referralLoginHook.test.ts`): increment + lastLogin stamp;
  zero-cost early return for players with no pending referral; invalidated and
  flagged skips; end-to-end criteria-met flow through the REAL reward path
  (mocked db, real service logic); criteria-unmet leaves validated=0;
  claim-race pin (lost claim -> no reward writes); post-validation idempotent
  re-call returns false; source pin asserting the login route wires the hook.
- Live probe (`scripts/e2eReferralLoginHook.ts`): real dev DB - seed a pending
  referral (8 days old), fire the hook 4x, assert validation lands on the 4th
  (validated=1, referrer reward columns increase, totalReferrals+1), snapshot +
  restore referrer state, delete the seeded row.
- Full gates: tsc 0, eslint 0, suite green, inverted census exit 0.

## 5. Non-goals

- Login-route daily-streak accrual (the session-route call site remains the
  single accrual point) - separate candidate if desired.
- Referral reward-rate changes, admin UI changes, backfill of historical logins.

## 8. Closure

- **Gates:** 8 pins green (incl. structural WHERE-column pin + claim-race-lost pin); live probe **10/10, exit 0** against the real dev DB (8-day seeded referral: fires 1–3 unvalidated, fire 4 validates with referrer rewards credited, fire 5 idempotent; snapshot/restore cleanup); tsc 0 · eslint 0 · census 0 · suite 1040 at the batch (1068 as of the FID-016 batch re-run).
- **Commit hash (G2):** `1bd818b`
- **Post-commit:** FID archived; SCOPE row 93 -> Closed; CHANGELOG; VERSION.
