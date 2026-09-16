/**
 * FID-20260916-011 — LIVE verification driver for the sabotage UI seams.
 * Runs against the real dev DB (DATABASE_URL from .env.local). Exercises the
 * three layers the panel flow uses, in order:
 *
 *   1. ENUMERATE  — getSabotageTargets(spyId): the probe's own missile must
 *      appear with the derived victim, protected=true, and shared-math values.
 *   2. PREVIEW    — sabotageSuccessChance / sabotageDetectionRisk must match
 *      the executeSabotage formula exactly (imported, not copied).
 *   3. FIRE       — executeSabotage against the PROBE'S OWN protected target
 *      must refuse with PROTECTION_REFUSAL_REASON and leave the spy AVAILABLE.
 *
 * Cleanup: onConflictDoNothing for inserts, hard delete of probe rows at exit.
 * One-shot; process.exit because the pg pool keeps the event loop alive.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { closeConnection } from '@/lib/db/connection';
import { players } from '@/lib/db/schema/players';
import { missiles, wmdSpies } from '@/lib/db/schema/wmd';
import { getSabotageTargets } from '@/lib/wmd/sabotageTargets';
import { executeSabotage } from '@/lib/wmd/spyService';
import { sabotageSuccessChance, sabotageDetectionRisk } from '@/lib/wmd/sabotageMath';
import { SpyRank } from '@/types/wmd/intelligence.types';

const STAMP = Date.now();
// Username/email columns are varchar(20) — keep every identity ≤20 chars
// (base36 stamp ≈ 8 chars; the -007/-008 varchar-discipline lesson).
const STAMP36 = STAMP.toString(36);
const MARK = `f011${STAMP36}`;
const OPERATOR = `${MARK}o`;
const VICTIM = `${MARK}v`;
const SPY_ID = `${MARK}_spy`;
const MISSILE_ID = `${MARK}_msl`;
// 72h window starting now — the victim is protected for the whole probe run.
const PROTECTED_UNTIL = new Date(STAMP + 72 * 3_600_000);

async function main(): Promise<void> {
  console.log('=== FID-20260916-011 live probe: sabotage UI seams ===');

  // -- seed -----------------------------------------------------------------
  await db.insert(players).values([
    {
      username: OPERATOR,
      email: `${OPERATOR}@probe.invalid`,
      password: 'x',
      level: 1,
      baseX: 1,
      baseY: 1,
      currentPositionX: 1,
      currentPositionY: 1,
    },
    {
      username: VICTIM,
      email: `${VICTIM}@probe.invalid`,
      password: 'x',
      protectionUntil: PROTECTED_UNTIL,
      level: 1,
      baseX: 1,
      baseY: 1,
      currentPositionX: 1,
      currentPositionY: 1,
    },
  ]).onConflictDoNothing();

  await db.insert(wmdSpies).values({
    id: `${MARK}_sp`,
    spyId: SPY_ID,
    ownerId: OPERATOR,
    ownerUsername: OPERATOR,
    codename: 'Probe Ghost',
    rank: SpyRank.ROOKIE,
    specialization: 'SABOTAGE',
    status: 'AVAILABLE',
    skillsStealth: 40,
    skillsHacking: 10,
    skillsSabotage: 60,
    skillsIntelligence: 10,
    recruitedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing();

  await db.insert(missiles).values({
    id: `${MARK}_m`,
    missileId: MISSILE_ID,
    ownerId: VICTIM,
    warheadType: 'NUCLEAR',
    status: 'READY',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing();

  try {
    // -- 1. ENUMERATE -------------------------------------------------------
    console.log('\n--- 1. ENUMERATE (getSabotageTargets) ---');
    const enumResult = await getSabotageTargets(SPY_ID);
    if (!enumResult.success) {
      throw new Error(`enumeration refused: ${enumResult.message}`);
    }
    const probeMissile = (enumResult.missiles ?? []).find((t) => t.targetId === MISSILE_ID);
    if (!probeMissile) {
      throw new Error(`probe missile ${MISSILE_ID} missing from enumeration`);
    }
    console.log(`missile listed: ${probeMissile.targetId} (${probeMissile.label})`);
    console.log(`victim derived: kind=${probeMissile.victimKind} username=${probeMissile.victimUsername}`);
    console.log(`protected flag: ${probeMissile.protected} (victim window until ${PROTECTED_UNTIL.toISOString()})`);
    console.log(`shared math: difficulty=${probeMissile.difficulty} baseDetection=${probeMissile.detectionRisk}`);

    if (probeMissile.victimUsername !== VICTIM) throw new Error('victim derivation mismatch');
    if (probeMissile.protected !== true) throw new Error('protected flag must be true for the seeded victim');
    if (probeMissile.difficulty !== 0.2) throw new Error('difficulty must come from the shared table (0.2)');
    if (probeMissile.detectionRisk !== 0.4) throw new Error('base detection must come from the shared table (0.4)');

    // -- 2. PREVIEW ----------------------------------------------------------
    console.log('\n--- 2. PREVIEW (shared math vs fire-path formula) ---');
    const chance = sabotageSuccessChance(60, 'MISSILE');
    const risk = sabotageDetectionRisk(40, 'MISSILE');
    const expectedChance = Math.max(0.05, 60 / 100 - 0.2); // executeSabotage formula
    const expectedRisk = Math.max(0.1, Math.min(0.9, 0.4 - 40 / 200)); // executeSabotage formula
    console.log(`success chance: ${chance} (expected ${expectedChance})`);
    console.log(`detection risk: ${risk} (expected ${expectedRisk})`);
    if (chance !== expectedChance || risk !== expectedRisk) {
      throw new Error('preview math diverges from the fire path');
    }

    // -- 3. FIRE (refusal path on protected target) ---------------------------
    console.log('\n--- 3. FIRE (protected victim → parity refusal expected) ---');
    const fire = await executeSabotage(SPY_ID, 'MISSILE', MISSILE_ID, OPERATOR);
    console.log(`success=${fire.success}`);
    console.log(`message="${fire.message}"`);
    if (fire.success !== false) throw new Error('fire against a protected victim must refuse');
    if (fire.message !== 'Target is under new-player protection') {
      throw new Error('refusal must use the parity constant verbatim');
    }

    const [spyAfter] = await db.select({ status: wmdSpies.status }).from(wmdSpies).where(eq(wmdSpies.spyId, SPY_ID));
    console.log(`spy status after refused fire: ${spyAfter?.status}`);
    if (spyAfter?.status !== 'AVAILABLE') throw new Error('a refused fire must not consume the spy');

    console.log('\n=== PROBE PASSED: enumerate → preview → refusal path all verified live ===');
  } finally {
    // -- cleanup (rows only — pool is ended once, at module scope) ------------
    console.log('\n--- cleanup ---');
    await db.delete(missiles).where(eq(missiles.missileId, MISSILE_ID));
    await db.delete(wmdSpies).where(eq(wmdSpies.spyId, SPY_ID));
    await db.delete(players).where(inArray(players.username, [OPERATOR, VICTIM]));
    console.log('probe rows removed');
  }
}

async function run(): Promise<number> {
  try {
    await main();
    return 0;
  } catch (err) {
    console.error('\n=== PROBE FAILED ===');
    console.error(err instanceof Error ? err.message : err);
    const cause = (err as { cause?: unknown })?.cause;
    if (cause) console.error('cause:', cause instanceof Error ? cause.message : cause);
    try {
      await db.delete(missiles).where(eq(missiles.missileId, MISSILE_ID));
      await db.delete(wmdSpies).where(eq(wmdSpies.spyId, SPY_ID));
      await db.delete(players).where(inArray(players.username, [OPERATOR, VICTIM]));
      console.log('probe rows removed (failure path)');
    } catch {
      /* cleanup best-effort */
    }
    return 1;
  }
}

run()
  .catch(() => 1)
  .then((code) => {
    void Promise.resolve(closeConnection()).finally(() => process.exit(code));
  });
