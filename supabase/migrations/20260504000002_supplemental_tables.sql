-- FID-20260503-SUPABASE: Supplemental tables for auxiliary services
-- Tables needed by: friendService, messagingService, researchPointService, playerHistoryService, beerBaseAnalytics

CREATE TABLE IF NOT EXISTS friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_username TEXT NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  friend_username TEXT NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_username, friend_username)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_username TEXT NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  receiver_username TEXT NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sender_username, receiver_username, status)
);

CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_username TEXT NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  blocked_username TEXT NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_username, blocked_username)
);

CREATE TABLE IF NOT EXISTS daily_harvest_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  metal_harvested NUMERIC DEFAULT 0,
  energy_harvested NUMERIC DEFAULT 0,
  harvest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(username, harvest_date)
);

CREATE TABLE IF NOT EXISTS player_level_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_harvest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_level_history ENABLE ROW LEVEL SECURITY;
