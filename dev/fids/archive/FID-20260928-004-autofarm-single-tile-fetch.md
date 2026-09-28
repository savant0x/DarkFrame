# FID-20260928-004: Auto-farm fetches the same tile three times per move — the move response already carries it

**Filename:** `FID-20260928-004-autofarm-single-tile-fetch.md`
**ID:** FID-20260928-004
**Severity:** LOW
**Status:** closed (2026-09-28, commit `5decefc`)
**Created:** 2026-09-28

---

## 1. Summary

`POST /api/move` returns the freshly-built tile (`data.data.currentTile`) on every call — yet auto-farm discards it and fetches the tile **twice more**: once in the engine (`getTileInfo` → `GET /api/tile`) and once in the page's `move` event handler (`updateTileOnly` → another `GET /api/tile`). Under VIP pacing (~1.7 tiles/s), that is ~3.4 wasted tile fetches per second — an extra ~200 requests/min of server work and response serialization that exists only because the original keypress-simulation architecture predated the move envelope's current shape. The fix: capture `currentTile` from the move response, use it as the engine's `tileInfo`, ship it to the page inside the `move` event, and have the page apply it via `setCurrentTile` — eliminating both redundant fetches on the happy path while keeping `updateTileOnly` as a fallback when the tile is absent from the envelope. This is the performance item recorded, not absorbed, by FID-20260928-003 (its §2 finding 4).

## 2. Evidence (RED)

All findings re-executed 2026-09-28.

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | **The move response carries the tile** — the route's documented contract | `app/api/move/route.ts:134` | `currentTile: tile` (inside `responseData` → `ApiResponse<MoveResponse>`) |
| 2 | **The engine ignores it** — the only `currentTile` reference in the engine is a comment describing the contract | `utils/autoFarmEngine.ts:904` | `// { success, data: { player, currentTile } } — read data.data.player first.` (zero reads of the field) |
| 3 | **Fetch #2: the engine re-fetches the tile it just moved onto** — `processTile` calls `getTileInfo(position)` immediately after a successful `moveToPosition` | `utils/autoFarmEngine.ts:726-737` | `const moveSuccess = await this.moveToPosition(position); … const tileInfo = await this.getTileInfo(position);` |
| 4 | **Fetch #3: the page re-fetches the tile again** on the engine's `move` event | `app/game/page.tsx:299` | `updateTileOnly(event.position.x, event.position.y);` — which is itself a `GET /api/tile` (`context/GameContext.tsx:324-326`) |
| 5 | **The tile the engine gets from the response is *better* than the one it fetches**: since FID-20260927-007, `getTileAt` attaches the viewer's `harvestStatus` — so the move envelope's tile carries the verdict, while the engine's extra `GET /api/tile` (unauthenticated, anonymous viewer) does not | `lib/movementService.ts:188` vs `app/api/tile/route.ts` (viewer resolution) | `movePlayer` → `getTileAt(newPosition.x, newPosition.y, username)` — identified viewer; `/api/tile` only attaches a verdict when a session resolves |
| 6 | **The event pipeline is the natural transport** — `AutoFarmEvent` already carries `position` + a `data` payload object; adding `tile` to `AutoFarmEventData` is additive | `types/autoFarm.types.ts:129-151,162-168` | `AutoFarmEventData` (closed index signature per FID-20260925-005: every field declared) · `AutoFarmEvent { type, timestamp, position, data?, message? }` |
| 7 | **The page already has the setter it needs** — `setCurrentTile` is on the context and is exactly the direct-replace semantic `updateTileOnly` performs after its fetch | `context/GameContext.tsx:32` | `setCurrentTile: (tile: Tile | null) => void;` |
| 8 | **Pacing math** (from FID-20260928-003): VIP `MOVEMENT_DELAY = 300` ms with ~500-1300 ms per tile total → roughly 1.7 tiles/s → the two redundant fetches are ~3.4 req/s ≈ **200 req/min** of pure waste, drawn from the shared per-IP budget that FID-20260928-003 proved is global | `utils/autoFarmEngine.ts:170-178` + FID-003 §2 | VIP constants; `rateLimiter.ts` key = `ip:<ip>` (no endpoint component) |
| 9 | **No test pins the current double-fetch** — no test references `getTileInfo` fetch behavior or the page's `move`-event `updateTileOnly` | repo-wide test grep | `grep -rln "getTileInfo\|updateTileOnly" __tests__/` → only unrelated matches (`viewportCooldownTruth`, `StatsPanel.test` mocks the context method itself) |

**Call-graph notes (Law 4).** Current happy path per tile: `processNextTile` → `processTile` → `moveToPosition` → `POST /api/move` (response: `{ data: { player, currentTile } }` — **tile discarded**) → back in `processTile` → `getTileInfo(position)` → `GET /api/tile` (fetch #2, consumed as `tileInfo`) → `attemptHarvest(position, tileInfo)`; concurrently the engine's `move` event → `app/game/page.tsx:299` → `updateTileOnly` → `GET /api/tile` (fetch #3 → `setCurrentTile`). Post-fix path: move response's `currentTile` becomes both `tileInfo` (engine) and, via the `move` event payload, the page's `setCurrentTile` argument — one tile build per move, server-side, zero extra round trips. The fallback (`getTileInfo` when no tile in envelope; `updateTileOnly` when no tile in event) keeps every degraded path working: older envelopes, missing tiles, error responses.

## 3. Impact Analysis

- **Who/what is affected:** auto-farm sessions (VIP most, by pacing); the server's per-request work; the shared per-IP request budget (FID-003's finding — this fix *reduces* budget pressure rather than re-adding it). Manual gameplay is untouched (the page's `move`-event handler only fires from the engine).
- **Failure modes if unfixed:** ~200 wasted requests/min under VIP auto-farm; doubled server-side tile builds; the shared budget fills ~40% faster than necessary; and each redundant fetch is a chance for a transient failure to blank a tile the engine already had.
- **Blast radius of the fix:** engine (capture + use + emit), event type (+1 optional field), page handler (prefer event tile, keep fallback). `context/GameContext` and `updateTileOnly` remain — the fallback keeps them live, so no API surface changes. Additive typing only.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | **Yes.** Happy path (tile in envelope) skips both fetches; every degraded path (tile absent, verification mismatch, re-sync) falls back to exactly today's behavior. The combat path still works — `tileInfo.occupiedByBase`/`baseOwner` ride on the move envelope's tile the same as on the fetched one. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | **Yes.** It removes load in proportion to auto-farm usage — the opposite of scaling risk. The event payload grows by one optional field; envelopes are already ~1.5 KB and carry the tile either way. |
| Survives a hostile attacker, not just an honest user? | **Yes.** The client trusts the tile from the *authenticated move response* it already acted on (it verified the position against it); no new trust boundary. Fallbacks mean a tampered/missing field degrades to today's behavior, never to a stuck engine. |
| Maintainable in 2 years? | **Yes.** The fetch count per tile becomes 1 + work, matching what a reader would assume from the route contract. The fallbacks are commented as degradation paths, not alternate features. |
| Sets the standard for the industry? | **Yes.** "Read the response you already have" is the same data-honesty standard as FID-20260927-007 — the engine was discarding exactly the artifact it then paid to rebuild. |

## 5. Proposed Fix (GREEN)

- **Approach:** single-source the tile from the move envelope. `executeMove` extracts `data.data.currentTile` (guarded, typed), uses it as the authoritative tile for the move it just performed, returns it to `processTile`, which skips `getTileInfo` when present; the `move` event carries it in `data.tile` for the page, which applies it with `setCurrentTile` and only calls `updateTileOnly` when absent.
- **Alternatives considered:**
  1. *Drop the page's `updateTileOnly` call entirely* — rejected: the event tile can be absent (degraded envelopes), and the page must still reflect the engine's position; the fallback keeps that guarantee.
  2. *Have `processTile` reuse the page's fetch instead* — rejected: inverts the dependency direction (engine → React state) and widens the race window.
  3. *Also delete `getTileInfo`* — rejected: it remains the fallback and the re-sync path's tool; deleting a working fallback to prove a point is not economy.
  4. *Do nothing (premature optimization?)* — rejected: this is not speculative — it is ~200 req/min of measured waste on the shared budget, found and recorded by FID-003.
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `types/autoFarm.types.ts` | modify | `AutoFarmEventData` gains `tile?: Tile;` (import `Tile` — the file already imports from `./game.types`; verify) — declared per the closed-index-signature rule. |
| `utils/autoFarmEngine.ts` | modify | `moveToPosition` returns `{ ok: boolean; tile: Tile \| null }` (internal shape change only — no external callers). Extract `data?.data?.currentTile` with a type guard; include it on the success `move` event (`data: { tile }`); same on the re-sync emit where available. `processTile`: `const tileInfo = moveResult.tile ?? await this.getTileInfo(position);` (fetch #2 eliminated on the happy path). |
| `app/game/page.tsx` | modify | `move` branch: if `event.data?.tile` → `setCurrentTile(event.data.tile)`; else fallback `updateTileOnly(event.position.x, event.position.y)` (fetch #3 eliminated on the happy path). |
| `__tests__/utils/autoFarmTileFlow.test.ts` | create | Pins below. |

- **The pins (`__tests__/utils/autoFarmTileFlow.test.ts`):**
  1. `extractMoveTile` (or the guard used) returns the tile from a well-formed envelope, `null` from malformed/absent ones — pure-function pins, the `extractMovePosition` precedent in the same file.
  2. `processTile` uses the envelope tile when present (a `getTileInfo` fetch would be observable — assert the engine does **not** fetch `/api/tile` on the happy path).
  3. `processTile` falls back to `getTileInfo` when the envelope lacks a tile (degraded path still fetches).
  4. The `move` event payload carries `data.tile` on success.
- **Verification plan:** `npx tsc --noEmit` → 0; `npx eslint . --max-warnings 0` → 0/0; `npx vitest run` → full suite green; census → exit 0.
- **Call-graph reachability plan (Law 4):** post-fix greps — `grep -n "currentTile" utils/autoFarmEngine.ts` shows the extraction site plus the comment; `grep -n "event.data?.tile\|data.tile" app/game/page.tsx utils/autoFarmEngine.ts` shows emit + consumption; `updateTileOnly` remains referenced in the page's fallback branch (no dead code created).

## 6. Audit Record

Double audit — two independent methods, evidence pasted, no self-reporting.

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: command re-execution | All §2 findings re-run this session; envelope shape re-verified at the route (`move/route.ts:134`); event type read in full before planning the additive field; `updateTileOnly` caller census taken to bound the blast radius | §2 as pasted | pass |
| Method 2: manual re-read | `processTile`/`moveToPosition`/`executeMove` re-read end-to-end to confirm the return-shape change has no other callers; `AutoFarmEventData`'s closed-signature comment re-read (the additive field must be declared — it is); page handler re-read to confirm the fallback ordering; Five Questions re-checked | This document §2/§5 as written | pass |

- **Honest limitations recorded:** (1) the request-count reduction is derived from constants and code paths, not measured with a profiler under live auto-farm — the per-tile request sequence is, however, fully static (one `move`, at most one `tile`, at most one `harvest`); (2) the envelope tile is built *before* the response is sent, so it is marginally staler than a fresh `GET /api/tile` would be — under auto-farm the tile is consumed immediately after moving, so staleness is bounded by one move's duration and the fallback covers any doubt; (3) no behavioral pin asserts the *absence* of a network call at the page level (the page handler is exercised manually/by e2e scripts) — the engine-level pin carries the regression weight.
- **Audit outcome: PASS → status `loop-complete`.** Circuit breakers: 2 passes, delta < 2%; iteration 2 of 10.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** done (implemented 2026-09-28 under the session's standing operator approval; landed on commit `5decefc`)
- **Files changed:** `types/autoFarm.types.ts` (+`AutoFarmEventData.tile?: Tile`, import added), `utils/autoFarmEngine.ts` (+46/−20: `moveToPosition` → `{ ok, tile }`; envelope extraction with type guard; tile on both success `move` emits; `processTile` uses `moveResult.tile ?? getTileInfo(...)`), `app/game/page.tsx` (move branch prefers `event.data?.tile` → `setCurrentTile`, `updateTileOnly` as fallback; deps array updated), `__tests__/utils/autoFarmTileFlow.test.ts` (new, 4 pins)
- **Verification evidence (executed 2026-09-28):** `npx tsc --noEmit` → 0 · `npx eslint . --max-warnings 0` → 0/0 · full suite **144 files / 1380 tests passed** · ledger census exit 0 · pins: happy path asserts NO `/api/tile` fetch occurs (the regression pin), fallback path asserts the fetch still happens, event payload carries `data.tile` with `harvestStatus` intact
- **Call-graph reachability evidence:** `data.tile` emitted at both success sites in `moveToPosition` (verified + re-synced) and consumed in the page's `move` branch; `getTileInfo` and `updateTileOnly` remain referenced as fallbacks (no dead code); the `updateTileOnly` deps-array entry was preserved and `setCurrentTile` added (lint-enforced)

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass (144 files / 1380) · [x] call-graph proven (emit/consumption greps; fallback still referenced)
- **Commit hash (G2 — required for `closed`):** `5decefc` — *perf(autofarm): use the move response's currentTile — eliminates two redundant tile fetches per tile (FID-20260928-004)*; the ledger-closure commit follows.
- **Staging plan (path-scoped, G3/G4):** commit 1 (code): `git add types/autoFarm.types.ts utils/autoFarmEngine.ts app/game/page.tsx __tests__/utils/autoFarmTileFlow.test.ts`; commit 2 (ledger): `git add SCOPE.md CHANGELOG.md VERSION dev/fids/ dev/session-summaries/` — never `git add -A`.
- **Commit message (G8):** `perf(autofarm): use the move response's currentTile — eliminates two redundant tile fetches per tile (FID-20260928-004)`
- **Archive:** move to `dev/fids/archive/` at `closed`; CHANGELOG entry; archival logged in the session summary. Never at `loop-complete`.

---

**Final status:** closed
