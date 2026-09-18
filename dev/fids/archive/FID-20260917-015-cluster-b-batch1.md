# FID-20260917-015 - Cluster B batch 1: stats, check-name, tutorial (main + decline) to pg

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-17 (056)
**Origin:** Mongo census Cluster B (MONGO-RESIDUE-CENSUS-2026-09-17, SCOPE row 84).
Operator directive: start Cluster B - migrate the remaining live clientPromise
call sites to pg.

## 1. Goal

Kill the census's "trivial" batch-1 slice of the 15 direct clientPromise users:
app/api/stats (leaderboard + global aggregates), app/api/clan/check-name,
app/api/tutorial (eligibility read, POST theater, restart delete),
app/api/tutorial/decline (pure connection theater). Contract-pinned per the
census rule: wire shape derived from the consumer, not from the old Mongo
projection.

## 2. Loop findings (live-probed)

- **Live sweep expanded the surface:** 73 files import lib/mongodb; 15 direct
  clientPromise users remain (not the census's "13"). FID-008's inventory hit
  is now a comment only. Batch 2 (friends x2, DM x3, ban-player,
  clear-flags, logs/cleanup, build-unit, antiCheatDetector) untouched here.
- **D1 - total_power does not exist in pg.** The Mongo route sorted/projected a
  `totalPower` field; rankingService derives power as
  totalStrength + totalDefense (lib/rankingService.ts:123). The pg rewrite
  derives it identically in SQL; consumers get the same shape.
- **Wire contract (from app/stats/page.tsx + StatsViewWrapper.tsx, the two
  consumers):** topPlayers items need _id (React key only - username serves),
  username, level, totalPower, totalStrength, totalDefense, metal, rank;
  gameStats needs totalPlayers/totalMetal/totalEnergy/totalPower/averageLevel/
  totalBattles/totalTerritories. `resources` flattened to metal/energy.
- **check-name:** clans_name_unique exists but pg unique indexes are
  case-sensitive; the route's case-insensitive check is load-bearing (two clans
  differing only by case would be indistinguishable to players). Rewritten as
  lower(name) equality - no regex from user input (the old code built
  `new RegExp(^${name}$, 'i')` from the query param, a latent ReDoS/injection
  seam, now gone).
- **tutorial route:** tutorialService is ALREADY pg (db + schema imports); the
  route's Mongo usage is (a) the eligibility level read, (b) dead connection
  theater in POST (`mongoClient.db()` result unused), (c) restart's
  deleteOne on tutorial_progress. All three map 1:1 onto drizzle; the
  tutorial_progress pg table exists with player_id unique index.
- **decline route:** clientPromise is pure theater (no collection use); drop it.

## 3. Scope

- app/api/stats/route.ts: pg rewrite - one indexed orderBy(...).limit(10)
  leaderboard query (the census's noted perf win replaces fetch-then-sort),
  one GROUP-less aggregate for gameStats, count queries on battle_logs and
  occupied tiles. Mongo imports gone.
- app/api/clan/check-name/route.ts: drizzle lower() equality on clans.name.
- app/api/tutorial/route.ts: pg level read, theater removed, pg restart delete.
- app/api/tutorial/decline/route.ts: theater removed.
- Pins: wire-contract pins per route family (mocked db, real handlers).

## 4. Verification

- Pins x9: stats leaderboard order-by columns per sortBy (structural), limit 10,
  response shape incl. derived totalPower + flattened metal; gameStats fields;
  check-name lower-equality + shape; tutorial restart deletes from pg
  tutorial_progress; decline route carries no mongodb import (source pin);
  tutorial route source pin (no clientPromise).
- Live probe: real dev DB - GET /api/stats returns 200 with topPlayers <= 10 and
  gameStats numbers consistent with a direct SQL count; check-name against an
  existing clan name (case-varied) returns available=false; tutorial restart
  round-trip on a probe row. Census gate exit 0 post-batch.
- Full gates: tsc 0, eslint 0, suite green.

## 5. Non-goals

- Batch 2 families (friends/DM/anti-cheat/build-unit/logs) - own FIDs.
- Cluster C aggregate pipelines (clan leaderboard, logs) - double-run oracle.
- Changing any wire shape (consumers untouched).

## 8. Closure

- **Gates:** 8 pins green (structural sort-column pins incl. the assertion that the nonexistent `total_power` never appears); live HTTP probe **16/16** against the real server + DB (top player matches a direct SQL oracle, all four gameStats counters equal direct SQL counts, case-mangled clan name "sAvAnT" correctly taken, tutorial restart deletes by session identity); tsc 0 · eslint 0 · census 0 · suite 1048 at the batch (1068 as of the FID-016 batch re-run).
- **Commit hash (G2):** `81a4d02`
- **Post-commit:** FID archived; SCOPE row 94 -> Closed; CHANGELOG; VERSION.
