/**
 * FID-20260919-016 — apply migration 0037 (consolidate the WMD alert tables).
 * Moves wmd_admin_alerts rows into wmd_alerts (details -> data, OPEN -> ACTIVE)
 * then drops the twin. Idempotent SQL (guarded source, ON CONFLICT, IF EXISTS),
 * so re-runs are safe. One-shot; exits explicitly.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

async function tableExists(name: string): Promise<boolean> {
  const res = (await db.execute(
    sql`SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${name}`
  )) as unknown as { rows: Array<{ n: number }> };
  return Number(res.rows[0]?.n ?? 0) > 0;
}

async function rowCount(table: string): Promise<number> {
  const res = (await db.execute(
    sql.raw(`SELECT count(*)::int AS n FROM ${table}`)
  )) as unknown as { rows: Array<{ n: number }> };
  return Number(res.rows[0]?.n ?? 0);
}

async function main(): Promise<void> {
  const before = {
    twinExists: await tableExists('wmd_admin_alerts'),
    twinRows: (await tableExists('wmd_admin_alerts')) ? await rowCount('wmd_admin_alerts') : 0,
    targetRows: await rowCount('wmd_alerts'),
  };
  console.log('before:', before);

  const ddl = readFileSync(
    join(process.cwd(), 'lib/db/migrations/0037_consolidate_alert_tables.sql'),
    'utf8'
  );
  await db.execute(sql.raw(ddl));
  console.log('migration 0037 applied');

  const after = {
    twinExists: await tableExists('wmd_admin_alerts'),
    targetRows: await rowCount('wmd_alerts'),
  };
  console.log('after :', after);

  const ok = !after.twinExists && after.targetRows >= before.targetRows + before.twinRows;
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
