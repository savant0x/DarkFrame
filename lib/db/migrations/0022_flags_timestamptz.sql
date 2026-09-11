-- FID-20260910-039: flags time columns → timestamptz.
--
-- Defect: the flag state machine's five naive `timestamp without time zone`
-- columns were written as UTC wall-clock literals (drizzle toISOString) but
-- parsed by node-pg as LOCAL time — shifting every stored instant by the
-- machine's UTC offset. All channel windows (challenge_ends_at, bearer flee
-- lock, flee cooldown, 1h grace, 12h hold clock) were skewed, which surfaced
-- as "taking the flag is broken": grace/channels expired at the wrong real
-- times and hold durations ran long.
--
-- timestamptz makes every value an absolute instant; node-pg then parses it
-- correctly regardless of the machine timezone. Existing literals are
-- converted assuming UTC (their dominant provenance). Column-local "now()"
-- comparisons become offset-proof.
ALTER TABLE flags
  ALTER COLUMN last_captured_at     TYPE timestamptz USING last_captured_at     AT TIME ZONE 'UTC',
  ALTER COLUMN grace_until          TYPE timestamptz USING grace_until          AT TIME ZONE 'UTC',
  ALTER COLUMN challenge_started_at TYPE timestamptz USING challenge_started_at AT TIME ZONE 'UTC',
  ALTER COLUMN challenge_ends_at    TYPE timestamptz USING challenge_ends_at    AT TIME ZONE 'UTC',
  ALTER COLUMN last_flee_at         TYPE timestamptz USING last_flee_at         AT TIME ZONE 'UTC';
