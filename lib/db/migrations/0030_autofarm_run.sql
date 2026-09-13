-- FID-20260912-078: server-backed AutoFarm run state.
-- The engine's run record (status/position/row/direction/tiles/startTime)
-- moves from browser localStorage to the player's row, so a refresh restores
-- the run from the same source the move API writes to — the engine's position
-- can never again be a stale local artifact fighting server truth (the
-- FID-075 divergence class). Column-add is idempotent by the guard in
-- lib/migrations/autofarmRun.ts.

ALTER TABLE players ADD COLUMN IF NOT EXISTS autofarm_run jsonb;
