# FID-20260925-003 — Forest tiles could never be harvested: the eligibility guard named three terrains while four have payout paths

**Filename:** `FID-20260925-003-forest-harvest-deadend.md`
**ID:** FID-20260925-003
**Severity:** HIGH
**Status:** closed (2026-09-25, commit `e41a1bf`)
**Created:** 2026-09-25
**Trigger:** operator directive, 2026-09-25 — *"Fix the Forest harvest dead-end so forest tiles can actually be collected, add a regression test that would have caught it, and record the closure in the ledger per protocol."* The directive named the work, the fix and the evidence standard, so the FID records a work order (the FID-20260924-004 shape) rather than gating a plan.

---

## 1. Summary

`lib/harvestService.ts` is the single eligibility authority for harvesting, and its terrain gate accepted **three** terrains:

```js
if (![TerrainType.Metal, TerrainType.Energy, TerrainType.Cave].includes(tile.terrain)) {
  return false;
}
```

Four terrains have payout paths. `/api/harvest` dispatches `Metal`/`Energy` to `harvestResourceTile` and `Cave`/**`Forest`** to `lib/caveItemService`, and `harvestForestTile` gates on `canHarvestTile` — the same function above. A forest tile therefore failed eligibility **before its payout path ever ran**, and the refusal was returned to the player as `'You have already explored this forest. It will refresh later.'` — a cooldown the tile had never earned, because the early return happens *before* any harvest record is written. Two consequences follow from that one omitted word:

1. **Forest harvest was impossible for every player, through every path** — the manual `F` key, the viewport harvest button, and auto-farm all funnel into `/api/harvest`. Not a flaky failure, a permanent one.
2. **The viewport chip could never stop saying `ready`.** `components/TileRenderer.tsx` renders the green `ready` chip whenever `isTileFarmable(terrain) && !isPlayerOnCooldown()`, and `isPlayerOnCooldown()` is "does the tile's harvest log contain a record for me" — and no record for a forest tile was ever written by anything. So every forest tile advertised itself as farmable and ready, forever, while yielding nothing. This is the reported symptom exactly: the auto-farm sweep passes over tiles reading `ready` and collects nothing from them, and because the engine's own stats subsystem records no resources at all (§2 finding 7), nothing contradicted the impression.

The fix is one word in the guard. The durable output is the regression test: the file's first new test pins **every terrain the game advertises as farmable** against the guard, so a future terrain cannot be advertised in the UI, priced in the help page and paid out by a route while remaining invisible to eligibility. Drilled red against the pre-fix code (3 failed / 35 passed) and green against the fix (38 passed).

## 2. Evidence (RED)

| # | Finding | Location | Evidence (command + output) |
| - | ------- | -------- | --------------------------- |
| 1 | **The guard accepts three terrains; four have payout paths** | `lib/harvestService.ts:123` (pre-fix) | `grep -n "TerrainType.Metal, TerrainType.Energy, TerrainType.Cave" lib/harvestService.ts` → `123:    if (![TerrainType.Metal, TerrainType.Energy, TerrainType.Cave].includes(tile.terrain)) {`. Post-fix the same guard reads `TerrainType.Cave, TerrainType.Forest` at `:136` |
| 2 | **The route can dispatch Forest, and does** | `app/api/harvest/route.ts` | `if (tile.terrain === TerrainType.Metal \|\| tile.terrain === TerrainType.Energy) … else if (tile.terrain === TerrainType.Cave) … else if (tile.terrain === TerrainType.Forest) { result = await harvestForestTile(username, tile); }` — four branches, one per terrain |
| 3 | **Forest's only payout path gates on the three-terrain guard, so it can never run** | `lib/caveItemService.ts:485` | `grep -n "canHarvestTile(playerId, tile)" lib/caveItemService.ts` → `334` (Cave — in the list, passes) and `485` (Forest — not in the list, always `false`). `harvestForestTile` is the sole caller-path: its only importer is `app/api/harvest/route.ts` (`referencedBy` on the function), so there is no alternate route to a forest payload |
| 4 | **The refusal is reported as an earned cooldown, and writes nothing** | `lib/caveItemService.ts:485-491` | `const canHarvest = await canHarvestTile(playerId, tile); if (!canHarvest) { return { success: false, message: 'You have already explored this forest. It will refresh later.' }; }` — the `return` precedes the `tiles.lastHarvestedBy` append, so the tile's log stays empty |
| 5 | **The chip is permanently green because it reads exactly that empty log** | `components/TileRenderer.tsx:163-173`, `:392-395` | `isTileFarmable` returns `… \|\| terrain === TerrainType.Forest`; `isPlayerOnCooldown()` returns `tile.lastHarvestedBy.some(record => record.playerId === player.username)`; the chip renders `nn-chip--green` with the text `ready` when not on cooldown. Empty log → not on cooldown → `ready`, for the lifetime of the tile |
| 6 | **Auto-farm attempts the harvest and eats the cost anyway** | `utils/autoFarmEngine.ts:987-988`, `:1014-1015` | The engine advertises the same four terrains — `const harvestableTerrains = ['Metal', 'Energy', 'Cave', 'Forest'];` — so it POSTs `/api/harvest`, receives `success:false`, logs `Harvest rejected: You have already explored this forest…`, and on Basic tier still pays `HARVEST_DELAY_EXTRA` (2000 ms) for the privilege |
| 7 | **Why nobody noticed: the subsystem that would have contradicted it reports nothing** (adjacent finding, not fixed here) | `utils/autoFarmEngine.ts`, `app/game/page.tsx:180-181`, `lib/autoFarmPersistence.ts` | The engine's `updateStats({…})` call sites touch only `tilesVisited`, `errorsEncountered`, `attacksLaunched/Won/Lost` — `grep -n "metalCollected\|energyCollected\|caveItemsFound\|forestItemsFound" utils/autoFarmEngine.ts` → **no output**, so session stats read 0 resources collected even when harvests succeed. `mergeSessionIntoAllTime`, `saveAllTimeStats`, `resetAllTimeStats`, `getStatsSummary`, `calculateEfficiency` have **zero callers outside their own module**, and the game page holds both stats in discarded setters (`const [, setAutoFarmSessionStats]`). There is no resource counter in the auto-farm surface at all |
| 8 | **Every other surface advertises Forest as farmable and valuable** | `lib/mapService.ts:444`, `lib/tileMessages.ts:81`, `app/help/page.tsx:41,179,215,259`, `lib/caveItemService.ts:463` | `{ terrain: TerrainType.Forest, weight: 2 }` (~2% of the map; 450 of 22,500 tiles); tile message `"🌲 Ancient Forest - Explore for rare treasures (Better loot than caves!)"`; help page `['Explore Cave/Forest', 'F']`, `Auto-Harvest: Automatically harvests Metal, Energy, Caves, and Forests`, `Forest Items Found`, `Forests: 50% chance to find items (better loot than caves!)`; `harvestForestTile`'s own docstring reads `Harvest a forest tile (BETTER rewards than caves!)` |
| 9 | **The status endpoint inherited the same false negative** | `lib/harvestService.ts:453,458,463` | `getHarvestStatus` returns `canHarvest: await canHarvestTile(playerId, tile)`, and it backs `GET /api/harvest/status` — so the API *also* told the client a forest tile was not harvestable, while the viewport chip computed its own (permanently green) answer. Two client-visible readiness signals disagreed with each other and both were wrong |

Call-graph notes (Law 4): a real runtime path, and the guard is what breaks it.
`POST /api/harvest` ← (manual `F` key handler / `handleHarvest` / viewport button at `app/game/page.tsx:577-603`) and (auto-farm `attemptHarvest`) → `getAuthenticatedUser` → `getPlayerSlim` → `getTileAt(player.currentPosition)` → terrain dispatch → `harvestForestTile` (`lib/caveItemService.ts:470`) → `canHarvestTile` (`lib/harvestService.ts:117`) → **early `return false`**. The failing call is reached on every forest tile by construction; nothing is unwired. The fix restores the branch, it does not add a wire.

## 3. Impact Analysis

- **Who/what is affected:** every player, on the ~2% of the map that is Forest (generator weight 2 of 100), through all three harvest entry points (manual key, viewport button, auto-farm). Plus the two readiness surfaces — the viewport chip and `GET /api/harvest/status` — which reported a state no harvest could ever earn.
- **Failure modes if unfixed:** (1) a documented, advertised, priced terrain class yields nothing, permanently and silently; (2) the readiness chip is unfalsifiable — it can never leave `ready` for a forest tile because the signal that would flip it is written only on success, so the UI cannot even show the player that something is wrong; (3) it reads as an auto-farm defect, which is how it was reported, while the auto-farm engine was doing exactly what it advertises; (4) the help page and tile messages promise Forest loot, so the drift is between what the product says and what the server does.
- **Blast radius of the fix:** one predicate. `canHarvestTile` has exactly three call sites — `harvestResourceTile` (`lib/harvestService.ts`, Metal/Energy, unchanged), `harvestCaveTile` and `harvestForestTile` (`lib/caveItemService.ts`). Cave and Metal/Energy already passed the gate, so admitting Forest changes the outcome for **Forest tiles only**, and for those it changes them from "impossible" to "governed by the existing 12-hour reset period", which is the rule the other three terrains already follow. No schema change, no route change, no client change, no dependency.
- **Blast radius against auto-farm:** none by design. The engine already advertised Forest; it will now receive `success:true` where it previously received a rejection, and the `HARVEST_DELAY_EXTRA` basic-tier penalty that was being paid on every forest tile becomes an ordinary post-harvest delay.
- **Deliberately untouched (recorded, not dropped):** the collected-resource counters and the unreachable all-time pipeline (finding 7) and the chip's period-blindness (`isPlayerOnCooldown` ignores `resetPeriod`, where the server compares it) are separate decisions with separate owners; both are recorded on `SCOPE.md` row 130 rather than smuggled into this fix.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — the guard is the single eligibility authority for all four terrains and all three call sites, so the fix cannot be true for one harness and false for another. The regression test asserts the advertised set as a set (a loop over all four), not just Forest, so it fails if the list ever loses a member again in either direction. Period semantics are pinned separately (already-harvested → false, rolled-over → true, another player's record → true). |
| Scales? | Yes — a longer array literal in a predicate already evaluated once per harvest. No new query, no new round-trip, no per-tile cost. |
| Survives a hostile attacker? | Unchanged and not weakened. The gate remains fail-closed for every terrain without a payout path (`Wasteland`, `Factory`, `Bank`, `Shrine`, `AuctionHouse` — asserted by the second new test via `Factory`), the 12-hour reset period still governs repeat harvests, and the route's own terrain dispatch remains the second wall. The change admits exactly the terrain the route already pays out; it does not relax the period rule or the anti-cheat path. |
| Maintainable in 2 years? | Better than before. The defect was a list that had to be kept in sync with a dispatcher by hand and wasn't; the fix adds the missing member **and** a test that pins the whole advertised set, plus a comment naming the invariant ("the list must name every terrain `/api/harvest` can dispatch") at the site that broke. The remaining structural weakness — four copies of "which terrains are farmable" (guard, route dispatch, engine list, viewport predicate) — is recorded on `SCOPE.md` row 129 as its own decision rather than silently solved here. |
| Sets the standard? | Yes, and it is the generalizable half: **an advertisement is a contract.** The help page promised Forest loot, the viewport promised `ready`, the engine promised to harvest it, and one predicate silently made all three false. The regression test asserts the contract as a set, which is the shape that catches the whole class — the same "one list must name every member" lesson the project's census gates exist to enforce, applied inside a service instead of across the tree. |

All five are `yes`; no redesign required.

## 5. Proposed Fix (GREEN)

Add the missing terrain to the eligibility list and pin the advertised set.

1. **`lib/harvestService.ts`** — admit `TerrainType.Forest` in `canHarvestTile`'s terrain gate, with the invariant stated at the site (the list must name every terrain `/api/harvest` can dispatch) and the failure mode recorded, so the next terrain added to a payout path has a reason to look here. The docstring's terrain list corrected from "(Metal, Energy, or Cave)" to "(Metal, Energy, Cave, or Forest)".
2. **`lib/harvestService.test.ts`** — a new `describe` block, `canHarvestTile — terrain eligibility (FID-20260925-003)`, that mocks the one drizzle chain the function uses (`db.select().from().where().limit()`, driven through a `vi.hoisted` state holder) and asserts: **every advertised terrain is eligible, Forest included**; a terrain with no payout path (`Factory`) is still refused; a tile this player already harvested in the current period is refused; the same tile is allowed once the period rolls over; another player's record on the tile is ignored.

**Alternatives considered:**

| Alternative | Why rejected |
| ----------- | ------------ |
| Remove Forest from the viewport predicate, the engine's list, the tile messages and the help page — declare Forest decorative | Overturns a documented, published player-facing feature (help page, tile message text, `harvestForestTile`'s payouts) to preserve a guard that is plainly the newer of the two facts. It would also delete code that works (`generateForestItem`, the 50% drop rate, the discovery-drop branch) and contradict `app/api/harvest/route.ts`'s own dispatch branch. Reduction of approved work, and aimed at the wrong artifact |
| Bypass the guard inside `harvestForestTile` (e.g. call `getCurrentResetPeriod` directly) | Duplicates the eligibility rule at a second site, so the two can drift — the exact class that caused this defect. One authority for eligibility is the property worth keeping |
| Extract a shared `HARVESTABLE_TERRAINS` constant used by guard + route + engine + viewport | The right structural answer, and rejected **for this change only** on scope: it edits client and server surfaces together and would need its own plan, gates and product read on the viewport predicate (which also carries display semantics). Recorded as `SCOPE.md` row 129 with the four current copies enumerated so the decision is visible rather than implied |
| Fix only the guard, no test | The directive asked for the test, and the file's existing tests are all pure-function tests for reset periods and bonus math — nothing pinned who may harvest what, which is precisely why a four-way advert/authority mismatch shipped unnoticed. A one-word fix with no pin is a one-word regression waiting to be re-introduced |

**Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/harvestService.ts` | modify | `canHarvestTile` admits `TerrainType.Forest`; invariant + failure mode recorded at the guard; docstring terrain list corrected (+14/−3) |
| `lib/harvestService.test.ts` | modify | New `describe` with 5 tests pinning the advertised set, the refusal of a no-payout terrain, and the three reset-period outcomes; adds a `vi.hoisted` db mock (+80/−1) |

**Verification plan:** the three Law-3 commands from `protocol.config.yaml` (`npx tsc --noEmit`, `npm run lint`, `npm run test:ci`) plus the ledger census and the full pre-push chain; and a **red drill** — the new tests run against the pre-fix guard — because a regression test never observed to fail is not known to be a regression test.

**Call-graph reachability plan:** paste the guard's own post-fix `grep` line, plus the new tests' names appearing in a real suite run, and the guard's line inside a full chain run. No new wiring exists to prove; the point is that the previously-dead branch now returns `true` for Forest, which the admissibility test asserts directly.

## 6. Audit Record

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis | `npx tsc --noEmit` · `npm run lint` · `npm run test:ci` | §7: `TSC EXIT=0`; `LINT EXIT=0` (no output — 0 errors / 0 warnings); `Test Files 136 passed (136) · Tests 1325 passed (1325)` (`SUITE EXIT=0`) | pass |
| Method 2: manual re-read against this FID | Guard re-read at the site (three call sites confirmed, period rule intact); the invariant comment checked against the route's four dispatch branches; every line reference in §2 re-run rather than recalled; the chip's logic re-read to confirm it reads exactly the log the early return never writes; the four advertised surfaces re-grepped | §2 findings 1-9 (each command re-executed for this document) | pass |
| Red drill — the regression test against the pre-fix guard | `lib/harvestService.ts` temporarily reverted to its pre-fix list (`sed`), suite run, then restored from a copy | §7: `Tests 3 failed \| 35 passed (38)` — the advertised-set test plus the two Forest-admissible cases fail; restored → `Tests 38 passed (38)` and the guard re-grepped as `TerrainType.Cave, TerrainType.Forest` at `:136` | pass |

- Audit outcome: **PASS** → `closed` on `e41a1bf` (§8).
- Circuit breakers: one pass to GREEN (the fix is a missing list member), plus the drill and one cleanup pass — the drill's backup copy left in `dev/tmp/` broke `tsc` and `lint`, because that directory is gitignored but **not** excluded from either scanner (§7, finding recorded). Two artifacts removed, gates re-run clean. No oscillation; far under the 10-iteration stop.

## 7. Implementation Record

- **Status:** done (2026-09-25).
- **Files changed:** `lib/harvestService.ts` (+14/−3), `lib/harvestService.test.ts` (+80/−1) — 2 files, 95 insertions, 3 deletions (`git show --stat e41a1bf`).
- **Verification evidence (Law 3, at `e41a1bf`):**
  ```
  === TYPECHECK ===
  TSC EXIT=0
  LINT EXIT=0          (npm run lint — no output at all: 0 errors, 0 warnings)
  === SUITE ===
  SUITE EXIT=0
   Test Files  136 passed (136)
        Tests  1325 passed (1325)
  ```
- **Regression-test evidence (the red drill, and why it counts):**
  ```
  --- guard under drill (pre-fix state) ---
  136:    if (![TerrainType.Metal, TerrainType.Energy, TerrainType.Cave].includes(tile.terrain)) {
  --- test run against pre-fix code ---
   FAIL  lib/harvestService.test.ts > canHarvestTile — terrain eligibility (FID-20260925-003) > accepts EVERY terrain the game advertises as farmable — Forest included
   FAIL  … > allows the same tile again once the reset period has rolled over
   FAIL  … > ignores another player's harvest of the same tile
   Test Files  1 failed (1)
        Tests  3 failed | 35 passed (38)
  === RESTORING ===
  136:    if (![TerrainType.Metal, TerrainType.Energy, TerrainType.Cave, TerrainType.Forest].includes(tile.terrain)) {
  ```
  and against the fix: `Test Files 1 passed (1) · Tests 38 passed (38)` (was 33 before the change).
- **Reachability evidence:** the fix is a restored branch, not a new wire — the guard is reached on every forest-tile harvest by the path in §2's call-graph notes (route dispatch → `harvestForestTile` → `canHarvestTile`), and the admissibility test asserts the returned value directly. Post-fix guard, re-grepped: `lib/harvestService.ts:136: … TerrainType.Cave, TerrainType.Forest].includes(tile.terrain)`.
- **Honest limitation (dated addendum, 2026-09-25 — recorded, not implied):** the evidence for this closure is **static plus unit-level**. No live probe against a real server or database was run: no forest harvest was executed end to end. The claim rests on three separately verified facts — the guard now admits `TerrainType.Forest` (asserted by the new test, and re-grepped at `lib/harvestService.ts:136`), `harvestForestTile` performs no other eligibility check before generating its payout (`lib/caveItemService.ts:485` is the only gate on that path), and `/api/harvest` dispatches `Forest` to it. That is sufficient to prove the previously-impossible outcome is now reachable, but it is **not** the same evidence class as the `n / n live probe` other FIDs in this ledger carry, and the directive did not ask for one. Stated here so that no reader infers a live probe that did not happen; a live end-to-end harvest on a real forest tile remains the stronger confirmation.
- **Artifact-cleanup finding (recorded because it cost a gate cycle):** the drill's backup (`dev/tmp/harvestService.fixed.ts`) and this session's earlier simulation shim (`dev/tmp/posixify.cjs`) both sat in a gitignored directory and broke the Law-3 gates — `tsc` on the copied file's relative imports (`TS2307 ×4`), `eslint` on the `.cjs` require style. `dev/tmp/` is ignored by git but **not** by `tsconfig`/`eslint`, so anything left there is invisible to `git status` and visible to the gates. Removed both (plus three run logs); gates re-run clean. Recorded on `SCOPE.md` row 128 rather than fixed here.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors / 0 warnings · [x] tests 1325/1325 · [x] call-graph proven (§2 notes, §7) · [x] regression test drilled red then green.
- **Commit hash (G2):** `e41a1bf` — *fix(harvest): Forest tiles are harvestable again — the eligibility guard named three terrains while four have payout paths (FID-20260925-003)*, 2 files (+95/−3).
- **Fresh closure probe at `e41a1bf` (Law 16, 2026-09-25):** the gates above were run on exactly this tree; `git status --porcelain` after the fix commit reported only `lib/harvestService.ts` and `lib/harvestService.test.ts` as modified before it, and empty after it except this document's own ledger commit. The guard was re-grepped post-fix rather than assumed restored after the drill.
- **Staging plan (path-scoped, G3/G4):** `git add dev/fids/archive/FID-20260925-003-forest-harvest-deadend.md SCOPE.md CHANGELOG.md VERSION dev/session-summaries/SESSION-2026-09-25-002.md` — filed directly into `dev/fids/archive/` because the fix shipped before the document (the operator directive named the work); `dev/fids/` stays empty of live FIDs.
- **Commit message (G8):** `docs(ledger): FID-20260925-003 filed closed on e41a1bf — Forest tiles are harvestable again, and the advertised terrain set is pinned by a test that fails against the old guard; SCOPE rows 127-129, CHANGELOG/VERSION 0.0.38 (FID-20260925-003)`
- **SCOPE rows:** 127 (this FID); 128 (the `dev/tmp` gate-blind-spot finding), 129 (the four-copy "farmable terrains" drift class), 130 (auto-farm telemetry: the collected-resource counters are never written and the all-time pipeline is unreachable), plus `[OPEN-OUT-OF-SCOPE]` item 66 (the CI Gate 1 portability defect found earlier the same session).
- **Archive:** `dev/fids/archive/FID-20260925-003-forest-harvest-deadend.md`; CHANGELOG entry under `0.0.38`; `VERSION` → `0.0.38`.

---

**Final status:** `closed` (2026-09-25, commit `e41a1bf`). Forest tiles are eligible to be harvested again under the same 12-hour reset rule as the other three terrains, and the set of terrains the game *advertises* as farmable is now pinned against the set its eligibility guard *accepts* by a test that was demonstrated to fail against the old guard.
