/**
 * FID-20260909-034 win-path smoke — preparation.
 * 1. Spawns a FRESH Beer Base via the production pipeline (spawnBeerBase) —
 *    doubles as a live FID-034 runtime check: the new base MUST land inside
 *    its drawn tier's band.
 * 2. Creates a throwaway attacker with a T5 army strong enough to win.
 *
 * Run: npx tsx --env-file=.env.local scripts/smoke-prepare-target.ts
 */
import { Client } from 'pg';
import { spawnBeerBase, POWER_BANDS } from '../lib/beerBaseService';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // 1. Fresh base through the real pipeline.
  const baseName = await spawnBeerBase();
  const b = (await c.query(`SELECT username, level, total_strength, total_defense, resources_metal, resources_energy, current_position_x, current_position_y, units FROM players WHERE username = $1`, [baseName])).rows[0];
  if (!b) throw new Error('fresh base row missing');
  const total = Number(b.total_strength) + Number(b.total_defense);
  const band = Object.values(POWER_BANDS).find((bd) => total >= bd.min && total <= bd.max);
  const levelToBand: Record<number, string> = { 1: 'weak', 2: 'mid', 3: 'strong', 4: 'elite', 5: 'ultra' };
  const expectedBand = Object.values(POWER_BANDS).find((bd) => bd.key === (levelToBand[Number(b.level) >= 40 ? 5 : Number(b.level) >= 30 ? 4 : Number(b.level) >= 20 ? 3 : Number(b.level) >= 10 ? 2 : 1] as never));
  console.log(`Fresh base: ${b.username} L${b.level} at (${b.current_position_x},${b.current_position_y})`);
  console.log(`  Army: STR ${Number(b.total_strength).toLocaleString()} / DEF ${Number(b.total_defense).toLocaleString()} = ${total.toLocaleString()}`);
  console.log(`  Band: ${band ? band.key : 'OUT OF ALL BANDS ✗'} (level implies ${expectedBand?.key ?? '?'}) ${band ? (band.key === expectedBand?.key ? '✓ matches level' : '⚠ level/band mismatch') : ''}`);
  console.log(`  Resources: ${b.resources_metal} metal / ${b.resources_energy} energy, ${b.units.length} entries`);
  const dual = b.units.filter((u: { strength: number; defense: number }) => Number(u.strength) > 0 && Number(u.defense) > 0);
  console.log(`  Dual-stat entries: ${dual.length} (must be 0 per FID-034)`);

  // 2. Throwaway attacker with a ~22.5M STR T5 army.
  const army = [
    { id: 'smoke-t5-titan', unitId: 'smoke-t5-titan', unitType: 'T5_Titan', name: 'Titan', category: 'STR', rarity: 'legendary', strength: 5000, defense: 0, quantity: 1500, createdAt: new Date().toISOString() },
    { id: 'smoke-t5-dread', unitId: 'smoke-t5-dread', unitType: 'T5_Dreadnought', name: 'Dreadnought', category: 'STR', rarity: 'legendary', strength: 5500, defense: 0, quantity: 1000, createdAt: new Date().toISOString() },
    { id: 'smoke-t5-warlord', unitId: 'smoke-t5-warlord', unitType: 'T5_Warlord', name: 'Warlord', category: 'STR', rarity: 'legendary', strength: 4500, defense: 0, quantity: 1200, createdAt: new Date().toISOString() },
  ];
  await c.query(
    `INSERT INTO players (username, email, level, xp, is_bot, is_special_base, units, total_strength, total_defense, current_position_x, current_position_y, resources_metal, resources_energy, created_at, last_login_date)
     VALUES ($1, $2, 50, 0, 0, 0, $3::jsonb, 14310000, 0, $4, $5, 0, 0, NOW(), NOW())
     ON CONFLICT (username) DO UPDATE SET units = $3::jsonb, total_strength = 14310000, current_position_x = $4, current_position_y = $5`,
    ['smoke_attacker', 'smoke-attacker@test.local', JSON.stringify(army), b.current_position_x, b.current_position_y]
  );
  console.log(`\nsmoke_attacker ready at the base tile with 13.31M STR + 9M additional T5 power (22.31M total).`);

  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
