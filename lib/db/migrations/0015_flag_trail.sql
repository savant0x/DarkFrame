-- Migration 0015: flag_trail (FID-20260905-001 §7.2)
--
-- The flag bearer's trail ("glimmer" tiles on the map) had no persistence: the
-- only writer (app/api/move/route.ts) pushed to a Mongo-era `trail` array on the
-- flags doc that the Postgres schema never carried, so no trail was ever stored
-- and every consumer's trail read was dead code.
--
-- TTL: entries expire 8 minutes after creation (matches FLAG trail TTL used by
-- readers); readers filter expired rows and the cap is enforced on write.

CREATE TABLE IF NOT EXISTS flag_trail (
  id varchar(24) PRIMARY KEY,
  holder_username varchar(20) NOT NULL,
  x integer NOT NULL CHECK (x BETWEEN 1 AND 150),
  y integer NOT NULL CHECK (y BETWEEN 1 AND 150),
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_flag_trail_expires ON flag_trail (expires_at);
CREATE INDEX IF NOT EXISTS idx_flag_trail_holder ON flag_trail (holder_username, expires_at);
