# FID-20260909-035 — Cron/Job Wiring Audit (Scheduler Integrity)

**Status:** ✅ CONVERGED · **Type:** Audit + wiring repair · **Risk:** Medium (production scheduler)

## Trigger

User asked to audit cron/job wiring so the FID-030 tile-release fix and
FID-033 unified-pool spawning actually run on schedule in production.

## Deployment model (audited fact)

`npm start` runs `tsx server.ts` — a **custom production server** that starts
every interval job at boot with graceful SIGTERM/SIGINT shutdown. Verified
registered: WMD scheduler, Flag Bot (30 min), Beer Base respawn (10 min check),
Factory Slot regen. `vercel.json` crons (player-snapshot daily, purge yearly)
are for the serverless model and intentionally minimal; `wmd-tick` exists as
its documented serverless escape hatch.

## Findings & fixes

### F1 (fixed): `isRespawnTime` ignored dynamic schedules
It checked only legacy `respawnDay/respawnHour`, so the FID-20251025-003
multi-schedule feature was dead behind the scheduler no matter what the admin
configured. Now evaluates enabled schedules in their own timezones (matching
`getNextRespawnTime`'s semantics), falling back to legacy fields when
`schedulesEnabled` is false.

### F2 (fixed): restart double-fire
The manager's `lastRespawnWeek` dedup was in-memory — a restart inside the
Sunday window respawned twice in one week (double tile churn, double bases).
The week is now persisted in `gameConfig.beerBase.lastRespawnWeek`
(`setLastRespawnWeek`), written **after** successful respawn.

### F3 (fixed): no catch-up
A server down for the whole scheduled hour skipped the week silently. With the
persisted week: a *past* week inside the window triggers catch-up on the next
tick (≤10 min later); a crashed respawn also re-attempts (week written last).

### F4 (fixed): bot growth was never scheduled
`botGrowthEngine.runGrowthCycle()` (resource regen, growth patterns, movement,
unit building, nest attraction) had **zero scheduled callers** — bots could
only decay. New `lib/jobs/botGrowthManager.ts` runs it hourly (matching the
documented hourly regen model), registered in server.ts with graceful stop.
This is the mechanism that will rebuild the near-extinct bot population over
time via unit building.

### F5 (fixed en route): band-overflow flake the full suite exposed
The FID-034 `≥1-unit guarantee` dumped up to one unit cost of unbudgeted power
per slot when a budget couldn't afford its tier's units (caught live:
51,155 vs the 50,000 WEAK ceiling). Slots the budget cannot afford are now
skipped (small bases legitimately lack T5 units); the floor top-up still
guarantees the band minimum, and the 15K WEAK floor keeps T1–T3 affordable
(no hollow armies). Verified 5 consecutive clean sweeps (~1,000 armies).

## Verification

- New `__tests__/lib/beerBaseScheduler.test.ts` (12 tests): legacy/dynamic/
  timezone/disabled window semantics; persisted-week dedup (skip), fresh fire
  (+persist), past-week catch-up, out-of-window no-op; bot growth job
  contract (start/stop/idempotent double-start).
- `beerBaseManagerJob` exported for the regression contract.
- Gates: `tsc` 0 · `eslint` 0 · vitest **456 passed / 1 skipped** ·
  `next build` exit 0.

## Residuals / notes

- In-memory dedup means **multiple concurrent server instances** would each
  check the window; the persisted week now also guards that case (first
  writer wins, others see the current week and skip) modulo the persist race.
- `vercel.json` remains minimal by design; the custom server is the scheduler
  of record. If the project moves to serverless, all four jobs need
  CRON_SECRET tick routes like `wmd-tick`.
- Bot repopulation still requires an explicit initial spawn (growth cycles
  only grow *existing* bots).
