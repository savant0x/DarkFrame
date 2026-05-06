ALTER TABLE players ADD COLUMN IF NOT EXISTS concentration_zones JSONB DEFAULT '[]'::jsonb;
