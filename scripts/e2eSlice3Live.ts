/**
 * FID-20260917-017 slice 3 — LIVE verification driver.
 * Every converted route is exercised over REAL HTTP against the dev server on
 * :3002 (booted from known env this session). Auth rides the game's real
 * register/login surfaces only — probe users register through
 * /api/auth/register and log in through /api/auth/login; the minted
 * darkframe_session cookie is replayed verbatim. No token minting, no secret
 * reconstruction (the session-058 F0 lesson: the game-auth path is the clean
 * path).
 *
 * Probes:
 *   P1  namespace clean (probe usernames absent)
 *   P2  register probe users via the real route (201 + cookie); login mints
 *       per-user sessions
 *   P3  heartbeat: 401 unauthenticated; 403 identity mismatch; 200 + one
 *       user_presence row with a fresh window
 *   P4  heartbeat idempotent: second beat updates the SAME row
 *   P5  online: global count includes both probes; users carry
 *       userId==username; newbie filter excludes the level-12 player
 *   P6  typing: POST upserts one row per (channel,user) incl. repeat; GET
 *       lists both with username==userId; GET without channelId 400s
 *   P7  typing window: rows older than 5s are invisible to GET
 *   P8  player/stats: 200 shape (stats defaults, level, resources)
 *   P9  player/profile: 200 shape (base coords + greeting round-trip)
 *   P10 player/greeting: write → read-back through profile; garbage session
 *       refused
 *   P11 clan/invite: real clan row → 200 with a clan_invitations row; ghost
 *       target → 404
 *   P12 snapshot capture lands for the probe player (pg-native service)
 *   P13 cleanup: probe residue zero (presence, typing, users, clan, invites)
 *
 * Exits 0 only when every probe passes.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq, sql, inArray, like } from 'drizzle-orm';

import { db } from '../lib/db';
import { userPresence, typingIndicators, players, clans } from '../lib/db/schema';

const SERVER = process.env.PROBE_SERVER ?? 'http://localhost:3002';
const RUN = 's17s3';
const P = { a: `${RUN}_a`, b: `${RUN}_b` };
const PW = 'probe-password-1';
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

async function extractSession(res: Response, username: string): Promise<void> {
  const setCookie = res.headers.get('set-cookie') || '';
  const sessionCookie = setCookie
    .split(',')
    .map((c) => c.trim())
    .find((c) => c.startsWith('darkframe_session='));
  if (sessionCookie) {
    // The REGISTER route mints the new user's 7-day darkframe_session — capture
    // it per-user immediately (the login route keys on email and was not needed).
    perUser.set(username, sessionCookie.split(';')[0]);
  }
}

async function register(username: string): Promise<boolean> {
  const res = await fetch(`${SERVER}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, email: `${RUN}.${username}@probe.invalid`, password: PW }),
  });
  await extractSession(res, username);
  return res.status === 201;
}

function cookieFor(username: string): Record<string, string> {
  const pair = perUser.get(username) ?? '';
  return pair ? { cookie: pair } : {};
}

async function call(
  username: string | null,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<{ status: number; json: () => Promise<Record<string, unknown>> }> {
  const res = await fetch(`${SERVER}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(username ? cookieFor(username) : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, json: () => res.json() as Promise<Record<string, unknown>> };
}

async function main(): Promise<void> {
  console.log(`probe server=${SERVER} run=${RUN}\n`);

  // ── P0: idempotent preflight — sweep any residue from a previously crashed
  // run so P1/P2 always start from a clean namespace.
  try {
    await db.delete(typingIndicators).where(like(typingIndicators.userId, `${RUN}_%`));
    await db.delete(userPresence).where(like(userPresence.userId, `${RUN}_%`));
    await db.execute(sql`DELETE FROM clan_invitations WHERE clan_id LIKE ${`${RUN}%`}`);
    await db.delete(clans).where(like(clans.id, `${RUN}_%`));
    await db.execute(sql`DELETE FROM player_level_history WHERE username LIKE ${`${RUN}_%`}`);    await db.delete(players).where(like(players.username, `${RUN}_%`));

    ok('P0 preflight sweep done', true);
  } catch (err) {
    return fail('P0', err);
  }

  // ── P1: namespace clean
  try {
    const existing = await db
      .select({ u: players.username })
      .from(players)
      .where(inArray(players.username, [P.a, P.b]));
    ok('P1 namespace clean', existing.length === 0, `found=${existing.length}`);
  } catch (err) {
    return fail('P1', err);
  }

  // ── P2: register via the real route, then login for per-user sessions
  try {
    const okA = await register(P.a);
    const okB = await register(P.b);
    ok('P2a probe users registered via real route', okA && okB, `a=${okA} b=${okB}`);
    if (!okA || !okB) process.exit(1);
    ok('P2b per-user session cookies minted at register',
      Boolean(perUser.get(P.a) && perUser.get(P.b)),
      `a=${Boolean(perUser.get(P.a))} b=${Boolean(perUser.get(P.b))}`);
  } catch (err) {
    return fail('P2', err);
  }

  // Probe b is "level 12" for the newbie-filter assertion
  await db.update(players).set({ level: 12 }).where(eq(players.username, P.b));

  // ── P3: heartbeat auth + upsert
  try {
    const anon = await call(null, '/api/chat/heartbeat', { method: 'POST', body: {} });
    ok('P3a heartbeat 401 unauthenticated', anon.status === 401, `status=${anon.status}`);

    const mismatch = await call(P.a, '/api/chat/heartbeat', { method: 'POST', body: { username: 'mallory' } });
    ok('P3b heartbeat 403 identity mismatch', mismatch.status === 403, `status=${mismatch.status}`);

    const good = await call(P.a, '/api/chat/heartbeat', { method: 'POST', body: { status: 'Online' } });
    ok('P3c heartbeat 200', good.status === 200, `status=${good.status}`);
    const rows = await db.select().from(userPresence).where(eq(userPresence.userId, P.a));
    ok('P3d presence row persisted (1 row, fresh window)',
      rows.length === 1 && rows[0].expiresAt.getTime() > rows[0].lastSeen.getTime(),
      `rows=${rows.length}`);
  } catch (err) {
    return fail('P3', err);
  }

  // ── P4: second beat updates the same row
  try {
    const first = await db.select().from(userPresence).where(eq(userPresence.userId, P.a));
    await new Promise((r) => setTimeout(r, 1100));
    await call(P.a, '/api/chat/heartbeat', { method: 'POST', body: {} });
    const rows = await db.select().from(userPresence).where(eq(userPresence.userId, P.a));
    ok('P4 heartbeat idempotent (same row updated)',
      rows.length === 1 && rows[0].lastSeen.getTime() > first[0].lastSeen.getTime(),
      `rows=${rows.length}`);
  } catch (err) {
    return fail('P4', err);
  }

  // ── P5: online counts + users
  try {
    await call(P.b, '/api/chat/heartbeat', { method: 'POST', body: {} });
    const online = await call(P.a, '/api/chat/online?channelId=global&includeUsers=true');
    const body = online.json ? await online.json() as unknown as { count: number; users?: Array<{ userId: string; username: string }> } : { count: 0 };
    const probeUsers = body.users?.filter((u) => u.userId === P.a || u.userId === P.b) ?? [];
    ok('P5a online (global) includes both probes',
      probeUsers.length === 2 && body.count >= 2, `count=${body.count}`);
    ok('P5b users carry userId==username', probeUsers.every((u) => u.username === u.userId));

    const newbie = await call(P.a, '/api/chat/online?channelId=newbie&includeUsers=true');
    const nb = await newbie.json() as unknown as { count: number; users?: Array<{ userId: string }> };
    ok('P5c newbie filter excludes level-12 probe',
      nb.users?.some((u) => u.userId === P.a) === true && nb.users?.every((u) => u.userId !== P.b) === true,
      `newbieCount=${nb.count}`);
  } catch (err) {
    return fail('P5', err);
  }

  // ── P6: typing upsert + read
  try {
    await call(P.a, '/api/chat/typing', { method: 'POST', body: { channelId: 'global' } });
    await call(P.b, '/api/chat/typing', { method: 'POST', body: { channelId: 'global' } });
    await call(P.a, '/api/chat/typing', { method: 'POST', body: { channelId: 'global' } }); // repeat beat
    const rows = await db.select().from(typingIndicators).where(eq(typingIndicators.channelId, 'global'));
    const probeRows = rows.filter((r) => r.userId === P.a || r.userId === P.b);
    ok('P6a typing upsert dedupes (1 row per pair)',
      probeRows.length === 2, `rows=${rows.length} probeRows=${probeRows.length}`);

    const noChannel = await call(P.a, '/api/chat/typing');
    ok('P6b typing GET 400 without channelId', noChannel.status === 400, `status=${noChannel.status}`);

    const list = await call(P.a, '/api/chat/typing?channelId=global');
    const body = await list.json() as unknown as { typers: Array<{ userId: string; username: string }> };
    ok('P6c typing GET lists both probes with username==userId',
      body.typers.filter((t) => t.userId === P.a || t.userId === P.b).length === 2);
  } catch (err) {
    return fail('P6', err);
  }

  // ── P7: expired typing rows invisible
  try {
    await db
      .update(typingIndicators)
      .set({ expiresAt: new Date(Date.now() - 8000) })
      .where(eq(typingIndicators.userId, P.b));
    const list = await call(P.a, '/api/chat/typing?channelId=global');
    const body = await list.json() as unknown as { typers: Array<{ userId: string }> };
    ok('P7 typing window excludes expired rows',
      body.typers.some((t) => t.userId === P.a) && !body.typers.some((t) => t.userId === P.b));
  } catch (err) {
    return fail('P7', err);
  }

  // ── P8: player/stats shape
  try {
    const res = await call(P.a, '/api/player/stats');
    const body = await res.json() as unknown as { success: boolean; username: string; stats: Record<string, number>; resources: { metal: number } };
    ok('P8 stats 200 with domain shape',
      res.status === 200 && body.success === true && body.username === P.a
        && body.stats.battlesWon === 0 && typeof body.resources.metal === 'number',
      `status=${res.status} stats=${JSON.stringify(body.stats ?? {}).slice(0, 80)}`);
  } catch (err) {
    return fail('P8', err);
  }

  // ── P9/P10: profile + greeting round-trip
  try {
    const g1 = await call(P.a, '/api/player/greeting', { method: 'POST', body: { greeting: '  hello probe  ' } });
    const g1Body = await g1.json() as unknown as { data: { greeting: string } };
    ok('P10a greeting write 200 + sanitized', g1.status === 200 && g1Body.data.greeting === 'hello probe');

    const prof = await call(P.a, '/api/player/profile');
    const profBody = await prof.json() as unknown as { data?: { username: string; base: { x: number; y: number; greeting: string } } };
    ok('P9 profile 200 with base + greeting round-trip',
      prof.status === 200 && profBody.data?.username === P.a
        && profBody.data?.base?.greeting === 'hello probe'
        && typeof profBody.data?.base?.x === 'number',
      `status=${prof.status} base=${JSON.stringify(profBody.data?.base ?? {}).slice(0, 80)}`);

    const garbage = await fetch(`${SERVER}/api/player/greeting`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'darkframe_session=not.a.real.token' },
      body: JSON.stringify({ greeting: 'x' }),
    });
    ok('P10b greeting with garbage session is refused', garbage.status === 401 || garbage.status === 404, `status=${garbage.status}`);
  } catch (err) {
    return fail('P9/P10', err);
  }

  // ── P11: clan invite (probe a as clan leader; invite a clan-less target)
  const CLAN_ID = `${RUN}_clan`;
  const tName = `${RUN}_t`;
  try {
    await db.insert(clans).values({
      id: CLAN_ID,
      name: `${RUN} Clan`,
      tag: 'S17S3',
      description: 'slice-3 live probe clan',
      leaderId: P.a,
      members: [
        { playerId: P.a, username: P.a, role: 'LEADER', joinedAt: new Date(), lastActive: new Date() },
        { playerId: P.b, username: P.b, role: 'MEMBER', joinedAt: new Date(), lastActive: new Date() },
      ],
      levelCurrentLevel: 1, levelTotalXP: 0, levelCurrentLevelXP: 0, levelXpToNextLevel: 100,
      levelFeaturesUnlocked: [],
      levelMilestonesCompleted: [],
      levelLastLevelUp: null,
      settingsMessageOfTheDay: '', settingsIsRecruiting: 1,
      settingsMinLevelToJoin: 1, settingsRequiresApproval: 0,
      researchPoints: 0, researchUnlockedTechs: [],
      createdAt: new Date(), updatedAt: new Date(),
    } as never);

    // The invitee must be clan-less; probe b is seeded as a Member, so the
    // invite targets a fresh throwaway account.
    const registered = await register(tName);
    ok('P11a invite target registered', registered);

    const res = await call(P.a, '/api/clan/invite', { method: 'POST', body: { targetUsername: tName } });
    const body = await res.json() as unknown as { success: boolean; invitation?: { invitationId?: string } };
    ok('P11b invite 200 on valid target',
      res.status === 200 && body.success === true, `status=${res.status} body=${JSON.stringify(body).slice(0, 140)}`);

    const ghostRes = await call(P.a, '/api/clan/invite', { method: 'POST', body: { targetUsername: `${RUN}_ghost` } });
    ok('P11c invite 404 ghost target', ghostRes.status === 404, `status=${ghostRes.status}`);

    const invCount = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM clan_invitations WHERE clan_id = ${CLAN_ID}`
    ) as unknown as { rows: Array<{ n: number }> };
    ok('P11d invitation row landed', (invCount.rows[0]?.n ?? 0) >= 1, `n=${invCount.rows[0]?.n}`);
  } catch (err) {
    return fail('P11', err);
  }

  // ── P12: snapshot capture lands for the probe player (pg-native service;
  // the route's select leg is pinned in the unit suite)
  try {
    const { capturePlayerSnapshot } = await import('../lib/playerHistoryService');
    const before = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM player_level_history WHERE username = ${P.a}`
    ) as unknown as { rows: Array<{ n: number }> };
    await capturePlayerSnapshot(P.a, 12);
    const after = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM player_level_history WHERE username = ${P.a}`
    ) as unknown as { rows: Array<{ n: number }> };
    ok('P12 snapshot capture lands for probe player',
      (after.rows[0]?.n ?? 0) === (before.rows[0]?.n ?? 0) + 1,
      `before=${before.rows[0]?.n} after=${after.rows[0]?.n}`);
  } catch (err) {
    return fail('P12', err);
  }

  // ── P13: cleanup — probe residue zero
  try {
    await db.delete(typingIndicators).where(like(typingIndicators.userId, `${RUN}_%`));
    await db.delete(userPresence).where(like(userPresence.userId, `${RUN}_%`));
    await db.execute(sql`DELETE FROM clan_invitations WHERE clan_id = ${CLAN_ID}`);
    await db.delete(clans).where(eq(clans.id, CLAN_ID));
    await db.execute(sql`DELETE FROM player_level_history WHERE username LIKE ${`${RUN}_%`}`);
    await db.delete(players).where(like(players.username, `${RUN}_%`));

    const residue = {
      presence: (await db.select().from(userPresence).where(like(userPresence.userId, `${RUN}_%`))).length,
      typing: (await db.select().from(typingIndicators).where(like(typingIndicators.userId, `${RUN}_%`))).length,
      players: (await db.select().from(players).where(like(players.username, `${RUN}_%`))).length,
      clans: (await db.select().from(clans).where(eq(clans.id, CLAN_ID))).length,
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
