ALTER TABLE clan_chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_clan_chat_unread ON clan_chat_messages(clan_id, is_read) WHERE is_read = false;
