-- FID-20260504-STABLE: Tutorial action tracking table (migrated from bot_config JSON)
CREATE TABLE IF NOT EXISTS tutorial_action_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_username TEXT NOT NULL,
  step_id TEXT NOT NULL,
  current_count INTEGER NOT NULL DEFAULT 0,
  target_count INTEGER,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_username, step_id)
);
CREATE INDEX IF NOT EXISTS idx_tutorial_tracking_player ON tutorial_action_tracking(player_username);
ALTER TABLE tutorial_action_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage tracking" ON tutorial_action_tracking FOR ALL USING (auth.role() = 'service_role');
