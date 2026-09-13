# FID-20260912-078 — AutoFarm run persistence moves server-side

**Date:** 2026-09-12
**Request:** "Make AutoFarm persist its position across refreshes from the server session rather than localStorage so engine/server divergence can never recur."

## 1. Problem

FID-075 fixed the AutoFarm divergence loop *reactively* (adopt server position on mismatch, sync at start/resume). The structural cause remained: the engine's run state originated in the browser, so every refresh created a window where engine state and server state were two different truths. Note: the run state was not actually surviving refreshes via localStorage before this FID — an ACTIVE run was silently lost on refresh. Config (`darkframe_autofarm_config`) and all-time stats (`darkframe_autofarm_alltime_stats`) are localStorage and **stay there** (device-local preferences/accumulations, not server-meaningful state).

## 2. Design

Run state now lives on the player's row: `players.autofarm_run` jsonb
(migration 0030, boot-applied, idempotent).

```
AutoFarmRunRecord = { status: ACTIVE|PAUSED, position, currentRow,
                      direction, tilesCompleted, startTime, savedAt }
```

- **Write path:** `POST /api/autofarm/run { run | null }` — session-authenticated; the username NEVER comes from the body, so no cross-player writes. Guard validates shape + map bounds (0–149) before persisting. `run: null` clears (stop/complete).
- **Read path:** `GET /api/autofarm/run` — slim projection (one jsonb column, honoring the FID-043 egress lesson).
- **Engine:** `persistRun()` on start/pause; `schedulePersist()` throttled to one POST per 2s on the tile loop; `clearPersistedRun()` on stop and map-complete. All fire-and-forget — a failed persistence write can never break the farm loop (move verification reconciles regardless).
- **Page:** on engine creation, fetches the persisted run; if present and <12h old, adopts it as PAUSED with a "run restored — press Resume" toast; stale records are cleared server-side.
- **FID-075 machinery stays:** start/resume still sync from `/api/player`, and move verification still adopts server truth on mismatch. That's now belt *and* suspenders — the persisted record itself is server data.

Why jsonb-on-players over a dedicated table: one record per player, written by the same authenticated routes that already mutate the player, no join, one nullable column.

## 3. Changes

- `lib/db/schema/players.ts` — `autofarmRun` jsonb column
- `lib/db/migrations/0030_autofarm_run.sql` + `lib/migrations/autofarmRun.ts` + `server.ts` registration
- `lib/autoFarmRunService.ts` (new) — save/clear/validate + `RUN_STALE_MS`
- `app/api/autofarm/run/route.ts` (new) — GET/POST, session-scoped, bounds-guarded, harvest-tier rate limit
- `lib/playerService.ts` — mapping both directions; `types/game.types.ts` — inline structural type on `Player` (no client bundle edge); `lib/playerSanitize.ts` — allowlisted (own-data only)
- `lib/mongodb.ts` — `PLAYER_DOT_PATH_COLUMNS` maps `autofarmRun` → root jsonb column (the FID-073 lesson applied preemptively)
- `utils/autoFarmEngine.ts` — persistence hooks + `adoptPersistedRun`
- `app/game/page.tsx` — auto-resume on engine creation

## 4. Tests

`__tests__/lib/autoFarmRun.test.ts` (9): record-validation matrix, session scoping (401 unauthenticated; username from session), bounds rejection, clear-on-null, savedAt stamping, GET returns null/record.

## 5. Gates

tsc 0 · eslint 0 · vitest **593** (9 new) · build exit 0.
