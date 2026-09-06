# FID-20260906-010: AutoFarm Dead Feature — Move Verification Reads a Response Shape That Doesn't Exist

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-010-autofarm-move-contract.md`
**ID:** FID-20260906-010
**Severity:** CRITICAL (premium feature 100% non-functional — every tile fails verification)
**Status:** created → GREEN
**Created:** 2026-09-06

---

## 1. Summary

AutoFarm skips every tile with `[AutoFarm] Position mismatch: Expected (65, 149), got {}`. The move succeeds server-side; the engine's position-extraction chain reads four response shapes, none of which the API produces.

## 2. RED — Evidence (file:line, live-probed)

| # | Finding | Evidence |
|---|---------|----------|
| F1 | Engine extraction chain: `data.player?.currentPosition` → `data.data?.player?.currentPosition` → `data.data?.newPosition` → `data.newPosition`; miss ⇒ mismatch log ⇒ `return false` | `utils/autoFarmEngine.ts:660-676` |
| F2 | Actual response: `{ success, data: { player, currentTile } }` — confirmed at `app/api/move/route.ts:124-131` (`MoveResponse = { player, currentTile }` wrapped in `ApiResponse.data`) | file read |
| F3 | **Live probe (authenticated page context):** `/api/move` 200 → `data.player.currentPosition` = `{x:56,y:1}` **but player object carries position as flat `currentPositionX/Y` = [55,1]**; nested `currentPosition` key absent from serialized player | preview_evaluate inside live session, 2026-09-06 |
| F4 | Consequence: `moveToPosition` returns false ⇒ `processTile` returns `success:false, action:'skipped'` ⇒ `processNextTile` never advances ⇒ engine visits one tile forever | `utils/autoFarmEngine.ts:506-520` |
| F5 | Same flat-vs-nested drift as FID-009: server mapper `shapeRowAliases` (lib/mongodb.ts:211) attaches nested aliases on *shim reads*, but `movePlayer`'s drizzle `RETURNING` row bypasses them | lib/movementService.ts:117-121 |
| F6 | Additional latent issues in the same engine (audit sweep): harvest verification polls `/api/player` 15× (2 HTTP calls/tile overhead); `attackBase` reads `battleLog.resources`/`battleLog.winner` unverified against the real combat contract. ~~Combat endpoint wrong~~ — **corrected**: `/api/combat/infantry` EXISTS (`app/api/combat/infantry/route.ts`) alongside `/api/combat/attack`; the engine's target is valid | grep + glob, 2026-09-06 |

## 3. Root Cause

Same systemic class as FID-009: consumers written against the *documented* domain shape (`Player.currentPosition: Position`), while the serialization seam ships flat columns. AutoFarm's author compensating with a four-path guessing chain instead of fixing the seam.

## 4. Five Questions

1. **What exactly is broken?** Position verification fails on every move ⇒ AutoFarm cannot advance.
2. **Since when?** Since the Postgres pivot (flat rows); user-reported 2026-09-06.
3. **Blast radius?** AutoFarm only (premium feature dead). Movement itself works.
4. **Minimal correct fix?** Serialize position honestly in the move response (nested `currentPosition`) — fixes AutoFarm *and* any other consumer of the move response; plus engine fallback read for resilience.
5. **Proof?** Live UI drive: start AutoFarm on 3002, observe consecutive `Move verified` logs and advancing tile counts; gates green.

## 5. GREEN — Design

- **R1 (`app/api/move/route.ts`):** before building `successResponse`, normalize `player.currentPosition = { x: player.currentPositionX, y: player.currentPositionY }` when the nested alias is absent (single documented shape leaves the API; no guessing downstream).
- **R2 (`utils/autoFarmEngine.ts`):** extraction chain reordered to read `data.data?.player` first (the real contract), then legacy paths; add flat-column fallback `currentPositionX/Y` as last resort. Wrong-path extraction logs removed after fix (they masked the contract drift).
- **R3:** ~~combat endpoint swap~~ **struck** — audit pass disproved it: both `/api/combat/infantry` and `/api/combat/attack` exist; engine's infantry target is correct PvP route (matches CombatAttackModal.tsx:152).
- **Non-goals:** harvest polling optimization (works; note for future), `attackBase` contract re-verification (needs its own FID with battle-log evidence — flagged).

## 6. Verification Plan

1. tsc 0; eslint clean on touched files; full suite pass.
2. Live probe: `/api/move` response now carries nested `currentPosition` matching flat columns.
3. **UI drive:** start AutoFarm from live game page on 3002; assert ≥3 consecutive `Move verified` logs and `tilesCompleted` increasing.
4. Loop record + archive + CHANGELOG + commit/push (standing authorization).

## 7. Loop Record

- **Pass 1:** F3 probe re-run confirmed nested `currentPosition` absent in current player serialization — R1 normalization is required at the route, not just engine-side guessing. R3 **struck**: glob proved `app/api/combat/infantry/route.ts` exists (engine target valid; my existence check had used a bad pattern).
- **Pass 2 (implementation audit):** tsc caught R1 v1 referencing `player.currentPositionX` on the `Player` type — re-probe showed nested `currentPosition` IS present post-move (flat columns carry the STALE pre-move row). R1 rewritten as a **preserve-don't-overwrite** guard: only set nested from flat when nested is missing, so the fresh server-confirmed position is never clobbered by the stale row. Probe corrections also caught: earlier JWT "mismatch" was my own minting script bug (argv slot) — no product defect; token signed with `.env.local` secret verifies live.
- **Pass 3 (LIVE UI drive, 2026-09-06):** real click on ▶️ Start Auto-Farm in the running game: **4/4 `Move verified`, 0 `Position mismatch`, tilesCompleted 1→3**, engine advancing E along row 99 with harvest polling active. Feature verified repaired end-to-end; probe account + claimed tile cleaned from dev DB.
- **Status: CONVERGED + IMPLEMENTED + LIVE-VERIFIED.**
