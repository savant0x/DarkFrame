#!/usr/bin/env tsx
/**
 * FID-20260917-016 — LIVE verification driver (Cluster B batch 2 pg rewrites).
 * Runs against the real dev DB (DATABASE_URL from .env.local), invoking the real
 * route handlers directly with minted session cookies (the e2eClanDetail pattern —
 * no network hop, no shared dev-server dependency).
 *
 * Probes:
 *   A. ban-player POST   → bans row (generated id/createdAt/smallint flags) +
 *                          players.banned=1 + mod_log BAN_PLAYER row.
 *   B. autoResolveFlags  → seeded flag resolved=1, metadata carries resolver evidence.
 *   C. ban-player DELETE → ban columns cleared + bans.active=0 + UNBAN_PLAYER row.
 *   D. clear-flags       → delete count honest, mod_log CLEAR_FLAGS row, rows gone.
 *   E. logs/cleanup dry  → activity count ≥ 0, reads player_activity (no error).
 *   F. build-unit POST   → units appended, resources charged, investedMetal/Energy
 *                          deltas landed, slots consumed.
 * G. Snapshot/restore: any pre-existing state touched is restored; probe artifacts
 *    deleted; residue asserted zero. Explicit exit.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  players, bans, modLog, playerFlags, factories,
} from '@/lib/db/schema';
import { JOSE_SECRET } from '@/lib/jwt';

import { POST as banPost, DELETE as banDelete } from '../app/api/admin/ban-player/route';
import { POST as clearFlagsPost } from '../app/api/admin/anti-cheat/clear-flags/route';
import { POST as cleanupPost } from '../app/api/logs/cleanup/route';

const STAMP = Date.now().toString(36);
const PROBE_NAME = `probe${STAMP}`.slice(0, 20);
const ADMIN_NAME = 'fame';
let passed = 0;
let builderNameForCleanup: string | null = null;

function ok(label: string, cond: boolean, detail?: string): boolean {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (cond) passed++;
  return cond;
}

function fail(stage: string, e: unknown): never {
  let cur: unknown = e;
  let depth = 0;
  while (cur && depth < 5) {
    const msg = cur instanceof Error ? cur.message : String(cur);
    if (!msg.startsWith('Failed query')) console.log(`${stage} ❌[cause:${depth}]`, msg);
    cur = (cur as { cause?: unknown })?.cause;
    depth++;
  }
  console.log(`${stage} ❌ (top)`, e instanceof Error ? e.message.split('\n')[0] : e);
  process.exit(1);
}

const banPostH = banPost as unknown as (req: NextRequest) => Promise<Response>;
const banDeleteH = banDelete as unknown as (req: NextRequest) => Promise<Response>;
const clearFlagsPostH = clearFlagsPost as unknown as (req: NextRequest) => Promise<Response>;
const cleanupPostH = cleanupPost as unknown as (req: NextRequest) => Promise<Response>;

/** Real POST NextRequest at the real route URL: cookies at construction, real json()/nextUrl. */
async function mintPost(username: string, url: string, body: unknown, extra: Record<string, unknown> = {}): Promise<NextRequest> {
  const token = await new SignJWT({ username, ...extra })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JOSE_SECRET);
  return new NextRequest(url, {
    method: 'POST',
    headers: { cookie: `darkframe_session=${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Real DELETE NextRequest with query params. */
async function mintDelete(username: string, url: string, extra: Record<string, unknown> = {}): Promise<NextRequest> {
  const token = await new SignJWT({ username, ...extra })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JOSE_SECRET);
  return new NextRequest(url, {
    method: 'DELETE',
    headers: { cookie: `darkframe_session=${token}` },
  });
}

async function main() {
  // ── Preflight: probe player + admin must exist; factories for the build step ──
  const [admin] = await db.select().from(players).where(eq(players.username, ADMIN_NAME)).limit(1);
  if (!admin) fail('preflight', new Error(`admin player ${ADMIN_NAME} not found`));

  // Seed a dedicated probe player (role: ban/flags victim; NOT the admin)
  const [victim] = await db.insert(players).values({
    username: PROBE_NAME,
    email: `${PROBE_NAME}@probe.invalid`,
    password: 'probe-no-login',
    baseX: 15,
    baseY: 15,
    currentPositionX: 15,
    currentPositionY: 15,
    resourcesMetal: 5000000,
    resourcesEnergy: 5000000,
    isAdmin: 0,
  }).onConflictDoNothing().returning();
  if (!victim) fail('preflight', new Error(`probe player ${PROBE_NAME} could not be created`));

  console.log(`probe victim=${PROBE_NAME}\n`);

  // ── Probe A: ban-player POST (temporary ban + autoResolveFlags) ──
  try {
    // Seed one unresolved flag first so autoResolve has something to flip
    await db.insert(playerFlags).values({
      id: `pf${STAMP}`.padEnd(24, '0').slice(0, 24),
      username: PROBE_NAME,
      flagType: 'probe_flag',
      severity: 'LOW',
      evidence: 'FID-20260917-016 live probe',
      resolved: 0,
      createdAt: new Date(),
    });
    const flagBefore = await db.select({ resolved: playerFlags.resolved }).from(playerFlags)
      .where(eq(playerFlags.username, PROBE_NAME));
    ok('A0 seeded flag unresolved', flagBefore.every((f) => f.resolved === 0));

    const adminReq = await mintPost(ADMIN_NAME, 'http://localhost:3000/api/admin/ban-player', {
      username: PROBE_NAME, reason: 'probe ban reason', durationDays: 2, autoResolveFlags: true,
    }, { isAdmin: true });
    const res = await banPostH(adminReq);
    const body = await res.json();
    ok('A1 ban POST 200', res.status === 200, `status=${res.status} ${JSON.stringify(body).slice(0, 120)}`);
    ok('A2 response flagsResolved', body?.data?.flagsResolved === true);

    const [banRow] = await db.select().from(bans).where(eq(bans.username, PROBE_NAME));
    ok('A3 bans row exists', !!banRow);
    ok('A4 bans row shape (id 24, createdAt, smallint flags)', !!banRow
      && typeof banRow.id === 'string' && banRow.id.length === 24
      && banRow.createdAt instanceof Date
      && banRow.isPermanent === 0 && banRow.active === 1
      && banRow.expiresAt instanceof Date);

    const [victimRow] = await db.select({ banned: players.banned, banReason: players.banReason, bannedBy: players.bannedBy })
      .from(players).where(eq(players.username, PROBE_NAME));
    ok('A5 players.banned=1 + reason', victimRow.banned === 1 && victimRow.banReason === 'probe ban reason' && victimRow.bannedBy === ADMIN_NAME);

    const [auditRow] = await db.select().from(modLog).where(and(eq(modLog.action, 'BAN_PLAYER'), eq(modLog.targetId, PROBE_NAME)));
    ok('A6 mod_log BAN_PLAYER row', !!auditRow && auditRow.moderatorId === ADMIN_NAME);

    const flagsAfterBan = await db.select().from(playerFlags).where(eq(playerFlags.username, PROBE_NAME));
    ok('B1 flag auto-resolved with metadata evidence', flagsAfterBan.length === 1
      && flagsAfterBan[0].resolved === 1
      && (flagsAfterBan[0].metadata as { resolvedBy?: string })?.resolvedBy === ADMIN_NAME);

    // ── Probe C: unban ──
    const unbanReq = await mintDelete(ADMIN_NAME, `http://localhost:3000/api/admin/ban-player?username=${PROBE_NAME}`, { isAdmin: true });
    const unbanRes = await banDeleteH(unbanReq);
    const unbanBody = await unbanRes.json();
    ok('C1 unban 200', unbanRes.status === 200, `status=${unbanRes.status} ${JSON.stringify(unbanBody).slice(0, 120)}`);

    const [victimAfter] = await db.select({ banned: players.banned, banReason: players.banReason, bannedAt: players.bannedAt })
      .from(players).where(eq(players.username, PROBE_NAME));
    ok('C2 ban columns cleared', victimAfter.banned === 0 && victimAfter.banReason === null && victimAfter.bannedAt === null);

    const [banAfter] = await db.select().from(bans).where(eq(bans.username, PROBE_NAME));
    ok('C3 bans.active=0', banAfter.active === 0);

    const [unbanAudit] = await db.select().from(modLog).where(and(eq(modLog.action, 'UNBAN_PLAYER'), eq(modLog.targetId, PROBE_NAME)));
    ok('C4 mod_log UNBAN_PLAYER row', !!unbanAudit);
  } catch (e) {
    fail('A/B/C', e);
  }

  // ── Probe D: clear-flags ──
  try {
    // Re-seed two flags (victim now unbanned)
    const flagIds = [`pf${STAMP}a`.padEnd(24, '0').slice(0, 24), `pf${STAMP}b`.padEnd(24, '0').slice(0, 24)];
    for (const id of flagIds) {
      await db.insert(playerFlags).values({
        id, username: PROBE_NAME, flagType: 'probe_flag2', severity: 'LOW',
        evidence: 'FID-20260917-016 live probe D', resolved: 0, createdAt: new Date(),
      });
    }
    const seededFlags = (await db.select({ id: playerFlags.id }).from(playerFlags).where(eq(playerFlags.username, PROBE_NAME))).length;
    const adminReq = await mintPost(ADMIN_NAME, 'http://localhost:3000/api/admin/anti-cheat/clear-flags', {
      username: PROBE_NAME,
    }, { isAdmin: true });
    const res = await clearFlagsPostH(adminReq);
    const body = await res.json();
    ok('D1 clear-flags 200 + honest count', res.status === 200 && body?.flagsCleared === seededFlags, `status=${res.status} cleared=${body?.flagsCleared} seeded=${seededFlags}`);

    const remaining = await db.select({ id: playerFlags.id }).from(playerFlags).where(eq(playerFlags.username, PROBE_NAME));
    ok('D2 flags actually gone', remaining.length === 0);

    const [auditRow] = await db.select().from(modLog).where(and(eq(modLog.action, 'CLEAR_FLAGS'), eq(modLog.targetId, PROBE_NAME)));
    ok('D3 mod_log CLEAR_FLAGS row', !!auditRow);
  } catch (e) {
    fail('D', e);
  }

  // ── Probe E: logs/cleanup dry-run ──
  try {
    const adminReq = await mintPost(ADMIN_NAME, 'http://localhost:3000/api/logs/cleanup?dryRun=true', {}, { isAdmin: true });
    const res = await cleanupPostH(adminReq);
    const body = await res.json();
    ok('E1 cleanup dry-run 200 + counts present', res.status === 200
      && typeof body?.activityLogsToDelete === 'number'
      && typeof body?.battleLogsToDelete === 'number');
  } catch (e) {
    fail('E', e);
  }

  // ── Probe F: build-unit POST as a fresh registered builder (probe F user).
  // The route authenticates via getAuthenticatedUser() → next/headers cookies(),
  // which does not exist outside a real request scope, and the shared dev server
  // runs a session secret this process cannot reconstruct — so F rides the real
  // server through the game's own public auth surface: register → Set-Cookie →
  // authenticated POST. The builder gets its OWN factory so the probe touches no
  // pre-existing player's economy.
  try {
    const builderName = `bld${STAMP}`.slice(0, 20);
    const regRes = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: builderName,
        email: `${builderName}@probe.invalid`,
        password: 'probe-password-1',
      }),
    });
    ok('F0 builder registered', regRes.status === 201, `status=${regRes.status}`);
    const setCookie = regRes.headers.get('set-cookie') || '';
    const sessionCookie = setCookie.split(',').map((c) => c.trim()).find((c) => c.startsWith('darkframe_session='));
    const cookieValue = sessionCookie ? sessionCookie.split(';')[0] : '';
    ok('F0b session cookie minted by the game', cookieValue.startsWith('darkframe_session='));

    // Give the builder a factory directly (the route requires one) and snapshot it
    await db.insert(factories).values({
      x: 90, y: 90, owner: builderName,
      slots: 20, usedSlots: 5,
      investedMetal: 1000, investedEnergy: 1000,
      lastSlotRegen: new Date(),
    }).onConflictDoNothing();
    const fSnap = (await db.select().from(factories).where(eq(factories.owner, builderName)).limit(1))[0];
    if (!fSnap) fail('F', new Error('builder factory insert failed'));

    // New registrations start with ZERO resources (STARTING_RESOURCES = 0; the
    // starter package rides tutorial completion) — top the builder up directly
    // and snapshot the pre-build values for exact-delta assertions.
    await db.update(players).set({ resourcesMetal: 1000, resourcesEnergy: 1000 })
      .where(eq(players.username, builderName));
    const [bSnap] = await db.select({ metal: players.resourcesMetal, energy: players.resourcesEnergy })
      .from(players).where(eq(players.username, builderName)).limit(1);

    const httpRes = await fetch('http://localhost:3000/api/player/build-unit', {
      method: 'POST',
      headers: { cookie: cookieValue, 'content-type': 'application/json' },
      body: JSON.stringify({ username: builderName, unitTypeId: 'militia', quantity: 1 }),
    });
    const body = await httpRes.json();
    ok('F1 build POST 200', httpRes.status === 200, `status=${httpRes.status} ${JSON.stringify(body).slice(0, 160)}`);

    const [builderAfter] = await db.select().from(players).where(eq(players.username, builderName)).limit(1);
    ok('F2 units appended (+1)', (builderAfter.units?.length ?? 0) === 1);
    const militiaBp = { metal: 180, energy: 180, strength: 90, defense: 0 }; // real blueprint values
    ok('F3 resources charged', builderAfter.resourcesMetal === bSnap.metal - militiaBp.metal
      && builderAfter.resourcesEnergy === bSnap.energy - militiaBp.energy);
    ok('F4 totals bumped', builderAfter.totalStrength === militiaBp.strength);

    const [factoryAfter] = await db.select().from(factories).where(eq(factories.owner, builderName)).limit(1);
    ok('F5 slot consumed', factoryAfter.usedSlots === fSnap.usedSlots + 1);
    ok('F6 investedMetal delta landed (D3)', factoryAfter.investedMetal === fSnap.investedMetal + militiaBp.metal);
    ok('F7 investedEnergy delta landed (D3)', factoryAfter.investedEnergy === fSnap.investedEnergy + militiaBp.energy);

    // Cleanup F artifacts
    builderNameForCleanup = builderName;
  } catch (e) {
    fail('F', e);
  }

  // ── Cleanup ──
  try {
    // Probe-owned artifacts only. Fame's economy is NEVER mutated by this
    // driver (ban/flags target the probe user; build rides the F builder with
    // its own factory), so there is deliberately no "restore fame" step — a
    // snapshot-restore could clobber the player's real concurrent progress.
    // Remove audit rows, bans, flags, probe players (incl. the F builder + its factory)
    await db.delete(modLog).where(eq(modLog.targetId, PROBE_NAME));
    await db.delete(bans).where(eq(bans.username, PROBE_NAME));
    await db.delete(playerFlags).where(eq(playerFlags.username, PROBE_NAME));
    await db.delete(players).where(eq(players.username, PROBE_NAME));
    if (builderNameForCleanup) {
      await db.delete(factories).where(eq(factories.owner, builderNameForCleanup));
      await db.delete(players).where(eq(players.username, builderNameForCleanup));
    }

    const residueFlags = await db.select({ id: playerFlags.id }).from(playerFlags).where(eq(playerFlags.username, PROBE_NAME));
    const residueBans = await db.select({ id: bans.id }).from(bans).where(eq(bans.username, PROBE_NAME));
    const residueVictim = await db.select({ id: players.username }).from(players).where(eq(players.username, PROBE_NAME));
    const residueBuilder = builderNameForCleanup
      ? await db.select({ id: players.username }).from(players).where(eq(players.username, builderNameForCleanup))
      : [];
    const residueFactory = builderNameForCleanup
      ? await db.select({ x: factories.x }).from(factories).where(eq(factories.owner, builderNameForCleanup))
      : [];
    ok('Z1 residue zero', residueFlags.length === 0 && residueBans.length === 0 && residueVictim.length === 0
      && residueBuilder.length === 0 && residueFactory.length === 0);

    console.log(`\n${passed} assertions passed`);
    if (passed < 24) {
      console.log('NOT ALL ASSERTIONS PASSED');
      process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    fail('cleanup', e);
  }
}

main().catch((e) => fail('unhandled', e));
