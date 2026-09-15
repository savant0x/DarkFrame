/**
 * Live hoarder-jackpot verification (FID-20260915-006 + FID-20260915-005).
 *
 * Hunts like a player: scout (tmpHoarderScout) picked Marauder_Control — the
 * nearest true hoarder (T2 at (68,32), d=34 from fame) whose metal vault
 * (323,739) sits ABOVE the old 2× cap (300,000), so the payout itself
 * discriminates pre/post FID-006:
 *   pre-006 loot would be min(vault, 300,000) = 300,000
 *   post-006 loot is  min(vault, 450,000)  = full vault (3× cap live)
 * Declared `metal` raid also proves FID-005: the bot's ENERGY must survive.
 * Then one real runGrowthCycle proves linear first-tick regrowth from 0:
 *   hoarder T2: floor(0.05 × 150,000) = 7,500 metal (energy +7,500 toward cap).
 *
 * Mutates game state by design (that's the point). Teleports fame for
 * presence and restores position in `finally`.
 *
 * Re-runnable: RAID_TARGET env selects another hoarder (default Marauder_Control,
 * the nearest true hoarder to fame at write time).
 *
 * Run: npx tsx -r dotenv/config scripts/e2eHoarderJackpot.ts dotenv_config_path=.env.local
 */
import { Client } from 'pg';
import { SignJWT } from 'jose';
import { runGrowthCycle } from '@/lib/botGrowthEngine';
import { getVaultCap, getResourceRange } from '@/lib/botService';
import { BotSpecialization } from '@/types/game.types';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3000';
const TARGET = process.env.RAID_TARGET ?? 'Marauder_Control';

const fmt = (n: number) => n.toLocaleString('en-US');
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const botRow = (await c.query(
    `SELECT username, level, base_x, base_y, resources_metal, resources_energy, units FROM players WHERE username = $1`,
    [TARGET]
  )).rows[0];
  const fameRow = (await c.query(
    `SELECT username, email, base_x, base_y, resources_metal, resources_energy, current_position_x, current_position_y FROM players WHERE username = 'fame'`
  )).rows[0];
  if (!botRow || !fameRow) throw new Error('pre-state rows missing');

  const vaultCap = getVaultCap(BotSpecialization.Hoarder, 2);
  const tier2Max = getResourceRange(BotSpecialization.Hoarder, 2).max;
  console.log(`=== PRE ===`);
  console.log(`${TARGET}: M ${fmt(Number(botRow.resources_metal))} · E ${fmt(Number(botRow.resources_energy))} · cap(3×)=${fmt(vaultCap)} (old 2× would be ${fmt(tier2Max * 2)})`);
  console.log(`fame: M ${fmt(Number(fameRow.resources_metal))} · E ${fmt(Number(fameRow.resources_energy))} at (${fameRow.current_position_x}, ${fameRow.current_position_y})`);

  // --- Teleport fame to the target tile for presence (restored in finally) ---
  await c.query(`UPDATE players SET current_position_x = $1, current_position_y = $2 WHERE username = 'fame'`, [botRow.base_x, botRow.base_y]);

  let lootMetal = 0, lootEnergy = 0;
  try {
    // --- Mint fame's session and raid through the LIVE route ---
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'darkframe-secret-change-in-production');
    const jwt = await new SignJWT({ username: 'fame', email: fameRow.email ?? 'fame@test.local' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(secret);

    const res = await fetch(`${BASE}/api/combat/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `darkframe_session=${jwt}` },
      body: JSON.stringify({ defender: TARGET, resource: 'metal' }),
    });
    const body = await res.json();
    console.log(`\n=== RAID ===\nHTTP ${res.status} → success=${body.success} victory=${body.victory}`);
    console.log(`Message: ${body.message ?? body.error ?? '(none)'}`);
    const rounds = body?.battle?.rounds?.length ?? body?.battleLog?.rounds?.length ?? 0;
    check('route answered 2xx', res.ok);
    check('victory', body.victory === true || body?.battle?.outcome === 'ATTACKER_WIN', `${rounds} round(s)`);

    // --- Post-raid state ---
    const botPost = (await c.query(
      `SELECT resources_metal, resources_energy FROM players WHERE username = $1`, [TARGET]
    )).rows[0];
    const famePost = (await c.query(
      `SELECT resources_metal, resources_energy FROM players WHERE username = 'fame'`
    )).rows[0];
    lootMetal = Number(famePost.resources_metal) - Number(fameRow.resources_metal);
    lootEnergy = Number(famePost.resources_energy) - Number(fameRow.resources_energy);
    const botMetal = Number(botPost.resources_metal);
    const botEnergy = Number(botPost.resources_energy);
    const preBotMetal = Number(botRow.resources_metal);
    const preBotEnergy = Number(botRow.resources_energy);

    console.log(`\n=== POST-RAID ===`);
    console.log(`fame delta: M +${fmt(lootMetal)} · E +${fmt(lootEnergy)}`);
    console.log(`${TARGET}: M ${fmt(botMetal)} (was ${fmt(preBotMetal)}) · E ${fmt(botEnergy)} (was ${fmt(preBotEnergy)})`);

    const expectedLoot = Math.floor(Math.min(preBotMetal, vaultCap)); // multiplier 1 for regular bots
    check('payout = full vault at the 3× cap (FID-006 jackpot)', lootMetal === expectedLoot,
      `loot ${fmt(lootMetal)} vs expected min(${fmt(preBotMetal)}, cap ${fmt(vaultCap)}) = ${fmt(expectedLoot)}; pre-006 would have paid ${fmt(Math.min(preBotMetal, tier2Max * 2))}`);
    check('declared-metal raid paid zero energy', lootEnergy === 0, `ΔE ${fmt(lootEnergy)}`);
    check('FID-005: defeated bot\'s ENERGY preserved', botEnergy === preBotEnergy, `${fmt(botEnergy)} vs ${fmt(preBotEnergy)}`);
    check('FID-005: looted METAL zeroed', botMetal === 0, `${fmt(botMetal)}`);

    // --- One real growth cycle → linear first-tick regrowth ---
    console.log(`\n=== GROWTH CYCLE (linear regen proof) ===`);
    const cycle = await runGrowthCycle();
    console.log(`cycle: processed=${cycle.processed} regenerated=${cycle.regenerated} moved=${cycle.moved} errors=${cycle.errors}`);

    const botGrown = (await c.query(
      `SELECT resources_metal, resources_energy FROM players WHERE username = $1`, [TARGET]
    )).rows[0];
    const expectedTick = Math.floor(0.05 * tier2Max); // hoarder rate × spawner max
    // The tick composes regen (+expectedTick) THEN the 70/20/10 growth roll —
    // grow ×1.05–1.15, stay ×1.0, decrease ×0.90–0.95 (engine band) — clamped
    // to cap. Honest window: [floor(tick×0.90), floor(tick×1.15)].
    const lo = Math.floor(expectedTick * 0.90), hi = Math.floor(expectedTick * 1.15);
    console.log(`${TARGET} after 1 tick: M ${fmt(Number(botGrown.resources_metal))} · E ${fmt(Number(botGrown.resources_energy))} (regen +${fmt(expectedTick)}, growth roll → window [${fmt(lo)}, ${fmt(hi)}])`);
    check('linear first-tick regrowth from zero (regen+growth composed)', Number(botGrown.resources_metal) >= lo && Number(botGrown.resources_metal) <= hi,
      `${fmt(Number(botGrown.resources_metal))} within [${fmt(lo)}, ${fmt(hi)}] — pre-006 exponential would still be 0`);
    if (preBotEnergy < vaultCap) {
      check('preserved energy still regenerating toward cap', Number(botGrown.resources_energy) > preBotEnergy,
        `${fmt(Number(botGrown.resources_energy))} > ${fmt(preBotEnergy)}`);
    } else {
      check('preserved energy at cap stays clamped', Number(botGrown.resources_energy) === vaultCap,
        `${fmt(Number(botGrown.resources_energy))} pinned at 3× cap — regen clamp live`);
    }

    // Tick 2 — the LINEAR SIGNATURE: a constant absolute step (+expectedTick
    // again, inside the same composed window). A percentage-of-current curve
    // cannot repeat the same absolute delta.
    await runGrowthCycle();
    const botGrown2 = (await c.query(
      `SELECT resources_metal FROM players WHERE username = $1`, [TARGET]
    )).rows[0];
    const delta2 = Number(botGrown2.resources_metal) - Number(botGrown.resources_metal);
    check('linear two-tick signature (constant absolute step)', delta2 >= lo && delta2 <= hi,
      `tick2−tick1 metal delta ${fmt(delta2)} within [${fmt(lo)}, ${fmt(hi)}] — compound curves can't repeat the same step`);
  } finally {
    // Restore fame's position no matter what.
    await c.query(`UPDATE players SET current_position_x = $1, current_position_y = $2 WHERE username = 'fame'`,
      [fameRow.current_position_x, fameRow.current_position_y]);
    await c.end();
  }

  console.log(`\n${failures === 0 ? '★ ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
