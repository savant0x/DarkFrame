ALTER TABLE players ADD COLUMN IF NOT EXISTS daily_bounties JSONB DEFAULT '{}'::jsonb;
