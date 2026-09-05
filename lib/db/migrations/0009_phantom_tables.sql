-- FID-20260904-005 §5.2a: phantom-table remediation + upsert conflict-target parity.
-- All statements idempotent (IF NOT EXISTS / no-ops on re-apply). Applied via
-- `npm run db:setup` (drizzle-kit migrate) and safe on the live production DB.

-- ── 1. rptransactions ────────────────────────────────────────────────────────
-- lib/researchPointService.ts writes/reads this table through RAW SQL with UNQUOTED
-- mixed-case identifiers ("INSERT INTO rpTransactions (id, playerUsername, …)").
-- Postgres folds unquoted identifiers to lower-case, so the table the SQL actually
-- resolves to is `rptransactions` with all lower-case column names. Creating exactly
-- that shape makes every existing INSERT/WHERE work UNMODIFIED. The JS-side row
-- mapping (row.playerUsername etc.) is fixed in the service (lower-case key reads).
CREATE TABLE IF NOT EXISTS rptransactions (
  id varchar(64) PRIMARY KEY,
  playerusername varchar(20) NOT NULL,
  amount integer NOT NULL,
  source varchar(50) NOT NULL,
  description text,
  "timestamp" timestamptz NOT NULL,
  vipbonus integer NOT NULL DEFAULT 0,
  balanceafter integer,
  metadata jsonb
);
CREATE INDEX IF NOT EXISTS rptransactions_player_idx ON rptransactions (playerusername);
CREATE INDEX IF NOT EXISTS rptransactions_timestamp_idx ON rptransactions ("timestamp");

-- ── 2. bot_migration_history ─────────────────────────────────────────────────
-- lib/botMigrationService.ts INSERTs (timestamp, bots_migrated, by_specialization,
-- triggered_by, triggered_by_user) and SELECTs * mapping snake_case fields — column
-- names must match exactly. No id column: the INSERT supplies none, so the PK is
-- an identity column (raw-SQL table, never shim-written, so the 24-char id scheme
-- does not apply).
CREATE TABLE IF NOT EXISTS bot_migration_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "timestamp" timestamptz NOT NULL,
  bots_migrated integer NOT NULL,
  by_specialization jsonb NOT NULL,
  triggered_by varchar(20) NOT NULL,
  triggered_by_user varchar(20)
);
CREATE INDEX IF NOT EXISTS bot_migration_history_ts_idx ON bot_migration_history ("timestamp" DESC);

-- ── 3. Conflict-target parity for race-safe upserts (FID §5.0 (b)) ──────────
-- user_presence_user_id_unique already exists in production (verified live);
-- IF NOT EXISTS makes fresh environments (CI, new dev DBs) match. The drizzle
-- schema mirrors it so schema-driven pushes can never silently drop it.
CREATE UNIQUE INDEX IF NOT EXISTS user_presence_user_id_unique ON user_presence (user_id);

-- game_config.type: the beer-base config upsert filters on { type: 'beerBase' }.
-- A unique index is required for atomic onConflictDoUpdate. Existing prod rows:
-- zero duplicate types (verified live during the FID audit).
CREATE UNIQUE INDEX IF NOT EXISTS game_config_type_unique ON game_config ("type");

-- tutorial_action_tracking unique (player_id, step_id) already exists in prod
-- (tutorial_action_player_step_unique); parity for fresh environments:
CREATE UNIQUE INDEX IF NOT EXISTS tutorial_action_player_step_unique
  ON tutorial_action_tracking (player_id, step_id);
