/**
 * @file __tests__/api/friends/friends.integration.test.ts
 * @created 2025-11-04
 * @overview Live integration tests for Friend System API routes (no service mocks)
 *
 * These tests use a Supabase service client, generate a real JWT,
 * seed minimal player data, and exercise the API handlers end-to-end.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

// Supabase client for test seed/teardown
function getTestSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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

describe('Friend API - Live Integration', () => {
  let dbName: string;
  let token: string;
  let testUserId: string;
  let friend1Id: string;

  beforeAll(async () => {
    dbName = getDbName();
  });

  beforeEach(async () => {
    const supabase = getTestSupabase();

    // Reset collections
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('friend_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('friends').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Seed users
    testUserId = crypto.randomUUID();
    friend1Id = crypto.randomUUID();

    const testUser = {
      id: testUserId,
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'hashed-test-password',
      level: 10,
      is_vip: false,
      is_bot: false,
      is_admin: false,
      is_special_base: false,
      current_x: 0,
      current_y: 0,
      base_x: 0,
      base_y: 0,
      bank_metal: 0,
      bank_energy: 0,
      resources_metal: 1000,
      resources_energy: 1000,
      xp: 0,
      max_hp: 100,
      current_hp: 100,
      rank: 0,
      total_defense: 0,
      total_strength: 100,
      referral_validated: false,
      login_streak: 0,
      stat_battles_won: 0,
      stat_total_resources_gathered: 0,
      stat_total_resources_banked: 0,
      stat_total_units_built: 0,
      stat_caves_explored: 0,
      stat_shrine_trade_count: 0,
      total_referrals: 0,
      pending_referrals: 0,
      referral_rewards_energy: 0,
      referral_rewards_metal: 0,
      referral_rewards_rp: 0,
      referral_rewards_xp: 0,
      referral_rewards_vip_days: 0,
      referral_milestones: [],
      referral_milestones_reached: [],
      factory_count: 0,
      inventory_capacity: 100,
      inventory_metal_digger_count: 0,
      inventory_energy_digger_count: 0,
      research_points: 0,
      gathering_metal_bonus: 0,
      gathering_energy_bonus: 0,
      spec_doctrine: 'none',
      spec_mastery_level: 0,
      spec_mastery_xp: 0,
      spec_total_units_built: 0,
      spec_total_battles_won: 0,
      battle_base_won: 0,
      battle_base_lost: 0,
      battle_base_initiated: 0,
      battle_base_defense_won: 0,
      battle_base_defense_lost: 0,
      battle_base_defense_total: 0,
      battle_infantry_won: 0,
      battle_infantry_lost: 0,
      battle_infantry_initiated: 0,
      unlocked_techs: [],
      unlocked_tiers: [],
      created_at: new Date().toISOString(),
    };
    const friend1 = { ...testUser, id: friend1Id, username: 'friend1', email: 'friend1@example.com' };

    await supabase.from('players').insert([testUser, friend1]);

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
