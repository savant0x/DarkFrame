/**
 * FID-20260916-009 D2 — apply migration 0032 (protection_until → timestamptz).
 * One-shot; exits explicitly (ESM + open pg pool keeps the process alive).
 * The USING clause reinterprets the naive UTC literals as UTC instants, so
 * no stored value shifts — only the column's type semantics change.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

async function main(): Promise<void> {
  const before = (await db.execute(
    sql`SELECT data_type FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'protection_until'`
  )) as unknown as { rows: Array<{ data_type: string }> };
  console.log('before:', before.rows[0]?.data_type);

  const ddl = readFileSync(
    join(process.cwd(), 'lib/db/migrations/0032_protection_until_timestamptz.sql'),
    'utf8'
  )
    .split('--> statement-breakpoint')
    .join(';');
  await db.execute(sql.raw(ddl));
  console.log('migration 0032 applied');

  const after = (await db.execute(
    sql`SELECT data_type FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'protection_until'`
  )) as unknown as { rows: Array<{ data_type: string }> };
  console.log('after :', after.rows[0]?.data_type);

  process.exit(after.rows[0]?.data_type === 'timestamp with time zone' ? 0 : 1);
}

main().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
