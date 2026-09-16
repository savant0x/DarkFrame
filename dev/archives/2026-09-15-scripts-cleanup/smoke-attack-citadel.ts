/**
 * FID-20260909-034 verification — end-to-end attack on Silent_Citadel through
 * the LIVE route (POST /api/combat/attack on the running dev server):
 * auth cookie → presence → real-unit garrison battle → outcome handling.
 *
 * Validates the unified catalog end-to-end:
 *  - battle log unit labels are unified-catalog names (no legacy Rifleman-era ids)
 *  - win path: loot = base resources × multiplier, XP awarded, base removed,
 *    tile claim RELEASED (FID-030 leak class — defeat path)
 *  - loss path: repelled message + persisted battle log
 *
 * Read-mostly: teleports fame to the base tile for presence (and back after),
 * mints a short-lived session JWT. The attack itself mutates game state by design.
 *
 * Run: npx tsx --env-file=.env.local scripts/smoke-attack-citadel.ts
 */
import { Client } from 'pg';
import { SignJWT } from 'jose';

const BASE = 'http://localhost:3000';
const ATTACKER = process.argv[2] ?? 'fame';
const DEFENDER = process.argv[3] ?? 'Silent_Citadel';
const HOME = ATTACKER === 'fame' ? { x: 43, y: 45 } : null;

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // --- Pre-state ---
  const atk = (await c.query(`SELECT username, email, resources_metal, resources_energy, xp, current_position_x, current_position_y, units FROM players WHERE username = $1`, [ATTACKER])).rows[0];
  if (!atk) throw new Error('attacker missing');
  const base = (await c.query(`SELECT username, resources_metal, resources_energy, current_position_x, current_position_y, units FROM players WHERE username = $1`, [DEFENDER])).rows[0];
  if (!base) throw new Error(`${DEFENDER} missing (already defeated?)`);
  const tileBefore = (await c.query(`SELECT base_owner FROM tiles WHERE x = $1 AND y = $2`, [base.current_position_x, base.current_position_y])).rows[0];
  console.log(`Attacker: ${ATTACKER} at (${atk.current_position_x},${atk.current_position_y}) STR total from ${atk.units.length} entries`);
  console.log(`Base: ${DEFENDER} at (${base.current_position_x},${base.current_position_y}) res ${base.resources_metal}/${base.resources_energy}, tile owner: ${tileBefore?.base_owner}`);

  // --- Teleport attacker onto the base tile (presence requirement) ---
  await c.query(`UPDATE players SET current_position_x = $1, current_position_y = $2 WHERE username = $3`, [base.current_position_x, base.current_position_y, ATTACKER]);
  console.log(`Teleported ${ATTACKER} onto the base tile for presence check.`);

  // --- Mint a short-lived session JWT (HS256, shared secret) ---
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'darkframe-secret-change-in-production');
  const jwt = await new SignJWT({ username: ATTACKER, email: atk.email ?? `${ATTACKER}@test.local` })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret);

  // --- Attack through the LIVE route ---
  const res = await fetch(`${BASE}/api/combat/attack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `darkframe_session=${jwt}` },
    body: JSON.stringify({ defender: DEFENDER }),
  });
  const body = await res.json();
  console.log(`\nHTTP ${res.status} → success=${body.success} victory=${body.victory}`);
  console.log(`Message: ${body.message ?? body.error ?? '(none)'}`);

  check('route answered 2xx', res.ok);
  check('battle log returned', !!body.battle, body.battle ? `${body.battle.rounds?.length ?? '?'} rounds` : '');

  // --- Unified-catalog label check across the battle log ---
  // True legacy markers: the botGrowthEngine scheme + pre-FID-033 identities.
  // NOTE: 'T1_RIFLEMAN' is the LIVE enum value of the unified-catalog Rifleman
  // (95 STR) — a false-positive legacy marker; validated against UNIT_CONFIGS below.
  const logStr = JSON.stringify(body.battle ?? {});
  const legacyLabels = ['warrior', 'berserker', 'champion', 'T2_RANGER', 'T1_SHIELD', 'T5_MONOLITH', 'Ranger', 'Enforcer', 'Demolisher', 'Immortal'];
  const foundLegacy = legacyLabels.filter((l) => logStr.includes(l));
  check('no legacy unit identities in battle log', foundLegacy.length === 0, foundLegacy.join(',') || 'clean');

  // --- Post-state ---
  // Garrison identity validation: every defender unit type in the persisted
  // battle log must be a live unified-catalog identity (enum value or
  // blueprint id) carrying that unit's exact unified stats.
  if (body.battle) {
    const { UNIT_CONFIGS } = await import('../types/game.types');
    const { UNIT_BLUEPRINTS: blueprints } = await import('../types/units.types');
    const statsByValue = new Map<string, { str: number; def: number }>();
    for (const cfg of Object.values(UNIT_CONFIGS)) statsByValue.set(String(cfg.type), { str: cfg.strength, def: cfg.defense });
    for (const bp of Object.values(blueprints)) statsByValue.set(String(bp.id), { str: bp.strength, def: bp.defense });
    const defenderUnitTypes: string[] = (body.battle.defender?.units ?? []).map((u: { type: string }) => u.type);
    const uniqueTypes = [...new Set(defenderUnitTypes)];
    const unknown = uniqueTypes.filter((t) => !statsByValue.has(t));
    const statMismatch = uniqueTypes.filter((t) => {
      const u = (body.battle.defender?.units ?? []).find((x: { type: string }) => x.type === t);
      const ref = statsByValue.get(t);
      return ref && u && (u.strength !== ref.str || u.defense !== ref.def);
    });
    check('all defender unit types exist in unified catalog', unknown.length === 0, unknown.join(',') || `${uniqueTypes.length} types verified`);
    check('defender unit stats match unified catalog exactly', statMismatch.length === 0, statMismatch.join(',') || 'stats exact');
  }

  const atkAfter = (await c.query(`SELECT resources_metal, resources_energy, xp FROM players WHERE username = $1`, [ATTACKER])).rows[0];
  const baseAfter = (await c.query(`SELECT username FROM players WHERE username = $1`, [DEFENDER])).rows[0];
  const tileAfter = (await c.query(`SELECT base_owner FROM tiles WHERE x = $1 AND y = $2`, [base.current_position_x, base.current_position_y])).rows[0];

  if (body.victory === true) {
    const expMetal = Math.floor(Number(base.resources_metal) * 3);
    const expEnergy = Math.floor(Number(base.resources_energy) * 3);
    const gotMetal = Number(atkAfter.resources_metal) - Number(atk.resources_metal);
    const gotEnergy = Number(atkAfter.resources_energy) - Number(atk.resources_energy);
    const gotXp = Number(atkAfter.xp) - Number(atk.xp);
    check('loot metal = base metal × 3', gotMetal === expMetal, `got ${gotMetal}, expected ${expMetal}`);
    check('loot energy = base energy × 3', gotEnergy === expEnergy, `got ${gotEnergy}, expected ${expEnergy}`);
    check('win XP awarded', gotXp >= 400, `+${gotXp} XP`);
    check('base removed after defeat', !baseAfter);
    check('tile claim released (FID-030 defeat path)', tileAfter?.base_owner === null, `owner now: ${tileAfter?.base_owner}`);
    check('rewards echoed in response', body.rewards?.metal === expMetal, JSON.stringify(body.rewards ?? {}));
  } else if (body.victory === false) {
    const gotXp = Number(atkAfter.xp) - Number(atk.xp);
    check('loss XP awarded (60)', gotXp === 60, `+${gotXp} XP`);
    check('base still standing after repel', !!baseAfter);
    check('tile claim intact after repel', tileAfter?.base_owner === DEFENDER, `owner: ${tileAfter?.base_owner}`);
  }

  // --- Teleport home (fame only — throwaway attackers have no home) ---
  if (HOME) {
    await c.query(`UPDATE players SET current_position_x = $1, current_position_y = $2 WHERE username = $3`, [HOME.x, HOME.y, ATTACKER]);
    console.log(`\n${ATTACKER} returned home to (${HOME.x},${HOME.y}).`);
  }

  await c.end();
  console.log(failures === 0 ? '\nSMOKE: ALL CHECKS PASSED' : `\nSMOKE: ${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
