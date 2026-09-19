/**
 * FID-20260917-017 slice 4 — LIVE verification driver.
 * Exercises the seven converted routes over REAL HTTP on :3002 (booted from
 * known env this session). Auth: register route mints session cookies;
 * the admin probe is registered, promoted (isAdmin=1) directly in the DB,
 * then logs in through the REAL login route (which re-mints the token with
 * the admin claim). No token minting, no secret reconstruction.
 *
 * Probes:
 *   P0  idempotent preflight sweep
 *   P1  namespace clean
 *   P2  shrine/activate (HTTP, session cookie): seed position (1,1) + two
 *       COMMON items → POST → 200, durationMinutes=30; DB row: shrineBoosts
 *       carries spade with a future expiry, inventory emptied
 *   P3  clan/leaderboard: probe clan ranked by level (rowToClan shape) and by
 *       power (member-sum subquery = probe's totalStrength)
 *   P4  admin probe: register → promote → real login mints admin session
 *   P5  admin/active-sessions: seeded open session appears with live duration
 *   P6  admin/achievement-stats: 15-entry catalog + bot-free player count
 *   P7  admin/bot-factory-economy: 200 with factories summary
 *   P8  auction/my-bids: seeded auction doc with probe bid → myBid + isWinning
 *   P9  cleanup: residue zero
 *
 * Exits 0 only when every probe passes.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq, inArray, like } from 'drizzle-orm';

import { db } from '../lib/db';
import { players, clans, playerSessions, auctions } from '../lib/db/schema';

const SERVER = process.env.PROBE_SERVER ?? 'http://localhost:3002';
const RUN = 's17s4';
const P = { shrine: `${RUN}_shrine`, admin: `${RUN}_admin`, bidder: `${RUN}_bidder` };
const CLAN_ID = `${RUN}_clan`;
const AUCTION_ID = `${RUN}_auc`;
const SESSION_ID = `${RUN}_sess`;
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

interface LeaderboardBody {
  leaderboard?: Array<{
    rank: number;
    clan: { _id?: string; name: string; level: { currentLevel: number } };
    value: number;
  }>;
}

function castBody<T>(body: Record<string, unknown>): T {
  return body as unknown as T;
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

async function login(username: string): Promise<boolean> {
  const res = await fetch(`${SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL(username), password: PW }),
  });
  captureSession(res, username);
  return res.status === 200;
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

function probeClanRow() {
  return {
    id: CLAN_ID,
    name: `${RUN} Clan`,
    tag: 'S17S4',
    description: 'slice-4 live probe clan',
    leaderId: P.shrine,
    members: [
      { playerId: P.shrine, username: P.shrine, role: 'LEADER', joinedAt: new Date(), lastActive: new Date() },
    ],
    levelCurrentLevel: 9,
    createdAt: new Date(),
  } as never;
}

function probeItem(id: string) {
  return {
    id, type: 'TRADEABLE_ITEM', name: `Item ${id}`, rarity: 'COMMON',
    bonusPercent: 0, foundAt: { x: 1, y: 1 }, foundDate: new Date(),
  };
}

async function main(): Promise<void> {
  console.log(`probe server=${SERVER} run=${RUN}\n`);

  // ── P0: idempotent preflight sweep
  try {
    await db.delete(playerSessions).where(like(playerSessions.userId, `${RUN}_%`));
    await db.delete(auctions).where(like(auctions.id, `${RUN}%`));
    await db.delete(clans).where(like(clans.id, `${RUN}_%`));
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

  // ── P2: shrine/activate over HTTP
  try {
    const registered = await register(P.shrine);
    ok('P2a probe registered via real route', registered);
    if (!registered) process.exit(1);

    // Position at the shrine (1,1) and seed two COMMON tradeables.
    await db.update(players)
      .set({
        currentPositionX: 1, currentPositionY: 1,
        inventoryItems: [probeItem('i1'), probeItem('i2')] as never,
        totalStrength: 777,
        clanId: CLAN_ID,
      })
      .where(eq(players.username, P.shrine));

    const res = await call(P.shrine, '/api/shrine/activate', { method: 'POST', body: { tier: 'spade', itemCount: 2 } });
    const body = res.body as unknown as { success: boolean; itemsConsumed: number; durationMinutes: number };
    ok('P2b activate 200 (30 min from 2 COMMON)', res.status === 200 && body.success === true && body.durationMinutes === 30,
      `status=${res.status} body=${JSON.stringify(body).slice(0, 100)}`);

    const [row] = await db.select().from(players).where(eq(players.username, P.shrine));
    const boosts = (row.shrineBoosts ?? []) as Array<{ tier: string; expiresAt: Date; yieldBonus: number }>;
    ok('P2c boost persisted with future expiry + yieldBonus',
      boosts.length === 1 && boosts[0].tier === 'spade' && boosts[0].yieldBonus === 0.25
        && new Date(boosts[0].expiresAt).getTime() > Date.now(),
      `boosts=${JSON.stringify(boosts).slice(0, 100)}`);
    ok('P2d inventory consumed', (row.inventoryItems ?? []).length === 0,
      `items=${(row.inventoryItems ?? []).length}`);

    // Insufficient-items refusal (real HTTP path)
    const poor = await call(P.shrine, '/api/shrine/activate', { method: 'POST', body: { tier: 'heart', itemCount: 5 } });
    ok('P2e insufficient items refused (400)', poor.status === 400, `status=${poor.status}`);
  } catch (err) {
    return fail('P2', err);
  }

  // ── P3: clan/leaderboard (level + power categories, domain shape)
  try {
    await db.insert(clans).values(probeClanRow());
    const byLevel = await call(null, `/api/clan/leaderboard?category=level&limit=50`);
    const lb = castBody<LeaderboardBody>(byLevel.body).leaderboard ?? [];
    const mine = lb.find((e) => e.clan._id === CLAN_ID);
    ok('P3a level category ranks probe clan with mapped shape',
      byLevel.status === 200 && Boolean(mine) && mine?.clan.level.currentLevel === 9 && mine?.value === 9,
      `status=${byLevel.status} mine=${JSON.stringify(mine ?? null).slice(0, 120)}`);

    const byPower = await call(null, `/api/clan/leaderboard?category=power&limit=50`);
    const lbP = castBody<LeaderboardBody>(byPower.body).leaderboard ?? [];
    const mineP = lbP.find((e) => e.clan._id === CLAN_ID);
    ok('P3b power category sums live member strength (subquery)',
      mineP?.value === 777, `value=${mineP?.value}`);
  } catch (err) {
    return fail('P3', err);
  }

  // ── P4: admin probe via real register → promote → login
  try {
    const registered = await register(P.admin);
    ok('P4a admin probe registered', registered);
    await db.update(players).set({ isAdmin: 1 }).where(eq(players.username, P.admin));
    const loggedIn = await login(P.admin);
    ok('P4b real login mints admin session', loggedIn && Boolean(perUser.get(P.admin)),
      `login=${loggedIn} cookie=${Boolean(perUser.get(P.admin))}`);
    if (!loggedIn) process.exit(1);
  } catch (err) {
    return fail('P4', err);
  }

  // ── P5: admin/active-sessions with a seeded open session
  try {
    await db.insert(playerSessions).values({
      id: SESSION_ID, userId: P.admin, token: 'probe-token',
      expiresAt: new Date(Date.now() + 3_600_000), createdAt: new Date(),
      sessionId: SESSION_ID, startTime: new Date(Date.now() - 60_000),
      actionsCount: 3,
    } as never);
    const res = await call(P.admin, '/api/admin/active-sessions');
    const body = res.body as unknown as {
      success: boolean; totalActive: number; totalActions: number;
      sessions: Array<{ userId: string; currentDuration: number; sessionId?: string }>;
    };
    const mine = body.sessions?.find((s) => (s as { sessionId?: string }).sessionId === SESSION_ID);
    const mineOk = Boolean(mine) && (mine?.currentDuration ?? -1) >= 55 && (mine?.currentDuration ?? -1) <= 90;
    ok('P5 seeded open session listed with live duration',
      res.status === 200 && body.success === true && mineOk && body.totalActions >= 3,
      `status=${res.status} mine=${JSON.stringify(mine ?? null).slice(0, 100)}`);
  } catch (err) {
    return fail('P5', err);
  }

  // ── P6: admin/achievement-stats
  try {
    const res = await call(P.admin, '/api/admin/achievement-stats');
    const body = res.body as unknown as { success: boolean; totalPlayers: number; achievements: Array<unknown> };
    ok('P6 catalog + player count served',
      res.status === 200 && body.success === true && body.achievements.length === 15 && body.totalPlayers >= 1,
      `status=${res.status} totalPlayers=${body.totalPlayers} entries=${body.achievements?.length}`);
  } catch (err) {
    return fail('P6', err);
  }

  // ── P7: admin/bot-factory-economy
  try {
    const res = await call(P.admin, '/api/admin/bot-factory-economy');
    const body = res.body as unknown as { success: boolean; data: { factories: { total: number } } };
    ok('P7 economy panel assembled',
      res.status === 200 && body.success === true && typeof body.data?.factories?.total === 'number',
      `status=${res.status} total=${body.data?.factories?.total}`);
  } catch (err) {
    return fail('P7', err);
  }

  // ── P8: auction/my-bids (doc-bridge round trip)
  try {
    const registered = await register(P.bidder);
    ok('P8a bidder registered', registered);
    await db.insert(auctions).values({
      id: AUCTION_ID,
      sellerId: P.shrine,
      itemData: { name: 'Probe Relic' },
      startingPrice: 10,
      expiresAt: new Date(Date.now() + 86_400_000),
      status: 'active',
      createdAt: new Date(),
      doc: {
        auctionId: AUCTION_ID,
        item: { name: 'Probe Relic' },
        sellerUsername: P.shrine,
        startingBid: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        highestBidder: 'someone_else',
        bids: [
          { bidderUsername: P.bidder, bidAmount: 42, bidTime: new Date(Date.now() - 60_000).toISOString() },
          { bidderUsername: 'someone_else', bidAmount: 99, bidTime: new Date().toISOString() },
        ],
      },
    } as never);
    const res = await call(P.bidder, '/api/auction/my-bids');
    const body = res.body as unknown as {
      success: boolean; totalCount: number;
      bids: Array<{ myBid: { bidAmount: number }; isWinning: boolean; auction: { auctionId?: string } }>;
    };
    ok('P8b containment match + myBid + isWinning=false',
      res.status === 200 && body.totalCount === 1 && body.bids?.[0]?.myBid?.bidAmount === 42
        && body.bids?.[0]?.isWinning === false,
      `status=${res.status} body=${JSON.stringify(body).slice(0, 160)}`);
  } catch (err) {
    return fail('P8', err);
  }

  // ── P9: cleanup — residue zero
  try {
    await db.delete(playerSessions).where(like(playerSessions.userId, `${RUN}_%`));
    await db.delete(auctions).where(like(auctions.id, `${RUN}%`));
    await db.delete(clans).where(eq(clans.id, CLAN_ID));
    await db.delete(players).where(like(players.username, `${RUN}_%`));

    const residue = {
      players: (await db.select().from(players).where(like(players.username, `${RUN}_%`))).length,
      sessions: (await db.select().from(playerSessions).where(like(playerSessions.userId, `${RUN}_%`))).length,
      auctions: (await db.select().from(auctions).where(like(auctions.id, `${RUN}%`))).length,
      clans: (await db.select().from(clans).where(eq(clans.id, CLAN_ID))).length,
    };
    const total = Object.values(residue).reduce((a, b) => a + b, 0);
    ok('P9 cleanup: residue zero', total === 0, JSON.stringify(residue));
  } catch (err) {
    return fail('P9', err);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nprobe result: ${failed.length === 0 ? 'ALL GREEN' : 'FAILURES'} (${results.length - failed.length}/${results.length} passed)`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('probe crashed:', err);
  process.exit(1);
});
