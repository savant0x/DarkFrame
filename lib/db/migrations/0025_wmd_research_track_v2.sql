-- FID-20260912-059 — WMD research track v2 (W1 revision): 600k / L40+2×tier.
--
-- FID-20260912-058 replaced the three parallel 10-tier tracks
-- (missile_tier_* / defense_tier_* / spy_tier_* / intel_tier_*) with ONE
-- single 10-tier track (wmd_tier_1 … wmd_tier_10). Rows written by the old
-- catalog would otherwise strand foreign ids in the jsonb columns forever.
--
-- For every existing player_research row this migration:
--   1. Prefixes legacy ids with `legacy_` (auditable history; they never
--      match the sellable catalog and the domain-tier computation, which
--      filters over catalog ids, ignores them).
--   2. Maps achieved legacy domain tiers onto the new track: tier N reached
--      in ANY old domain completes wmd_tier_1…N (same content tier — no
--      progress lost beyond the per-domain → single-track fold, which is
--      the accepted W1 design decision).
--   3. Refunds stale in-progress research: if current_research_tech_id is
--      not a catalog id, the partially-spent RP returns to the player and
--      the slot clears. (Join on players."_id"::text — if id formats ever
--      diverge, the refund no-ops safely for that row.)
--   4. Recomputes missile/defense/intelligence tiers per the FID-058
--      catalog rotation (missile {1,4,6,8,10}, defense {2,5,7},
--      intelligence {3,9}) and available/locked per the
--      initializePlayerResearch invariant: available = next incomplete
--      tier, locked = everything else. (Level/clan gates for the next
--      tier are re-checked by recalculateAvailableTechs on the player's
--      next research action — this migration does not pre-filter them.)
--
-- Idempotent: guards on legacy prefixes/id membership make every pass a
-- no-op once the first has run. Live DB at migration time had 0 rows —
-- this ships defensively so any pre-v2 install upgrades without loss.

DO $$
DECLARE
  r RECORD;
  k int;
  new_completed jsonb;
  avail jsonb;
  locked jsonb;
  mt int; dt int; it int;
  cur_out text; spent_out int; req_out int; prog_out numeric;
  refund int;
  MISSILE_TIERS int[] := ARRAY[1, 4, 6, 8, 10];
  DEFENSE_TIERS int[] := ARRAY[2, 5, 7];
  INTEL_TIERS   int[] := ARRAY[3, 9];
BEGIN
  FOR r IN
    SELECT id, player_id, completed_techs AS completed,
           current_research_tech_id AS cur,
           current_research_rp_spent AS spent,
           current_research_rp_required AS req,
           current_research_progress AS prog
    FROM player_research
  LOOP
    -- Highest tier reached: existing wmd ids first, else best legacy tier.
    SELECT GREATEST(
             COALESCE(MAX(CASE WHEN v LIKE 'wmd_tier_%'
                               THEN substring(v from '[0-9]+$')::int END), 0),
             COALESCE(MAX(CASE WHEN v ~ '^(missile_|defense_|spy_|intel_)tier_[0-9]+$'
                               THEN substring(v from '[0-9]+$')::int END), 0)
           )
      INTO k
      FROM jsonb_array_elements_text(COALESCE(r.completed, '[]'::jsonb)) AS t(v);
    k := LEAST(COALESCE(k, 0), 10);

    -- 1+2. Remap completed: keep non-legacy ids, prefix legacy ones,
    --      then add the mapped wmd_tier_1..k prefix.
    SELECT COALESCE(jsonb_agg(DISTINCT x ORDER BY x), '[]'::jsonb)
      INTO new_completed
      FROM (
        SELECT v AS x
        FROM jsonb_array_elements_text(COALESCE(r.completed, '[]'::jsonb)) AS t(v)
        WHERE v !~ '^(missile_|defense_|spy_|intel_)tier_[0-9]+$'
        UNION
        SELECT 'legacy_' || v
        FROM jsonb_array_elements_text(COALESCE(r.completed, '[]'::jsonb)) AS t(v)
        WHERE v ~ '^(missile_|defense_|spy_|intel_)tier_[0-9]+$'
        UNION
        SELECT 'wmd_tier_' || n FROM generate_series(1, k) AS n WHERE k > 0
      ) AS u;

    -- 4. Domain tiers from the FID-058 rotation, over completed 1..k.
    SELECT COALESCE(MAX(n), 0) INTO mt FROM generate_series(1, k) AS n WHERE n = ANY(MISSILE_TIERS);
    SELECT COALESCE(MAX(n), 0) INTO dt FROM generate_series(1, k) AS n WHERE n = ANY(DEFENSE_TIERS);
    SELECT COALESCE(MAX(n), 0) INTO it FROM generate_series(1, k) AS n WHERE n = ANY(INTEL_TIERS);

    -- 4. available = next incomplete tier; locked = the rest.
    IF k >= 10 THEN
      avail := '[]'::jsonb;
    ELSE
      avail := jsonb_build_array('wmd_tier_' || (k + 1));
    END IF;
    SELECT COALESCE(jsonb_agg(x ORDER BY x), '[]'::jsonb)
      INTO locked
      FROM unnest(ARRAY['wmd_tier_1','wmd_tier_2','wmd_tier_3','wmd_tier_4','wmd_tier_5',
                        'wmd_tier_6','wmd_tier_7','wmd_tier_8','wmd_tier_9','wmd_tier_10']) AS x
      WHERE x <> ALL (SELECT jsonb_array_elements_text(new_completed))
        AND x <> ALL (SELECT jsonb_array_elements_text(avail));

    -- 3. Refund stale in-progress research (non-catalog tech id).
    cur_out := r.cur;
    spent_out := r.spent;
    req_out := r.req;
    prog_out := r.prog;
    IF r.cur IS NOT NULL AND r.cur !~ '^wmd_tier_[0-9]+$' THEN
      UPDATE players
         SET research_points = COALESCE(research_points, 0) + COALESCE(r.spent, 0)
       WHERE "_id"::text = r.player_id;
      GET DIAGNOSTICS refund = ROW_COUNT;
      IF refund > 0 THEN
        RAISE NOTICE 'player_research %: refunded % RP for stale research on legacy id %', r.id, COALESCE(r.spent, 0), r.cur;
      END IF;
      cur_out := NULL; spent_out := 0; req_out := 0; prog_out := 0;
    END IF;

    UPDATE player_research SET
      completed_techs = new_completed,
      available_techs = avail,
      locked_techs = locked,
      missile_tier = mt,
      defense_tier = dt,
      intelligence_tier = it,
      current_research_tech_id = cur_out,
      current_research_rp_spent = spent_out,
      current_research_rp_required = req_out,
      current_research_progress = prog_out,
      total_techs_unlocked = (SELECT COUNT(*)
                                FROM jsonb_array_elements_text(new_completed) AS t(v)
                               WHERE v LIKE 'wmd_tier_%'),
      updated_at = now()
    WHERE id = r.id;
  END LOOP;

  RAISE NOTICE 'WMD v2 migration pass complete (idempotent).';
END
$$;

-- Post-conditions (manual verification):
--   SELECT COUNT(*) FROM player_research WHERE EXISTS (
--     SELECT 1 FROM jsonb_array_elements_text(completed_techs) t(v)
--     WHERE v ~ '^(missile_|defense_|spy_|intel_)tier_[0-9]+$');   -- expect 0
--   SELECT COUNT(*) FROM player_research WHERE current_research_tech_id IS NOT NULL
--     AND current_research_tech_id !~ '^wmd_tier_[0-9]+$';         -- expect 0
