# FID-20260914-009: unmapped legacy collections — abandon's lost-unit accounting no-ops post-pivot (plus three siblings of the same class)

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID per templates/FID-TEMPLATE.md.
  Attribution rule honored: no author field, no signatures.
-->

**Filename:** `FID-20260914-009-unmapped-collections-units-abandon.md`
**ID:** FID-20260914-009
**Severity:** HIGH (silent data-loss illusion + dead cron writes; no crash)
**Status:** converged
**Created:** 2026-09-14

---

## 1. Summary

The Mongo→pg compat shim silently no-ops every `db.collection(name)` whose name resolves
to no schema table and no alias (`getTable()` → undefined; reads return empty, writes
vanish). A full census of all 22 distinct collection names used in `lib/` + `app/` found
**four unmapped names**:

1. `units` — `app/api/factory/abandon` counts, reads, and deletes "units produced at the
   factory" from it and deducts the player's STR/DEF totals accordingly. All of it
   silently no-ops: **abandoning a factory reports 0 units lost while units persist in
   `players.units`** (found live during the FID-20260914-004 sweep).
2. `BattleLog` — the admin log-cleanup route's retention policy for battle logs counts
   and deletes **nothing**, forever (and reports success with those zeros).
3. `playerLevelHistory` — the daily player-snapshot **cron has stored nothing** since the
   pivot; growth-rate and beer-base predictive-distribution reads always see "no data"
   and fall back.
4. `clan_territories` — cache-warming reads no-op (and the warming module itself is
   dead code, referenced only by the barrel export).

The directive's seed (abandon/units) is the flagship; the census proves it is a class.

## 2. RED evidence (this session)

### 2.1 Census method

Every `collection('…')` literal in `lib/` + `app/` (22 distinct names) was resolved against
the shim's resolution order: `TABLE_REGISTRY` (schema export name ∪ SQL table name, from a
live dump of `lib/db/schema` = 39 tables) → `TABLE_ALIASES` (12 legacy names) → undefined.
Four names resolve to undefined.

> **Correction 2026-09-14 (machine re-census):** the registry figures above were
> grep-derived and wrong — the live schema module dumps **110 registry keys covering 63
> distinct tables**, and `TABLE_ALIASES` has **11** entries (not 12). The unmapped set of
> four names and every caller citation were unaffected and are machine-confirmed by
> `scripts/censusCollectionMapping.ts` (re-runnable, mirrors `getTable()` verbatim).
> Methodological lesson recorded: generic invocations (`db.collection<Unit>('units')`)
> defeat naive `collection(` greps — the census regex now accepts the `<T>` form, and
> that exact shape is how all four sites were re-verified.

| # | Unmapped name | Callers | Runtime behavior today | Impact |
| --- | --- | --- | --- | --- |
| 1 | `units` | `app/api/factory/abandon/route.ts:80` (+ count at 107, find at 143, deleteMany at 158; STR/DEF deductions at ~171) | all no-op; `unitsAtFactory` always 0; delete 0 | Abandon's "N units were lost" warning **never fires**; units survive abandon (in `players.units`); STR/DEF "deductions" dead code. Sweep-live-verified (FID-004 §8) |
| 2 | `BattleLog` | `app/api/logs/cleanup/route.ts:246,267` (via legacy `clientPromise` + Mongo filter syntax, not even the shim) | count = 0, delete = 0, reported as success | Admin retention policy for battle logs **silently unenforced**; battle_logs grows unbounded |
| 3 | `playerLevelHistory` | `lib/playerHistoryService.ts:72,102,164,328` — `capturePlayerSnapshot` (insert) via cron `app/api/cron/player-snapshot`, `purgeOldSnapshots` via cron purge, `getPlayerGrowthRate`, `generatePredictiveDistribution` (consumed by `lib/beerBaseService.ts:30` and the admin recalculate-predictions route) | insert silently dropped; reads always empty → "not enough data" | **Daily snapshot cron has stored nothing since the pivot**; beer-base predictions run without their intended data foundation; purge honest-count reports 0 |
| 4 | `clan_territories` | `lib/cacheWarming.ts:201` | read no-ops | None at runtime (module is dead code — referenced only by `lib/index.ts` barrel) |

### 2.2 The units domain shift (why this is not just an alias fix)

The abandon route encodes the 2025-10-era contract: *units are stationed at the factory
that produced them; abandoning the factory kills them.* Post-pivot reality, measured:

- **0 of 57** players with units have ANY `producedAt` (factory coords) in their
  `players.units` entries (live probe: `u ? 'producedAt'` matched zero entries; samples
  show `unitType/unitId/category/quantity/strength/createdAt` only — bots never stamped
  location, and the build routes' stamps exist only on units created since their fixes).
- No column or jsonb field anywhere stores a unit's factory. "Units produced at (x,y)"
  is **not reconstructible** from current data.
- `db.collection('units')` is not table-shaped for a reason: the concept has no pg home.
  Mapping the alias (Option C) is therefore semantically impossible — the filter keys
  (`owner`, `factoryX`, `factoryY`) have no column counterparts.

So the real defect is not "the shim can't find the table" — it is that **abandon still
carries dead code promising an obsolete behavior** (with STR/DEF side-effect code that
can never run), while the page contract silently changed.

### 2.3 Cleared suspicions

- The abandon route's factory reset, `factory_count` recount, and honest `modifiedCount`
  gate are all live and correct (FID-004 sweep drove them).
- `players.units` is written by both build routes and read by combat/power paths —
  unaffected by abandon's dead branch.
- The shim's silent-no-op semantics for unknown collections are *documented* in
  `lib/mongodb.ts` (reads empty/writes drop) — the defect is the callers, not the shim
  contract (a hard-throw shim is a separate, riskier design change; not proposed here).

## 3. GREEN

### Finding 1 — units/abandon (the flagship)

**Option A (RECOMMENDED): accept the domain shift; remove the obsolete accounting.**
Delete the `unitsCollection` block from abandon (count/find/deleteMany + STR/DEF
deductions + the never-firing warning). The route keeps: ownership check, factory reset
(owner null, level, slots, invested zeroing — already exact per FID-032), honest count
gate, `factory_count` recount. Message drops the units warning (nothing is lost — the
army is global). Zero-risk dead-code removal matching measured reality.

**Option B: reintroduce stationing.** Add `producedAt` backfill + enforce the stamp on
every unit-creating path (both builds, bot growth, tutorials), then make abandon kill
stamped units. This is a *feature* (per-factory stationing) with a migration and a
balance surface — belongs in its own FID if the operator wants the 2025-10 concept back.

**Option C (rejected): alias `units` → `players` + translate doc filters.** Impossible
semantically: `owner/factoryX/factoryY` have no columns; `players.units` holds a
different shape. Rejected by evidence.

### Finding 2 — BattleLog retention

Rewrite `countOldBattleLogs`/`cleanupOldBattleLogs` in `app/api/logs/cleanup/route.ts`
against the shim collection `battleLogs` (maps to the real `battle_logs` table) with a
drizzle `lt(timestamp, cutoff)` predicate — and audit the route's other cleanup targets
for the same legacy `clientPromise` pattern. Retention becomes real and honest-counted.

### Finding 3 — playerLevelHistory

Create the missing home: `player_level_history` pg table (`username varchar(20)`, `level
int`, `captured_at timestamp`, pk `(username, captured_at)`) + shim alias
`playerLevelHistory`; translate the four call sites (the `{u,l,t}` short-key docs become
rows; insert in the cron, select in growth/prediction, delete in purge). Snapshot history
starts accruing from deploy; predictions keep their fallback until data exists (honest).

### Finding 4 — clan_territories

Delete `lib/cacheWarming.ts`'s territory branch (module is barrel-only dead code; the
table concept has no schema). If clan territory returns as a feature, it returns with a
schema and its own FID.

**Implementation is gated** (G-laws): Phase A = Finding 1 (+4, trivial deletion); Phase B
= Findings 2–3 (retention + snapshot table/migration). Each lands with its own tests.

## 4. Verification plan (per finding, for the implementation session)

| Finding | Proof |
| --- | --- |
| 1 | Abandon drive over HTTP (FID-004 sweep pattern): factory resets, `factory_count` recounts, response carries no units warning, `players.units` untouched; unit tests pin the message contract |
| 2 | Seed `battle_logs` rows older than retention → cleanup route deletes exactly them (live + unit); honest deletedCount in the response |
| 3 | Cron route invoked → row persists in `player_level_history`; growth-rate returns real data after two snapshots; purge removes only old rows |
| 4 | `tsc`/grep proves no remaining references; barrels updated |
| All | Full gates (tsc/lint/vitest) + updated contract tests |

## 5. Perfection Loop record

- **Loop 1 (design audit):** initial draft aliased `units` → `players` (Option C-shaped).
  Self-audit against the live `players.units` shape (0/57 with `producedAt`) falsified it —
  the alias would map filters to nonexistent columns. Reframed to the domain-shift
  analysis and Option A. The census also widened the FID from one collection to four.
- **Loop 2 (deep audit):** verified the cron route (`app/api/cron/player-snapshot`)
  genuinely schedules `capturePlayerSnapshot` (so the dead write is on a real timer, not
  vestigial code); confirmed the cleanup route's admin gate is sound (only its storage
  layer is dead); confirmed Option B's backfill scale honestly (57 players' units lack
  stamps — a backfill can only approximate by createdAt heuristics, strengthening the
  Option A recommendation for now); checked `system_logs` alias (exists → not a finding).
  Two refinements folded (cron scheduling note; backfill honesty). No further actionable
  improvements — **converged in 2 of 10 iterations, no oscillation.**

## 6. Verification (document-only session)

Gates re-run as Method-1 proof of zero code drift: `npx tsc --noEmit` exit 0 ·
`npm run lint` exit 0 · `npm run test:ci` **769 passed / 1 skipped / 0 failures**.
Scratch census/probe scripts deleted after use; evidence preserved in §2.

## 7. Closure

- **Gates:** [x] census complete (22 names resolved) · [x] live shape probe · [x] loop converged · [x] machine re-census confirms the unmapped set and caller citations (`scripts/censusCollectionMapping.ts`, 2026-09-14)
- **Commit hash (G2):** _pending implementation + commit (spec FID; Phases A/B gated)_
- **Staging plan:** Phase A — `app/api/factory/abandon/route.ts`, `lib/cacheWarming.ts`; Phase B —
  `lib/db/migrations/0031_player_level_history.sql`, `lib/db/schema/playerHistory.ts`,
  `lib/db/schema/index.ts`, `lib/playerHistoryService.ts`, `app/api/cron/player-snapshot/route.ts`,
  `app/api/logs/cleanup/route.ts`, `lib/dmService.ts` (stale-doc fix from the MySQL sweep);
  plus `__tests__/lib/collectionCensus.test.ts`, `scripts/censusCollectionMapping.ts`, this FID,
  `SCOPE.md`, `dev/session-summaries/SESSION-2026-09-14-010.md`

---

**Addendum 2026-09-15 (Phases A + B implemented, operator-directed):** Phase A removed abandon's
obsolete units-accounting block (the unmapped `units` collection) and the dead cacheWarming
territory branch (unmapped `clan_territories` + zero-reader cache keys) with doc updates. Phase B
shipped migration 0031 (`player_level_history`, PK (username, captured_at)), the
`playerLevelHistory` schema export (resolves directly on the shim — no alias entry needed), the
service rewritten on drizzle with the public API intact, and two latent cron-route bugs found
while migrating: the player query filtered on phantom `lastActive` (no such column — the shim
matched nothing) instead of `lastLoginDate`, and snapshots keyed by the dead Mongo-era `_id`
instead of username. Retention now really counts/deletes on the mapped `battleLogs` table with
honest `.returning()` counts. Live: table applied to the DB (information_schema-verified);
snapshot insert → growth-rate read → prediction → cleanup verified end-to-end. The MySQL-era SQL
sweep commissioned alongside found **zero live remnants** — every hit was a comment or valid pg
syntax; the two stale `JSON_CONTAINS` doc-comments in `dmService.ts` were corrected.
**Final status:** implemented + live-verified (closes on commit per G2)
