-- Migration 0019: backfill players.factory_count from the factories table
-- (FID-20260908-004)
--
-- players.factory_count is a denormalized counter (StatsPanel "Factories"
-- readout, unit-slot capacity 100 + count×50, battleService) that no ownership
-- transition ever maintained — it stayed at its default 0 for every player.
-- Ownership maintenance now happens at every transition (capture in
-- factoryService, abandon, release); this one-statement backfill repairs
-- EXISTING rows (the live save included). Idempotent: recount from source of
-- truth, rows with no factories land at 0.

UPDATE players
SET factory_count = (
  SELECT count(*) FROM factories WHERE factories.owner = players.username
);
