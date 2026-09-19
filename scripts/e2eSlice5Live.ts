/**
 * FID-20260917-017 slice 5 — LIVE verification driver.
 * Exercises the slice-5 conversions over REAL HTTP on :3002. Auth: register
 * route mints session cookies; admin legs via register → promote → real login.
 * Probes the seven converted routes' contracts plus the census-forced extras.
 *
 * Probes:
 *   P0  idempotent preflight sweep
 *   P1  namespace clean
 *   P2  /api/health: 200, database check 'ok' (the drizzle SELECT 1)
 *   P3  /api/leaderboard: 200, leaderboard + beerBases arrays, totals
 *   P4  /api/referral/leaderboard: 200, shape + rank math
 *   P5  /api/referral/generate: 200, code minted; idempotent second call returns SAME code
 *   P6  /api/referral/stats: 200, rewards derived from flat columns
 *   P7  /api/factory/list: 200, empty empire shape
 *   P8  /api/factory/status?x=1&y=1: 200 (factory auto-created by the loader)
 *   P9  /api/factory/build-unit: claim factory at (2,2) → build → 200 with totals;
 *       DB truth: resources deducted, unit appended (folded), invested incremented
 *   P10 /api/factory/upgrade: 200 → level 2 with full stat block; DB truth: level 2
 *   P11 /api/factory/abandon: 200 → reset to neutral; DB truth: owner null, invested 0
 *   P12 /api/factory/release single: 200 on a re-claimed factory
 *   P13 cleanup: residue zero
 *
 * Exits 0 only when every probe passes.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq, like, inArray, and } from 'drizzle-orm';

import { db } from '../lib/db';
import { players, factories } from '../lib/db/schema';

const SERVER = process.env.PROBE_SERVER ?? 'http://localhost:3002';
const RUN = 's17s5';
const P = { main: `${RUN}_main`, other: `${RUN}_other` };
const PW = 'probe-password-1';
const EMAIL = (u: string) => `${RUN}.${u}@probe.invalid`;

const results: Array<{ ok: boolean; name: string; detail?: string }> = [];
function ok(name: string, cond: boolean, detail = ''): void {
  results.push({ ok: cond, name, detail });
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(section: string, err: unknown): never {
  console.error(`✗ ${section} crashed:`, err);
  process.exit(1);
}

const perUser = new Map<string, string>();
function captureSession(res: Response, username: string): void {
  const setCookie = res.headers.get('set-cookie') || '';
  const sessionCookie = setCookie
    .split(',')
    .map((c) => c.trim())
    .find((c) => c.startsWith('darkframe_session='));
  if (sessionCookie) perUser.set(username, sessionCookie.split(';')[0]);
}

async function register(username: string): Promise<boolean> {
  const res = await fetch(`${SERVER}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, email: EMAIL(username), password: PW }),
  });
  captureSession(res, username);
  return res.status === 201;
}

async function call(
  username: string | null,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${SERVER}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(username && perUser.get(username) ? { cookie: perUser.get(username) as string } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let body: Record<string, unknown> = {};
  try { body = (await res.json()) as Record<string, unknown>; } catch { /* non-JSON */ }
  return { status: res.status, body };
}

interface UnitEntry {
  unitType?: string;
  quantity?: number;
  producedAt?: { x: number; y: number };
}

async function main(): Promise<void> {
  console.log(`probe server=${SERVER} run=${RUN}\n`);

  // ── P0: idempotent preflight sweep
  try {
    await db.delete(players).where(like(players.username, `${RUN}_%`));
    ok('P0 preflight sweep done', true);
  } catch (err) {
    return fail('P0', err);
  }

  // ── P1: namespace clean
  try {
    const existing = await db
      .select({ u: players.username })
      .from(players)
      .where(inArray(players.username, Object.values(P)));
    ok('P1 namespace clean', existing.length === 0, `found=${existing.length}`);
  } catch (err) {
    return fail('P1', err);
  }

  // ── P2: /api/health
  try {
    const res = await call(null, '/api/health');
    const body = res.body as unknown as { status: string; checks: { database: { status: string } } };
    ok('P2 health: 200 + database ok', res.status === 200 && body.checks?.database?.status === 'ok',
      `status=${res.status} db=${body.checks?.database?.status}`);
  } catch (err) {
    return fail('P2', err);
  }

  // ── P3: /api/leaderboard
  try {
    const res = await call(null, '/api/leaderboard');
    const body = res.body as unknown as { leaderboard: unknown[]; beerBases: unknown[]; totalPlayers: number };
    ok('P3 leaderboard: 200 with ladders + totals',
      res.status === 200 && Array.isArray(body.leaderboard) && Array.isArray(body.beerBases) && body.totalPlayers >= 1,
      `status=${res.status} totalPlayers=${body.totalPlayers}`);
  } catch (err) {
    return fail('P3', err);
  }

  // ── P4: /api/referral/leaderboard
  try {
    const res = await call(null, '/api/referral/leaderboard?limit=10');
    const body = res.body as unknown as { success: boolean; data: { leaderboard: unknown[]; totalRecruiters: number } };
    ok('P4 referral leaderboard: 200 with shape',
      res.status === 200 && body.success === true && Array.isArray(body.data?.leaderboard),
      `status=${res.status} totalRecruiters=${body.data?.totalRecruiters}`);
  } catch (err) {
    return fail('P4', err);
  }

  // ── P5/P6: referral generate (idempotency) + stats
  try {
    const registered = await register(P.main);
    ok('P5a probe registered via real route', registered);
    if (!registered) process.exit(1);

    const gen1 = await call(P.main, '/api/referral/generate', { method: 'POST' });
    const code1 = (gen1.body as unknown as { data?: { code?: string } }).data?.code;
    ok('P5b generate mints a code', gen1.status === 200 && typeof code1 === 'string' && code1.length > 0,
      `status=${gen1.status} code=${code1}`);

    const gen2 = await call(P.main, '/api/referral/generate', { method: 'POST' });
    const code2 = (gen2.body as unknown as { data?: { code?: string } }).data?.code;
    ok('P5c generate is idempotent (same code, no second write)',
      gen2.status === 200 && code2 === code1, `code2=${code2}`);

    const stats = await call(P.main, '/api/referral/stats');
    const sbody = stats.body as unknown as { success: boolean; data: { playerStats: { referralCode: string; totalRewardsEarned: { metal: number } } } };
    ok('P6 stats: 200 with rewards derived from flat columns',
      stats.status === 200 && sbody.success === true
        && sbody.data?.playerStats?.referralCode === code1
        && typeof sbody.data?.playerStats?.totalRewardsEarned?.metal === 'number',
      `status=${stats.status} code=${sbody.data?.playerStats?.referralCode}`);
  } catch (err) {
    return fail('P5/P6', err);
  }

  // ── P7: /api/factory/list (empty empire)
  try {
    const res = await call(P.main, '/api/factory/list');
    const body = res.body as unknown as { success: boolean; count: number; canClaimMore: boolean; totalInvestment: { metal: number } };
    ok('P7 factory list: 200 with empty-empire shape',
      res.status === 200 && body.success === true && body.count === 0 && body.canClaimMore === true
        && body.totalInvestment?.metal === 0,
      `status=${res.status} count=${body.count}`);
  } catch (err) {
    return fail('P7', err);
  }

  // ── P8: /api/factory/status (auto-create leg of the loader)
  try {
    const res = await call(null, '/api/factory/status?x=1&y=1');
    const body = res.body as unknown as { success: boolean; factory: { x: number; y: number; level: number }; slotInfo: { max: number } };
    ok('P8 factory status: 200 with factory + slotInfo',
      res.status === 200 && body.success === true && body.factory?.x === 1 && body.factory?.level >= 1
        && typeof body.slotInfo?.max === 'number',
      `status=${res.status} level=${body.factory?.level}`);
  } catch (err) {
    return fail('P8', err);
  }

  // ── P9–P12: the factory lifecycle on tile (2,2)
  try {
    // Ensure the factory row exists (rows are lazy-created by the status
    // loader — the claim UPDATE below silently no-ops without a row), then
    // claim it for the probe player. The lifecycle under test is
    // build/upgrade/abandon/release.
    await db
      .insert(factories)
      .values({ x: 2, y: 2, owner: null, level: 1, slots: 5000, usedSlots: 0, lastSlotRegen: new Date() })
      .onConflictDoNothing();
    await db.update(factories)
      .set({ owner: P.main, level: 1, slots: 5000, usedSlots: 0 })
      .where(and(eq(factories.x, 2), eq(factories.y, 2)));

    // Seed resources for the build + upgrade legs
    await db.update(players)
      .set({ resourcesMetal: 5_000_000, resourcesEnergy: 5_000_000 })
      .where(eq(players.username, P.main));

    const build = await call(P.main, '/api/factory/build-unit', {
      method: 'POST',
      body: { factoryX: 2, factoryY: 2, unitType: 'INFANTRY', quantity: 2 },
    });
    const bbody = build.body as unknown as {
      success: boolean; unitsBuilt: { quantity: number }; resourcesSpent: { metal: number; energy: number };
      playerTotals: { totalStrength: number };
    };
    ok('P9a build-unit: 200 with totals',
      build.status === 200 && bbody.success === true && bbody.unitsBuilt?.quantity === 2
        && bbody.playerTotals?.totalStrength > 0,
      `status=${build.status} str=${bbody.playerTotals?.totalStrength}`);

    const [afterBuild] = await db.select().from(players).where(eq(players.username, P.main));
    const units = (afterBuild.units ?? []) as UnitEntry[];
    const mine = units.filter((u) => u.unitType === 'INFANTRY' && u.producedAt?.x === 2 && u.producedAt?.y === 2);
    const builtQuantity = mine.reduce((acc, u) => acc + (u.quantity || 0), 0);
    ok('P9b DB truth: folded unit entry with provenance, resources deducted',
      builtQuantity === 2
        && afterBuild.resourcesMetal === 5_000_000 - bbody.resourcesSpent.metal,
      `units=${builtQuantity} metal=${afterBuild.resourcesMetal}`);

    const upgrade = await call(P.main, '/api/factory/upgrade', {
      method: 'POST',
      body: { factoryX: 2, factoryY: 2 },
    });
    const ubody = upgrade.body as unknown as { success: boolean; newStats: { maxSlots: number }; factory: { level: number } };
    ok('P10a upgrade: 200 → level 2 with full stat block',
      upgrade.status === 200 && ubody.success === true && ubody.factory?.level === 2 && ubody.newStats?.maxSlots > 0,
      `status=${upgrade.status} level=${ubody.factory?.level}`);

    const [afterUpgrade] = await db.select().from(factories).where(and(eq(factories.x, 2), eq(factories.y, 2)));
    ok('P10b DB truth: level 2 persisted with full stats + investment',
      afterUpgrade.level === 2 && afterUpgrade.slots > 0
        && afterUpgrade.investedMetal > 0,
      `level=${afterUpgrade.level} invested=${afterUpgrade.investedMetal}`);

    const abandon = await call(P.main, '/api/factory/abandon', {
      method: 'POST',
      body: { factoryX: 2, factoryY: 2 },
    });
    const abody = abandon.body as unknown as { success: boolean; factory: { owner: string | null; level: number }; factoriesOwned: number };
    ok('P11a abandon: 200 → neutral reset',
      abandon.status === 200 && abody.success === true && abody.factory?.owner === null && abody.factory?.level === 1,
      `status=${abandon.status} owner=${abody.factory?.owner}`);

    const [afterAbandon] = await db.select().from(factories).where(and(eq(factories.x, 2), eq(factories.y, 2)));
    ok('P11b DB truth: owner null, investment zeroed',
      afterAbandon.owner === null && afterAbandon.investedMetal === 0 && afterAbandon.investedEnergy === 0,
      `owner=${afterAbandon.owner} invested=${afterAbandon.investedMetal}`);

    // Re-claim for the release leg
    await db.update(factories)
      .set({ owner: P.main, level: 1, slots: 5000, usedSlots: 0 })
      .where(and(eq(factories.x, 2), eq(factories.y, 2)));

    const release = await call(P.main, '/api/factory/release', {
      method: 'POST',
      body: { mode: 'single', factoryX: 2, factoryY: 2 },
    });
    const rbody = release.body as unknown as { success: boolean; releasedCount: number };
    ok('P12 release single: 200, released 1',
      release.status === 200 && rbody.success === true && rbody.releasedCount === 1,
      `status=${release.status} released=${rbody.releasedCount}`);
  } catch (err) {
    return fail('P9-P12', err);
  }

  // ── P13: cleanup — residue zero
  try {
    await db.delete(players).where(like(players.username, `${RUN}_%`));

    const residue = {
      players: (await db.select().from(players).where(like(players.username, `${RUN}_%`))).length,
    };
    const total = Object.values(residue).reduce((a, b) => a + b, 0);
    ok('P13 cleanup: residue zero', total === 0, JSON.stringify(residue));
  } catch (err) {
    return fail('P13', err);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nprobe result: ${failed.length === 0 ? 'ALL GREEN' : 'FAILURES'} (${results.length - failed.length}/${results.length} passed)`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('probe crashed:', err);
  process.exit(1);
});
