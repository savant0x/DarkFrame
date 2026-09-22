-- 0037_consolidate_alert_tables.sql (FID-20260919-016)
--
-- wmd_alerts and wmd_admin_alerts were near-twin alert logs for the same event
-- class. wmd_admin_alerts was the live one (2 writers, 2 readers); wmd_alerts
-- was the richer ORIGINAL design (incident references, channel/delivery model,
-- acknowledge/resolve lifecycle) that was never written to once. FID-20260919-011
-- kept it on the false claim that the admin health endpoint read it — that
-- endpoint reads wmd_admin_alerts. Consolidation: move the rows, drop the twin.
--
-- Column mapping: wmd_admin_alerts.details -> wmd_alerts.data; status 'OPEN' ->
-- 'ACTIVE' (AlertStatus vocabulary); channels/delivery_status defaulted.
-- Idempotent: the source presence is guarded, the target insert is
-- ON CONFLICT DO NOTHING, and the drop is IF EXISTS — safe on re-runs and on
-- fresh environments (where wmd_admin_alerts may already be absent).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wmd_admin_alerts'
  ) THEN
    INSERT INTO wmd_alerts (
      id, type, severity, status, title, message,
      data, channels, delivery_status, created_at, resolved_at
    )
    SELECT
      id,
      type,
      severity,
      CASE WHEN status = 'OPEN' THEN 'ACTIVE' ELSE status END,
      title,
      message,
      details,
      '[]'::jsonb,
      '{}'::jsonb,
      created_at,
      resolved_at
    FROM wmd_admin_alerts
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS wmd_admin_alerts;
