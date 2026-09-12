# FID-20260912-063 — AutoFarm Move Verification Broken (Position Parser Missed the Real API Shape)

**Date:** 2026-09-12 · **Severity:** live gameplay breaker · **Trigger:** user console
error `[AutoFarm] Position mismatch: Expected (65, 67), got {}` on every move.

## Root cause

`/api/move` returns the envelope:

```json
{ "success": true, "data": { "player": { "currentPosition": { "x": 65, "y": 67 } }, "currentTile": { … } } }
```

`AutoFarmEngine.moveToPosition` verified the move by probing four shapes —
`data.data.player.currentPositionX/Y` (fields that do not exist — position is an
object, not scalar columns), `data.player.currentPosition`,
`data.data.newPosition`, `data.newPosition` — and never the actual
`data.data.player.currentPosition`. Every verified move logged a mismatch and
the engine stalled mid-run. The stale shapes date from the pre-Postgres API;
FID-045's payload slimming made the mismatch fatal by removing the redundant
scalar copies the parser leaned on.

## Fix

- Extracted `extractNewPosition(payload)` as an exported pure function in
  `utils/autoFarmEngine.ts`: checks the real shape first, keeps the legacy
  fallbacks, returns `null` when nothing matches (typed, no `{}` leaks).
- `moveToPosition` uses it; mismatch logging unchanged.

## Tests

`__tests__/utils/autoFarmPosition.test.ts` pins: the real envelope, every legacy
shape, garbage payloads → null, and coordinate equality rejection paths.

## Gates

tsc 0 · eslint 0 · vitest (new pins) · `npm run build` 0.
