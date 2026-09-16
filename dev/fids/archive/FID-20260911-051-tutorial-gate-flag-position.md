# FID-20260911-051 — Tutorial Terminal Gate + Flag Position Slimming

**Date:** 2026-09-11 · **Follows:** FID-20260911-050 (egress verdict) · **Trigger:**
residual tutorial (~286–922/h) and flags (~192/h) query rates in the
post-FID-037/046/047/048 window.

## The verdict: no leak — plus two real hardenings

`scripts/probe-query-rates.ts` (committed; snapshot / 60s live-sampler /
delta modes against `pg_stat_statements` + `pg_stat_activity`):

- **60s live sample: zero executions** of any residual fingerprint at idle.
- **12-minute delta during active play**: tutorial pairs at ~920/h — the
  **by-design 3s poll of fame's ACTIVE tutorial** (fame is legitimately
  mid-quest; the probe's status call returns an active quest). That poll
  stops at terminal state (client stop verified in TutorialQuestPanel:
  `pollTerminal` halts the self-scheduling loop).
- flags ~192/h = per-tile-view checks during play — legitimate reads.

## Hardening 1 — server-side terminal gate (`lib/tutorialTerminalCache.ts`)

The client stop can't help a **stale tab running pre-fix JS**, which polls
forever. `GET /api/tutorial` now pins a player's terminal state
(complete/declined/no-active-quest) in a module-scoped TTL cache (10 min) and
serves the terminal payload from memory — **zero DB reads** — for repeat
polls. Correctness contract (5 unit tests):

- Only terminal states are cached; non-terminal polls never touch the cache.
- Entries expire → one real re-check per 10 min (self-healing).
- `POST /api/tutorial action:'restart'` invalidates immediately (and 400s on
  a missing playerId, closing a latent NPE).

## Hardening 2 — `getFlagBearerPosition()` (`lib/flagState.ts`)

The tile route (once per AutoFarm cycle + every manual tile view) used
`getFlagState()` for a single fact — is the bearer on this tile — while also
selecting the bearer's **live trail list (≤200 rows)** it never consumed.
New position-only helper reads the flags row + 4 holder columns; the tile
route now uses it and keeps the existing point `getTrailInfoAt()` check.
Each AutoFarm cycle sheds up to 200 trail rows of wire.

## Gates + live verification

tsc 0 · eslint 0 · vitest **504 passed / 1 skipped** (5 new) · build exit 0 ·
:3001 restarted and live-verified (tutorial status, tile render with the new
lookup). Egress dashboard is the final arbiter; residuals during active play
are now at their design floor.
