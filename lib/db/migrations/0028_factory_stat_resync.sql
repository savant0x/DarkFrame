-- FID-20260912-072 — Factory stat resync.
--
-- The dormant-stats audit found every factory's `slots` and `production_rate`
-- frozen at their creation values (5,000 / 1) regardless of level: neither the
-- player upgrade route nor the bot economy ever wrote them. Level+defense were
-- maintained; capacity and production were not.
--
-- This migration recomputes BOTH from the canonical FID-072 curves (single
-- source: lib/factoryUpgradeService.ts):
--   slots          = 400 + (level-1)*150
--   production_rate = 5*level^2 + 5
--   defense        = CASE level WHEN 1 THEN 1000 ELSE (level-1)^2 * 12500 END
--
-- Defense resync also repairs the pre-072 curve (L2 was 50,000 — the 50x
-- cliff) for factories the bot seed upgraded under the old formula.
--
-- used_slots is CLAMPED to the new capacity: with the old 5,000 pool the max
-- observed garrison was 1,901, but at the new L1 capacity of 400 some rows
-- could exceed their ceiling. Units themselves live on players' `units` blobs —
-- this trims the COUNTER only (the FID-032 §7 invariant: used_slots is
-- bookkeeping, never the army).
--
-- Idempotent: rerunning produces the same values from the same levels.

UPDATE factories SET
  slots = 400 + (level - 1) * 150,
  production_rate = 5 * level * level + 5,
  defense = CASE WHEN level = 1 THEN 1000 ELSE (level - 1) * (level - 1) * 12500 END;

UPDATE factories SET used_slots = slots WHERE used_slots > slots;
