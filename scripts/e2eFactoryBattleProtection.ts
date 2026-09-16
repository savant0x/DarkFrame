/**
 * FID-20260916-008 — LIVE verification driver: factory-capture void + latent
 * battle-route protection. Runs against the real dev DB and dev server.
 *
 * Design (v3): each probe gets its own dedicated protected attacker so no
 * void from an earlier probe can poison a later "window intact" assertion.
 * Factory probes are service-direct; the roll may land either way — the
 * invariant asserted is always the protection window, never capture success
 * (roll independence is proven by the pins).
 *
 * Probes:
 *   1. factory: PROTECTED owner → -002 refusal message, attacker-2 window intact
 *   2. factory: player-owned UNPROTECTED owner → attacker-1 void fired
 *   3. factory: wild factory, attacker-PvE still protected → window untouched
 *   4. battle route: protected defender → refusal, battle-attacker window intact
 *   5. battle route: unprotected defender → battle-attacker void fired
 *   6. cleanup: 0 residual
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { players, factories } from '../lib/db/schema';

const TS = Date.now().toString(36);
const ATTACKER = `svc8_a_${TS}`; // probe 2: player-owned capture → void
const ATTACKER2 = `svc8_b_${TS}`; // probe 1: protected-owner refusal
const ATTACKER_PVE = `svc8_e_${TS}`; // probe 3: wild-capture control
const BATTLE_ATTACKER = `svc8_t_${TS}`; // probes 4-5: HTTP route
const OWNER = `svc8_o_${TS}`; // unprotected player-owned factory
const OWNER_PROT = `svc8_r_${TS}`; // protected player-owned factory
const DEFENDER = `svc8_d_${TS}`; // battle victim, unprotected
const DEFENDER_PROT = `svc8_p_${TS}`; // battle victim, protected
const FACTORY_PVP = { x: 6, y: 6 }; // owned by OWNER (unprotected)
const FACTORY_PROT = { x: 8, y: 8 }; // owned by OWNER_PROT (protected)
const PORT = 3002;

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
    protectionUntil: protectedWindow ? new Date(Date.now() + 72 * 3_600_000) : null,
    level: 1,
    baseX: 1,
    baseY: 1,
    currentPositionX: 1,
    currentPositionY: 1,
  });
}

async function insertFactory(pos: { x: number; y: number }, owner: string | null): Promise<void> {
  await db.insert(factories).values({
    x: pos.x,
    y: pos.y,
    owner,
    defense: 500,
    lastSlotRegen: new Date(),
  });
}

const ALL_USERS = [ATTACKER, ATTACKER2, ATTACKER_PVE, BATTLE_ATTACKER, OWNER, OWNER_PROT, DEFENDER, DEFENDER_PROT];

async function cleanup(): Promise<void> {
  await db.delete(factories).where(
    sql`(${factories.x}, ${factories.y}) IN ((${FACTORY_PVP.x}, ${FACTORY_PVP.y}), (${FACTORY_PROT.x}, ${FACTORY_PROT.y}), (7, 7))`
  );
  await db.delete(players).where(inArray(players.username, ALL_USERS));
  const residual = await db
    .select({ username: players.username })
    .from(players)
    .where(inArray(players.username, ALL_USERS));
  check('cleanup: fixture residual = 0', residual.length === 0, `${residual.length} rows left`);
}

async function main(): Promise<void> {
  console.log(`\n=== FID-20260916-008 live probes (fixtures ${TS}) ===\n`);
  let probeError: unknown = null;
  try {
    for (const u of [ATTACKER, ATTACKER2, ATTACKER_PVE, BATTLE_ATTACKER, DEFENDER_PROT]) {
      await insertPlayer(u, true);
    }
    await insertPlayer(OWNER, false); // unprotected factory owner (not in loop above)
    await insertPlayer(OWNER_PROT, true); // protected factory owner — probe 1's refusal target
    await insertPlayer(DEFENDER, false); // unprotected battle victim — probe 5's void target

    await insertFactory(FACTORY_PVP, OWNER); // real player, unprotected
    await insertFactory(FACTORY_PROT, OWNER_PROT); // real player, PROTECTED
    // (7,7) deliberately absent → wild

    const { attackFactory } = await import('../lib/factoryService');

    // --- Probe 1: protected owner → -002 refusal; ATTACKER2 window intact ---
    const p1 = await attackFactory(ATTACKER2, FACTORY_PROT.x, FACTORY_PROT.y);
    check(
      'factory: protected owner → PROTECTION refusal, attacker window intact',
      p1.success === false && p1.message === 'Target is under new-player protection' && (await protectionOf(ATTACKER2)) !== null,
      `message="${p1.message}"`
    );

    // --- Probe 2: player-owned unprotected → void fires (roll-independent) ---
    await attackFactory(ATTACKER, FACTORY_PVP.x, FACTORY_PVP.y);
    const attackerWindow = await protectionOf(ATTACKER);
    check(
      'factory: player-owned capture attempt → attacker void fired',
      attackerWindow === null,
      `attacker protectionUntil=${String(attackerWindow)}`
    );

    // --- Probe 3: wild factory with a still-protected attacker → no forfeit ---
    await attackFactory(ATTACKER_PVE, 7, 7);
    const pveWindow = await protectionOf(ATTACKER_PVE);
    check(
      'factory: wild capture (protected attacker) → window untouched',
      pveWindow !== null,
      `window=${String(pveWindow)}`
    );

    // --- battle route (HTTP, signed JWT on BATTLE_ATTACKER) ---
    const { generateToken } = await import('../lib/authService');
    const token = generateToken(BATTLE_ATTACKER, `${BATTLE_ATTACKER}@probe.invalid`, false, false, 1, 600);
    const cookie = `darkframe_session=${token}`;
    // Schema validates {targetUsername, units}; the route reads attacker/
    // defender/etc from the RAW body and pins attacker to the session user.
    const body = (target: string) => JSON.stringify({
      targetUsername: target,
      units: { infantry: 10 },
      attacker: BATTLE_ATTACKER,
      defender: target,
      factoryLocation: { x: 1, y: 1 },
      attackerUnits: { infantry: 10 },
      defenderUnits: { infantry: 10 },
    });

    // Probe 4: protected defender → refusal; BATTLE_ATTACKER window intact
    const res4 = await fetch(`http://localhost:${PORT}/api/battle/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: body(DEFENDER_PROT),
    });
    const window4 = await protectionOf(BATTLE_ATTACKER);
    check(
      'battle route: protected defender → refusal, attacker window intact',
      res4.status >= 400 && res4.status < 500 && window4 !== null,
      `status=${res4.status}; window=${String(window4)}`
    );

    // Probe 5: unprotected defender → route-level void fires before resolution
    const res5 = await fetch(`http://localhost:${PORT}/api/battle/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: body(DEFENDER),
    });
    const window5 = await protectionOf(BATTLE_ATTACKER);
    check(
      'battle route: unprotected defender → attacker void fired',
      window5 === null,
      `status=${res5.status}; window=${String(window5)}`
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
