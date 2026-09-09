-- Migration 0018: widen tutorial_action_tracking.action_type varchar(30) -> varchar(160)
-- (FID-20260908-001)
--
-- updateActionTracking persists the step's count state as JSON inside action_type
-- ({"currentCount":N,"targetCount":15} = 35 chars; MOVE_TO_COORDS adds targetX/Y,
-- startX/Y, moveCount ≈ 105 chars worst case). The column was sized for a short
-- action label, so EVERY tracking write failed with "value too long" and was
-- swallowed by the routes' try/catch — the tracking table stayed empty and the
-- tutorial's counted steps could never progress. Widening is non-destructive and
-- backward compatible (house pattern: migration 0014, identical defect class).

ALTER TABLE tutorial_action_tracking ALTER COLUMN action_type TYPE varchar(160);
