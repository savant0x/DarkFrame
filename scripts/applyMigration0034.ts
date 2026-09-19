/**
 * FID-20260917-017 slice 3 - apply migration 0034
 * (typing_indicators unique (channel_id, user_id) index). One-shot; exits
 * explicitly. The shim wrote typing rows via select-then-insert against a
 * non-unique index; the direct-drizzle upsert needs the pair unique (and
 * historical duplicates removed, which the migration's DO block handles).
 * Idempotent SQL (guarded by pg_indexes check) so re-runs are safe.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

async function uniquePairIndexExists(): Promise<boolean> {
  const res = (await db.execute(
    sql`SELECT 1 FROM pg_indexes WHERE indexname = 'typing_indicators_channel_user_unique'`
  )) as unknown as { rows: unknown[] };
  return res.rows.length > 0;
}

async function duplicatePairCount(): Promise<number> {
  const res = (await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM (
          SELECT channel_id, user_id FROM typing_indicators GROUP BY channel_id, user_id HAVING COUNT(*) > 1
        ) d`
  )) as unknown as { rows: Array<{ n: number }> };
  return res.rows[0]?.n ?? 0;
}

async function main(): Promise<void> {
  console.log('before:', {
    uniquePairIndex: await uniquePairIndexExists(),
    duplicatePairs: await duplicatePairCount(),
  });

  const ddl = readFileSync(
    join(process.cwd(), 'lib/db/migrations/0034_typing_unique_pair.sql'),
    'utf8'
  );
  await db.execute(sql.raw(ddl));
  console.log('migration 0034 applied');

  const after = {
    uniquePairIndex: await uniquePairIndexExists(),
    duplicatePairs: await duplicatePairCount(),
  };
  console.log('after :', after);

  process.exit(after.uniquePairIndex && after.duplicatePairs === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
