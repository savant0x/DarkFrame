# FID-20260909-025: Power formula wiring, balance-display regression, VIP grant failure modes, tutorial quest-2 structural freeze

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-025-power-balance-vip-tutorial-integrity.md`
**ID:** FID-20260909-025
**Severity:** HIGH (one progression-blocking freeze, one contract-truth defect, one silent admin-flow failure, one regression)
**Status:** in_progress
**Created:** 2026-09-09

---

## 1. Summary

Four operator-reported defects, each root-caused in §3:

1. **Power displays raw STR+DEF** — the sidebar `StatsPanel` shows `totalStrength + totalDefense` as "Total Power", ignoring the documented combat-power formula (`lib/combatPowerService.ts`: `(STR+DEF) × balance × clan × discovery × specialization`). The formula route exists (`/api/player/stats`) and one consumer (`StatsViewWrapper`) uses it; the always-visible panel never has.
2. **Balance display regressed** — the FID-012 reskin dropped the per-row STR%/DEF% balance pills; the surviving imbalance warning is dead on arrival because `balanceEffects` is not in the sanitize allowlist for most read paths. The STR/DEF meters silently became balance-share bars without saying so.
3. **"No way to grant VIP"** — the grant stack is fully built (`/api/admin/vip/grant` + audit row + AdminView panel with 7d/30d/1yr buttons) but fails silently: `requireAdmin` trusts a JWT `isAdmin` claim minted at login (stale after promotion → 403), and `loadVipUsers` swallows errors, rendering an empty panel with no signal.
4. **Tutorial quest 2 is structurally uncompletable** — step "Find Your First Cave" (2/7) demands the exact tile (20,40) via `validationData.targetCoordinates`, but **no code path reads `targetCoordinates`** (`validateStepCompletion` has zero callers; the move route only handles `requiredMoves` and `MOVE_TO_COORDS`). Additionally (20,40) is usually not a cave at all — the generator shuffles terrain. The HARVEST step (3/7) can never complete either: `track-action` has zero client callers and the harvest route has no tutorial hook. All four later steps are `CUSTOM` actions whose `requirementType` values (`metal_balance`, `energy_balance`, `factory_capture`, `build_unit`) have zero consumers.

## 2. Law compliance

- **Law 4 (reachability):** every dead path above was proven by grep before the fix was designed (`targetCoordinates` readers, `requirementType` consumers, `track-action` callers, `BalanceIndicator` render sites).
- **Law 5 (no placeholders):** the CUSTOM-step evaluator is a real implementation of each requirement type, not a stub that auto-passes.
- **Law 7 (reuse):** reuses `getActionTracking`/`updateActionTracking` JSON contract (FID-001), `completeStep`, `calculateCombatPower`, `calculateBalanceEffects`, `requireAdmin`; no parallel mechanisms introduced.
- **Law 13 (testability):** the cave resolver and the CUSTOM evaluator are pure-ish service functions with unit tests; route hooks covered by regression tests.
- **Law 15 (lint gates):** tsc 0 · eslint 0 errors · vitest green · build clean before closure.

## 3. Root causes

| # | Defect | Root cause |
|---|--------|-----------|
| A | Power 1:1 with STR/DEF | `StatsPanel` line ~135: `useCountUp((player?.totalStrength || 0) + (player?.totalDefense || 0))` labeled "Total Power". The canonical `calculateCombatPower` is only invoked by `/api/player/stats`. Git (`git log -S calculateCombatPower -- components/`) proves no component ever called it — StatsPanel was never wired, not a regression. |
| B | Balance pill gone / meters misleading | Pre-reskin panel (ad14f79) rendered STR%/DEF% chips from `player.balanceEffects.ratio`. FID-012 reskin replaced rows with `MeterBlock` bars whose widths are the STR/DEF *share* of total — visually identical to progress bars. The `nn-note--caution` imbalance warning depends on `player.balanceEffects`, which `/api/player` merges, but the field is absent from the `PUBLIC_FIELDS` allowlist on other sanitize paths and was never shown as a persistent balance readout. |
| C | VIP grant invisible/failing | (1) `requireAdmin` → `requireAuth` → JWT claim `isAdmin` stamped **at login**; a token issued before the operator's row became admin yields 403 on every `vip/*` call. (2) `loadVipUsers` catch block only `console.error`s — the UI shows an empty table. (3) The VIP panel sits mid-page in a 3,550-line scroll with no section navigation — discoverability failure. |
| D | Quest-2 freeze | `resource_find_cave` declares `targetCoordinates {x:20,y:40,radius:0}`; move route's tutorial block handles only `requiredMoves` and `MOVE_TO_COORDS.validationData` — `targetCoordinates` matches neither branch. `validateStepCompletion` (which does read it) has zero callers. Map generator shuffles cave placement so the hardcoded tile is usually not a cave. Downstream: `resource_harvest_cave` (HARVEST) has no completion hook (track-action endpoint uncalled; harvest route unaware of tutorials); `resource_collect_metal/energy`, `resource_capture_factory`, `resource_build_infantry` are `CUSTOM` steps whose `requirementType` union is consumed nowhere. |

## 4. Design

### 4.1 Power + balance (StatsPanel)

- Panel fetches `/api/player/stats` (existing, session-authenticated, returns `combatPower` + full `powerBreakdown`) once per player-army change (mount + when `totalStrength/totalDefense` change), cached in state; failure falls back to the raw STR+DEF row labeled "Base Power" — never a fake formula result.
- Military panel shows: **Base Power** (STR+DEF), **Combat Power** (formula result, accent number), **Balance** (`balanceStatus` + `×{multiplier}`), and the STR/DEF meters **relabeled as balance share** with restored per-row % chips (green `0.8 ≤ ratio ≤ 1.2`, amber outside, per `calculateBalanceEffects` thresholds).
- `balanceEffects` is added to the sanitize `PUBLIC_FIELDS` allowlist (derived, non-sensitive) so every read path ships it; the existing imbalance warning remains.

### 4.2 VIP grant

- `requireAdmin` re-checks `isAdmin` from the `players` row (DB truth) after JWT auth — demotions take effect immediately, promotions work with in-flight tokens. One indexed PK read on admin-only routes; acceptable.
- `loadVipUsers` surfaces errors in the UI (existing `showError`), and the VIP panel gets a jump link in the admin section nav strip so it is discoverable.

### 4.3 Tutorial quest 2 (server truth, client unchanged)

- **Cave step:** on first move during `resource_find_cave`, the move route resolves the **nearest actual cave tile** to the player (`resolveNearestCaveTile` in tutorialService; one indexed tiles query), persists it via `updateActionTracking` extras (`targetX/targetY`) — same contract as `MOVE_TO_COORDS` dynamic targets — and the step completes on arrival. Instruction text renders the resolved coordinates (panel already displays step text; server stores it dynamically at step start).
- **Harvest step:** harvest route calls `recordTutorialHarvest(username)` after a successful Cave/Forest harvest; increments tracking and auto-completes the active HARVEST step (requiredHarvests defaults 1).
- **CUSTOM steps:** `getCurrentQuestAndStep` evaluates the active `CUSTOM` step against the player row (`resources.metal/energy ≥ target`, `factoryCount ≥ 1`, units contain `unitType ≥ count`) and auto-completes via `completeStep` when satisfied. One evaluation point on the already-polled read; no client changes.
- Honest instruction copy: the cave step no longer names (20,40); it says "seek the marked cave" while the resolved coordinates ride `validationData`/tracking to the UI.

## 5. Files (planned)

| File | Change |
|------|--------|
| `components/StatsPanel.tsx` | combat-power fetch + display; balance-share labels; % chips |
| `lib/playerSanitize.ts` | + `balanceEffects` in `PUBLIC_FIELDS` |
| `lib/authMiddleware.ts` | `requireAdmin` DB re-verification |
| `app/admin/AdminView.tsx` | VIP panel error surfacing + section jump link |
| `lib/tutorialService.ts` | `resolveNearestCaveTile`, `recordTutorialHarvest`, CUSTOM evaluator; step copy/validationData honesty |
| `app/api/move/route.ts` | `targetCoordinates` branch (resolve-persist-complete) |
| `app/api/harvest/route.ts` | harvest → tutorial hook |
| `app/stats/page.tsx` | rubric visual pass if audit shows debt |
| `__tests__/lib/tutorialQuest2.test.ts`, `__tests__/api/security/admin-gate.test.ts` (extend) | regression coverage |

## 6. Verification plan

- Unit: cave resolver picks nearest cave; CUSTOM evaluator completes each requirement type and leaves unsatisfied steps; harvest hook increments/completes; requireAdmin rejects non-admin rows with valid admin-minted token for another user.
- Route: move route completes cave step on arrival (test with stubbed tiles query); harvest route completes HARVEST step.
- Gates: tsc 0 · eslint 0 errors · vitest all green · build clean; manual preview pass of StatsPanel power block and admin VIP panel.

## 7. Risks / non-goals

- `requireAdmin` DB re-check adds one read per admin request — accepted for correctness (stale-claim demotion is a security win).
- No changes to quest order/step IDs (progress rows in the wild keep validating).
- Leaderboard `effectivePower` column semantics are a separate question (recorded; not in this FID's scope).
- **Known non-fatal prerender log:** ~~one build worker logs `ReferenceError: location is not defined` (referrals render tree) during static generation.~~ **RESOLVED (2026-09-09, FID-026 §7 follow-up):** root cause was `app/referrals/page.tsx` calling `router.push('/login')` in the *render body* — a side-effect-in-render violation; the app router's navigation internals read `location`, which doesn't exist during static prerender. Fixed by moving the redirect into `useEffect` with the `!isLoading && !player` guard (the codebase pattern used by game/messages pages) and rendering null until auth resolves. Verified: fresh build logs **zero** `location` errors (238/238 pages, exit 0); referrals page now prerenders server-side.
- **Implementation note (Law 2):** `targetCoordinates` is a TOP-LEVEL TutorialStep field, not a `validationData` key — first wiring draft read it off `validationData` and was caught by tests (`tutorialQuest2Wiring.test.ts` asserts `step.targetCoordinates`).

## 8. Changelog

- 2026-09-09: created; root causes proven (§3), design fixed (§4).
- 2026-09-09 (§9 implementation record):
  - **A — power wiring:** StatsPanel fetches `/api/player/stats` (debounced 400 ms, refetch on army change); Military panel now shows Balance row (`status ×multiplier`, color-coded), **Combat Power** (formula, cyan accent, tooltip with multiplier chain), falling back to honest **Base Power** when the fetch fails. STR/DEF meters relabeled `STRENGTH · NN%` / `DEFENSE · NN%` — they are balance-share bars (pre-FID-012 pill semantics restored).
  - **B — data path:** `balanceEffects` added to sanitize `PUBLIC_FIELDS`; `BalanceIndicator` component confirmed still present but unrendered — the panel now carries its data instead.
  - **C — VIP:** `authenticateRequest` derives `isAdmin` from the players ROW (already loaded; zero extra queries) — repairs all 25 `requireAdmin` routes for stale-JWT holders at once; `vip: smallint` truthiness handled (`=== 1`). `loadVipUsers` surfaces errors via toast (silent-empty-table failure eliminated). VIP panel gets an anchor + `VIP ▾` jump button in the admin health strip (discoverability).
  - **D — quest 2:** `getCurrentQuestAndStep` now evaluates the active CUSTOM step through `completeStep` and recurses to the next step when satisfied (bounded: unsatisfied steps return untouched). Move route handles `targetCoordinates` MOVE steps: resolves the **nearest real cave** (`resolveNearestCaveTile`, single ordered tiles query) on first move, persists through the one tracking writer, auto-completes on arrival, falls back to declared coordinates if a world has no caves. Harvest route calls `recordTutorialHarvest` on successful cave/forest harvests (non-throwing; increments + auto-completes the HARVEST step). Step copy no longer names hardcoded (20,40); panel renders the resolved coordinates for coordinate-target MOVE steps. Merged resolved `targetX/targetY` into `getCurrentQuestAndStep`'s validationData so route and panel share one truth.
  - **Tests:** `__tests__/lib/tutorialQuest2Wiring.test.ts` — 8 tests (quest completability contracts, nearest-cave resolution, non-throwing harvest hook, balanceEffects allowlist).
  - **Gates:** tsc 0 · eslint 0 errors (2 pre-existing warnings) · vitest 377 passed / 1 skipped · `next build` exit 0 (238/238 pages; §7 prerender note).
