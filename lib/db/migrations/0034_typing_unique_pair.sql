-- 0034_typing_unique_pair.sql (FID-20260917-017 slice 3)
--
-- The Mongo shim wrote typing indicators via select-then-insert against a
-- NON-unique (channel_id, user_id) index, so concurrent first-typing writes
-- could race two rows per (channel, user) pair — and nothing ever deleted
-- expired rows (no TTL engine on pg), letting duplicates accumulate.
--
-- This migration makes the pair unique so the direct-drizzle upsert
-- (ON CONFLICT (channel_id, user_id) DO UPDATE) is atomic, deduplicating any
-- historical pairs first (highest expires_at wins per pair).
--
-- Idempotent: safe to re-run (the DO blocks no-op when the index exists).

-- 1. Dedupe historical pairs: keep the newest row (max expires_at) per pair.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_indexes
		WHERE indexname = 'typing_indicators_channel_user_unique'
	) THEN
		DELETE FROM typing_indicators a
		USING typing_indicators b
		WHERE a.channel_id = b.channel_id
		  AND a.user_id = b.user_id
		  AND (a.expires_at, a.id) < (b.expires_at, b.id);

		CREATE UNIQUE INDEX "typing_indicators_channel_user_unique"
			ON "typing_indicators" ("channel_id", "user_id");
	END IF;
END
$$;

-- 2. Drop the superseded non-unique pair index (keeps the pair index landscape clean).
DROP INDEX IF EXISTS "typing_indicators_channel_user_idx";
