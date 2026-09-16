# FID-20260911-048 — Egress Round 4: Census Closeout

**Date:** 2026-09-11 · **Follows:** FID-046 (server harvest chain), FID-047 (AutoFarm
verification polling). Final pass of "keep scanning egress issues".

## Changes

**`app/api/beer-bases/list/route.ts` projected.** The route full-read every special-
base player row (`select().from(players)`) — each carrying the ~30 KB units blob —
per client fetch, and the 5s Beer Base panel poll plus every manual open hit it.
Both reads now project: caller → position only; bases → the ~10 rendered fields
(`units` included solely for the scanned base's army size). At 1 live base the
payload is unchanged (124 B — the payload never shipped blobs, only the DB read
pulled them); at a future 50-base population this avoids shipping ~1.5 MB of blobs
per poll *through the database wire*, which counts against Supabase egress even
when the HTTP response is small. That is the point of the fix: egress is DB→server
plus server→client, and the DB→server half was O(all bases × full row).

## Audit results (no action needed — recorded so the next pass starts here)

- **`/api/auth/session`** → 34 bytes (`{success, username, dailyReward}`). No player
  payload embedded; the 21.5 KB `/api/player` load happens once per page load.
- **`attackBase` (AutoFarm)** fetches `/api/player` twice per raid but is gated by
  `config.attackPlayers`, which **defaults to `false`** — opt-in only, and a raid is
  one-off per base tile, not per farm cycle. Acceptable.
- **`GameContext.loadPlayerData`** → page-load/session/one-off events only (purchases,
  captures, flag claim), throttled to 1 per 2s. Not a furnace.
- **`/api/combat/infantry`** — re-verified during the AutoFarm audit: client-supplied
  `unitIds` are filtered against the DB-owned `players.units` in
  `executeInfantryAttack` (server-side validation holds; the RP-audit class of bug
  does not exist here).
- Chat, tile, leaderboard, stats, WMD status, discovery, bot scanner — all measured
  small (34 B – 1.3 KB) with sane cadences.

## Egress program state after four rounds

| Round | Furnace removed | Effect |
|---|---|---|
| 037 | auth full-row select, tutorial poll, flag cluster | ~93% auth payload cut |
| 043/044 | move/harvest response payloads, stat/achievement reads | move 40 KB → 854 B |
| 046 | harvest-chain server reads (3× full rows/harvest) | ~99% DB read cut per harvest |
| 047 | AutoFarm 16× `/api/player` verification polling | ~366 KB → ~310 B per cycle |
| 048 | beer-bases list full-row reads (future-proofing) | O(bases × 30 KB) → O(fields) |

Expected steady-state while AutoFarm runs: **~1.5 KB wire + slim DB reads per
~1.1s cycle** — the dashboard should now show the multi-GB/day burn collapsed to
low-MB/day territory. Verification is the 24–48h dashboard comparison per
`dev/EGRESS-WATCH.md`.

## Gates

tsc 0 · eslint 0 · vitest **499 passed / 1 skipped** · build exit 0 · beer-bases list
live-verified (124 B, 4 fields unscanned).
