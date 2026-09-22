/**
 * FID-20260919-017 — apply migration 0038 (drop the five consumerless tables).
 * Idempotent (IF EXISTS); one-shot; exits explicitly.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

const TABLES = [
  'achievements',
  'wmd_votes',
  'wmd_consequence_events',
  'wmd_resource_pools',
  'wmd_defense_grids',
];

async function exists(name: string): Promise<boolean> {
  const res = (await db.execute(
    sql`SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${name}`
  )) as unknown as { rows: Array<{ n: number }> };
  return Number(res.rows[0]?.n ?? 0) > 0;
}

async function main(): Promise<void> {
  const before = Object.fromEntries(
    await Promise.all(TABLES.map(async (t) => [t, await exists(t)]))
  );
  console.log('before:', before);

  const ddl = readFileSync(
    join(process.cwd(), 'lib/db/migrations/0038_law17_ticket_removals.sql'),
    'utf8'
  );
  await db.execute(sql.raw(ddl));
  console.log('migration 0038 applied');

  const after = Object.fromEntries(
    await Promise.all(TABLES.map(async (t) => [t, await exists(t)]))
  );
  console.log('after :', after);

  const ok = TABLES.every((t) => after[t] === false);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
