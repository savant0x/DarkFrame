# FID-20260914-004: shim hardening — dead $pull SQL, honest update/delete counts, real $addToSet

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID per templates/FID-TEMPLATE.md.
  Attribution rule honored: no author field, no signatures.
-->

**Filename:** `FID-20260914-004-shim-hardening-pull-and-update-counts.md`
**ID:** FID-20260914-004
**Severity:** HIGH
**Status:** closed
**Created:** 2026-09-14

---

## 1. Summary

FID-20260914-003 banked two follow-ups against the Mongo→pg compat seam (`lib/mongodb.ts`):
replace the dead `$pull` SQL with the probe-verified `jsonb_agg` rewrite, and give the
seam real conditional-update semantics so money/ integrity branches can trust their
result counts. This FID specifies both, plus a third defect found while enumerating the
same operator family: `$addToSet` is implemented as an unconditional append (push
semantics), silently violating Mongo set semantics for its one live caller. The blast
radius is one shim file plus new unit tests; no caller changes are required — the fixes
make EXISTING caller code (seven failure branches that currently read fictional counts)
honest without touching it.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | **`$pull` emits SQL that cannot execute on this engine.** The handler builds `coalesce(col,'[]'::jsonb) - <operand>::jsonb`. The live probe (`scripts/probePullObjectOperand.ts`, read-only SELECTs, exit 0) proved pg rejects the operator: `operator does not exist: jsonb - jsonb` — for object AND scalar operands, matching and non-matching. Any `$pull` use is a guaranteed 500. Status after FID-20260914-003: ZERO live callers (grep over `lib/` + `app/` excluding tests returns only the shim itself, its type, a comment, and FID-003's removal note in auctionService) — the defect is LATENT, not active. But the shim API advertises `$pull` (`MongoUpdate.$pull`), so the next caller writes a crash. | `lib/mongodb.ts:713-716` (`$pull` branch), `lib/mongodb.ts:80` (type advertises `$pull`), probe output (2026-09-14): "probe: shim-shape object operand (jsonb - jsonb) → FAILED … operator does not exist: jsonb - jsonb" | grep `\$pull lib/ app/ --include='*.ts'` (excl. tests) → 4 hits, none a live call site; probe script run recorded in SESSION-2026-09-14-003 |
| 2 | **The probe-verified replacement exists and is banked:** `coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(col) e WHERE e <> <operand>), '[]'::jsonb)` — deep-equality element removal (jsonb `<>` is structural), returns `[]` when the array empties, coalesced so a fully-emptied column stores `[]` not NULL. Probe: "probe: jsonb_agg rewrite CONFIRMED — drop-in $pull replacement for the shim-hardening follow-up". | `scripts/probePullObjectOperand.ts` (rewrite leg, exit 0) | probe output line quoted above |
| 3 | **`updateOne` returns `modifiedCount: 1` unconditionally** (five return sites across the success paths), whether or not the filter matched a row. Seven live failure branches read this fictional number: `app/api/admin/ban-player/route.ts:221` (ban integrity), `app/api/factory/abandon/route.ts:133`, `app/api/factory/upgrade/route.ts:201,231`, `app/api/player/build-unit/route.ts:378,409` (batch integrity — `slotWrite.modifiedCount < factoryUpdates.length` can never trip), `app/api/player/greeting/route.ts:58`. FID-20260914-003 was FORCED around this (claim-first `findOneAndUpdate` instead of match-count detection) because the count cannot be trusted. `lib/researchPointService.ts:331` separately documents the workaround culture: "Drizzle doesn't return modifiedCount, so we verify" — a comment that is false for the shim (it returns a fictional count) and true for raw drizzle. | `lib/mongodb.ts:1330,1336,1346-1349` (`return { modifiedCount: 1 }`), `lib/mongodb.ts:1360-1363` (`updateMany` same), `lib/mongodb.ts:1366-1370` (`deleteOne` → `deletedCount: 1`), `lib/mongodb.ts:1372-1376` (`deleteMany`), `lib/mongodb.ts:1435-1447` (`bulkWrite` sums fiction) | grep `modifiedCount` across `lib/ app/` (excl. shim) → the seven branch sites above |
| 4 | **`deleteOne`/`deleteMany`/`bulkWrite` counts are equally fictional** — `drizzleDb.delete(t).where(w)` discards the real affected-row count. Consumers: `lib/beerBaseAnalytics.ts:499-506` (reports `spawnsDeleted`/`defeatsDeleted` — admin analytics showing wrong numbers), `lib/playerHistoryService.ts:336-340` (purge reporting), `lib/beerBaseService.ts:1386`. | `lib/mongodb.ts:1366-1376` | grep `deletedCount` |
| 5 | **`$addToSet` is an unconditional append** (`coalesce(col,'[]'::jsonb) \|\| [value]` — identical to the `$push` handler), so Mongo's set semantics (no duplicates) are silently violated. Live caller: `lib/tierUnlockService.ts:105` (`$addToSet: { unlockedTiers: tier }`) — re-unlocking an already-unlocked tier appends a duplicate entry to the jsonb array. One live caller, LOW-MED severity, but it is the same operator-family defect class and a one-line fix alongside the others. | `lib/mongodb.ts:753-758` (`$addToSet` branch — read in full), `lib/tierUnlockService.ts:105` | read of the `$addToSet` loop: `payload[key] = sql\`coalesce(...) \|\| ${JSON.stringify([value])}::jsonb\`` |
| 6 | **The in-repo fix precedent is established**: 10+ services already count real affected rows via drizzle `.returning()` (e.g. `lib/friendService.ts:275` "pg: RETURNING length replaces mysql2 affectedRows", `lib/moderationService.ts:356`, `lib/concentrationZoneService.ts:132`). The fix is idiomatic HERE, not imported practice. | grep `.returning(` → 10 hits in `lib/` | grep output recorded 2026-09-14 |
| 7 | **Cleared — the insert-if-no-match block is upsert-gated** (`options?.upsert`), so unconditional counts do NOT imply phantom-row creation on missed filters. Documented so the implementation audit does not re-flag it. | `lib/mongodb.ts:1284-1288` | read of `updateOne` head |

**Call-graph notes (Law 4):** the seam is THE persistence layer — every collection call in
`lib/` and `app/` routes through `getCollection`. The affected surfaces: `$pull` (zero
callers — the point of fixing before the next caller), counts (seven live branches +
three reporting sites), `$addToSet` (one caller). No schema changes; no API signature
changes except WIDENING the returned result type (additive).

## 3. Impact Analysis

- **Who/what is affected:** every consumer of `updateOne`/`updateMany`/`deleteOne`/
  `deleteMany`/`bulkWrite` results — most urgently the seven failure branches that exist
  to catch "row not found" and currently cannot; admin analytics reporting; the next
  developer to reach for `$pull` (guaranteed 500); `tierUnlockService` (duplicate tiers).
- **Failure modes if unfixed:** silent integrity violations (ban reported failed but
  applied, or vice versa — the worst case is a ban that "failed" and actually landed, or
  a factory/build write that failed but the route reported success); a guaranteed-crash
  operator advertised in the shim's public type; corrupted jsonb arrays.
- **Blast radius of the fix (Section 5):** `lib/mongodb.ts` only (one file), plus a new
  unit-test file. Widening return types is additive; the seven branches begin working
  with ZERO caller edits. Risk: a count that was fictional `1` becoming an honest `0`
  could expose latent bugs in branches that were never exercised — those branches were
  WRITTEN to catch exactly that, so exposure is the fix working.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — counting via `.returning()` is exact for matched-0, matched-and-set, and SQL-fragment updates alike; the `$pull`/`$addToSet` rewrites are total over empty arrays, missing elements, and object/scalar operands |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes — `.returning(id)` adds no second query (single round-trip); `jsonb_agg` rewrite is one statement with the same index profile as the dead one |
| Survives a hostile attacker, not just an honest user? | Yes — honest counts close the "reported success on failed write" class that a hostile client can currently trigger by racing (e.g. double-cancel, ban of an already-deleted row); no new attack surface |
| Maintainable in 2 years? | Yes — the seam stops LYING, which deletes the workaround culture (`researchPointService`'s comment, FID-003's `findOneAndUpdate` circumvention); future FIDs can trust counts instead of routing around them |
| Sets the standard for the industry? | Yes — a compat seam's first duty is honest semantics; this converts three silent-liar surfaces into contract-honest ones |

## 5. Proposed Fix (GREEN)

**Approach:** fix the seam in place, minimal surface, `.returning()`-based counting (the
established in-repo idiom). Option B (reimplement `updateOne` as `SELECT` then
conditional `UPDATE` per call) is rejected: it doubles round-trips on the hottest path
and re-introduces read-modify-write races the seam's SQL-fragment design deliberately
avoids. Option C (leave counts fictional, document loudly) is rejected: seven branches
already exist to consume honest counts — the demand is real, today.

- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/mongodb.ts` | modify | (1) `$pull` handler: replace the `jsonb - jsonb` fragment with the probe-verified rewrite — `coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(coalesce(col,'[]'::jsonb)) e WHERE e <> <operand>), '[]'::jsonb)` (deep-equality removal, empty→`[]`). Object AND scalar operands both flow through the same `<>` comparison; no operand-type branching. (2) Honest counts: `updateOne`/`updateMany` chain `.returning({ id: <pk> })` (or the table's primary key via the existing conflict-target helper) onto the drizzle `update()` and report `modifiedCount: rows.length`; `deleteOne`/`deleteMany` do the same on `delete()` → `deletedCount`; `bulkWrite` sums the real per-op counts. SQL-fragment payloads (jsonb_set/`$inc`/`$push`/`$pull` rebinds) are unaffected — `.returning()` composes with `.set(sql\`...\`)`. Tables without an id-style PK: fall back to `returning()` of the first column group drizzle supports; if none, return the drizzle row count via the existing shape (documented in-code). (3) `$addToSet`: append only when absent — `CASE WHEN coalesce(col,'[]'::jsonb) @> <operand-as-element>::jsonb THEN coalesce(col,'[]'::jsonb) ELSE coalesce(col,'[]'::jsonb) \|\| <operand-as-element>::jsonb END` (scalar and object operands wrapped as one-element arrays for the containment probe; matches the `buildDocPathPredicate` dual-probe idiom already in the file). |
| `__tests__/lib/shimUpdateSemantics.test.ts` | new | Unit tests per the repo's scripted-mock idiom (`pushOperandAndPower.test.ts` exports `normalizePushOperand`; here the handlers are exercised through the collection API with a scripted drizzle layer): `$pull` payload contains the `jsonb_agg` fragment and NOT `::jsonb) - `; `$addToSet` payload contains the `@>` guard and an append only in the else branch; `updateOne` on a non-matching filter resolves `modifiedCount: 0`; SQL-fragment updates still count; `deleteMany` reports the real count. Live SQL verification for the `$pull`/`$addToSet` fragments reuses the probe script (read-only SELECTs) — extend it with the `$addToSet` CASE shape. |
| `scripts/probePullObjectOperand.ts` | modify | Add the `$addToSet` containment-guard fragment probe (read-only), so both shipped SQL shapes are machine-verified, not hand-asserted. |

- **Alternatives considered:** (B) SELECT-then-UPDATE reimplementation — rejected (round-trips
  + races, above); (C) document-only — rejected (demand exists at seven call sites);
  (D) also implement `findAndModify`-style atomic `findOneAndUpdate` inside the seam —
  deferred: FID-003 already proved `findOne→updateOne` composition suffices at game scale,
  and true single-statement atomicity belongs to the money-write serialization follow-up
  already scoped in FID-20260914-003 §5 Known residual.

- **Known residual (documented, not deferred silently):** `modifiedCount` in real Mongo
  counts DOCUMENTS MODIFIED, not matched (a no-op `$set` on a matching row counts 0).
  The `.returning()` approach counts MATCHED rows. The seven consumer branches all check
  `=== 0` / `< length` (matched-row semantics), so this divergence is safe for every
  current caller; noted in-code so a future Mongo-exactness need considers a
  read-diff-before-write approach — out of scope here.
- **Verification plan:** `npx tsc --noEmit` → exit 0; `npm run lint` → exit 0;
  `npm run test:ci` → all pass, 0 failures (≥ 748-test baseline + new unit tests);
  probe script (extended) exit 0; live drive: a failing-factory-write path now returns
  its error branch (e.g. abandon a factory row that does not exist → route reports
  failure honestly instead of success).
- **Call-graph reachability plan:** grep `modifiedCount|deletedCount` before/after — the
  seven branches gain a live path; grep `\.\$pull|\$addToSet` after to confirm zero
  regressions in existing callers; `tierUnlockService` unlock path still returns success
  (payload shape change is internal to the shim).

## 6. Audit Record

### Loop 1 — audit of the RED/GREEN document

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | Document-only session must not change code; baseline gates hold | `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm run test:ci` 75 passed / 1 skipped (76 files), 747 passed / 1 skipped (748 tests), 0 failures (2026-09-14, this session) | pass |
| Method 2: manual re-read against this FID | Every file:line claim re-verified by reads of `lib/mongodb.ts` (`$pull`/`$addToSet`/`$push`/`$inc` handlers, `updateOne`/`updateMany`/`deleteOne`/`deleteMany`/`bulkWrite`/`findOneAndUpdate` bodies, upsert gating), the seven `modifiedCount` branch sites, three `deletedCount` sites, `lib/tierUnlockService.ts:105`, probe script, and the `.returning()` precedent sites | findings table cites the re-reads; upsert phantom-insert suspicion checked and cleared (finding 7) | pass |

- Loop 1 outcome: PASS → deep-audit pass.

### Loop 2 — deep audit (adversarial re-check of the loop-1 GREEN)

| Probe | What was checked | Evidence | Result |
| ----- | ---------------- | -------- | ------ |
| `.returning()` on `.set(sql\`...\`)` composes? | SQL-fragment payloads (the $inc/$push/$pull rebinds) must still count | drizzle pg supports `.returning()` on any `update()`; the seam's fragments are `.set()` arguments, orthogonal to the returning clause | cleared |
| Honest counts breaking the seven branches? | A branch that today takes the success path (count 1) but would take the failure path on an honest 0 is the POINT; but a branch checking `!== 1` where `updateMany` matched >1 would newly fail | each of the seven sites read: all check `=== 0` or `< expected` — matched-row semantics; none assumes `always 1` for a multi-match update (`updateMany` callers: ban-player's unban uses `updateMany` without count checks) | cleared |
| `jsonb_agg` rewrite with NULL array elements | `jsonb_array_elements` yields each element including SQL NULLs; `e <> operand` on NULL yields NULL → element DROPPED silently | acceptable: jsonb array elements are never SQL NULL (JSON null is `jsonb 'null'`, which `<>` compares fine); probe covers object/scalar/no-match — add a JSON-null element case to the probe extension to pin it | 1 probe hardening applied to §5 (probe row) |
| `$addToSet` containment probe with scalar vs object operand | `@> '[scalar]'::jsonb` matches element-wise for scalars; object operands need the same wrap | the dual-probe idiom (both wrapped forms ORed) is already the file's own pattern (`buildDocPathPredicate`); spec updated to wrap BOTH operand kinds as one-element arrays | spec tightened |
| upsert path under honest counts | upsert's insert branch returns 1 legitimately; conflict-do-nothing insert that inserted 0 rows would previously report 1 | `.returning()` added to the upsert insert branches too (both onConflictDoUpdate and onConflictDoNothing paths count returned rows) | 1 GREEN scope refinement applied |

- Loop 2 outcome: **1 GREEN scope refinement** (upsert branches included in honest
  counting) + **1 probe hardening** (JSON-null element case); all other probes cleared
  with evidence. Convergence: document delta < 2% across passes; no oscillation;
  iterations used: 2 of 10. Termination: zero further actionable improvements → status
  `converged`.

## 7. Implementation Record (only after status reaches `converged`)

- **Status:** implemented 2026-09-14 on the operator's explicit directive, per the
  FID-20260914-003 precedent.

| Item | Where | Notes |
| ---- | ----- | ----- |
| Honest counts (all five methods + upsert branches) | `lib/mongodb.ts` `updateOne`/`updateMany`/`deleteOne`/`deleteMany` + `bulkWrite` (sums the per-op results) | Bare `.returning()` counts affected rows exactly — no per-table PK discovery needed, composes with SQL-fragment payloads. `updateOne`/`updateMany` with an empty set payload now honestly return 0 (previously fictional 1). Upsert insert branches (`onConflictDoUpdate`, select-then-insert fallback) count their returned rows. |
| `$pull` rewrite | `lib/mongodb.ts` `buildSetPayload` | `coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(coalesce(col,'[]'::jsonb)) e WHERE e <> <operand>::jsonb), '[]'::jsonb)` — the probe-verified deep-equality form, one shape for object AND scalar operands. |
| `$addToSet` guard | `lib/mongodb.ts` `buildSetPayload` | `CASE WHEN coalesce(col,'[]'::jsonb) @> [operand]::jsonb THEN col ELSE col \|\| [operand] END` — containment probe over a one-element array (deep equality for scalars and objects). |
| Unit tests (13) | `__tests__/lib/shimUpdateSemantics.test.ts` + `__tests__/lib/fakeDrizzle.ts` harness | Scripted drizzle layer (CI is DB-less): honest counts incl. non-matching filter → 0, fragment payloads, bulkWrite sum, upsert branches, `$pull`/`$addToSet` SQL-shape assertions (drizzle-0.45 StringChunk-aware flattener). |
| Probe extension | `scripts/probePullObjectOperand.ts` | Shipped fragments verified live (exit 0): `$pull` object + scalar, JSON-null element PRESERVED (loop-2 hardening), `$addToSet` guard absent/present × scalar/object. Legacy `jsonb - jsonb` legs retained as expected-failing documentation; exit gates only the shipped shapes. |
| Live seam verification | `scripts/verifyShimSemanticsLive.ts` (+ `scripts/cleanupShimVerify.ts`) | Scratch players via the real register route, then the REAL seam vs the live engine: matching `$set` → 1, non-matching → 0 (the honest-failure proof), `$inc` → 1, `$push`+`$pull` over `players.units` removes exactly the matching unit, `$addToSet` absent-tier appends / present-tier does not duplicate, `deleteMany` → real 2. Cleanup residual 0/0. |

**Implementation discoveries (Law 1, disclosed):**

1. The upsert `onConflictDoNothing` branch is **dead code**: the whole upsert block is
   gated on `options?.upsert && setPayload` while that branch requires `!setPayload`, so
   empty-update upserts fall through to the final `modifiedCount: 0` return. Not widened
   (no live caller sends an empty upsert); the test asserts the real honest semantics and
   documents the dead branch.
2. The abandon route's HTTP path is gated by its `findOne` pre-check (`Factory not found
   at these coordinates` — live-verified); the `modifiedCount === 0` branch behind it is
   defense-in-depth that was previously DEAD (fictional count) and now works.
3. The seven count branches + three reporting sites gain live paths with ZERO caller
   edits, exactly as specified (grep before/after: call sites unchanged; `build-unit`'s
   `slotWrite.modifiedCount < factoryUpdates.length` batch check is now reachable).

**Evidence (gates, 2026-09-14, post-implementation):** `npx tsc --noEmit` exit 0 ·
`npm run lint` exit 0 · `npm run test:ci` **76 passed / 1 skipped (77 files) · 760 passed /
1 skipped (761 tests) · 0 failures** (+13 over the 747 baseline — the new suite).
Probe exit 0 (all shipped fragments live-verified). Live seam verification exit 0.

**Law 4:** the seam is THE persistence layer — all changes are internal to
`lib/mongodb.ts` (return types widened additively); zero caller edits required, zero
made; `tierUnlockService`'s `$addToSet` path keeps its contract with real set semantics.

## 8. Closure

### Post-implementation live regression sweep (2026-09-14, `scripts/sweepHonestBranchRoutes.ts`)

Live HTTP drive of every route whose failure branch came alive, with per-step DB assertions
and verified cleanup (23/23 checks, exit 0). The sweep's purpose — proving no honest count
turned a previously-successful path into a failure — passed everywhere: build-unit (slots
batch write, player $inc), greeting ($set), factory upgrade/abandon (player + factory
fragments), ban → login blocked → unban → login restored (the ban-integrity branch
end-to-end).

Three REAL defects the sweep surfaced and fixed (all pre-existing, all disclosed):

1. **ban-player + clear-flags audit inserts 500'd after applying** — the legacy Mongo doc
   keys (`adminUsername`/`targetUsername`/`timestamp`/`actionType`) resolve to NO
   mod_log column post-pivot, so NOT NULL `moderator_id`/`target_id`/`created_at`
   rendered as drizzle `default` and every insert died AFTER the ban/flag-clear had
   already been applied (partial-apply, HTTP 500). Fixed to column keys with legacy
   fields preserved in `details`. give-resources/hotkeys' `adminUsername` occurrences
   are log statements only — verified, not affected.
2. **player build-unit unit-array corruption** — the plain-array `$push` operand
   appended as ONE nested element (`[[u1,u2,u3]]`, Mongo parity appends arrays whole)
   AND would triple-count totals on a flat append (full-quantity stamping). Fixed to
   `{ $each: … }` with per-unit `quantity: 1` — the seam's `$each` path is
   probe-verified (this FID's own suite); FID-20260909-033's plain-array workaround
   predates it and was obsolete.
3. **`db.collection('units')` is unmapped post-pivot** — no table alias exists, so the
   abandon route's unit-loss accounting (count/find/deleteMany over the legacy units
   collection) silently no-ops; abandoned factories report 0 units lost while units
   persist in `players.units`. Recorded, NOT patched (semantics change = own FID).
   Also: fixture hygiene — the sweep's original fixed (3,3) factory site inherited
   boot-time bot-economy investment history (log: "Bot investment pass: 5 factories
   upgraded"); the sweep now picks a verified-empty cell at runtime.

Evidence (gates, 2026-09-14, post-sweep-fixes): tsc 0 · eslint 0 · vitest 760/1 skipped/
0 failures — unchanged from the implementation baseline. Sweep exit 0 (23/23).

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass (760/1 skipped/0 fail) · [x] call-graph proven (zero caller edits; seven branches gain live paths)
- **Commit hash (G2 — required for `closed`):** `f075a85` — `fix(shim): real update/delete counts, working $pull, true $addToSet (FID-20260914-004)` (path-scoped: 13 files — shim, 2 new test files, 3 sweep-fixed routes, 5 verification scripts, FID, SCOPE surgical, session record)
- **Staging plan (path-scoped, G3/G4):** `lib/mongodb.ts`, `__tests__/lib/shimUpdateSemantics.test.ts`, `__tests__/lib/fakeDrizzle.ts`, `scripts/probePullObjectOperand.ts`, `scripts/verifyShimSemanticsLive.ts`, `scripts/cleanupShimVerify.ts`, `scripts/sweepHonestBranchRoutes.ts`, `app/api/admin/ban-player/route.ts`, `app/api/admin/anti-cheat/clear-flags/route.ts`, `app/api/player/build-unit/route.ts` (sweep-driven fixes), the FID doc, `SCOPE.md`, `dev/session-summaries/SESSION-2026-09-14-005.md`
- **Commit message (G8):** `fix(shim): real update/delete counts, working $pull, true $addToSet (FID-20260914-004)`
- **Archive:** on close — move to `dev/fids/archive/`, CHANGELOG entry, session-summary log.

---

**Final status:** closed (implemented + live-verified 2026-09-14; committed as `f075a85` 2026-09-14; closed per G2)
