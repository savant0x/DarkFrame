/**
 * FID-20260919-015 W3: WMD alert configuration, persisted in wmd_config.
 *
 * getAlertConfig is table-first: the row at key='alerts' is truth; when absent
 * the hardcoded default applies (fallback-honest — the gate's behavior before
 * this table existed). setAlertConfig upserts the single row.
 *
 * Severity gate: enabled=false or severity below minSeverity suppresses the
 * admin-alert INSERT. Ranking handles both vocabularies that flow through
 * createAdminAlert/recordAdminAlert: AlertSeverity (INFO/WARNING/CRITICAL)
 * and the suspicious-activity vocabulary (LOW/MEDIUM/HIGH).
 */
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { wmdConfig } from '@/lib/db/schema';
import type { AlertConfig } from '@/lib/wmd/admin/alert.types';
import { AlertSeverity } from '@/lib/wmd/admin/alert.types';

export const ALERT_CONFIG_KEY = 'alerts';

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  minSeverity: AlertSeverity.INFO,
  channels: [],
  autoAcknowledge: false,
  autoArchiveDays: 30,
};

const SEVERITY_RANK: Record<string, number> = {
  INFO: 0,
  LOW: 0,
  WARNING: 1,
  MEDIUM: 1,
  CRITICAL: 2,
  HIGH: 2,
};

/** Read the persisted config; falls back to defaults when no row exists. */
export async function getAlertConfig(): Promise<AlertConfig> {
  const rows = await db
    .select()
    .from(wmdConfig)
    .where(eq(wmdConfig.key, ALERT_CONFIG_KEY))
    .limit(1);
  const row = rows[0];
  if (!row) return DEFAULT_ALERT_CONFIG;
  // The row value is the WmdAlertSettingsPayload ({ settings }) the schema
  // declares; tolerate a bare AlertConfig too (defensive — both were written
  // historically by hand against this key).
  const raw = row.value as unknown;
  const settings = (raw as { settings?: AlertConfig })?.settings ?? (raw as AlertConfig);
  if (!settings || typeof settings !== 'object') return DEFAULT_ALERT_CONFIG;
  return {
    ...DEFAULT_ALERT_CONFIG,
    ...settings,
  };
}

/** Persist the alert config (upsert on the unique key). */
export async function setAlertConfig(settings: AlertConfig): Promise<AlertConfig> {
  const merged: AlertConfig = { ...DEFAULT_ALERT_CONFIG, ...settings };
  const payload = { settings: merged };
  await db
    .insert(wmdConfig)
    .values({
      id: `wmdcfg-${Date.now().toString(36)}`,
      key: ALERT_CONFIG_KEY,
      value: payload,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: wmdConfig.key,
      set: { value: payload, updatedAt: new Date() },
    });
  return merged;
}

/**
 * Gate decision for an admin alert: true = record it.
 * `severity` accepts either severity vocabulary (see SEVERITY_RANK).
 */
export async function shouldRecordAlert(severity: string): Promise<boolean> {
  const config = await getAlertConfig();
  if (!config.enabled) return false;
  const floor = SEVERITY_RANK[config.minSeverity] ?? 0;
  const level = SEVERITY_RANK[severity] ?? 0;
  return level >= floor;
}
