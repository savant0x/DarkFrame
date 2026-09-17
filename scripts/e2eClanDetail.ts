/**
 * FID-20260917-006 — LIVE verification driver for GET /api/clan/[id].
 * Drives the route handler DIRECTLY (no dev server needed) — requireAuth runs
 * for real (JWT verify + player-row lookup) against the dev DB.
 *
 * Design notes (learned from this driver's own first run):
 *  - The probe does NOT insert a player row (players has many NOT NULL columns
 *    without defaults; the app seeds them via createPlayer). Instead it binds
 *    to an EXISTING player (read-only) and seeds/deletes ONLY the probe clan.
 *  - Explicit process.exit: an open pg pool keeps the process alive otherwise
 *    (same lesson as the FID-009 UTC probe driver).
 *
 * Stages:
 *   1. SEED     — pick existing player (read-only) + insert probe clan row
 *   2. CONTRACT — route returns { success: true, clan } with members[]/level/
 *                 settings/stats — exactly what ClanManagementView:720-796 eats
 *   3. 404      — unknown id → CLAN_NOT_FOUND envelope, status 404
 *   4. 401      — no cookie → requireAuth's 401 pass-through
 *   5. CLEANUP  — probe clan deleted
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players, clans } from '@/lib/db/schema';
import { JOSE_SECRET, JWT_SECRET } from '@/lib/jwt';
import * as jwtViaBarrel from '@/lib/jwt';
import { GET } from '../app/api/clan/[id]/route';

const STAMP = Date.now().toString(36);
const CLAN_ID = `c${STAMP}`.padEnd(24, '0').slice(0, 24);

function fail(stage: string, e: unknown): never {
  console.log(`${stage} ❌`, e instanceof Error ? e.message : e);
  process.exit(1);
}

async function main(): Promise<void> {
  // Stage 1: SEED (existing player read-only + probe clan)
  const found = await db
    .select({ username: players.username })
    .from(players)
    .limit(1);
  if (found.length === 0) fail('SEED', new Error('no player rows exist to bind the probe to'));
  const USERNAME = found[0].username;

  try {
    await db.insert(clans).values({
      id: CLAN_ID,
      name: `Probe ${STAMP}`,
      tag: `P${STAMP}`.slice(0, 6),
      description: 'FID-20260917-006 live probe',
      leaderId: USERNAME,
      members: [
        {
          playerId: USERNAME,
          username: USERNAME,
          role: 'LEADER',
          joinedAt: new Date(),
          lastActive: new Date(),
        },
      ],
      createdAt: new Date(),
    } as typeof clans.$inferInsert);
    console.log(`SEED     ✅ clan ${CLAN_ID} (probe player: ${USERNAME}, read-only)`);
  } catch (e) {
    fail('SEED', e);
  }

  const makeRequest = async (withCookie: boolean, id: string = CLAN_ID) => {
    const headers: Record<string, string> = {};
    if (withCookie) {
      const token = await new SignJWT({ username: USERNAME })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(JOSE_SECRET);
      // Cookie must be present at CONSTRUCTION — setting headers afterwards
      // does not refresh NextRequest's already-parsed cookie store.
      headers['cookie'] = `darkframe_session=${token}`;
    }
    return new NextRequest(`http://localhost:3000/api/clan/${id}`, { headers });
  };

  // Stage 2: CONTRACT
  try {
    // Diagnostics: verify the token in-process exactly as authMiddleware does,
    // and check module-instance identity of the secret across specifiers.
    const tok = await new SignJWT({ username: USERNAME })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(JOSE_SECRET);
    try {
      await jwtVerify(tok, new TextEncoder().encode(JWT_SECRET));
      console.log(`DIAG     sign+verify OK (token len ${tok.length}, secret len ${JWT_SECRET.length}, sameInstance=${(jwtViaBarrel as { JOSE_SECRET?: Uint8Array }).JOSE_SECRET === JOSE_SECRET})`);
    } catch (e) {
      console.log('DIAG     in-process verify FAILED:', e instanceof Error ? e.message : e);
    }
    const res = await GET(await makeRequest(true), { params: Promise.resolve({ id: CLAN_ID }) });
    const body = await res.json();
    const ok =
      res.status === 200 &&
      body.success === true &&
      body.clan?._id === CLAN_ID &&
      Array.isArray(body.clan.members) &&
      body.clan.members[0]?.username === USERNAME &&
      typeof body.clan.level?.currentLevel === 'number' &&
      body.clan.settings != null &&
      body.clan.stats != null;
    if (!ok) throw new Error(`status=${res.status} body=${JSON.stringify(body).slice(0, 200)}`);
    console.log('CONTRACT ✅ 200 { success, clan } with members/level/settings/stats');
  } catch (e) {
    await db.delete(clans).where(eq(clans.id, CLAN_ID)).catch(() => {});
    fail('CONTRACT', e);
  }

  // Stage 3: 404
  try {
    const res = await GET(await makeRequest(true, 'zzzzzzzzzzzzzzzzzzzzzzzz'), {
      params: Promise.resolve({ id: 'zzzzzzzzzzzzzzzzzzzzzzzz' }),
    });
    const body = await res.json();
    if (res.status !== 404 || body.error?.code !== 'CLAN_NOT_FOUND') {
      throw new Error(`status=${res.status} body=${JSON.stringify(body).slice(0, 160)}`);
    }
    console.log('404      ✅ CLAN_NOT_FOUND envelope');
  } catch (e) {
    await db.delete(clans).where(eq(clans.id, CLAN_ID)).catch(() => {});
    fail('404', e);
  }

  // Stage 4: 401
  try {
    const res = await GET(await makeRequest(false), { params: Promise.resolve({ id: CLAN_ID }) });
    if (res.status !== 401) throw new Error(`status=${res.status}`);
    console.log('401      ✅ requireAuth pass-through');
  } catch (e) {
    await db.delete(clans).where(eq(clans.id, CLAN_ID)).catch(() => {});
    fail('401', e);
  }

  // Stage 5: CLEANUP
  try {
    await db.delete(clans).where(eq(clans.id, CLAN_ID));
    console.log('CLEANUP  ✅ probe clan removed');
  } catch (e) {
    fail('CLEANUP', e);
  }

  console.log('RESULT   ✅ 4/4 stages green');
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
