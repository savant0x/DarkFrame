/**
 * FID-20260917-012 backfill (session 057) - apply migration 0033
 * (chat_reports + blocked_users). One-shot; exits explicitly.
 * The FID shipped the drizzle schema but no migration; the live probe
 * caught `relation "blocked_users" does not exist` - every report/block
 * call 500s until this lands. Idempotent SQL (IF NOT EXISTS) so re-runs
 * are safe.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

async function tableExists(name: string): Promise<boolean> {
  const res = (await db.execute(
    sql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${name}`
  )) as unknown as { rows: unknown[] };
  return res.rows.length > 0;
}

async function main(): Promise<void> {
  console.log('before:', { chat_reports: await tableExists('chat_reports'), blocked_users: await tableExists('blocked_users') });

  const ddl = readFileSync(
    join(process.cwd(), 'lib/db/migrations/0033_chat_honesty_tables.sql'),
    'utf8'
  )
    .split('--> statement-breakpoint')
    .join(';');
  await db.execute(sql.raw(ddl));
  console.log('migration 0033 applied');

  const after = { chat_reports: await tableExists('chat_reports'), blocked_users: await tableExists('blocked_users') };
  console.log('after :', after);

  // Column-shape spot check against the drizzle definitions
  const cols = (await db.execute(
    sql`SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('chat_reports','blocked_users') ORDER BY table_name, ordinal_position`
  )) as unknown as { rows: Array<{ table_name: string; column_name: string }> };
  console.log('columns:', cols.rows.map((r) => `${r.table_name}.${r.column_name}`).join(', '));

  process.exit(after.chat_reports && after.blocked_users ? 0 : 1);
}

main().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
