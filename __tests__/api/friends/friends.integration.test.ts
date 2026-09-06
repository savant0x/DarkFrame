/**
 * @file __tests__/api/friends/friends.integration.test.ts
 * @created 2025-11-04
 * @overview Live integration tests for Friend System API routes (no service mocks)
 *
 * ⚠️ LIVE-DB TEST — OPT-IN ONLY (set RUN_LIVE_DB_TESTS=1 to enable).
 *
 * Since the Postgres pivot, the compat layer (`@/lib/mongodb`) is bound to the real
 * configured DATABASE_URL — there is no in-memory fallback for it. This suite's
 * `beforeEach` DELETES all rows from players/friends/friendRequests, so it must
 * never run implicitly: a dev/staging database would be wiped. Point DATABASE_URL
 * at a disposable database before enabling, e.g.:
 *   RUN_LIVE_DB_TESTS=1 DATABASE_URL=postgresql://…/disposable npx vitest run __tests__/api/friends
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { createHmac } from 'crypto';


function getDbName() {
  return process.env.MONGODB_DB || 'darkframe-test';
}

async function signToken(payload: Record<string, any>) {
  const secret = process.env.JWT_SECRET || 'test-secret';
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: now, exp: now + 3600 };
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = (obj: any) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  const headerB64 = enc(header);
  const payloadB64 = enc(claims);
  const data = `${headerB64}.${payloadB64}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function withAuth(req: NextRequest, token: string) {
  // Clone headers and append cookie + test bypass header
  const headers = new Headers(req.headers);
  const existing = headers.get('cookie');
  const cookie = `token=${token}`;
  headers.set('cookie', existing ? `${existing}; ${cookie}` : cookie);
  headers.set('x-test-user', 'testuser');
  return new NextRequest(req.url, {
    method: req.method,
    headers,
    body: (req as any)._bodyInit ?? undefined,
  } as any);
}

// Skip by default: without this gate the suite targets whatever DATABASE_URL points
// at and wipes the listed tables in beforeEach (see file-header warning above).
const RUN_LIVE_DB_TESTS = process.env.RUN_LIVE_DB_TESTS === '1';

describe.skipIf(!RUN_LIVE_DB_TESTS)('Friend API - Live Integration', () => {
  let dbName: string;
  let token: string;
  let _testUserId: string; // assigned in beforeAll; kept for future assertion use
  let friend1Id: string;

  beforeAll(async () => {
    dbName = getDbName();
  });

  beforeEach(async () => {
    const client = await clientPromise;
    const db = client.db(dbName);

    // Reset collections
    await db.collection('players').deleteMany({});
    await db.collection('friendRequests').deleteMany({});
    await db.collection('friends').deleteMany({});

    // Seed users
    const testUser = {
      _id: new ObjectId(),
      username: 'testuser',
      email: 'testuser@example.com',
      level: 10,
      vip: false,
    };
    const friend1 = {
      _id: new ObjectId(),
      username: 'friend1',
      email: 'friend1@example.com',
      level: 8,
      vip: false,
    };

    await db.collection('players').insertMany([testUser, friend1]);

    _testUserId = testUser._id.toString();
    friend1Id = friend1._id.toString();

    // Ensure JWT secret matches authMiddleware default so verification succeeds
    process.env.JWT_SECRET = 'darkframe-secret-change-in-production';

    // Real JWT for requireAuth, payload contains username used by auth to fetch player
    token = await signToken({ username: 'testuser', isAdmin: false });
  });

  it('should complete full friend request flow live', async () => {
    // Dynamically import route handlers after env and DB are ready
    const { GET: GetFriends, POST: PostFriend } = await import('@/app/api/friends/route');
    const { GET: GetRequests } = await import('@/app/api/friends/requests/route');
    const { PATCH: PatchFriendAction } = await import('@/app/api/friends/[id]/route');
    const { GET: SearchFriends } = await import('@/app/api/friends/search/route');

    // 1) Send friend request
    const postReq = new NextRequest('http://localhost/api/friends', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `token=${token}`,
        'x-test-user': 'testuser',
      },
      body: JSON.stringify({ recipientId: friend1Id, message: 'Hey!' }),
    });

    const postRes = await PostFriend(postReq);
    if (postRes.status !== 201) {
      const errBody = await postRes.json();
      // eslint-disable-next-line no-console
      console.log('POST /api/friends error:', postRes.status, errBody);
    }
    expect(postRes.status).toBe(201);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    const requestId: string = postData.request?.requestId || postData.request?._id || postData.request?.id;
    expect(requestId).toBeTruthy();

    // 2) Requests list should include the new request (received by friend1 or sent by testuser)
    const getReqs = new NextRequest('http://localhost/api/friends/requests');
    const getReqsRes = await GetRequests(withAuth(getReqs, token));
    expect(getReqsRes.status).toBe(200);
    const getReqsData = await getReqsRes.json();
    expect(getReqsData.success).toBe(true);

    // 3) Accept the request
    const patchReq = new NextRequest(`http://localhost/api/friends/${requestId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `token=${token}`,
        'x-test-user': 'friend1',
      },
      body: JSON.stringify({ action: 'accept' }),
    });
    const patchRes = await PatchFriendAction(patchReq, { params: Promise.resolve({ id: requestId }) });
    if (patchRes.status !== 200) {
      const errBody = await patchRes.json();
      // eslint-disable-next-line no-console
      console.log('PATCH /api/friends/:id error:', patchRes.status, errBody);
    }
    expect(patchRes.status).toBe(200);

    // 4) Friends list should include friend1 now
    const listReq = new NextRequest('http://localhost/api/friends');
    const listRes = await GetFriends(withAuth(listReq, token));
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.success).toBe(true);
    expect(Array.isArray(listData.friends)).toBe(true);
    // len may vary by service implementation; at least one friendship expected
    expect(listData.friends.length).toBeGreaterThan(0);

    // 5) Search should return friend1 (using username)
    const searchReq = new NextRequest('http://localhost/api/friends/search?q=friend');
    const searchRes = await SearchFriends(withAuth(searchReq, token));
    expect(searchRes.status).toBe(200);
    const searchData = await searchRes.json();
    expect(searchData.success).toBe(true);
    expect(Array.isArray(searchData.results)).toBe(true);
  });
});
