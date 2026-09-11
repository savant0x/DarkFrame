# Session — FID-20260909-033: Unit catalog unification (2026-09-10)

**Trigger:** Operator confirmed the STR T1 unit IS "Infantry" (100 STR, 200/200),
not "Rifleman" (5 STR). Four parallel unit catalogs had diverged.

## What changed
- `UNIT_CONFIGS` regenerated from `UNIT_BLUEPRINTS` (canonical roster); enum
  T-tier values renamed to canonical ids. SPEC/PRESTIGE entries preserved.
- `beerBaseService` UNIT_POOLS + `botGrowthEngine` UNIT_TYPES now derive from
  the unified config — no hand-copied stats, no third naming scheme.
- `/api/player/build-unit` entries: `id` + `unitType` + `producedAt` provenance.
- Tutorial `build_unit` validator accepts enum value / display name aliases.
- Market listing dropdown derives from configs (was hardcoded stale ids).
- Data migration `scripts/migrate-unit-catalog.ts` (idempotent): re-keyed
  fame (`INFANTRY`, 1,072,500 STR preserved), mapped Silent_Tower's 7 legacy
  identities to nearest canonical equivalents, re-keyed pamtpkziq5.
- 6 drift-guard tests pin configs to blueprints forever.

## Gates
tsc 0 · eslint 0 · vitest 434 passed/1 skipped · build exit 0 ·
migration re-run no-op · fresh-account tutorial probe 16/16 PASS.

## Notes
- Second `$each` blob bug (cast-smuggled) found + fixed in /api/player/build-unit.
- Probe digger-count assertion fixed: universal digger bumps item + both counters;
  count physical items only.
- UnitBuildPanel.tsx (legacy, unmounted) flagged for deletion.

## Follow-up batch (same session): respawn cycle + leak fix + dead code
- Beer Base weekly respawn executed: removed Silent_Tower, spawned
  Silent_Citadel (ELITE, Wasteland claim at 45,8, native unified-pool army —
  8.67M STR / 2.90M DEF, zero non-canonical identities except by-design
  SPEC/PRESTIGE entries, no duplicate identity entries).
- **Leak fixed:** weeklyBeerBaseRespawn's bulk deleteMany skipped the tile
  release that removeBeerBase performs (FID-030 leak class) — every weekly
  cycle permanently ghosted each replaced base's claim. Now releases all
  existing bases' tiles before deleting. Live ghost (Silent_Tower @ 68,123)
  cleaned; 0 ghost claims verified.
- Dead UnitBuildPanel.tsx deleted (was the stale-catalog consumer); barrel
  duplicate export removed. Gates re-run: tsc 0, eslint 0, vitest 434,
  build exit 0.

## Post-restart closure: respawn leak regression test
- Added `__tests__/lib/beerBaseRespawn.test.ts` (4 tests) pinning the weekly
  respawn's tile-claim release contract: every base's
  `releaseBotBaseTile(x, y, owner)` runs before the bulk delete (ordering
  pinned via event timeline), a failing single-base release doesn't abort
  the respawn (per-base tolerance), coordinate-less bases delete without a
  release attempt, and a disabled config short-circuits with no
  releases/deletes.
- Gates: tsc 0, eslint 0, vitest **438 passed / 1 skipped**.

## FID-20260909-034: Beer Base power-band audit + calibration
- Verdict: bands (level→tier brackets, spread, variety floors) are structurally
  sound; Silent_Citadel's tier draw (≈9.65M) was legitimately ELITE — the
  overflow was a generator leak, not band miscalibration.
- Fixed: cross-stat spillover (dual-stat SPEC_TAC/PRESTIGE units delivered
  unbudgeted power; quantity now costs full str+def, pools filtered to PURE
  units), hollow armies (floor() emptied every tier at post-unification unit
  costs — ≥1-unit guarantee + floor top-up added), stale 1K WEAK floor raised
  to 15K (minimum viable 10-slot army).
- POWER_BANDS exported as band truth; Monte-Carlo sweep test (6 bands × 5
  specs × 40 draws) pins in-band delivery; UNIT_POOLS drift guard retained.
- Silent_Citadel regenerated in place: 9,175,480 total — in-band, zero
  dual-stat entries.
- Gates: tsc 0, eslint 0, vitest 444/1 skip, build exit 0.

## FID-034 verification: live combat smoke test vs Beer Base (both paths)
- Defeat-path leak found + fixed en route: combat/attack's inline delete after
  victory skipped the tile release (FID-030 leak class); route now calls
  removeBeerBase (release + delete). Verified live: tile owner → null.
- Smoke driver scripts/smoke-attack-citadel.ts (args: attacker defender):
  mints session JWT, teleports attacker onto base tile for presence, POSTs
  the live route, validates battle log labels vs the unified catalog,
  loot/XP math, base removal, tile release.
- LOSS PATH (fame vs Silent_Citadel): 6/6 PASS — repelled by the real
  27,412-unit garrison, +60 XP, base + tile intact, no legacy identities.
- WIN PATH (smoke_attacker vs freshly spawned Forsaken_Warrens): 11/11 PASS —
  loot exactly ×3 (659,934/659,934), +400 XP, base removed, tile released,
  all 10 defender unit types verified against UNIT_CONFIGS/UNIT_BLUEPRINTS
  with exact stats (Rifleman 95 STR = live unified identity, not legacy).
- Live FID-034 re-verification: two fresh bases spawned through the pipeline
  (Sable_Fortress 1.44M STRONG, Forsaken_Warrens in-band), 0 dual-stat entries.
- Cleanup: smoke_attacker deleted, 0 ghost claims, Silent_Citadel tile intact,
  fame returned home (+60 XP from the repel test, resources untouched).
- Gates: tsc 0, eslint 0, vitest 444/1 skip, build exit 0.

## FID-20260909-035: cron/job wiring audit
- Deployment model: npm start → tsx server.ts (custom server) registers all
  interval jobs (WMD, Flag Bot 30min, Beer Base 10min check, Factory regen)
  with graceful shutdown; vercel.json minimal by design.
- F1 fixed: isRespawnTime now honors dynamic multi-schedules in their own
  timezones (legacy fields were the only check — dynamic windows were dead).
- F2 fixed: respawn dedup week persisted to gameConfig (in-memory week meant
  a restart inside the Sunday window double-respawned).
- F3 fixed: catch-up — past-week windows fire on next tick (≤10min); crashed
  respawns re-attempt (week persisted after success).
- F4 fixed: botGrowthEngine.runGrowthCycle had ZERO scheduled callers (bots
  could only decay) — new lib/jobs/botGrowthManager.ts runs it hourly,
  registered in server.ts with graceful stop.
- F5 fixed: full-suite run exposed a FID-034 band-overflow flake (≥1-unit
  guarantee dumped unbudgeted power, 51,155 vs 50K WEAK ceiling) — unaffordable
  slots now skipped; 5 consecutive clean sweeps (~1,000 armies).
- Tests: beerBaseScheduler.test.ts (12) pins windows/dedup/catch-up/growth
  contract. Gates: tsc 0, eslint 0, vitest 456/1 skip, build exit 0.

## FID-035 follow-up: initial bot ecosystem repopulation
- scripts/repopulate-bots.ts: spawns through createBotPlayer (legal Wasteland
  claims in tier-aligned zones, themed names, tier resources) then arms each
  bot in place with generateBeerBaseUnits at POWER_TIER_FOR_BOT_TIER (new
  exported mapping: bot T1→WEAK … T6/7→LEGENDARY, mirroring player brackets).
- Ran 50: distribution T1 26 / T2 14 / T3 6 / T4 3 / T5 1 (52/28/12/6/2% vs
  50/25/15/7/3 target); zones 0-2 = 40, 3-5 = 9, 6-8 = 1 (geography held).
- Verification: 50/50 tiles Wasteland + base_owner = self; 0 totals
  mismatches (Σ qty×stat = stored columns); 0 dual-stat entries; all 54
  distinct identities canonical (incl. by-design SPEC/PRESTIGE); 0 ghost
  claims map-wide; population 2 → 52.
- Admin route note: its inline bot doc also writes husk armies (legacy
  {soldiers|tanks|aircraft} shape) — flagged for a future FID; the hourly
  growth cycle now builds armies for any husk automatically.
- Gates: tsc 0, eslint 0, vitest 456/1 skip.

## FID-035 follow-up: admin Scheduler Health panel (jobs-status)
- GET /api/admin/jobs-status (admin-gated, read-only): aggregates all five job
  families — Beer Base respawn (with persisted dedup week), bot growth (with
  last-cycle summary), flag bot, factory slot regen, WMD sub-jobs — plus
  serverModel flag.
- getBeerBaseJobInfo/getBotGrowthJobInfo added (isRunning accessors, mirrors
  getFlagBotJobInfo shape).
- components/admin/JobsStatusModal.tsx: nn-* neon-noir modal, polls every 30s,
  per-job last-run age vs cadence (overdue = no run in 2.5x interval),
  error counts, RUNNING/NOT RUNNING/OVERDUE status. Lazy-loaded from AdminView
  via a new "Scheduler Health" button next to Achievement Stats.
- Live smoke: HTTP 200 via minted admin JWT; correctly shows all jobs NOT
  RUNNING under `next dev` (server.ts — where jobs run — only executes under
  npm start). That asymmetry is exactly what the panel makes visible.
- Contract tests: jobs-status.test.ts (5): 403 gates, aggregation shape,
  persisted-week passthrough (37 / null). Gates: tsc 0, eslint 0, vitest
  461/1 skip, build exit 0.

## FID-20260909-036 — Scheduler Health lifecycle controls (2026-09-10, later)

Admin Scheduler Health panel gained stop/start/restart/run-now per job.

- Route: `POST /api/admin/jobs-status { job, action }` — admin-gated, validated
  (400 on unknown job/action/malformed body), own rate-limit budget (shares
  nothing with the 30s poll), every mutation audit-logged to `mod_log` as
  `ADMIN_JOB_CONTROL` (including refusals). Job ids: `beerBase`, `botGrowth`,
  `flagBot`, `factorySlotRegen`, `wmd` (family), `wmd:<name>` (single WMD job).
- GET entries now carry a stable `id` for the contract.
- Managers: added `runBeerBaseJobNow`/`runBotGrowthJobNow` (single-flight entry
  points; scheduled interval untouched), `stopSingleWMDJob`/`startSingleWMDJob`
  in the WMD scheduler.
- Semantics fix: `getSchedulerHealth` now reports the FULL WMD roster (never-
  started jobs show zeroed stats instead of vanishing) and per-job `isRunning`
  means *scheduled* (matching other families), not the transient mid-execution
  flag. Stopping the last WMD sub-job flips the family flag.
- UI: per-job STOP/RESTART (running) or START (stopped) + RUN NOW (non-WMD),
  busy spinner, inline magenta error banner, immediate refresh after mutation.
- Tests: 14 new route-contract tests (19 total in the file). Gates: tsc 0 ·
  eslint 0 · vitest 475 passed / 1 skipped · next build exit 0.
- Live smoke vs dev server: start flipped state, run-now executed a real bot
  growth cycle (1 exec, 0 errors), stop restored, WMD sub-job stop→start→
  restart→stop round-trip honest, audit rows verified in mod_log (6), 403/400s
  correct. Pre-smoke scheduler states restored afterwards.

## Session addendum 2026-09-10 (FID-037): egress, enemy combat, attribution guard

- Egress root cause found via user-exported pg_stat CSV: auth full-row player select (187,781
  calls), 3s forever tutorial poll (258K selects), double getFlagState per tile view. All fixed
  (slim auth projection, terminal-aware poll, single-pass flag state + point-lookup index 0021).
- Enemy-base tile surface shipped: /api/tile ownership+level enrichment, TileRenderer
  classification with level→image and ATTACK button, combat route generalized to all bot bases
  (Full Permanence; Beer keeps 3× + removal).
- Attribution guard ported from savant-code (.githooks commit-msg + fail-closed pre-push scan).
  History scrubbed in temp clone: 29 watermarked commits cleaned, trees byte-identical, backup at
  backup-main-pre-rewrite. Local main = clean 6c2b0d9; force-push awaiting user go-ahead.
- CLI/account resolution: org Savant = ehguufzuggdxzqspdjnl (the email's ID); user's CLI now
  logged into the correct account (project DarkFrame ahzpjdemomuashuxnwve).
- Gates: tsc 0, eslint 0, vitest 475 passed, build exit 0. Live attack smoke verified loot
  crediting and Full-Permanence defender survival at (46,19).

### FID-038 addendum: base intel surface + flag panel correctives + resource raids
Badge → BOT BASE / BEER BASE · LV n; /api/map/bases (30s cache) + canvas chips (magenta
beer / red bot, owner·LV labels); nn-range/nn-slider collision fixed (OUT OF RANGE pill
restored); flag self-view client fallback + action refetch via shared fetchFlagData;
metal/energy raid choice per archived FID-20251017-023 with BASE SACKED victory readout.

### FID-039 addendum: flag capture repair (doc-faithful)
Root causes of "taking the flag is broken": (1) expired channels never swept — one abandoned
challenge deadlocked all future challenges (pollChallenge §5.2 now implemented w/ 2-min
claim window; claim path never sweeps); (2) naive timestamp columns skewed every window 4h
(migration 0022 → timestamptz); (3) server steal range was HP-era 5-tile Chebyshev vs doc's
15-tile Euclidean (STEAL_RANGE + Euclidean check). Live: stale channel swept, capture
completes (captures 6, grace stamped, earnings reset), 10-tile challenge passes. 475 tests.
