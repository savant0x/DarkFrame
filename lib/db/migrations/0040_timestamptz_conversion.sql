-- 0040_timestamptz_conversion.sql (FID-20260923-001)
--
-- Eliminate the naive-timestamp class: convert every `timestamp without time
-- zone` column to `timestamptz`, interpreting each stored wall clock with the
-- zone it was WRITTEN in. Zone NAMES (not fixed offsets) are used so DST
-- resolves per stored value, including pre-transition history.
--
--   * app-written columns hold the process-local wall clock -> America/New_York
--   * DB-defaulted (`DEFAULT now()`) and unwritten columns hold the session
--     wall clock (UTC) -> UTC
--
-- 135 columns total (119 app-local, 16 UTC);
-- 57 carry data, the rest are a pure type change.
--
-- IDEMPOTENT: a column already `timestamp with time zone` is skipped. Reapplying
-- the USING expression to an already-converted column would silently re-shift it
-- (`timestamptz AT TIME ZONE z` yields a naive local timestamp), so the guard is
-- load-bearing, not cosmetic.
--
-- CALIBRATED TO THIS ENVIRONMENT: `America/New_York` is the writing process TZ
-- of the data here. A database whose naive rows were written by a UTC process
-- must use `UTC` for those rows (see the provenance caveat in
-- dev/TIMESTAMP-CLASSIFICATION-2026-09-23.md).

DO $$
DECLARE
  r RECORD;
  n_done int := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('auctions', 'closed_at', 'America/New_York'),
      ('auctions', 'created_at', 'America/New_York'),
      ('auctions', 'expires_at', 'America/New_York'),
      ('bans', 'banned_at', 'America/New_York'),
      ('bans', 'created_at', 'America/New_York'),
      ('bans', 'expires_at', 'America/New_York'),
      ('battle_logs', 'timestamp', 'America/New_York'),
      ('beer_base_defeat_events', 't', 'America/New_York'),
      ('beer_base_spawn_events', 't', 'America/New_York'),
      ('blocked_users', 'created_at', 'America/New_York'),
      ('bot_config', 'last_spawn', 'UTC'),
      ('bot_magnet_beacons', 'cooldown_until', 'America/New_York'),
      ('bot_magnet_beacons', 'deployed_at', 'America/New_York'),
      ('bot_magnet_beacons', 'expires_at', 'America/New_York'),
      ('chat_messages', 'edited_at', 'America/New_York'),
      ('chat_messages', 'timestamp', 'America/New_York'),
      ('chat_read_status', 'last_read_at', 'America/New_York'),
      ('chat_reports', 'created_at', 'America/New_York'),
      ('chat_reports', 'resolved_at', 'UTC'),
      ('clan_relations', 'last_updated', 'America/New_York'),
      ('clan_wars', 'created_at', 'UTC'),
      ('clan_wars', 'declared_at', 'UTC'),
      ('clan_wars', 'ended_at', 'America/New_York'),
      ('clan_wars', 'updated_at', 'UTC'),
      ('clans', 'created_at', 'America/New_York'),
      ('clans', 'last_territory_income_collection', 'America/New_York'),
      ('clans', 'level_last_level_up', 'America/New_York'),
      ('conversations', 'created_at', 'America/New_York'),
      ('conversations', 'last_message_created_at', 'America/New_York'),
      ('conversations', 'metadata_first_message_at', 'UTC'),
      ('conversations', 'updated_at', 'America/New_York'),
      ('factories', 'last_attack_time', 'America/New_York'),
      ('factories', 'last_resource_generation', 'America/New_York'),
      ('factories', 'last_slot_regen', 'America/New_York'),
      ('flag_trail', 'created_at', 'America/New_York'),
      ('flag_trail', 'expires_at', 'America/New_York'),
      ('friend_requests', 'created_at', 'America/New_York'),
      ('friend_requests', 'expires_at', 'America/New_York'),
      ('friend_requests', 'responded_at', 'America/New_York'),
      ('friends', 'created_at', 'America/New_York'),
      ('friends', 'updated_at', 'America/New_York'),
      ('messages', 'created_at', 'America/New_York'),
      ('messages', 'deleted_at', 'America/New_York'),
      ('messages', 'edited_at', 'UTC'),
      ('messages', 'read_at', 'America/New_York'),
      ('migrations', 'applied_at', 'America/New_York'),
      ('missiles', 'completed_at', 'America/New_York'),
      ('missiles', 'created_at', 'America/New_York'),
      ('missiles', 'impact_at', 'America/New_York'),
      ('missiles', 'intercepted_at', 'America/New_York'),
      ('missiles', 'launched_at', 'America/New_York'),
      ('missiles', 'updated_at', 'America/New_York'),
      ('mod_log', 'created_at', 'America/New_York'),
      ('mutes', 'created_at', 'America/New_York'),
      ('mutes', 'expires_at', 'America/New_York'),
      ('player_activity', 'timestamp', 'America/New_York'),
      ('player_flags', 'created_at', 'America/New_York'),
      ('player_level_history', 'captured_at', 'UTC'),
      ('player_research', 'current_research_started_at', 'America/New_York'),
      ('player_research', 'updated_at', 'America/New_York'),
      ('player_sessions', 'created_at', 'America/New_York'),
      ('player_sessions', 'end_time', 'America/New_York'),
      ('player_sessions', 'expires_at', 'America/New_York'),
      ('player_sessions', 'start_time', 'America/New_York'),
      ('players', 'active_boosts_expires_at', 'America/New_York'),
      ('players', 'ban_expires_at', 'America/New_York'),
      ('players', 'bank_last_deposit', 'America/New_York'),
      ('players', 'banned_at', 'America/New_York'),
      ('players', 'created_at', 'UTC'),
      ('players', 'last_bot_summon', 'America/New_York'),
      ('players', 'last_fast_travel', 'America/New_York'),
      ('players', 'last_flag_attack', 'UTC'),
      ('players', 'last_level_up', 'America/New_York'),
      ('players', 'last_login_date', 'America/New_York'),
      ('players', 'last_referral_validated', 'America/New_York'),
      ('players', 'last_streak_reward', 'America/New_York'),
      ('players', 'last_xp_award', 'America/New_York'),
      ('players', 'referral_validated_at', 'America/New_York'),
      ('players', 'vip_expiration', 'America/New_York'),
      ('players', 'vip_last_updated', 'America/New_York'),
      ('referrals', 'created_at', 'America/New_York'),
      ('referrals', 'last_login', 'America/New_York'),
      ('referrals', 'signup_date', 'America/New_York'),
      ('referrals', 'updated_at', 'America/New_York'),
      ('referrals', 'validation_date', 'America/New_York'),
      ('rp_daily_totals', 'updatedat', 'UTC'),
      ('shrine_blessings', 'created_at', 'America/New_York'),
      ('shrine_blessings', 'expires_at', 'America/New_York'),
      ('tiles', 'trail_expires_at', 'UTC'),
      ('tiles', 'trail_timestamp', 'UTC'),
      ('trade_history', 'completed_at', 'America/New_York'),
      ('tutorial_action_tracking', 'last_updated', 'America/New_York'),
      ('tutorial_progress', 'completed_at', 'America/New_York'),
      ('tutorial_progress', 'current_step_started_at', 'America/New_York'),
      ('tutorial_progress', 'declined_at', 'America/New_York'),
      ('tutorial_progress', 'last_updated', 'America/New_York'),
      ('tutorial_progress', 'started_at', 'America/New_York'),
      ('typing_indicators', 'expires_at', 'America/New_York'),
      ('user_presence', 'expires_at', 'America/New_York'),
      ('user_presence', 'last_seen', 'America/New_York'),
      ('warnings', 'created_at', 'America/New_York'),
      ('wmd_alerts', 'acknowledged_at', 'UTC'),
      ('wmd_alerts', 'created_at', 'America/New_York'),
      ('wmd_alerts', 'resolved_at', 'UTC'),
      ('wmd_clan_votes', 'created_at', 'America/New_York'),
      ('wmd_clan_votes', 'expires_at', 'America/New_York'),
      ('wmd_clan_votes', 'resolved_at', 'America/New_York'),
      ('wmd_config', 'updated_at', 'America/New_York'),
      ('wmd_counter_intel_operations', 'created_at', 'America/New_York'),
      ('wmd_counter_intel_operations', 'executed_at', 'America/New_York'),
      ('wmd_defense_batteries', 'built_at', 'America/New_York'),
      ('wmd_defense_batteries', 'repair_completes_at', 'America/New_York'),
      ('wmd_defense_batteries', 'updated_at', 'America/New_York'),
      ('wmd_intelligence_reports', 'created_at', 'America/New_York'),
      ('wmd_intelligence_reports', 'expires_at', 'America/New_York'),
      ('wmd_intelligence_reports', 'gathered_at', 'America/New_York'),
      ('wmd_interceptions', 'timestamp', 'America/New_York'),
      ('wmd_launch_authorizations', 'expires_at', 'America/New_York'),
      ('wmd_launch_authorizations', 'granted_at', 'America/New_York'),
      ('wmd_notifications', 'broadcast_at', 'America/New_York'),
      ('wmd_notifications', 'created_at', 'America/New_York'),
      ('wmd_sabotage_operations', 'created_at', 'America/New_York'),
      ('wmd_sabotage_operations', 'executed_at', 'America/New_York'),
      ('wmd_security_status', 'last_incident', 'America/New_York'),
      ('wmd_security_status', 'updated_at', 'America/New_York'),
      ('wmd_spies', 'created_at', 'America/New_York'),
      ('wmd_spies', 'last_mission_at', 'America/New_York'),
      ('wmd_spies', 'recruited_at', 'America/New_York'),
      ('wmd_spies', 'updated_at', 'America/New_York'),
      ('wmd_spy_missions', 'actual_completion', 'America/New_York'),
      ('wmd_spy_missions', 'completed_at', 'UTC'),
      ('wmd_spy_missions', 'created_at', 'America/New_York'),
      ('wmd_spy_missions', 'estimated_completion', 'America/New_York'),
      ('wmd_spy_missions', 'updated_at', 'America/New_York'),
      ('wmd_suspicious_activity', 'created_at', 'America/New_York')
    ) AS t(tbl, col, zone)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.col
        AND data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE timestamptz USING (%I AT TIME ZONE %L)',
                     r.tbl, r.col, r.col, r.zone);
      n_done := n_done + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'migration 0040: % column(s) converted to timestamptz', n_done;
END $$;

-- Explicit decisions for the MIXED (multi-writer) columns, recorded here so the
-- zone list above is auditable against the evidence in
-- dev/TIMESTAMP-CLASSIFICATION-2026-09-23.md §Mixed-writer columns:
--   auctions.expires_at -> America/New_York
--   clan_wars.declared_at -> UTC
--   clan_wars.updated_at -> UTC
--   flag_trail.created_at -> America/New_York
--   player_level_history.captured_at -> UTC
--   players.created_at -> UTC
