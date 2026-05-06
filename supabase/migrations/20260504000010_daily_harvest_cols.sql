ALTER TABLE daily_harvest_progress ADD COLUMN IF NOT EXISTS harvest_count INTEGER DEFAULT 0;
ALTER TABLE daily_harvest_progress ADD COLUMN IF NOT EXISTS milestones_completed INTEGER[] DEFAULT '{}';
ALTER TABLE daily_harvest_progress ADD COLUMN IF NOT EXISTS total_rp_earned INTEGER DEFAULT 0;
