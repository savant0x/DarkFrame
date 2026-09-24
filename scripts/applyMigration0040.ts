/**
 * FID-20260923-001 — apply migration 0040 (naive timestamps -> timestamptz for
 * the 135 columns). The migration is a single guarded DO block: a column that is
 * already `timestamp with time zone` is skipped, so re-running is safe. One-shot;
 * exits explicitly (ESM + an open pg pool keeps the process alive).
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

async function naiveCount(): Promise<number> {
  const res = (await db.execute(
    sql`SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'`
  )) as unknown as { rows: Array<{ n: number }> };
  return res.rows[0]?.n ?? -1;
}

async function main(): Promise<void> {
  const before = await naiveCount();
  console.log(`before: ${before} naive timestamp column(s)`);

  const ddl = readFileSync(
    join(process.cwd(), 'lib/db/migrations/0040_timestamptz_conversion.sql'),
    'utf8'
  );
  await db.execute(sql.raw(ddl));

  const after = await naiveCount();
  console.log(`after : ${after} naive timestamp column(s)`);
  process.exit(after === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('migration 0040 failed:', err);
  process.exit(1);
});
