/**
 * @file __tests__/lib/wmdAlertConfig.test.ts
 * @created 2026-09-19 (FID-20260919-015 W3)
 * @overview Pins for the persisted WMD alert configuration (wmd_config) and
 *            the severity gate: table-first read with honest fallback, upsert
 *            shape, dual-vocabulary severity ranking, and the suppressed
 *            path through createAdminAlert (no INSERT, acknowledged result).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';

const { capture } = vi.hoisted(() => ({
  capture: {
    configRows: [] as unknown[],
    inserts: [] as Array<{ table: unknown; values: unknown; conflict: unknown }>,
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: (_table: unknown) => ({
        where: () => ({
          limit: async () => capture.configRows,
        }),
        // suspicious-activity reader shape not used here
        orderBy: () => ({
          limit: async () => [],
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        const chain = {
          onConflictDoUpdate: (conflict: unknown) => {
            chain.conflict = conflict;
            return Promise.resolve();
          },
          conflict: undefined as unknown,
          returning: async () => [],
        };
        capture.inserts.push({ table, values, conflict: chain });
        return chain;
      },
    }),
  },
}));

import { getAlertConfig, setAlertConfig, shouldRecordAlert, DEFAULT_ALERT_CONFIG } from '@/lib/wmd/admin/alertConfigService';
import { flagSuspiciousActivity } from '@/lib/wmd/admin/wmdAdminService';
import { wmdConfig, wmdAlerts } from '@/lib/db/schema/wmd';
import { AlertSeverity } from '@/lib/wmd/admin/alert.types';

describe('getAlertConfig — table-first, fallback-honest', () => {
  beforeEach(() => {
    capture.configRows = [];
    capture.inserts = [];
  });

  it('falls back to the default config when no row exists', async () => {
    const config = await getAlertConfig();
    expect(config).toEqual(DEFAULT_ALERT_CONFIG);
    expect(config.enabled).toBe(true);
  });

  it('reads the persisted payload ({ settings }) over the default', async () => {
    capture.configRows = [
      { value: { settings: { enabled: false, minSeverity: 'CRITICAL', channels: [], autoAcknowledge: true, autoArchiveDays: 7 } } },
    ];
    const config = await getAlertConfig();
    expect(config.enabled).toBe(false);
    expect(config.minSeverity).toBe('CRITICAL');
    expect(config.autoArchiveDays).toBe(7);
  });

  it('tolerates a bare AlertConfig payload (historical hand-writes)', async () => {
    capture.configRows = [{ value: { enabled: true, minSeverity: 'WARNING' } }];
    const config = await getAlertConfig();
    expect(config.minSeverity).toBe('WARNING');
    expect(config.autoArchiveDays).toBe(30); // default fills the gap
  });
});

describe('setAlertConfig — upsert on the unique key', () => {
  beforeEach(() => {
    capture.configRows = [];
    capture.inserts = [];
  });

  it('upserts the settings payload keyed on wmd_config.key', async () => {
    const saved = await setAlertConfig({ ...DEFAULT_ALERT_CONFIG, minSeverity: AlertSeverity.WARNING });
    expect(saved.minSeverity).toBe('WARNING');
    expect(capture.inserts).toHaveLength(1);
    const { table, values, conflict } = capture.inserts[0];
    expect(getTableName(table as never)).toBe(getTableName(wmdConfig));
    expect((values as { key: string }).key).toBe('alerts');
    expect((values as { value: { settings: { minSeverity: string } } }).value.settings.minSeverity).toBe('WARNING');
    expect((conflict as unknown as { conflict?: unknown }).conflict).toBeDefined();
  });
});

describe('shouldRecordAlert — the severity gate (both vocabularies)', () => {
  beforeEach(() => {
    capture.configRows = [];
    capture.inserts = [];
  });

  it('records everything at the default (enabled, min INFO)', async () => {
    expect(await shouldRecordAlert('INFO')).toBe(true);
    expect(await shouldRecordAlert('LOW')).toBe(true);
    expect(await shouldRecordAlert('HIGH')).toBe(true);
  });

  it('suppresses everything when disabled', async () => {
    capture.configRows = [{ value: { settings: { ...DEFAULT_ALERT_CONFIG, enabled: false } } }];
    expect(await shouldRecordAlert('CRITICAL')).toBe(false);
    expect(await shouldRecordAlert('HIGH')).toBe(false);
  });

  it('floors at minSeverity (WARNING): WARNING/HIGH pass, INFO/LOW drop', async () => {
    capture.configRows = [{ value: { settings: { ...DEFAULT_ALERT_CONFIG, minSeverity: 'WARNING' } } }];
    expect(await shouldRecordAlert('WARNING')).toBe(true);
    expect(await shouldRecordAlert('MEDIUM')).toBe(true);
    expect(await shouldRecordAlert('INFO')).toBe(false);
    expect(await shouldRecordAlert('LOW')).toBe(false);
  });

  it('CRITICAL floor: everything below top rank drops; HIGH ≡ CRITICAL (top of its vocabulary)', async () => {
    capture.configRows = [{ value: { settings: { ...DEFAULT_ALERT_CONFIG, minSeverity: 'CRITICAL' } } }];
    expect(await shouldRecordAlert('WARNING')).toBe(false);
    expect(await shouldRecordAlert('MEDIUM')).toBe(false);
    expect(await shouldRecordAlert('CRITICAL')).toBe(true);
    expect(await shouldRecordAlert('HIGH')).toBe(true); // HIGH ranks with CRITICAL by design
  });
});

describe('flagSuspiciousActivity — the gated alert path (suppression class)', () => {
  beforeEach(() => {
    capture.configRows = [];
    capture.inserts = [];
  });

  it('disabled config: the suspicious-activity row persists but NO admin alert is inserted', async () => {
    capture.configRows = [{ value: { settings: { ...DEFAULT_ALERT_CONFIG, enabled: false } } }];
    const result = await flagSuspiciousActivity({
      playerId: 'tester',
      clanId: 'NONE',
      activityType: 'EXCESSIVE_LAUNCHES',
      details: '10 launches in 24h',
      evidence: {},
      severity: 'MEDIUM',
    });
    expect(result.success).toBe(true);
    expect(capture.inserts).toHaveLength(1); // wmd_suspicious_activity only
    expect(getTableName(capture.inserts[0].table as never)).not.toBe(getTableName(wmdAlerts));
  });

  it('passing gate: both the suspicious-activity row and the admin alert insert', async () => {
    const result = await flagSuspiciousActivity({
      playerId: 'tester',
      clanId: 'NONE',
      activityType: 'EXCESSIVE_LAUNCHES',
      details: '10 launches in 24h',
      evidence: {},
      severity: 'MEDIUM',
    });
    expect(result.success).toBe(true);
    expect(capture.inserts).toHaveLength(2);
    expect(getTableName(capture.inserts[1].table as never)).toBe(getTableName(wmdAlerts));
    // FID-20260919-016: the consolidated table uses the AlertStatus vocabulary
    // and stores the payload in `data` (the retired twin used `details`).
    const alertValues = capture.inserts[1].values as { status: string; data: Record<string, unknown> };
    expect(alertValues.status).toBe('ACTIVE');
    expect(alertValues.data).toMatchObject({ playerId: 'tester', activityType: 'EXCESSIVE_LAUNCHES' });
    expect('details' in alertValues).toBe(false);
  });
});
