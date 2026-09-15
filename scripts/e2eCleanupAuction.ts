/**
 * E2E cleanup for the FID-20260914-003 live auction verification.
 * Deletes ONLY rows created by this verification: usernames LIKE 'e2e%'
 * (both minted batches), their notifications, and the auction/trade rows.
 * Guarded: aborts if the LIKE pattern matches an implausible row count.
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/mongodb';

async function main(): Promise<void> {
  const db = await connectToDatabase();

  const probe = await db.execute(
    sql`SELECT count(*)::int AS n FROM players WHERE username LIKE 'e2e%'`
  );
  const n = Number((probe.rows as Array<{ n: number }>)[0]?.n ?? 0);
  if (n === 0 || n > 50) {
    console.log(`cleanup ABORT: players LIKE 'e2e%' = ${n} (expected 1-50)`);
    process.exit(1);
  }
  console.log(`cleanup: matched ${n} e2e accounts`);

  const notif = await db.execute(
    sql`DELETE FROM player_notifications WHERE player_id LIKE 'e2e%'`
  );
  console.log(`cleanup: notifications deleted = ${notif.rowCount ?? 'n/a'}`);

  const trades = await db.execute(
    sql`DELETE FROM trade_history WHERE seller_username LIKE 'e2e%' OR buyer_username LIKE 'e2e%'`
  );
  console.log(`cleanup: trade_history deleted = ${trades.rowCount ?? 'n/a'}`);

  const auctions = await db.execute(
    sql`DELETE FROM auctions WHERE seller_username LIKE 'e2e%' OR highest_bidder LIKE 'e2e%' OR winner_username LIKE 'e2e%'`
  );
  console.log(`cleanup: auctions deleted = ${auctions.rowCount ?? 'n/a'}`);

  const players = await db.execute(
    sql`DELETE FROM players WHERE username LIKE 'e2e%'`
  );
  console.log(`cleanup: players deleted = ${players.rowCount ?? 'n/a'}`);

  const residual = await db.execute(
    sql`SELECT (SELECT count(*)::int FROM players WHERE username LIKE 'e2e%') AS p,
               (SELECT count(*)::int FROM auctions WHERE seller_username LIKE 'e2e%') AS a,
               (SELECT count(*)::int FROM trade_history WHERE seller_username LIKE 'e2e%') AS t`
  );
  console.log(`cleanup residual check → ${JSON.stringify((residual.rows as Array<unknown>)[0])}`);
  process.exit(0);
}

void main().catch((err) => {
  console.log('cleanup crashed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
