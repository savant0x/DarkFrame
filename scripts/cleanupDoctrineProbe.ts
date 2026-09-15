/**
 * Guarded cleanup for the FID-20260914-008 Phase 1-2 probe fixtures.
 * Deletes ONLY rows created by this verification: usernames LIKE 'spe%'
 * and the one factory tile they claimed. Aborts if the LIKE pattern
 * matches an implausible row count.
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/mongodb';

async function main(): Promise<void> {
  const db = await connectToDatabase();

  const probe = await db.execute(
    sql`SELECT count(*)::int AS n FROM players WHERE username LIKE 'spe%'`
  );
  const n = Number((probe.rows as Array<{ n: number }>)[0]?.n ?? 0);
  if (n === 0 || n > 20) {
    console.log(`cleanup ABORT: players LIKE 'spe%' = ${n} (expected 1-20)`);
    process.exit(1);
  }
  console.log(`cleanup: matched ${n} spe accounts`);

  const factory = await db.execute(
    sql`UPDATE factories SET owner = NULL, slots = 0, used_slots = 0, level = 1
        WHERE owner LIKE 'spe%' RETURNING x, y`
  );
  console.log(`cleanup: factory tiles released = ${factory.rowCount ?? 'n/a'}`);

  const players = await db.execute(
    sql`DELETE FROM players WHERE username LIKE 'spe%'`
  );
  console.log(`cleanup: players deleted = ${players.rowCount ?? 'n/a'}`);

  const residual = await db.execute(
    sql`SELECT (SELECT count(*)::int FROM players WHERE username LIKE 'spe%') AS p,
               (SELECT count(*)::int FROM factories WHERE owner LIKE 'spe%') AS f`
  );
  const r = (residual.rows as Array<{ p: number; f: number }>)[0];
  if (Number(r.p) !== 0 || Number(r.f) !== 0) {
    console.log(`cleanup FAIL: residual players=${r.p} factories=${r.f}`);
    process.exit(1);
  }
  console.log(`cleanup: residual verified 0/0`);
  process.exit(0);
}

main().catch((e) => {
  console.log('cleanup FAIL: unhandled error →', e);
  process.exit(1);
});
