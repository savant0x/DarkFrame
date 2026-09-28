# FID-20260927-001: One farmable-terrain truth — the advertised set exists in seven unverified copies

**Filename:** `FID-20260927-001-farmable-terrain-single-source.md`
**ID:** FID-20260927-001
**Severity:** HIGH
**Status:** implemented
**Created:** 2026-09-27

---

## 1. Summary

"Which terrains are farmable" — the set `{Metal, Energy, Cave, Forest}` — is written out independently in **seven** places across **six** files (SCOPE row 129 said four; the census was already stale when this FID's sweep re-ran it, which is the drift class proving itself). FID-20260925-003 was one of these copies disagreeing with the others: Forest was advertised by three copies while the eligibility guard refused it, silently disabling ~2% of the map for every player. The interim control — the FID-003 pin test — pins the guard against **its own hardcoded copy** of the advertised set, so it cannot detect future drift by construction. This FID extracts the set into one named constant beside `TerrainType`, routes every consumer through it, and pins the single copy against the authoritative terrain inventory with a census-style test that fails on any future disagreement.

## 2. Evidence (RED)

All findings cataloged before any fix is designed. Every claim is a re-executed command from this session (2026-09-27), not recalled.

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | **The authoritative terrain inventory declares the enum but no farmability predicate** — `TerrainType` has 9 members; only 4 carry payout paths; the inventory knows which of its own members exist, not which are farmable, and nothing binds the two | `types/game.types.ts:28-38` | `sed -n '28,38p'` → `Metal, Energy, Cave, Forest, Factory, Wasteland, Bank, Shrine, AuctionHouse` |
| 2 | **Copy 1 — the server eligibility guard** (the copy FID-20260925-003 fixed) | `lib/harvestService.ts:136` | `if (![TerrainType.Metal, TerrainType.Energy, TerrainType.Cave, TerrainType.Forest].includes(tile.terrain))` |
| 3 | **Copy 2 — the route's dispatch chain** (if/else chain, four branches) | `app/api/harvest/route.ts:100-108` | `grep -n "tile.terrain === TerrainType.Metal \\|\\| tile.terrain === TerrainType.Energy" app/api/harvest/route.ts` → `100:` (+ `:104` Cave, `:106` Forest, `:108` else `HARVEST_INVALID_TILE`) |
| 4 | **Copy 3 — the engine's advertised set** (string literals, not enum members — tsc cannot check it against `TerrainType` at all) | `utils/autoFarmEngine.ts:1039` | `const harvestableTerrains = ['Metal', 'Energy', 'Cave', 'Forest'];` — a typo here compiles clean and is invisible to the compiler |
| 5 | **Copy 4 — the viewport predicate** | `components/TileRenderer.tsx:163-167` | `const isTileFarmable = (terrain: TerrainType): boolean => { return terrain === TerrainType.Metal \|\| ... }` |
| 6 | **Copy 5 — a SECOND copy inside TileRenderer**: the harvest-button guard is an independent inline OR-chain, not a call to `isTileFarmable`; row 129's census counted this file once | `components/TileRenderer.tsx:1052` | `{onHarvestClick && (tile.terrain === TerrainType.Metal \|\| ... \|\| tile.terrain === TerrainType.Forest) && (` |
| 7 | **Copy 6+7 — TileHarvestStatus duplicates the list TWICE inside one component** (effect body `:45`, render guard `:99`); the file is LIVE — imported by `StatsViewWrapper.tsx:38` (grep → 1 importer); row 129's census did not count this file at all | `components/TileHarvestStatus.tsx:45-50, 99-104` | `grep -n "harvestableTerrains = \[" components/TileHarvestStatus.tsx` → `45:`, `99:` |
| 8 | **The engine list is client-local; the server owns eligibility.** The engine sends a harvest request for every tile in its local set; the server's `canHarvestTile` (`:136`) decides. A tile the engine advertises but the server refuses is paid for with the Basic-tier `HARVEST_DELAY_EXTRA` 2000 ms per tile — the exact waste FID-20260925-003 §2 documented for Forest | `utils/autoFarmEngine.ts` (HARVEST_DELAY_EXTRA) vs `lib/harvestService.ts:136` | constructor: `this.HARVEST_DELAY_EXTRA = 2000; // 2s extra after harvest (3s total = cooldown respected)` |
| 9 | **The interim control pins the guard against its own frozen copy** — `advertised` is a locally declared list identical to the guard's, so a future edit to either survives the test: the test would keep testing its own list | `lib/harvestService.test.ts:375-383` | `const advertised = [TerrainType.Metal, TerrainType.Energy, TerrainType.Cave, TerrainType.Forest]; for (const terrain of advertised) { ... }` |
| 10 | **The help page advertises the same set in prose** — documentation drift when the set next changes (help text updated for Forest during FID-003's incident, proving the prose is maintained by hand) | `app/help/page.tsx:179` | `Automatically harvests Metal, Energy, Caves, and Forests` |
| 11 | **Row 129's own census was stale** — it said four places in four files; the real count at filing time is seven instances in six files | SCOPE.md row 129 | `sed -n '1294p' SCOPE.md` → "defined in four places"; §2 above shows 7 instances |

**Call-graph notes (Law 4):** every copy is reached in production. Server chain: `POST /api/harvest` (`route.ts:100-108`) → `harvestResourceTile`/`harvestCaveTile`/`harvestForestTile` → `canHarvestTile` (`lib/caveItemService.ts:334,485`); `GET /api/harvest/status` → `getHarvestStatus` → `canHarvestTile`. Client: `TileRenderer` renders the tile view inside `GameLayout`; `TileHarvestStatus` renders inside `StatsViewWrapper` (grep: exactly one importer); the engine's `attemptHarvest` runs on every auto-farm tick. No copy is dead code, so no copy can be deleted — they can only be re-pointed.

## 3. Impact Analysis

- **Who/what is affected:** the harvest feature end to end — server eligibility (`canHarvestTile`, `harvestResourceTile`), the route contract (`/api/harvest`), auto-farm's advertised set and its cooldown-respecting delays, the viewport chip, the harvest cooldown indicator, the harvest button's visibility, and the help page's prose.
- **Failure modes if unfixed:** the next terrain-level change (new harvestable terrain, removal, or a rename) must be hand-synced into 7 places; the FID-20260925-003 incident class repeats silently. The engine copy is string-typed, so even a `TerrainType` rename is invisible to it. The pin test cannot catch drift because it tests its own list.
- **Blast radius of the fix:** direct — six files re-pointed to one constant; the constant is a new export beside `TerrainType`; one new pin test. Transitive — none: no signature, payload, route, or schema changes; behavior is byte-identical when the copies agree (verified in §6); `applyHarvestGains`' site comment ("must not grow farmable-list knowledge") is preserved — the helper still maps gains and never consults the constant.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | **Yes.** The constant is the single definition; the pin test fails the build on any future disagreement between the definition, the authoritative terrain inventory, and every consumer's re-pointed predicate — including the string-typed engine list (enum-keyed) and the help prose (derived from the same constant). |
| Scales (design tolerates growth; harness reference is 1000 agents)? | **Yes.** Adding farmable terrain #5 is a one-line edit to the constant plus one line in the pin's intent records; every consumer follows. The census-style pin pattern is the same one Gate 4 (schema-consumer) uses, proven at 57 tables. |
| Survives a hostile attacker, not just an honest user? | **Yes — attack surface unchanged or narrowed.** The server guard remains the only authority for eligibility (clients were never trusted); the constant cannot widen the attack surface because the server predicate still gates every payout. A client lying about farmability gets the server's refusal, exactly as today. |
| Maintainable in 2 years? | **Yes.** One named, self-documenting definition with its invariant recorded at the site; consumers read `FARMABLE_TERRAINS.includes(...)` — self-explanatory; the pin test mechanically fails on drift instead of relying on review memory of row 129. |
| Sets the standard for the industry? | **Yes.** Single source of truth + census-style verification is the same standard this repo already applies to schemas (Law 17) and routes (Gate 1); this closes the last unguarded "truth in N places" class the ledger tracks. |

## 5. Proposed Fix (GREEN)

Minimal changes: **one definition, re-pointed consumers, one census-style pin.** No behavior change while the copies agree — this FID re-points truths, it does not move one.

- **Approach:** define the set once next to the enum it qualifies (its natural home — the enum's members are what it names, and `types/index.ts:23` already re-exports `game.types`, so every consumer imports it through its **existing** import statement with zero new import edges). Export as a `readonly` enum-keyed array plus a predicate, so consumers express intent (`isFarmableTerrain(t)`) instead of re-deriving membership, and so tsc rejects a future rename of any enum member at every use site.
- **Alternatives considered:**
  1. *Status quo (keep four-to-seven copies, test as guard)* — rejected: the test's own hardcoded copy (finding 9) makes it structurally incapable of detecting drift, and row 129's census already rotted (finding 11). The decision row 129 awaited was between exactly this and a shared constant; the shared constant + pin answers the Five Questions, the status quo demonstrably does not (it already failed once).
  2. *Derived-from-map-weights* (`TERRAIN_COUNTS`/`mapService` weights as the truth) — rejected: the generator's weights are a distribution policy, not an eligibility contract; Farmable ≠ "has a weight" (Factory and Wasteland have weights), and deriving an eligibility predicate from a cost/policy table couples two unrelated concerns.
  3. *Server-exported capability endpoint* — rejected: adds a network round-trip and a new API to a purely static game rule; over-engineering for a constant.
  4. *Object map `Record<TerrainType, boolean>`* — considered and rejected in favor of the array: an object's completeness is compile-checked per enum member, but *its values* (true/false) are exactly the drift this FID exists to prevent — and a partially-written object maps missing members to `undefined` (falsy), silently de-farming a terrain. The array + inventory pin fails loudly instead.
- **Changes:**

| File | Action (create/modify/delete) | Description |
| ---- | ----------------------------- | ----------- |
| `types/game.types.ts` | modify | Below `TerrainType` (`:38`): export `FARMABLE_TERRAINS: readonly [TerrainType.Metal, TerrainType.Energy, TerrainType.Cave, TerrainType.Forest]` and `export function isFarmableTerrain(t: TerrainType): boolean`. Doc comment states the invariant: *"Every terrain listed here must have a server payout path reachable from `/api/harvest`, and every terrain a payout path can pay must be listed. The census-style pin (`__tests__/terrainTruth.test.ts`) enforces both directions. FID-20260925-003 is the incident this prevents."* |
| `lib/harvestService.ts` | modify | `canHarvestTile:136` → `if (!isFarmableTerrain(tile.terrain))`. Docstring list at `:111` updated to point at the constant. Import via the existing `@/types` barrel (`:14`). |
| `app/api/harvest/route.ts` | modify | Dispatch `:100-108` → `if (isFarmableTerrain(tile.terrain))` followed by the existing per-terrain branches (Metal/Energy vs Cave/Forest stay explicit — they select payout *paths*, which are genuinely different code paths, not farmability). |
| `utils/autoFarmEngine.ts` | modify | `:1039` string array → `const tileIsFarmable = isFarmableTerrain(tileInfo.terrain);` — the engine list becomes compiler-checked against `TerrainType`; the string-typo hazard (finding 4) is deleted. `applyHarvestGains`' site comment unchanged (row 129 guard preserved). |
| `components/TileRenderer.tsx` | modify | `isTileFarmable:163-167` body → `return isFarmableTerrain(terrain);` (the local name and its call sites stay — display semantics unaffected, per row 129's scope note). Button guard `:1052` → `onHarvestClick && isFarmableTerrain(tile.terrain) && (`. |
| `components/TileHarvestStatus.tsx` | modify | Both internal arrays (`:45-50`, `:99-104`) → single `isFarmableTerrain(currentTile.terrain)` checks. The component's own 5-minute `HARVEST_COOLDOWN_MS` display logic is NOT touched (row 130's adjacent sub-item — separate decision). |
| `lib/harvestService.test.ts` | modify | `advertised` (`:375`) → `import { FARMABLE_TERRAINS } from '@/types/game.types'` and iterate that — the guard test now tests the ONE definition against the guard, so guard-vs-definition drift is caught at unit level too. |
| `__tests__/terrainTruth.test.ts` | create | The census-style pin (detailed below) — the cross-file control no single unit test provides. |
| `app/help/page.tsx` | modify | `:179` prose derived from the constant with a local presentation-label map: `const FARMABLE_TERRAIN_LABELS: Partial<Record<TerrainType, string>> = { [TerrainType.Cave]: 'Caves', [TerrainType.Forest]: 'Forests' }` — labels are **display only**; membership comes from `FARMABLE_TERRAINS.map(t => FARMABLE_TERRAIN_LABELS[t] ?? t)` (Metal/Energy pass through their enum names; a future member renders sensibly by default). SELF-CORRECT note (AUDIT pass 3): the original sketch `t.toLowerCase() + 's'` rendered `Energys` — a GREEN defect caught by the loop's own re-read and replaced by the label map. |

- **The pin (`__tests__/terrainTruth.test.ts`) — four assertions:**
  1. **Inventory direction:** every member of `FARMABLE_TERRAINS` is a `TerrainType` member (compile-time by construction, asserted at runtime for the record) — no phantom terrain.
  2. **Consumer direction (the Gate-4-style census):** scan `lib/`, `app/api/`, `components/`, `utils/` for `TerrainType.Metal` occurrences and assert each file that names a farmable member names them through the constant or the predicate — mechanically: **no file outside `types/game.types.ts` may contain the sequence `TerrainType.Metal` alongside `TerrainType.Cave` or `TerrainType.Forest` in the same statement** (the fingerprint of a hand-rolled farmability list). `harvestResourceTile`'s internal Metal/Energy branch and the route's path-selection survive because they compare a single terrain against a path, not a set — the assertion targets set-shaped comparisons, and the suite fails with the offending file:line in the message if a sixth copy ever appears.
  3. **Payout direction:** `FARMABLE_TERRAINS` ⊆ the terrains the route can dispatch — pinned by asserting the route file contains a branch naming each constant member (static grep of `app/api/harvest/route.ts` for `harvestResourceTile`/`harvestCaveTile`/`harvestForestTile` coverage). FID-20260925-003's incident, caught by tool instead of by a player.
  4. **Intent records:** the constant equals the documented set `{Metal, Energy, Cave, Forest}` — the assertion that fails first when a human legitimately changes the farmable set, forcing the intent to be updated in one place, not seven.
- **Verification plan:** `npx tsc --noEmit` (0 errors); `npm run lint` (0/0); `npm run test:ci` (all suites, count = 1342 + the new pin file); full 10-gate chain exit 0; red drill below.
- **Red drill obligation (before the fix lands):** the pin's consumer-direction and payout-direction assertions are validated against the PRE-fix tree — the consumer-direction assertion must FAIL (finding the 5 hand-rolled copies it exists to catch: `harvestService:136`, `autoFarmEngine:1039`, `TileRenderer:164/1052`, `TileHarvestStatus:45/99`), then pass after re-pointing. The inventory/intent assertions must pass both before and after (the set itself is not changing in this FID).
- **Call-graph reachability plan:** `grep -rn "isFarmableTerrain\|FARMABLE_TERRAINS" lib/ app/ components/ utils/` must show the definition plus every re-pointed site (§5 table count: definition + 7 use sites + 2 test/pin files); `grep -n "harvestableTerrains" utils/ components/` → **0 matches** (both string-typed arrays deleted); behavior equality re-verified by the full suite including `lib/harvestService.test.ts`'s 38 assertions.

## 6. Audit Record

Double audit — two independent methods, evidence pasted, no self-reporting.

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: command re-execution | Every §2 evidence row re-executed this session against the current tree; §5's approach validated against the actual import graph and call graph; row-129 census recount | `grep -c "harvestableTerrains"` (7→ recount), `grep -rn "isTileFarmable"`, `grep -n "TerrainType" types/index.ts` → `export * from './game.types'`, per-finding commands in §2 with outputs pasted | pass |
| Method 2: manual re-read against this FID | §2 re-read file-by-file in full windows (`harvestService.ts` 484 lines, `route.ts` 275, `TileHarvestStatus.tsx` full, `TileRenderer` windows `:140-199`/`:1035-1064`, `game.types` `:24-73`/`:770-839`, `harvestService.test` `:366-390`, template, architecture notes); §5's per-file plan re-read against each file's actual structure (imports, locals, tests); Five Questions re-checked; the `applyHarvestGains` row-129 comment confirmed preserved in the plan; circuit breakers tracked (3 passes, delta < 2% between passes 2-3); one GREEN defect found and self-corrected (help-page label derivation — recorded in §5) | this document §2/§5 as written | pass (after self-correct) |

- Caller checks (AUDIT rule for any new symbol): `isFarmableTerrain` and `FARMABLE_TERRAINS` are **planned** symbols — §5's reachability plan names their exact post-implementation grep and requires the 7 re-pointed use sites + zero orphaned old forms before `implemented` may be claimed. Zero production callers at `implemented` = FID rejected by the loop's own rule.
- Audit outcome: **PASS → status `loop-complete`** (the LOOP converged; the status says what happened to the DOCUMENT, not the code). Circuit breakers: 3 GREEN passes total; character delta between passes 2 and 3 < 2% (converged); no issue reappeared 3×; iteration count 3 of 10.
- Honest limitations recorded: (1) the payout-direction pin greps the route's *source* for branch coverage — it verifies the dispatch names each farmable terrain, not that every branch terminates in a real payout (that half is FID-003's unit-level guard, retained); (2) the help-page derivation changes rendered prose only if the set changes — today's output is verified equal to the current hand-written line in implementation testing; (3) `TileHarvestStatus`'s 5-minute cooldown semantics are untouched (row 130's adjacent sub-item stays open).

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** implemented 2026-09-27 (G2 commit outstanding — the agent does not execute git). Operator approval to implement: session directive "approve all pending work … Proceed".

**Implemented exactly as §5 specified.** `FARMABLE_TERRAINS` (`readonly TerrainType[]`) and `isFarmableTerrain(t)` added below the enum in `types/game.types.ts`; all eight use sites re-pointed — `lib/harvestService.ts:145` guard, `app/api/harvest/route.ts:106` dispatch guard, `utils/autoFarmEngine.ts:1043` (string array deleted), `components/TileRenderer.tsx:168` predicate + `:1053` button guard, `components/TileHarvestStatus.tsx:46` + `:93` (both arrays deleted), `lib/harvestService.test.ts:379` (`advertised` list deleted), `app/help/page.tsx` prose derived from the constant via the label map.

**Red drill (the FID's own obligation), executed before the fix:** the pin was written first and run against the unre-pointed tree. It failed, naming the copies. Three passes were needed to make the census honest, and each pass was driven by a real file:

1. First version flagged 4 sites — a same-line check. Too weak: it missed `TileRenderer`'s 4-line OR-chain and reported only the *first* `harvestableTerrains` array per file. Rejected.
2. Second version was statement-scoped and found 9, including two **false positives**: `mapService.ts:441` (a weight table spanning Metal→Wasteland) and `terrainCodec.ts:32` (a 9-member wire codec). A farmable set is a *subset* of both, so neither is a farmability list. Fixed by excluding statements that also name a non-farmable terrain.
3. Third version found a **genuine eighth copy the FID's own §2 census had missed**: `components/HarvestModal.tsx:44`, `PRE_HARVEST_MESSAGES`. It is a `Record` keyed by exactly the four farmable terrains — a lookup table, not a membership list, so it was excluded from the census by brace-matched `Record<…> = {…}` span detection. But it is coupled to the farmable set and degrades *silently* (an unmapped terrain falls through `|| []` to `'Ready to harvest?'`), so a fifth farmable terrain would have shipped a wrong message unnoticed. A new assertion (§5 group 5) now pins that every farmable terrain has a message.

Final red drill: `1 failed | 7 passed` naming 8 offender sites across 5 files, with zero false positives. Post-fix: the census is clean.

**Verification, this session, all pasted from tool output:**
- `npx vitest run __tests__/terrainTruth.test.ts lib/harvestService.test.ts` → `Test Files 2 passed (2)`, `Tests 47 passed (47)`
- `npx tsc --noEmit` → exit 0 — after tsc caught a real break mid-implementation: removing `TerrainType` from `TileHarvestStatus.tsx`'s import orphaned its use at `:21` (`TS2304`), restored
- `npx eslint .` → exit 0
- `npx vitest run` (full) → **`Test Files 141 passed (141)`, `Tests 1354 passed (1354)`**, `Failed Tests` marker count 0
- `node scripts/ledgerIntegrityCensus.cjs` → exit 0, `ledger census clean`; `schemaConsumerCensus` → 57/57 live, 0 violations; `hostTimezoneCensus` → exit 0
- **Call-graph reachability (Law 4):** `isFarmableTerrain|FARMABLE_TERRAINS` resolves to the definition (`types/game.types.ts:54,62,68,69`) plus 7 production use sites (`route.ts:12,100,105,106`; `help/page.tsx:30,35,46`; `TileHarvestStatus.tsx:15,46,93`; `TileRenderer.tsx:20,168,1053`; `harvestService.ts:21,112,126,130,145`; `autoFarmEngine.ts:25,1043`) plus 2 test files. **Zero orphaned old forms:** `harvestableTerrains` across `utils/` + `components/` → **0 matches**.

**Deviation from §5, recorded:** the plan said the route's dispatch would become `if (isFarmableTerrain(tile.terrain))` wrapping the existing branches. Implemented as an early-return guard instead, with the same semantics and the same `HARVEST_INVALID_TILE` response — a guard reads better beside a `log.warn` than a positive condition wrapping a four-branch chain, and it keeps the payout-path branches visually unchanged for the next reader.

## 8. Closure

- **Gates:** [ ] typecheck 0 errors · [ ] lint 0 errors/0 warnings · [ ] tests pass · [ ] call-graph proven
- **Commit hash (G2 — required for `closed`):** *(prepared by agent; committed by operator or under approved agent-run execution — the agent does not execute git unprompted)*
- **Staging plan (path-scoped, G3/G4):** commit 1 (definition + consumers + tests): `git add types/game.types.ts lib/harvestService.ts lib/harvestService.test.ts app/api/harvest/route.ts utils/autoFarmEngine.ts components/TileRenderer.tsx components/TileHarvestStatus.tsx __tests__/terrainTruth.test.ts app/help/page.tsx`; commit 2 (ledger): `git add dev/fids/ SCOPE.md CHANGELOG.md VERSION dev/session-summaries/` — never `git add -A`.
- **Commit message (G8):** `refactor(harvest): one farmable-terrain truth — the advertised set is defined once and pinned by a census-style test (FID-20260927-001)`
- **Archive:** move to `dev/fids/archive/` on `closed` only; CHANGELOG entry; archival logged in the session summary. Never at `loop-complete`.

---

**Final status:** loop-complete
