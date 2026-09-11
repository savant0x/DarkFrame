/**
 * FID-20260909-034 live remediation — regenerate Silent_Citadel's army in
 * place with the fixed pure-unit, total-power-budgeted generator. Identity,
 * position, level, rank, and resources are preserved; only units and the
 * derived totals are replaced (the previous army carried 1.9M of unbudgeted
 * cross-stat STR, pushing it 16% past the ELITE ceiling).
 *
 * Run: npx tsx --env-file=.env.local scripts/regenerate-citadel-army.ts
 */
import { Client } from 'pg';
import { generateBeerBaseUnits, POWER_BANDS } from '../lib/beerBaseService';
import { BotSpecialization } from '../types/game.types';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const { rows } = await c.query<{ username: string; level: number; units: unknown }>(
    `SELECT username, level, units FROM players WHERE username = 'Silent_Citadel'`
  );
  const base = rows[0];
  if (!base) throw new Error('Silent_Citadel not found');

  // Regenerate with the same Raider 70/30 spec it originally drew.
  const units = generateBeerBaseUnits(BotSpecialization.Raider, POWER_BANDS.elite.key);
  const totalStrength = units.reduce((s, u) => s + u.strength * u.quantity, 0);
  const totalDefense = units.reduce((s, u) => s + u.defense * u.quantity, 0);
  const total = totalStrength + totalDefense;

  console.log('New army:');
  for (const u of units) {
    console.log(`  ${u.name} (${u.strength}/${u.defense}) x${u.quantity.toLocaleString()}`);
  }
  console.log(`Total: STR ${totalStrength.toLocaleString()} / DEF ${totalDefense.toLocaleString()} = ${total.toLocaleString()}`);
  console.log(`ELITE band: 2M-10M → ${total >= POWER_BANDS.elite.min && total <= POWER_BANDS.elite.max ? 'IN BAND ✓' : 'OUT OF BAND ✗'}`);

  if (total < POWER_BANDS.elite.min || total > POWER_BANDS.elite.max) {
    throw new Error('Generated army violates the ELITE band; aborting write.');
  }

  await c.query(`UPDATE players SET units = $1::jsonb, total_strength = $2, total_defense = $3 WHERE username = 'Silent_Citadel'`, [
    JSON.stringify(units.map((u) => ({ ...u, createdAt: (u.createdAt as Date).toISOString() }))),
    totalStrength,
    totalDefense,
  ]);
  console.log('Silent_Citadel army regenerated in place.');
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
