-- FID-20260912-070 — one-time truth repair: migration-restored armies
-- (FID-033 catalog migration rebuilt 10.7K legacy units) never fed the
-- stats tracker, so totalUnitsBuilt undercounts. Raise the counter to the
-- army truth (never lower it) for every player whose counter lags.
UPDATE players
SET stats = jsonb_set(
  COALESCE(stats, '{}'::jsonb),
  '{totalUnitsBuilt}',
  to_jsonb(
    (SELECT COALESCE(SUM((u->>'quantity')::numeric), 0)
     FROM jsonb_array_elements(units) u)
  )
)
WHERE units IS NOT NULL
  AND jsonb_array_length(units) > 0
  AND COALESCE((stats->>'totalUnitsBuilt')::numeric, 0)
      < (SELECT COALESCE(SUM((u->>'quantity')::numeric), 0)
         FROM jsonb_array_elements(units) u)
RETURNING username, stats->>'totalUnitsBuilt' AS total_units_built;
