/**
 * FID-20260919-016 — LIVE verification driver for the alert-table consolidation.
 * Runs against the real dev DB (DATABASE_URL from .env.local). The seams are
 * service-level (both writers are module-private; the probe calls the same
 * reachable entry point the admin route does) and query-level for the reader.
 *
 * Probes:
 *   P1  the retired twin (wmd_admin_alerts) no longer exists
 *   P2  wmd_alerts holds the migrated rows, all in the AlertStatus vocabulary
 *   P3  reader semantics: "unacknowledged" = ACTIVE (a RESOLVED row drops out)
 *   P4  writer: flagSuspiciousActivity lands an ACTIVE row with its data payload
 *   P5  idempotence: re-running the migration DDL is a no-op (no throw, no dupes)
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { flagSuspiciousActivity } from '../lib/wmd/admin/wmdAdminService';

type Row = Record<string, unknown>;
const rows = async (q: ReturnType<typeof sql>): Promise<Row[]> =>
  ((await db.execute(q)) as unknown as { rows: Row[] }).rows;

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, detail ?? ''); }
}

const MIGRATION = '0037_consolidate_alert_tables.sql';

async function main(): Promise<void> {
  console.log('FID-20260919-016 alert-consolidation live probe\n');

  // P1 — the twin is gone.
  const twin = await rows(sql`SELECT count(*)::int AS n FROM information_schema.tables
    WHERE table_schema='public' AND table_name='wmd_admin_alerts'`);
  check('P1 wmd_admin_alerts retired (table absent)', Number(twin[0]?.n ?? 0) === 0, twin);

  // P2 — migrated rows present and in-vocabulary.
  const total = await rows(sql`SELECT count(*)::int AS n FROM wmd_alerts`);
  const badStatus = await rows(sql`SELECT count(*)::int AS n FROM wmd_alerts
    WHERE status NOT IN ('ACTIVE','ACKNOWLEDGED','RESOLVED','ARCHIVED')`);
  check('P2a wmd_alerts holds the migrated rows', Number(total[0]?.n ?? 0) >= 8, total);
  check('P2b every status is in the AlertStatus vocabulary', Number(badStatus[0]?.n ?? 0) === 0, badStatus);

  // P3 — reader semantics: unacknowledged == ACTIVE.
  const activeBefore = Number((await rows(sql`SELECT count(*)::int AS n FROM wmd_alerts WHERE status='ACTIVE'`))[0]?.n ?? 0);
  const probeId = `probe-resolved-${Date.now()}`;
  await db.execute(sql`INSERT INTO wmd_alerts (id, type, severity, status, title, message, channels, delivery_status, created_at)
    VALUES (${probeId}, 'SYSTEM_ERROR', 'INFO', 'RESOLVED', 'probe', 'reader-semantics probe', '[]'::jsonb, '{}'::jsonb, now())`);
  const activeAfterResolved = Number((await rows(sql`SELECT count(*)::int AS n FROM wmd_alerts WHERE status='ACTIVE'`))[0]?.n ?? 0);
  const resolvedCounted = Number((await rows(sql`SELECT count(*)::int AS n FROM wmd_alerts WHERE id=${probeId} AND status='ACTIVE'`))[0]?.n ?? 0);
  check('P3a a RESOLVED row does not count as unacknowledged', resolvedCounted === 0 && activeAfterResolved === activeBefore, { activeBefore, activeAfterResolved });
  await db.execute(sql`DELETE FROM wmd_alerts WHERE id=${probeId}`);

  // P4 — writer lands an ACTIVE row with its payload.
  const marker = `probe-${Date.now()}`;
  const res = await flagSuspiciousActivity({
    playerId: marker,
    clanId: 'NONE',
    activityType: 'EXCESSIVE_LAUNCHES',
    details: 'consolidation probe',
    evidence: { probe: true },
    severity: 'MEDIUM',
  });
  check('P4a flagSuspiciousActivity reports success', res.success === true, res);
  const written = await rows(sql`SELECT id, status, data FROM wmd_alerts WHERE id=${res.alertId}`);
  check('P4b the alert landed in wmd_alerts as ACTIVE', written.length === 1 && written[0]?.status === 'ACTIVE', written);
  check('P4c the payload is in `data` (not `details`)', Boolean((written[0]?.data as Row)?.playerId === marker), written[0]?.data);

  // P5 — re-running the migration DDL is a no-op.
  const before = Number((await rows(sql`SELECT count(*)::int AS n FROM wmd_alerts`))[0]?.n ?? 0);
  const ddl = readFileSync(join(process.cwd(), 'lib/db/migrations', MIGRATION), 'utf8');
  let threw = false;
  try { await db.execute(sql.raw(ddl)); } catch (e) { threw = true; console.error(e); }
  const after = Number((await rows(sql`SELECT count(*)::int AS n FROM wmd_alerts`))[0]?.n ?? 0);
  check('P5 re-applying the migration is safe and idempotent', !threw && after === before, { before, after, threw });

  // Cleanup the P4 row so the probe is repeatable.
  await db.execute(sql`DELETE FROM wmd_alerts WHERE id=${res.alertId}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('probe crashed:', err); process.exit(1); });
