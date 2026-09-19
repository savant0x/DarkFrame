-- 0035_notification_stack_removal.sql (FID-20260919-011)
--
-- Removes the never-wired WMD notification side-stack: player_notifications,
-- admin_dashboard_notifications, email_queue (designed by FID-20260903-002
-- alongside alertService). Evidence at removal time: zero trigger callers
-- anywhere, no email sender consumed the queue, no reader surfaced, and all
-- three tables held 0 rows in the live DB — the stack never fired once.
-- The wmd_alerts SOURCE table REMAINS (live reader: admin health endpoint).
--
-- Idempotent (IF EXISTS) so re-runs and fresh environments are safe.

DROP TABLE IF EXISTS player_notifications;
DROP TABLE IF EXISTS admin_dashboard_notifications;
DROP TABLE IF EXISTS email_queue;
