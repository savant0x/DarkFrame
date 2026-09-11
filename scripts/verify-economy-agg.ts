/**
 * FID-20260909-031 §4.5 live smoke — read-only probe running the economy
 * route's exact SQL fragments against the real database to validate the
 * jsonb paths, day bucketing, and aggregate expressions the mocked-seam
 * unit tests cannot cover.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-economy-agg.ts
 */
import { Client } from 'pg';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // 1 — trade ledger (route query 0)
  const ledger = await c.query(
    `SELECT final_price, sale_fee, seller_received, seller_username, buyer_username, completed_at
     FROM trade_history ORDER BY completed_at DESC`
  );
  console.log(`trade ledger rows=${ledger.rows.length}`);

  // 2-4 — window aggregates
  const allTime = await c.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(final_price),0) AS volume FROM trade_history`
  );
  console.log(`all-time: ${JSON.stringify(allTime.rows[0])}`);

  const active = await c.query(
    `SELECT COUNT(*) AS active_count, AVG(current_bid) AS avg_bid, AVG(buyout_price) AS avg_buyout
     FROM auctions WHERE status = 'active'`
  );
  console.log(`active book: ${JSON.stringify(active.rows[0])}`);

  const sold = await c.query(
    `SELECT COUNT(*) AS sold_count, AVG(final_price) AS avg_sold,
            AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600) AS avg_hours
     FROM auctions WHERE status = 'sold' AND closed_at IS NOT NULL`
  );
  console.log(`sold book: ${JSON.stringify(sold.rows[0])}`);

  // 6 — flow: jsonb extraction + day bucketing (the route's exact expressions)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const flow = await c.query(
    `SELECT to_char(date_trunc('day', timestamp), 'YYYY-MM-DD') AS bucket,
            COALESCE(SUM(CASE WHEN action = 'harvest' THEN COALESCE((metadata->'resourcesGained'->>'metal')::numeric, 0) ELSE 0 END), 0) AS metal,
            COALESCE(SUM(CASE WHEN action = 'harvest' THEN COALESCE((metadata->'resourcesGained'->>'energy')::numeric, 0) ELSE 0 END), 0) AS energy,
            COUNT(CASE WHEN action = 'cave_explore' THEN 1 END) AS caves
     FROM player_activity
     WHERE timestamp >= $1 AND action IN ('harvest', 'cave_explore')
     GROUP BY date_trunc('day', timestamp)
     ORDER BY date_trunc('day', timestamp)`,
    [sevenDaysAgo]
  );
  console.log(`flow days=${flow.rows.length}: ${JSON.stringify(flow.rows.slice(0, 3))}`);

  // 7 — supply
  const supply = await c.query(
    `SELECT COALESCE(SUM(resources_metal),0) AS wallet_metal,
            COALESCE(SUM(resources_energy),0) AS wallet_energy,
            COALESCE(SUM(bank_metal),0) AS banked_metal,
            COALESCE(SUM(bank_energy),0) AS banked_energy
     FROM players`
  );
  console.log(`supply: ${JSON.stringify(supply.rows[0])}`);

  // 8 — top sellers
  const top = await c.query(
    `SELECT seller_username AS username, COUNT(*) AS trades,
            COALESCE(SUM(final_price),0) AS volume, COALESCE(SUM(seller_received),0) AS received
     FROM trade_history GROUP BY seller_username
     ORDER BY COALESCE(SUM(final_price),0) DESC LIMIT 5`
  );
  console.log(`top sellers: ${JSON.stringify(top.rows)}`);

  await c.end();
  console.log('ECONOMY-AGG-VERIFY-OK');
})().catch((e: Error) => {
  console.error('VERIFY FAILED:', e.message);
  process.exit(1);
});
