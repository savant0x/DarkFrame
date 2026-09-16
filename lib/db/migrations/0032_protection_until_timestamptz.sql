-- FID-20260916-009 D2: protection_until timestamp → timestamptz.
-- Every historical value was written by node-pg (UTC literal in a naive
-- column), so reinterpret with AT TIME ZONE 'UTC' — no instant shifts.
-- Two-step form avoids a data-loss casting shortcut on NULLs/edge values.
ALTER TABLE "players"
  ALTER COLUMN "protection_until" TYPE timestamp with time zone
  USING ("protection_until" AT TIME ZONE 'UTC');
