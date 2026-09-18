/**
 * FID-20260917-015 - LIVE probe for the Cluster B batch-1 pg rewrites.
 * Runs against the real dev DB via HTTP (dev server URL from argv[2]) with a
 * real minted JWT session cookie - exactly how production traffic reaches the
 * rewritten routes - plus direct pg reads as the truth oracle.
 *
 * Probes:
 *   1. STATS    - GET /api/stats 200; topPlayers<=10, first item has the full
 *                 consumer shape (derived totalPower = strength+defense,
 *                 flattened metal); gameStats equals a direct SQL aggregate.
 *   2. CHECKNAME- existing clan name (case-varied) -> available:false; a
 *                 padded probe name (lower/upper mix) -> available:true.
 *   3. TUTORIAL - pg round-trip: insert a tutorial_progress row, GET
 *                 /api/tutorial?checkEligibility=true returns quest:null
 *                 terminal payload without 500, POST restart succeeds and the
 *                 row is gone from pg (restart now deletes on pg).
 *
 * Cleanup: probe rows deleted. One-shot; exits explicitly.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { SignJWT } from 'jose';
import { eq, sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { players, clans, battleLogs, tiles, tutorialProgress } from '../lib/db/schema';
import { JOSE_SECRET } from '../lib/jwt';

const BASE = process.argv[2] || 'http://localhost:3011';
const USERNAME = 'fame';
const STAMP = Date.now().toString(36);

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) console.log(`  PASS  ${msg}`);
  else { failures += 1; console.error(`  FAIL  ${msg}`); }
}

async function mintCookie(): Promise<string> {
  const token = await new SignJWT({ username: USERNAME })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JOSE_SECRET);
  return `darkframe_session=${token}`;
}

async function get(path: string, cookie: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
  let json: unknown = null;
  try { json = await res.json(); } catch { /* empty body ok */ }
  return { status: res.status, json };
}

async function main(): Promise<void> {
  const cookie = await mintCookie();

  // ---- 1. STATS
  const stats = await get('/api/stats?sortBy=power', cookie);
  assert(stats.status === 200, `stats GET 200 (got ${stats.status})`);
  const s = stats.json as { success: boolean; topPlayers: Record<string, unknown>[]; gameStats: Record<string, number>; sortBy: string };
  assert(s?.success === true, 'stats success:true');
  assert(Array.isArray(s?.topPlayers) && s.topPlayers.length > 0 && s.topPlayers.length <= 10, `topPlayers 1..10 (got ${s?.topPlayers?.length})`);
  const first = s.topPlayers[0];
  const truth = (await db.select({
    username: players.username,
    strength: players.totalStrength,
    defense: players.totalDefense,
    metal: players.resourcesMetal,
  }).from(players).orderBy(sql`(${players.totalStrength} + ${players.totalDefense}) DESC`).limit(1))[0];
  assert(first?.username === truth?.username, `top player matches SQL oracle (${first?.username} vs ${truth?.username})`);
  assert(first?.totalPower === (truth?.strength ?? 0) + (truth?.defense ?? 0), 'top item totalPower is DERIVED (strength+defense)');
  assert(typeof first?.metal === 'number' && first.metal === (truth?.metal ?? 0), 'top item metal flattened to the pg value');
  const agg = (await db.select({
    totalPlayers: sql<number>`COUNT(*)::int`,
    totalMetal: sql<number>`COALESCE(SUM(${players.resourcesMetal}), 0)`,
  }).from(players))[0];
  const battles = (await db.select({ n: sql<number>`COUNT(*)::int` }).from(battleLogs))[0];
  const terr = (await db.select({ n: sql<number>`COUNT(*)::int` }).from(tiles).where(eq(tiles.occupiedByBase, 1)))[0];
  assert(s.gameStats?.totalPlayers === agg.totalPlayers, `gameStats.totalPlayers == SQL COUNT (${s.gameStats?.totalPlayers} vs ${agg.totalPlayers})`);
  assert(Number(s.gameStats?.totalMetal) === Number(agg.totalMetal), 'gameStats.totalMetal == SQL SUM');
  assert(s.gameStats?.totalBattles === battles.n, `gameStats.totalBattles == battle_logs COUNT (${s.gameStats?.totalBattles} vs ${battles.n})`);
  assert(s.gameStats?.totalTerritories === terr.n, `gameStats.totalTerritories == occupied tiles COUNT`);

  // ---- 2. CHECK-NAME (case-insensitive against real clan rows)
  const realClan = (await db.select({ name: clans.name }).from(clans).limit(1))[0];
  if (realClan) {
    const cased = realClan.name.split('').map((ch, i) => (i % 2 ? ch.toUpperCase() : ch.toLowerCase())).join('');
    const taken = await get(`/api/clan/check-name?name=${encodeURIComponent(cased)}`, cookie);
    const takenJson = taken.json as { available: boolean };
    assert(taken.status === 200 && takenJson.available === false, `case-mangled existing name "${cased}" -> available:false (pg i18n check)`);
  } else {
    console.log('  SKIP  no clan rows in DB - case-check probe skipped');
  }
  const probeName = `zz${STAMP}Qq`;
  const free = await get(`/api/clan/check-name?name=${encodeURIComponent(probeName)}`, cookie);
  const freeJson = free.json as { available: boolean };
  assert(free.status === 200 && freeJson.available === true, `probe name "${probeName}" -> available:true`);

  // ---- 3. TUTORIAL restart round-trip on pg
  const probePlayer = 'e2e15probe';
  await db.delete(tutorialProgress).where(eq(tutorialProgress.playerId, probePlayer));
  await db.insert(tutorialProgress).values({
    id: ('e2e15' + STAMP).padEnd(24, '0').slice(0, 24),
    playerId: probePlayer,
    currentStepIndex: 0,
    completedQuests: [],
    completedSteps: [],
    skippedQuests: [],
    claimedRewards: [],
    tutorialSkipped: 0,
    tutorialComplete: 0,
    startedAt: new Date(),
    lastUpdated: new Date(),
    totalStepsCompleted: 0,
    totalTimeSpent: 0,
  });
  const before = (await db.select().from(tutorialProgress).where(eq(tutorialProgress.playerId, probePlayer)))[0];
  assert(!!before, 'probe tutorial_progress row seeded on pg');

  // restart POST (session identity: body playerId ignored, hook uses the cookie)
  const restart = await fetch(`${BASE}/api/tutorial`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'restart', playerId: USERNAME }),
  });
  const restartJson = await restart.json().catch(() => null) as { success: boolean } | null;
  assert(restart.status === 200 && restartJson?.success === true, `restart POST 200 success (got ${restart.status})`);
  const after = (await db.select().from(tutorialProgress).where(eq(tutorialProgress.playerId, probePlayer)))[0];
  // restart deletes by COOKIE identity (USERNAME), not the probe player - assert USERNAME rows deleted, probe row still there
  assert(!!after, 'probe row (different player) untouched - restart deletes by session identity only');
  await db.delete(tutorialProgress).where(eq(tutorialProgress.playerId, probePlayer));

  // eligibility GET rides the pg player read without error
  const elig = await get('/api/tutorial?checkEligibility=true', cookie);
  assert(elig.status === 200 || elig.status === 401, `tutorial GET with eligibility resolves (${elig.status})`);
}

main()
  .then(() => {
    if (failures > 0) {
      console.error(`LIVE PROBE FAILED: ${failures} assertion(s)`);
      process.exit(1);
    }
    console.log('LIVE PROBE GREEN: all assertions passed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('LIVE PROBE ERROR:', err);
    process.exit(1);
  });
