# FID-20260911-047 — Egress Round 3: AutoFarm Verification Polling Eliminated

**Date:** 2026-09-11 · **Follows:** FID-046 (server-side harvest-chain slims).
Continuation of "keep scanning egress issues".

## The furnace (found by scanning client-side wire traffic per endpoint)

Measured real response sizes for every poll target: `/api/beer-bases/list` (124 B —
only 1 special base live, but the route full-reads every special base row → slim when
the population grows), chat (10 msgs × 150 B), `/api/tile` (344 B), leaderboard
(1.3 KB) — all fine. `/api/player` returns **21.5 KB** (inventory 14.7 KB +
discoveries 4.2 KB dominate).

**`utils/autoFarmEngine.attemptHarvest` simulated a 'g'/'f' keypress** (so it could
not see the harvest response) and then **verified the harvest by polling
`/api/player` up to 16× per cycle**: 1 pre-harvest read + up to 15 × 200 ms
verification polls + 1 `onRefresh` UI read ≈ **366 KB of wire per harvest cycle**.
At ~3,270 cycles/hour that is >1 GB/hour of pure verification polling — the largest
single egress source in the game after FID-046's server-side fixes.

## Fix

1. **`attemptHarvest` calls `POST /api/harvest` directly** (matching the engine's
   existing direct-API move path). The response already carries the authoritative
   result — `metalGained`, `energyGained`, `itemFound`, `xpAwarded`, cooldown
   rejections — so **the response is the verification**. Keypress simulation and the
   16-poll loop are gone. `RefreshCallback` now receives optional
   `{metal, energy}` deltas; `HarvestAttemptResult.method` widened to `'direct_api'`.
2. **Game page `onRefresh` applies the deltas locally** via the context's updater
   `setPlayer(prev => …)` — zero refetch to update the resource display.
3. **Manual harvest handler does the same** — the response's gains merge into local
   state immediately (previously the HUD only updated on the next move/refetch).

## Verification

- **Live:** harvest response = **310 bytes** carrying `energyGained=7060,
  xpAwarded=72` (HTTP 200, fresh tile, full VIP/clan/flag stack) — verification
  payload per cycle drops from ~366 KB to ~310 B (**~99.9%**).
- Full AutoFarm cycle wire (move 854 B + harvest 310 B + tile 344 B) ≈ **~1.5 KB**,
  with the server-side DB reads slim from FID-046.
- Gates: tsc 0 · eslint 0 · vitest **499 passed / 1 skipped** · build exit 0 ·
  FID-047 recorded.

## Notes for the next egress pass (if the dashboard still complains)

- `app/api/beer-bases/list` full-reads every special-base row per fetch (fine at 1
  base; project to the ~10 rendered fields when the population grows).
- `/api/player` at 21.5 KB is now fetched only on page load, sessions, and rare
  events — trimming `inventory` (14.7 KB) out of the session load is the remaining
  structural lever.
