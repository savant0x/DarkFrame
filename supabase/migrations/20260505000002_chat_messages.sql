-- Migration: Create chat_messages table for global/trade/help/vip channels
-- FID: FID-20260504-STABLE | 2026-05-04

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('global', 'newbie', 'trade', 'help', 'vip')),
  sender_id TEXT NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  sender_username TEXT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  deleted BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read chat_messages" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Service role can manage chat_messages" ON chat_messages FOR ALL USING (auth.role() = 'service_role');
