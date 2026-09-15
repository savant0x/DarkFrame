-- FID-20260914-009 Phase B: real storage for player level snapshots.
-- The snapshot cron has written to the unmapped `playerLevelHistory`
-- collection since the Mongo pivot — every insert silently vanished and the
-- beer-base prediction system ran on its fallback distribution. This table
-- gives the snapshots a real home; lib/db/schema exports `playerLevelHistory`
-- (same identifier the service previously used as a collection name), so the
-- shim registry resolves it directly.
--
-- Key contract: username (players.username) — stable, joinable, human-auditable.
-- The Mongo-era _id key died with the pivot; the table starts empty by design
-- and accrues from deploy (a backfill of past levels is unreconstructible).

CREATE TABLE IF NOT EXISTS player_level_history (
    username varchar(20) NOT NULL,
    level integer NOT NULL,
    captured_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (username, captured_at)
);

CREATE INDEX IF NOT EXISTS player_level_history_captured_idx
    ON player_level_history (captured_at);
