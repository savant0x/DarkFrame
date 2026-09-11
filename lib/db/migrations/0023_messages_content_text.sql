-- FID-20260911-044 — battle reports must fit the inbox.
--
-- messages.content was varchar(1000) (a chat-message legacy cap). The
-- FID-20260911-044 full line-item battle report (~1–3.8 KB) cannot fit, so
-- every report insert died with `value too long for type character
-- varying(1000)` — silently, because notification delivery is non-fatal by
-- contract. Widening to text (unbounded) fixes all three consumers:
--   1. system battle reports (the new consumer),
--   2. normal chat messages (zod caps those at 1000 chars anyway,
--      so player-typed content is unchanged),
--   3. conversations.last_message_content stays varchar(1000) — it is a
--      preview and deliverReport() slices to 200 chars for reports.
--
-- text vs varchar(4000): the report body is machine-formatted, not
-- user-typed; text avoids a future re-widen.

ALTER TABLE messages ALTER COLUMN content TYPE text;
