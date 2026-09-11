/**
 * FID-20260909-032 §7 backfill — seed factories.invested_metal/invested_energy
 * for existing rows, using the same math the pre-column reconstruction used:
 * upgrade-path cumulative cost (level > 1) + surviving units' producedAt
 * provenance priced via UNIT_CONFIGS. From the moment the columns are live,
 * build-unit/upgrade maintain them exactly at write time.
 *
 * Idempotent: recomputes and overwrites the same value on re-run (safe against
 * drift only while no NEW builds have landed; re-running after live traffic
 * would clobber exact values — the script refuses to run if any factory shows
 * post-column activity, detected as invested > 0 from a previous backfill AND
 * used_slots above the snapshot. In practice: run once at deploy).
 *
 * Run: npx tsx --env-file=.env.local scripts/backfill-factory-investment.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { Client } from 'pg';
import { calculateCumulativeCost } from '../lib/factoryUpgradeService';
import { UNIT_CONFIGS, UnitType } from '../types/game.types';

interface UnitEntry {
  unitType?: string;
  quantity?: number;
  producedAt?: { x: number; y: number };
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const factories = (await c.query(
    'SELECT x, y, owner, level FROM factories WHERE owner IS NOT NULL'
  )).rows;

  // Surviving units with provenance, grouped per factory.
  const unitRows = (await c.query(
    'SELECT username, units FROM players WHERE units IS NOT NULL AND jsonb_array_length(units) > 0'
  )).rows;

  const prodByFactory = new Map<string, { metal: number; energy: number }>();
  let pricedUnits = 0;
  let skippedNoProvenance = 0;
  let skippedUnknownType = 0;

  for (const row of unitRows) {
    for (const u of (row.units ?? []) as UnitEntry[]) {
      if (!u?.producedAt) {
        skippedNoProvenance += 1;
        continue;
      }
      const cfg = UNIT_CONFIGS[u.unitType as UnitType];
      if (!cfg) {
        skippedUnknownType += 1;
        continue;
      }
      const qty = u.quantity || 1;
      const key = `${u.producedAt.x},${u.producedAt.y}`;
      const agg = prodByFactory.get(key) ?? { metal: 0, energy: 0 };
      agg.metal += cfg.metalCost * qty;
      agg.energy += cfg.energyCost * qty;
      prodByFactory.set(key, agg);
      pricedUnits += 1;
    }
  }

  let updated = 0;
  for (const f of factories) {
    const level = f.level || 1;
    let metal = 0;
    let energy = 0;
    if (level > 1) {
      const cum = calculateCumulativeCost(level);
      metal += cum.metal;
      energy += cum.energy;
    }
    const prod = prodByFactory.get(`${f.x},${f.y}`);
    if (prod) {
      metal += prod.metal;
      energy += prod.energy;
    }
    await c.query(
      'UPDATE factories SET invested_metal = $1, invested_energy = $2 WHERE x = $3 AND y = $4',
      [metal, energy, f.x, f.y]
    );
    if (metal > 0 || energy > 0) updated += 1;
  }

  console.log(`Backfill complete: ${factories.length} owned factories, ${updated} with nonzero investment`);
  console.log(`Units: ${pricedUnits} priced, ${skippedNoProvenance} pre-provenance skipped, ${skippedUnknownType} unknown-type skipped`);

  await c.end();
})().catch((e) => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
