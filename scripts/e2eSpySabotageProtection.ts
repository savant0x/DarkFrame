/**
 * FID-20260916-007 — LIVE verification driver for the spy-sabotage seams.
 * Runs against the real dev DB (DATABASE_URL from .env.local). Seams are
 * service-level; the driver exercises `executeSabotage` directly, exactly as
 * the repaired route now calls it: (spyId, targetType, targetId, operatorId).
 *
 * Probes:
 *   1. PROTECTED victim → refused with PROTECTION_REFUSAL_REASON, operator window intact
 *   2. Unprotected victim → operation executes (roll-independent), operator window VOIDED
 *   3. Hijack attempt (operator id ≠ spy owner) → refused "Not your spy", nothing written
 *   4. Cleanup: guarded delete of fixtures — 0 residual
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { players } from '../lib/db/schema';

const TS = Date.now().toString(36);
const OPERATOR = `svc7_op_${TS}`; // protected — must be, to prove the void
const VICTIM_PROT = `svc7_vp_${TS}`; // protected victim (refusal probe)
const VICTIM_OK = `svc7_vo_${TS}`; // unprotected victim (void probe)
const SPY_ID = `spy7_${TS}`.slice(0, 50);
const SPY_ROW_ID = `ws7${TS}`.slice(0, 24);
const MISSILE_PK_1 = `m7a${TS}`.slice(0, 24);
const MISSILE_PK_2 = `m7b${TS}`.slice(0, 24);
const MISSILE_BIZ_1 = `probe7_m1_${TS}`.slice(0, 50);
const MISSILE_BIZ_2 = `probe7_m2_${TS}`.slice(0, 50);
const HIJACKER = `svc7_hij_${TS}`; // never needs a player row: binding refuses first

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function protectionOf(username: string): Promise<Date | null> {
  const [row] = await db
    .select({ protectionUntil: players.protectionUntil })
    .from(players)
    .where(eq(players.username, username))
    .limit(1);
  if (!row) throw new Error(`fixture missing: ${username}`);
  return row.protectionUntil;
}

async function insertPlayer(username: string, protectedWindow: boolean): Promise<void> {
  await db.insert(players).values({
    username,
    email: `${username}@probe.invalid`,
    password: 'x',
    // FID-002 seam: registration normally stamps this; the driver stamps the
    // same value so shielded fixtures start inside a live window.
    protectionUntil: protectedWindow ? new Date(Date.now() + 72 * 3_600_000) : null,
    level: 1,
    baseX: 1,
    baseY: 1,
    currentPositionX: 1,
    currentPositionY: 1,
  });
}

async function cleanup(): Promise<void> {
  // operations written by probe 2 reference the spy; delete by spy_id
  await db.execute(sql`DELETE FROM wmd_sabotage_operations WHERE spy_id = ${SPY_ID}`);
  await db.execute(sql`DELETE FROM wmd_spies WHERE spy_id = ${SPY_ID}`);
  await db.execute(sql`DELETE FROM missiles WHERE id IN (${MISSILE_PK_1}, ${MISSILE_PK_2})`);
  await db.delete(players).where(
    inArray(players.username, [OPERATOR, VICTIM_PROT, VICTIM_OK])
  );
  const residual = await db
    .select({ username: players.username })
    .from(players)
    .where(inArray(players.username, [OPERATOR, VICTIM_PROT, VICTIM_OK]));
  check('cleanup: fixture residual = 0', residual.length === 0, `${residual.length} rows left`);
}

async function main(): Promise<void> {
  console.log(`\n=== FID-20260916-007 live probes (fixtures ${TS}) ===\n`);
  let probeError: unknown = null;
  try {
    await insertPlayer(OPERATOR, true); // protected: only a void can clear it
    await insertPlayer(VICTIM_PROT, true); // protected victim
    await insertPlayer(VICTIM_OK, false); // unprotected victim

    // Spy owned by OPERATOR, sabotage skill 50 (above the 30 floor), AVAILABLE.
    await db.execute(sql`
      INSERT INTO wmd_spies (id, spy_id, owner_id, owner_username, clan_id, codename, rank,
        experience, specialization, status, current_mission_id, mission_history,
        skills_stealth, skills_hacking, skills_sabotage, skills_intelligence,
        last_mission_at, recruited_at, created_at, updated_at)
      VALUES (${SPY_ROW_ID}, ${SPY_ID}, ${OPERATOR}, ${OPERATOR}, NULL, 'PROBE7', 'ROOKIE',
        0, 'SABOTEUR', 'AVAILABLE', NULL, '[]'::jsonb,
        10, 10, 50, 10,
        NULL, NOW(), NOW(), NOW())
    `);

    // Victims' assets: business missile_id is what the validator resolves.
    await db.execute(sql`
      INSERT INTO missiles (id, missile_id, owner_id, warhead_type, status, created_at, updated_at)
      VALUES (${MISSILE_PK_1}, ${MISSILE_BIZ_1}, ${VICTIM_PROT}, 'TACTICAL', 'READY', NOW(), NOW())
    `);
    await db.execute(sql`
      INSERT INTO missiles (id, missile_id, owner_id, warhead_type, status, created_at, updated_at)
      VALUES (${MISSILE_PK_2}, ${MISSILE_BIZ_2}, ${VICTIM_OK}, 'TACTICAL', 'READY', NOW(), NOW())
    `);

    const { executeSabotage } = await import('../lib/wmd/spyService');

    // --- Probe 1: protected victim refuses; operator shield intact ---
    const p1 = await executeSabotage(SPY_ID, 'MISSILE', MISSILE_BIZ_1, OPERATOR);
    check(
      'protected victim → refused, operator window intact',
      p1.success === false && (await protectionOf(OPERATOR)) !== null,
      `message="${p1.message}"`
    );

    // --- Probe 2: unprotected victim executes; operator void fires (roll-independent) ---
    const p2 = await executeSabotage(SPY_ID, 'MISSILE', MISSILE_BIZ_2, OPERATOR);
    const operatorWindow = await protectionOf(OPERATOR);
    check(
      'unprotected victim → operation committed + operator void fired',
      p2.message.startsWith('Sabotage operation') && operatorWindow === null,
      `success=${p2.success} (roll); message="${p2.message}"; operator protectionUntil=${String(operatorWindow)}`
    );

    // --- Probe 3: hijack refused before any work ---
    const p3 = await executeSabotage(SPY_ID, 'MISSILE', MISSILE_BIZ_1, HIJACKER);
    check(
      'hijack (operator ≠ spy owner) → refused, nothing written',
      p3.success === false && p3.message === 'Not your spy',
      `message="${p3.message}"`
    );
  } catch (err) {
    // Preserve the failure — process.exit() inside finally would silently
    // discard an in-flight exception (the failure-impersonates-pass class).
    probeError = err;
  } finally {
    await cleanup();
    console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} probes passed ===\n`);
  }
  if (probeError) {
    console.error('Driver crashed:', probeError);
    process.exit(1);
  }
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

main().catch((err) => {
  console.error('Driver crashed:', err);
  process.exit(1);
});
