/**
 * FID-20260914-004 live-verification cleanup: removes the scratch shim-test
 * players (`e2eShim%`) and their notifications, with guarded counts.
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/mongodb';

async function main(): Promise<void> {
  const db = await connectToDatabase();
  const probe = await db.execute(
    sql`SELECT count(*)::int AS n FROM players WHERE username LIKE 'e2eShim%'`
  );
  const n = Number((probe.rows as Array<{ n: number }>)[0]?.n ?? 0);
  console.log(`cleanup: matched ${n} e2eShim% player(s)`);
  if (n === 0) {
    console.log('cleanup: nothing to remove');
    process.exit(0);
  }
  if (n > 10) {
    console.log('cleanup ABORT: unexpectedly large match set');
    process.exit(1);
  }
  const notif = await db.execute(
    sql`DELETE FROM player_notifications WHERE player_id LIKE 'e2eShim%'`
  );
  console.log(`cleanup: notifications deleted = ${notif.rowCount ?? 0}`);
  const players = await db.execute(sql`DELETE FROM players WHERE username LIKE 'e2eShim%'`);
  console.log(`cleanup: players deleted = ${players.rowCount ?? 0}`);
  const residual = await db.execute(
    sql`SELECT (SELECT count(*)::int FROM players WHERE username LIKE 'e2eShim%') AS p,
               (SELECT count(*)::int FROM player_notifications WHERE player_id LIKE 'e2eShim%') AS nt`
  );
  console.log(`cleanup residual → ${JSON.stringify((residual.rows as Array<unknown>)[0])}`);
  process.exit(0);
}

void main().catch((err) => {
  console.log('cleanup crashed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
