/**
 * @file __tests__/lib/wmdAlertConsolidation.test.ts
 * @created 2026-09-19 (FID-20260919-016)
 * @overview Pins for the WMD alert-table consolidation. Hermetic — reads the
 *            migration file and inspects the schema modules; no DB.
 *            The regression class: a retired near-twin table left behind, or a
 *            migration that drops before it moves (losing the 8 live rows).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { getTableColumns, getTableName } from 'drizzle-orm';

import { wmdAlerts } from '@/lib/db/schema/wmd';
import * as schema from '@/lib/db/schema';

const MIGRATION = '0037_consolidate_alert_tables.sql';

function readMigration(): string {
  return readFileSync(join(process.cwd(), 'lib', 'db', 'migrations', MIGRATION), 'utf8');
}

describe('migration 0037 — moves the rows before it drops the twin', () => {
  const sql = readMigration();

  it('exists as a tracked migration file', () => {
    // (Not "is newest" — later FIDs legitimately add newer migrations.)
    const dir = join(process.cwd(), 'lib', 'db', 'migrations');
    const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f));
    expect(files).toContain(MIGRATION);
  });

  it('inserts into wmd_alerts and selects from wmd_admin_alerts', () => {
    expect(sql).toMatch(/INSERT INTO wmd_alerts/i);
    expect(sql).toMatch(/FROM wmd_admin_alerts/i);
  });

  it('maps the retired vocabulary: OPEN status → ACTIVE, details → data', () => {
    expect(sql).toMatch(/CASE WHEN status = 'OPEN' THEN 'ACTIVE'/);
    expect(sql).toMatch(/data, channels, delivery_status/); // payload column list
    expect(sql).toMatch(/details,/); // the source column being moved
  });

  it('is idempotent: guarded source presence, ON CONFLICT guard, IF EXISTS drop', () => {
    expect(sql).toMatch(/information_schema\.tables/);
    expect(sql).toMatch(/ON CONFLICT \(id\) DO NOTHING/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS wmd_admin_alerts/i);
  });

  it('drops the twin only AFTER the move block (order matters for the 8 rows)', () => {
    expect(sql.indexOf('INSERT INTO wmd_alerts')).toBeLessThan(
      sql.indexOf('DROP TABLE IF EXISTS wmd_admin_alerts'),
    );
  });
});

describe('schema — one alert table after consolidation', () => {
  it('wmdAlerts is the canonical wmd_alerts table', () => {
    expect(getTableName(wmdAlerts)).toBe('wmd_alerts');
  });

  it('wmdAdminAlerts is no longer exported from the schema barrel', () => {
    expect('wmdAdminAlerts' in schema).toBe(false);
  });

  it('wmd_alerts carries every column the retired twin used', () => {
    const cols = Object.keys(getTableColumns(wmdAlerts));
    for (const c of ['id', 'type', 'severity', 'status', 'title', 'message', 'createdAt', 'resolvedAt']) {
      expect(cols).toContain(c);
    }
    // ...and the richer incident columns the twin never had.
    for (const c of ['data', 'missileId', 'voteId', 'operationId', 'acknowledgedAt']) {
      expect(cols).toContain(c);
    }
  });
});
