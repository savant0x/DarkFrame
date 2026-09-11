# FID-20260911-046 — Egress Round 2: Harvest-Chain Furnace Eliminated

**Date:** 2026-09-11 · **Trigger:** egress still massive (26.13 GB cycle-to-date);
user mandate: "full force on the egress issue."

## Census findings (measured, not guessed)

**Client polls are clean.** All 30+ `setInterval` sites classified: the 1s tickers are
client-only countdown timers (zero API); real polls are 5–60s, mostly 15–60s, and the
FID-044 feed + TopNavBar already pause on hidden tabs. No client changes warranted.

**The remaining furnace was the harvest chain itself.** After FID-043/044's route-level
slims, the chain still full-read the 39 KB players row (≈31.8 KB units blob) **3× per
harvest**:

| Site | Consumed | Before | After |
|---|---|---|---|
| `app/api/harvest/route.ts` position read (shim `findOne`) | 2 scalars | full row | position projection via shim |
| `lib/harvestService.harvestResource` gather math | 6 fields | full row | 10 tiny scalars (~200 B) — `mapRowToPlayer` widened to a `Pick<>` so the type system proves the math inputs survive |
| `lib/xpService.awardXP` (every harvest + every unit build + battle) | 4 scalars | full row | 4-column projection |
| `lib/discoveryService` ×3 (`checkDiscoveryDrop` per harvest, progress, bonuses) | `discoveries` only | full row ×3 | shim `{ discoveries: 1 }` projection |

Also re-audited and **deliberately unchanged**: `updateSession` (playerSessions rows
are tiny), `getPlayerGameState` (runs only during an active tutorial CUSTOM step),
flag reads (small), the tutorial poll (self-stops post-completion), admin/bot/wmd
full reads (not per-action hot paths).

## Verification (live, :3001 production build)

- Three real harvests via `POST /api/harvest`, each on a fresh tile: HTTP 200,
  `success:true`, 1.6–2.1 s, full bonus stacks intact in the yield messages
  (VIP 2x, clan synergy, flag 🚩 bonus) — resource deltas confirmed in DB
  (+5,048 metal / +12,288 energy across the three).
- Per-harvest payload from the players table: **~118 KB → ~0.6 KB** (3 reads ×
  ~39 KB → 3 slim reads); AutoFarmVIP ≈ **95–99% reduction on the dominant loop**.
- Gates: tsc 0 · eslint 0 · vitest **499 passed / 1 skipped** · build exit 0.

## What success looks like (dashboard, 48h)

Compare against `dev/EGRESS-WATCH.md`: daily egress should drop from multi-GB to
hundreds of MB while AutoFarm runs. If still high, next levers (in order):
1. Batch AutoFarm move+harvest into one tick endpoint (halves request count).
2. Trim the tutorial poll window further (it self-stops, but starts on page load).
3. Audit `/api/player` full-payload responses on non-hot screens.

## Beer Base art

Save-path cheat sheet added at `dev/art/BEER-BASE-SAVE-PATHS.md` (folder, exact
filenames `1..10.jpg`, level→tier table, fallback behavior). Full design brief
remains at `dev/art/BEER-BASE-ART-SPEC.md`.
