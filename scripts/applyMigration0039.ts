/**
 * FID-20260919-018 — apply migration 0039 (clan WMD cooldown + retaliation
 * timestamps → timestamptz). Idempotent: ALTER COLUMN TYPE on an already
 * timestamptz column is a no-op. One-shot; exits explicitly.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

const COLUMNS: Array<[string, string]> = [
  ['clans', 'wmd_cooldown_until'],
  ['clans', 'last_wmd_launch'],
  ['wmd_retaliation_rights', 'expires_at'],
  ['wmd_retaliation_rights', 'granted_at'],
];

async function typeOf(table: string, column: string): Promise<string | null> {
  const res = (await db.execute(
    sql`SELECT data_type FROM information_schema.columns
        WHERE table_name = ${table} AND column_name = ${column}`
  )) as unknown as { rows: Array<{ data_type: string }> };
  return res.rows[0]?.data_type ?? null;
}

async function main(): Promise<void> {
  console.log('before:', await Promise.all(COLUMNS.map(([t, c]) => typeOf(t, c).then((d) => `${t}.${c}=${d}`))));

  const ddl = readFileSync(
    join(process.cwd(), 'lib/db/migrations/0039_clan_wmd_timestamptz.sql'),
    'utf8'
  );
  await db.execute(sql.raw(ddl));
  console.log('migration 0039 applied');

  const after = await Promise.all(COLUMNS.map(([t, c]) => typeOf(t, c)));
  console.log('after :', after.map((d, i) => `${COLUMNS[i][0]}.${COLUMNS[i][1]}=${d}`));

  const ok = after.every((d) => d === 'timestamp with time zone');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
