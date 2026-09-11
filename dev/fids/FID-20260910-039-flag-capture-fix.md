# FID-20260910-039 — Flag Capture Fix (doc-faithful state machine repair)

**Date:** 2026-09-11 · **Trigger:** operator: "there's an issue with taking the flag… read the
doc for the flag system, fix it if it does not match."

## Source of truth
- `dev/fids/FID-20260906-001-flag-reward-loop-balance.md` (Option A GREEN design) —
  challenge → 30s channel (5s bearer lock) → claim only after `challenge_ends_at` →
  transfer + state reset; flee 10→30% gross ×5 then auto-lose; 1h grace; first-claim at
  spawn (15 tiles); bot auto-loses at channel end; §5.2 names a `pollChallenge` seam.
- `dev/archives/2025-10-22-cleanup/feature-completions/FLAG_FEATURE_PLAN.md` — numeric
  source: 15-tile steal range (§168-176, Euclidean area ~706), 12h max hold.

## Defects found (RED-verified live)

### D1 — Expired channels deadlocked the flag (the reported break)
`startChallenge` rejected whenever `challenge_challenger` was set; nothing ever cleared an
expired channel (the doc's `pollChallenge` was never implemented; `breakChallenge` only ran
on flee). One abandoned challenge (tab closed / claim never fired) made every future
challenge return **409 "A steal challenge is already in progress"** forever — proven live by
seeding a stale channel: in-range challenge blocked, GET stuck showing `secondsRemaining: 0`
with `canChallenge: false`.
**Fix:** `pollChallenge()` implemented (doc §5.2) — sweeps channels expired >2 min
(`CLAIM_WINDOW_MS`), wired into `startChallenge` + the GET route. First attempt swept in
`getFlagHolderState` and destroyed the challenger's own claimable channel at expiry+1.5s —
caught in the live drive; the claim path now **never** sweeps (claim reads through unswept).

### D2 — Timezone skew corrupted every window
flags time columns were `timestamp without time zone`: writers stored UTC literals while
node-pg parsed them as LOCAL — a live-observed 4h skew (row `grace_until` 06:53Z vs DB
`now()` 02:49Z while JS computed 471s remaining). Grace, channel ends, flee lock/cooldown,
and the 12h hold clock all compared skewed instants.
**Fix:** migration **0022** → `timestamptz` (UTC-assumed conversion) on all five columns;
drizzle schema mirrored `{ withTimezone: true }`; transient windows reset to sane absolutes.

### D3 — Steal range contradicted the doc
Server enforced the HP-battle-era `ATTACK_RANGE: 5` (Chebyshev); the doc's steal model is
**15 tiles** (§168-176) and the tracker panel displays Euclidean distance.
**Fix:** `FLAG_CONFIG.STEAL_RANGE: 15` added (legacy constants marked deprecated, no
consumers); challenge route validates **Euclidean ≤ 15** on resolved DB positions; panel
readout uses `STEAL_RANGE`. Server and client now agree on metric and radius.

## Verification (live, :3001 production build)
- Stale-channel deadlock: seeded → challenge **swept + STARTED** ✓
- Early claim → 409 "Channel still running — 30s remaining" ✓
- Claim at channel end → **flag transferred**, captures 5→6, 1h grace stamped, channel
  cleared, flee_count 0, session earnings reset ✓ GET shows new bearer (`isBearer: true`) ✓
- Range: challenge at 10 tiles (impossible under old 5-tile rule) → **STARTED** ✓
- Gates: tsc 0 · eslint 0 · vitest **475 passed / 1 skipped** · next build exit 0

## Files touched
lib/flagBonusService.ts · app/api/flag/route.ts · app/api/flag/challenge/route.ts ·
lib/flagService.ts · types/flag.types.ts · components/FlagTrackerPanel.tsx ·
lib/db/schema/config.ts · lib/db/migrations/0022_flags_timestamptz.sql (new)

## R2 — Client-side 409 storm (2026-09-11, post-deploy operator report)

**Operator report:** console 409 on `/api/flag/challenge` while the panel still
displayed the previous bearer (`Flag_Bearer_1027`) — but the DB showed the
operator themselves held the flag (captured 03:58Z, no channel).

**Root cause (client, not the R1 state machine — server verified doc-faithful):**
`handleFlagChallenge` POSTed unconditionally. Three illegal-fire paths:
1. **Stale panel**: the 30s poll lag means a fresh capture leaves the tracker
   view ("X is holding it" + enabled STEAL) while the viewer is already the
   holder → click → 409 "You already hold the Flag".
2. **Ungated ATTACK BEARER button** (TileRenderer) calls the same handler with
   no range/holder/channel pre-checks at all.
3. **Double-click / double-render**: no in-flight dedupe — the second POST
   reads its own first channel → 409 "already in progress".

**Fixes:**
- `app/game/page.tsx` — `handleFlagChallenge` gains: in-flight ref guard,
  viewer-holds-flag pre-flight (server `actions.isBearer` OR client-side
  identity fallback), and channel-running pre-flight; each surfaces a real
  message and refetches instead of POSTing a known-illegal request.
- `lib/flagBonusService.ts` — `startChallenge` is now **idempotent for the
  same challenger**: a retry while their own channel runs returns
  `{ ok: true, rejoined: true }` with the channel's original times (no
  restart, no 409). Other challengers still get 409; holder/grace rules
  untouched. `ChallengeStartResult.rejoined?: boolean` added.
- `components/FlagTrackerPanel.tsx` — misnomer `canChallenge` (which computed
  the *negation*) renamed `challengeBlocked`; same value, honest name.

**Live verification (prod build :3001):** holder-challenge → 409 authority
intact; same-challenger in-range retry → 200 REJOINED with DB `endsAt`
unchanged (idempotent, channel not restarted); second challenger in-range →
409 "already in progress". tsc 0 · eslint 0 · vitest 475 · build exit 0.
