/**
 * One-off: measure per-column byte cost of fame's players row (egress math).
 * Run: npx tsx --env-file=.env.local scripts/measure-row-bytes.ts
 */
import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const COLS = [
  'inventory_items', 'units', 'rp_history', 'discoveries', 'achievements',
  'stats', 'battle_stats', 'daily_bounties', 'concentration_zones',
  'fast_travel_waypoints', 'referral_titles', 'referral_badges',
  'unlocked_techs', 'balance_effects', 'shrine_boosts', 'referral_rewards_metal',
  'referral_rewards_energy', 'referral_rewards_rp', 'referral_rewards_xp',
];

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const selects = COLS.map((col) => `pg_column_size(${col}) AS "${col}"`).join(', ');
  const r = await c.query(
    `SELECT username, ${selects} FROM players WHERE username = 'fame'`,
  );
  const row = r.rows[0];

  const entries = Object.entries(row as Record<string, number>)
    .filter(([k]) => k !== 'username')
    .sort((a, b) => (b[1] as number) - (a[1] as number));

  let total = 0;
  entries.forEach(([k, v]) => {
    total += v as number;
    if ((v as number) > 512) console.log(`${((v as number) / 1024).toFixed(1)} KB | ${k}`);
  });
  console.log(`--- tracked columns total: ${(total / 1024).toFixed(1)} KB`);

  const full = await c.query(
    `SELECT pg_column_size(p.*) AS full_row FROM players p WHERE username = 'fame'`,
  );
  console.log(`FULL ROW: ${((full.rows[0] as { full_row: number }).full_row / 1024).toFixed(1)} KB`);

  await c.end();
}

main();
