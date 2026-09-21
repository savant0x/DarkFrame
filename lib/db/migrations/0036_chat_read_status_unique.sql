-- 0036_chat_read_status_unique.sql (FID-20260919-015 W1)
--
-- chat_read_status gains its first live consumer (chatReadStatusService, the
-- persistent channel unread-badge store). The table's pair index is
-- NON-unique, so concurrent mark-as-read upserts could race two rows per
-- (channel_id, user_id) pair — the exact defect 0034 fixed for
-- typing_indicators. Making the pair unique keeps the upsert atomic
-- (ON CONFLICT DO UPDATE), deduplicating any historical pairs first.
--
-- Idempotent: safe to re-run (the DO block no-ops when the index exists).

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_indexes
		WHERE indexname = 'chat_read_status_channel_user_unique'
	) THEN
		DELETE FROM chat_read_status a
		USING chat_read_status b
		WHERE a.channel_id = b.channel_id
		  AND a.user_id = b.user_id
		  AND (a.last_read_at, a.id) < (b.last_read_at, b.id);

		CREATE UNIQUE INDEX "chat_read_status_channel_user_unique"
			ON "chat_read_status" ("channel_id", "user_id");
	END IF;
END
$$;

-- Drop the superseded non-unique pair index.
DROP INDEX IF EXISTS "chat_read_status_user_channel_idx";
