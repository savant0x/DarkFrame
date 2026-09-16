/**
 * FID-20260916-005 — LIVE verification driver for the revived target-validation seam.
 * Run against the real dev DB (DATABASE_URL from .env.local). The seam lives in
 * `launchMissile` (service-level), so HTTP is unnecessary — mirroring the FID-004
 * driver's honest-about-what-it-tests approach.
 *
 * Probes (per the FID's verification plan):
 *   1. PROTECTED target → launch refused, missile stays READY, launcher shield intact
 *   2. nonexistent target → launch refused, missile stays READY, launcher shield intact
 *   3. sub-floor target (level < 10) → launch refused, launcher shield intact
 *   4. valid target → launch commits + FID-004 void fires (order: validate → commit → void)
 *   5. cleanup: guarded delete of fixtures — 0 residual
 *
 * Refusal semantics proven by the service seam pins (pins 7–11): a refusal
 * leaves the missile READY and never forfeits the launcher — no committed
 * action, no protection loss.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { players } from '../lib/db/schema';

const TS = Date.now().toString(36);
const LAUNCHER = `svc5_l_${TS}`; // protected launcher (stays protected on refusals)
const TARGET_VALID = `svc5_tv_${TS}`; // level 25, no protection
const TARGET_GHOST = `svc5_tg_${TS}`; // NEVER INSERTED — existence rule
const TARGET_FLOOR = `svc5_tf_${TS}`; // level 5, no protection — level-floor rule
const TARGET_SHIELD = `svc5_ts_${TS}`; // level 25, protected — protection rule
const MISSILE_PK = `m5${TS}`.slice(0, 24); // missiles.id (PK), ≤ 24 chars
const MISSILE_BIZ = `probe5_m_${TS}`; // missiles.missile_id (business key)

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

async function insertPlayer(username: string, level: number, protectedWindow: boolean): Promise<void> {
  await db.insert(players).values({
    username,
    email: `${username}@probe.invalid`,
    password: 'x',
    // FID-002 seam: registration normally stamps this; the driver stamps the
    // same value so shielded fixtures start inside a live window.
    protectionUntil: protectedWindow ? new Date(Date.now() + 72 * 3_600_000) : null,
    level,
    // NOT NULL positionals (fixtures never move; the probe reads protection only)
    baseX: 1,
    baseY: 1,
    currentPositionX: 1,
    currentPositionY: 1,
  });
}

async function missileStatus(): Promise<string> {
  const result = await db.execute<{ status: string }>(
    sql`SELECT status FROM missiles WHERE id = ${MISSILE_PK}`
  );
  const row = result.rows[0];
  if (!row) throw new Error(`fixture missing: missile ${MISSILE_PK}`);
  return row.status;
}

/** Incremental cleanup — every probe registers its fixtures immediately. */
const fixtureUsers: string[] = [];
async function cleanup(): Promise<void> {
  if (fixtureUsers.length) {
    await db.delete(players).where(inArray(players.username, fixtureUsers));
  }
  await db.execute(sql`DELETE FROM missiles WHERE id = ${MISSILE_PK}`);
  const residual = await db
    .select({ username: players.username })
    .from(players)
    .where(inArray(players.username, fixtureUsers.length ? fixtureUsers : ['__none__']));
  check('cleanup: fixture residual = 0', residual.length === 0, `${residual.length} rows left`);
}

async function main(): Promise<void> {
  console.log(`\n=== FID-20260916-005 live probes (fixtures ${TS}) ===\n`);
  let probeError: unknown = null;
  try {
    await insertPlayer(LAUNCHER, 30, true);
    fixtureUsers.push(LAUNCHER);
    await insertPlayer(TARGET_VALID, 25, false);
    fixtureUsers.push(TARGET_VALID);
    await insertPlayer(TARGET_FLOOR, 5, false);
    fixtureUsers.push(TARGET_FLOOR);
    await insertPlayer(TARGET_SHIELD, 25, true);
    fixtureUsers.push(TARGET_SHIELD);
    // TARGET_GHOST is deliberately never inserted.

    await db.execute(sql`
      INSERT INTO missiles (id, missile_id, owner_id, warhead_type, status, created_at, updated_at)
      VALUES (${MISSILE_PK}, ${MISSILE_BIZ}, ${LAUNCHER}, 'TACTICAL', 'READY', NOW(), NOW())
    `);

    const { launchMissile } = await import('../lib/wmd/missileService');

    // --- Probe 1: protected target refuses; launcher shield intact ---
    const p1 = await launchMissile(MISSILE_PK, TARGET_SHIELD, LAUNCHER);
    check(
      'protected target → refused, missile READY, launcher shield intact',
      p1.success === false && (await missileStatus()) === 'READY' && (await protectionOf(LAUNCHER)) !== null,
      `success=${p1.success}; message="${p1.message}"`
    );

    // --- Probe 2: nonexistent target refuses; launcher shield intact ---
    const p2 = await launchMissile(MISSILE_PK, TARGET_GHOST, LAUNCHER);
    check(
      'nonexistent target → refused, missile READY, launcher shield intact',
      p2.success === false && (await missileStatus()) === 'READY' && (await protectionOf(LAUNCHER)) !== null,
      `success=${p2.success}; message="${p2.message}"`
    );

    // --- Probe 3: sub-floor target refuses ---
    const p3 = await launchMissile(MISSILE_PK, TARGET_FLOOR, LAUNCHER);
    check(
      'sub-floor target (level < 10) → refused, launcher shield intact',
      p3.success === false && (await protectionOf(LAUNCHER)) !== null,
      `success=${p3.success}; message="${p3.message}"`
    );

    // --- Probe 4: valid target commits + FID-004 void fires ---
    const p4 = await launchMissile(MISSILE_PK, TARGET_VALID, LAUNCHER);
    check(
      'valid target → launch commits + launcher void fired (FID-004 intact)',
      p4.success === true && (await missileStatus()) === 'LAUNCHED' && (await protectionOf(LAUNCHER)) === null,
      `success=${p4.success}; status=${await missileStatus()}; launcher protectionUntil=${String(await protectionOf(LAUNCHER))}`
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
