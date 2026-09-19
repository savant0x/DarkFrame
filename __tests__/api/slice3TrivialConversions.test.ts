/**
 * @file __tests__/api/slice3TrivialConversions.test.ts
 * @created 2026-09-18
 * @overview Pins for FID-20260917-017 slice 3 (8 conversions off the Mongo
 *            shim): chat heartbeat/online/typing, player stats/greeting/
 *            profile, clan/invite, cron/player-snapshot. Mock rides the REAL
 *            drizzle query-builder surface — builders record the drizzle table
 *            objects so assertions run through getTableName + the builder spec
 *            (the batch-2 lesson: a mock factory that ignores drizzle's table
 *            argument leaves insert/update specs table-less and useless).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { getTableName } from 'drizzle-orm';

const { state, authMock } = vi.hoisted(() => {
  const state = {
    specs: [] as Array<Record<string, unknown>>,
    responder: (_spec: Record<string, unknown>) => [] as unknown,
  };
  const authMock = { value: undefined as undefined | { username: string; playerId?: string; isAdmin?: boolean } };
  return { state, authMock };
});

function tableOf(spec: Record<string, unknown> | undefined): string {
  const t = (spec?.table ?? spec?.from) as { $inferInsert?: unknown } | undefined;
  return getTableName((t ?? {}) as never);
}

// The terminal builder lives INSIDE the factory so it closes only over the
// hoisted `state` — a factory referencing module-scope helpers runs before
// those are initialized (TDZ, the batch-2 lesson). Every call RECORDS its spec
// into state.specs before returning the chainable terminal.
vi.mock('@/lib/db/connection', () => {
  const mk = (spec: Record<string, unknown>): Record<string, unknown> => {
    state.specs.push(spec);
    const terminal = {
      from: (t: unknown) => { spec.from = t; return terminal; },
      leftJoin: (t: unknown, on: unknown) => {
        spec.joins = [...((spec.joins as Array<unknown>) ?? []), { table: t, on }];
        return terminal;
      },
      innerJoin(t: unknown, on: unknown) { return terminal.leftJoin(t, on); },
      where: (c: unknown) => { spec.where = c; return terminal; },
      orderBy: (...c: unknown[]) => { spec.orderBy = c; return terminal; },
      groupBy: (...c: unknown[]) => { spec.groupBy = c; return terminal; },
      limit: (n: number) => { spec.limit = n; return terminal; },
      values: (v: unknown) => { spec.values = v; return terminal; },
      set: (v: unknown) => { spec.set = v; return terminal; },
      onConflictDoUpdate: (c: unknown) => { spec.conflict = c; return terminal; },
      onConflictDoNothing: (c?: unknown) => { spec.conflict = { doNothing: true, c }; return terminal; },
      returning: () => { spec.returning = true; return terminal; },
      then: (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(state.responder(spec)).then(onF, onR),
    };
    return terminal;
  };
  return {
    db: {
      insert: (t: unknown) => mk({ op: 'insert', table: t }),
      update: (t: unknown) => mk({ op: 'update', table: t }),
      delete: (t: unknown) => mk({ op: 'delete', table: t }),
      select: (...fields: unknown[]) => mk({ op: 'select', fields }),
      execute: async () => ({ rows: [] }),
    },
  };
});
vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: async () => authMock.value,
}));
vi.mock('@/lib/playerService', () => ({
  getPlayer: vi.fn(),
  getPlayerSlim: vi.fn(),
}));
vi.mock('@/lib/combatPowerService', () => ({
  calculateCombatPower: vi.fn(async () => ({ combatPower: 10, breakdown: { balanceStatus: 'balanced' } })),
}));
vi.mock('@/lib/playerHistoryService', () => ({ capturePlayerSnapshot: vi.fn(async () => {}) }));
vi.mock('@/lib/clanService', () => ({ invitePlayerToClan: vi.fn() }));
vi.mock('@/lib/battleStatsService', () => ({
  computeBattleStats: vi.fn(async () => ({ battlesWon: 1 })),
  toPanelBattleStats: (x: unknown) => x,
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  structuredLogger: { info: () => {}, warn: () => {}, error: () => {} },
}));

vi.mock('@/lib', () => ({
  withRequestLogging: (h: unknown) => h,
  createRouteLogger: () => ({
    time: () => () => {},
    debug: () => {},
    warn: () => {},
    info: () => {},
    error: () => {},
  }),
  createRateLimiter: () => (h: unknown) => h,
  ENDPOINT_RATE_LIMITS: { STANDARD: {} },
  createErrorFromException: (e: unknown, code: string) =>
    NextResponse.json({ error: String(e), code }, { status: 500 }),
  ErrorCode: { INTERNAL_ERROR: 'INTERNAL_ERROR' },
  requireClanMembership: vi.fn(),
}));

import { POST as heartbeatPOST } from '@/app/api/chat/heartbeat/route';
import { GET as onlineGET } from '@/app/api/chat/online/route';
import { POST as typingPOST, GET as typingGET } from '@/app/api/chat/typing/route';
import { GET as statsGET } from '@/app/api/player/stats/route';
import { POST as greetingPOST } from '@/app/api/player/greeting/route';
import { GET as profileGET } from '@/app/api/player/profile/route';
import { POST as invitePOST } from '@/app/api/clan/invite/route';
import { GET as cronGET, POST as cronPOST } from '@/app/api/cron/player-snapshot/route';
import { getPlayer, getPlayerSlim } from '@/lib/playerService';
import { requireClanMembership } from '@/lib';
import { invitePlayerToClan } from '@/lib/clanService';
import { capturePlayerSnapshot } from '@/lib/playerHistoryService';
import { readFileSync } from 'node:fs';

type Handler = (req: NextRequest) => Promise<Response>;
const asHandler = (h: unknown) => h as Handler;

const getReq = (url: string) => new NextRequest(`http://localhost:3000${url}`);
const postReq = (url: string, body: unknown) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  state.specs.length = 0;
  state.responder = () => [];
  authMock.value = undefined;
  vi.mocked(getPlayer).mockReset();
  vi.mocked(getPlayerSlim).mockReset();
  vi.mocked(requireClanMembership).mockReset();
  vi.mocked(invitePlayerToClan).mockReset();
  vi.mocked(capturePlayerSnapshot).mockClear();
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

// ============================================================================
// chat/heartbeat
// ============================================================================
describe('POST /api/chat/heartbeat (pg upsert)', () => {
  it('401s without a session', async () => {
    const res = await asHandler(heartbeatPOST)(postReq('/api/chat/heartbeat', { username: 'x' }));
    expect(res.status).toBe(401);
    expect(state.specs).toHaveLength(0);
  });

  it('403s on body/session identity mismatch', async () => {
    authMock.value = { username: 'alice' };
    const res = await asHandler(heartbeatPOST)(postReq('/api/chat/heartbeat', { userId: 'mallory' }));
    expect(res.status).toBe(403);
    expect(state.specs).toHaveLength(0);
  });

  it('400s on an invalid status', async () => {
    authMock.value = { username: 'alice' };
    const res = await asHandler(heartbeatPOST)(postReq('/api/chat/heartbeat', { status: 'Ghost' }));
    expect(res.status).toBe(400);
  });

  it('atomically upserts user_presence keyed on user_id', async () => {
    authMock.value = { username: 'alice' };
    const res = await asHandler(heartbeatPOST)(postReq('/api/chat/heartbeat', { status: 'Online' }));
    expect(res.status).toBe(200);
    const spec = state.specs[0];
    expect(tableOf(spec)).toBe('user_presence');
    expect((spec.op as string)).toBe('insert');
    const values = spec.values as Record<string, unknown>;
    expect(typeof values.id).toBe('string');
    expect(values.userId).toBe('alice');
    expect(values.lastSeen).toBeInstanceOf(Date);
    expect(values.expiresAt).toBeInstanceOf(Date);
    // The Mongo doc's username/level/isVIP/status map to NO column — the
    // honest contract persists none of them.
    expect(values).not.toHaveProperty('username');
    expect(values).not.toHaveProperty('level');
    expect(values).not.toHaveProperty('isVIP');
    expect(values).not.toHaveProperty('status');
    const conflict = spec.conflict as { target: unknown; set: Record<string, unknown> };
    expect((conflict.target as { name: string }).name).toBe('user_id');
    expect(conflict.set.lastSeen).toBeInstanceOf(Date);
  });
});

// ============================================================================
// chat/online
// ============================================================================
describe('GET /api/chat/online (presence join + channel filters)', () => {
  it('joins players for level/VIP and formats the single-channel response', async () => {
    state.responder = (spec) => {
      const table = tableOf(spec);
      if (table === 'user_presence') {
        return [
          { userId: 'alice', lastSeen: new Date('2026-09-18T10:00:00Z'), level: 4, vip: 1 },
          { userId: 'bob', lastSeen: new Date('2026-09-18T10:00:01Z'), level: 12, vip: 0 },
        ];
      }
      if (table === 'clans') return [];
      return [];
    };
    const res = await asHandler(onlineGET)(getReq('/api/chat/online?channelId=vip&includeUsers=true'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number; users: Array<{ userId: string; username: string; isVIP?: boolean }> };
    expect(body.count).toBe(1);
    expect(body.users[0]).toMatchObject({ userId: 'alice', username: 'alice', isVIP: true });

    const spec = state.specs.find((s) => tableOf(s) === 'user_presence');
    expect(spec).toBeTruthy();
    const joins = (spec?.joins as Array<{ table: unknown }>) ?? [];
    expect(joins.map((j) => getTableName(j.table as never))).toContain('players');
    expect(spec?.where).toBeTruthy(); // threshold filter rides the WHERE
  });

  it('filters clan channels against the clans membership roster', async () => {
    state.responder = (spec) => {
      if (tableOf(spec) === 'user_presence') {
        return [{ userId: 'alice', lastSeen: new Date(), level: 4, vip: 0 }];
      }
      if (tableOf(spec) === 'clans') {
        return [{ id: 'clanA', members: [{ playerId: 'alice' }] }];
      }
      return [];
    };
    const res = await asHandler(onlineGET)(getReq('/api/chat/online?channelId=clan_clanA'));
    const body = (await res.json()) as { count: number };
    expect(body.count).toBe(1);

    const res2 = await asHandler(onlineGET)(getReq('/api/chat/online?channelId=clan_other'));
    const body2 = (await res2.json()) as { count: number };
    expect(body2.count).toBe(0);
  });

  it('newbie channel excludes players above level 5', async () => {
    state.responder = (spec) =>
      tableOf(spec) === 'user_presence'
        ? [
            { userId: 'alice', lastSeen: new Date(), level: 4, vip: 0 },
            { userId: 'bob', lastSeen: new Date(), level: 12, vip: 0 },
          ]
        : [];
    const res = await asHandler(onlineGET)(getReq('/api/chat/online?channelId=newbie'));
    const body = (await res.json()) as { count: number };
    expect(body.count).toBe(1);
  });
});

// ============================================================================
// chat/typing
// ============================================================================
describe('/api/chat/typing (pg upsert + window read)', () => {
  it('401s without a session', async () => {
    const res = await asHandler(typingPOST)(postReq('/api/chat/typing', { channelId: 'global' }));
    expect(res.status).toBe(401);
  });

  it('403s on identity mismatch', async () => {
    authMock.value = { username: 'alice' };
    const res = await asHandler(typingPOST)(postReq('/api/chat/typing', { channelId: 'global', username: 'mallory' }));
    expect(res.status).toBe(403);
  });

  it('upserts typing_indicators keyed on (channel_id, user_id)', async () => {
    authMock.value = { username: 'alice' };
    const res = await asHandler(typingPOST)(postReq('/api/chat/typing', { channelId: 'global' }));
    expect(res.status).toBe(200);
    const spec = state.specs[0];
    expect(tableOf(spec)).toBe('typing_indicators');
    const values = spec.values as Record<string, unknown>;
    expect(values.channelId).toBe('global');
    expect(values.userId).toBe('alice');
    expect(typeof values.id).toBe('string');
    const conflict = spec.conflict as { target: unknown[] };
    expect(conflict.target.map((c) => (c as { name: string }).name)).toEqual(['channel_id', 'user_id']);
  });

  it('GET requires channelId and filters the expired window', async () => {
    const missing = await asHandler(typingGET)(getReq('/api/chat/typing'));
    expect(missing.status).toBe(400);

    state.responder = () => [{ userId: 'alice', expiresAt: new Date('2026-09-18T10:00:04Z') }];
    const res = await asHandler(typingGET)(getReq('/api/chat/typing?channelId=global'));
    const body = (await res.json()) as { typers: Array<{ userId: string; username: string; timestamp: string }> };
    expect(body.typers).toEqual([
      { userId: 'alice', username: 'alice', timestamp: '2026-09-18T10:00:04.000Z' },
    ]);
    const spec = state.specs[0];
    expect(tableOf(spec)).toBe('typing_indicators');
    expect(spec.where).toBeTruthy();
    expect((spec.orderBy as unknown[]).length).toBeGreaterThan(0);
  });
});

// ============================================================================
// player/stats
// ============================================================================
describe('GET /api/player/stats (domain loader)', () => {
  it('401s unauthenticated', async () => {
    const res = await asHandler(statsGET)(getReq('/api/player/stats'));
    expect(res.status).toBe(401);
  });

  it('404s for an unknown player', async () => {
    authMock.value = { username: 'ghost' };
    vi.mocked(getPlayer).mockResolvedValue(null);
    const res = await asHandler(statsGET)(getReq('/api/player/stats'));
    expect(res.status).toBe(404);
    expect(vi.mocked(getPlayer)).toHaveBeenCalledWith('ghost', { includePrivate: true });
  });

  it('returns stats with defaults through the pg domain shape', async () => {
    authMock.value = { username: 'fame' };
    vi.mocked(getPlayer).mockResolvedValue({
      username: 'fame',
      level: 4,
      stats: { battlesWon: 5 },
      resources: { metal: 100, energy: 200 },
    } as never);
    const res = await asHandler(statsGET)(getReq('/api/player/stats'));
    const body = (await res.json()) as { stats: Record<string, number>; level: number; resources: { metal: number } };
    expect(body.level).toBe(4);
    expect(body.stats.battlesWon).toBe(5);
    expect(body.stats.totalUnitsBuilt).toBe(0);
    expect(body.resources.metal).toBe(100);
  });
});

// ============================================================================
// player/greeting
// ============================================================================
describe('POST /api/player/greeting (pg update)', () => {
  it('400s on a non-string greeting', async () => {
    authMock.value = { username: 'fame' };
    const res = await asHandler(greetingPOST)(postReq('/api/player/greeting', { greeting: 42 }));
    expect(res.status).toBe(400);
  });

  it('updates base_greeting and returns the sanitized value', async () => {
    authMock.value = { username: 'fame' };
    state.responder = () => [{ id: 'player-1' }];
    const res = await asHandler(greetingPOST)(postReq('/api/player/greeting', { greeting: '  hi  ' }));
    const body = (await res.json()) as { data: { greeting: string } };
    expect(body.data.greeting).toBe('hi');
    const spec = state.specs[0];
    expect(tableOf(spec)).toBe('players');
    expect((spec.set as Record<string, unknown>).baseGreeting).toBe('hi');
  });

  it('404s when the update touches no rows', async () => {
    authMock.value = { username: 'ghost' };
    state.responder = () => [];
    const res = await asHandler(greetingPOST)(postReq('/api/player/greeting', { greeting: 'hi' }));
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// player/profile
// ============================================================================
describe('GET /api/player/profile (domain loader)', () => {
  it('401s unauthenticated', async () => {
    const res = await asHandler(profileGET)(getReq('/api/player/profile'));
    expect(res.status).toBe(401);
  });

  it('builds the profile payload from the pg domain shape', async () => {
    authMock.value = { username: 'fame' };
    vi.mocked(getPlayer).mockResolvedValue({
      username: 'fame',
      level: 4,
      rank: 2,
      resources: { metal: 10, energy: 20 },
      base: { x: 3, y: 7 },
      baseGreeting: 'yo',
      achievements: [{ id: 'a1' }],
      createdAt: new Date('2026-01-01T00:00:00Z'),
    } as never);
    const res = await asHandler(profileGET)(getReq('/api/player/profile'));
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({
      username: 'fame',
      level: 4,
      rank: 2,
      base: { x: 3, y: 7, greeting: 'yo' },
      achievements: [{ id: 'a1' }],
    });
    expect(body.data.battleStats).toBeTruthy();
  });

  it('404s for an unknown player', async () => {
    authMock.value = { username: 'ghost' };
    vi.mocked(getPlayer).mockResolvedValue(null);
    const res = await asHandler(profileGET)(getReq('/api/player/profile'));
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// clan/invite
// ============================================================================
describe('POST /api/clan/invite (slim loader)', () => {
  it('passes the membership refusal through untouched', async () => {
    const refusal = NextResponse.json({ success: false }, { status: 403 });
    vi.mocked(requireClanMembership).mockResolvedValue(refusal as never);
    const res = await asHandler(invitePOST)(postReq('/api/clan/invite', { targetUsername: 'bob' }));
    expect(res.status).toBe(403);
  });

  it('404s when the target player does not exist', async () => {
    vi.mocked(requireClanMembership).mockResolvedValue({ auth: { playerId: 'alice' }, clanId: 'clanA' } as never);
    vi.mocked(getPlayerSlim).mockResolvedValue(null);
    const res = await asHandler(invitePOST)(postReq('/api/clan/invite', { targetUsername: 'ghost' }));
    expect(res.status).toBe(404);
    expect(vi.mocked(getPlayerSlim)).toHaveBeenCalledWith('ghost');
  });

  it('sends the invitation through the clan service on a valid target', async () => {
    vi.mocked(requireClanMembership).mockResolvedValue({ auth: { playerId: 'alice' }, clanId: 'clanA' } as never);
    vi.mocked(getPlayerSlim).mockResolvedValue({ username: 'bob' } as never);
    vi.mocked(invitePlayerToClan).mockResolvedValue({ id: 'inv1' } as never);
    const res = await asHandler(invitePOST)(postReq('/api/clan/invite', { targetUsername: 'bob' }));
    const body = (await res.json()) as { success: boolean; invitation: { id: string } };
    expect(body.success).toBe(true);
    expect(body.invitation.id).toBe('inv1');
    expect(vi.mocked(invitePlayerToClan)).toHaveBeenCalledWith('clanA', 'alice', 'bob');
    expect(state.specs).toHaveLength(0); // no shim collection traffic remains
  });
});

// ============================================================================
// cron/player-snapshot
// ============================================================================
describe('/api/cron/player-snapshot (pg select + shared runner)', () => {
  it('GET 401s without the cron secret', async () => {
    const res = await asHandler(cronGET)(getReq('/api/cron/player-snapshot'));
    expect(res.status).toBe(401);
  });

  it('GET 401s with a wrong bearer', async () => {
    process.env.CRON_SECRET = 's3cret';
    const res = await asHandler(cronGET)(
      new NextRequest('http://localhost:3000/api/cron/player-snapshot', {
        headers: { authorization: 'Bearer wrong' },
      })
    );
    expect(res.status).toBe(401);
  });

  it('GET snapshots active players (last_login_date window)', async () => {
    process.env.CRON_SECRET = 's3cret';
    state.responder = () => [
      { username: 'alice', level: 4 },
      { username: 'bob', level: 9 },
    ];
    const res = await asHandler(cronGET)(
      new NextRequest('http://localhost:3000/api/cron/player-snapshot', {
        headers: { authorization: 'Bearer s3cret' },
      })
    );
    const body = (await res.json()) as { stats: { total: number; success: number; errors: number } };
    expect(body.stats).toEqual({ total: 2, success: 2, errors: 0 });
    expect(vi.mocked(capturePlayerSnapshot)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(capturePlayerSnapshot)).toHaveBeenNthCalledWith(1, 'alice', 4);
    const spec = state.specs[0];
    expect(tableOf(spec)).toBe('players');
    expect(spec.where).toBeTruthy();
  });

  it('POST 401s non-admins and runs for admins', async () => {
    authMock.value = { username: 'pleb', isAdmin: false };
    const denied = await asHandler(cronPOST)(postReq('/api/cron/player-snapshot', {}));
    expect(denied.status).toBe(401);

    authMock.value = { username: 'chief', isAdmin: true };
    state.responder = () => [{ username: 'alice', level: 4 }];
    const ok = await asHandler(cronPOST)(postReq('/api/cron/player-snapshot', {}));
    const body = (await ok.json()) as { stats: { total: number } };
    expect(body.stats.total).toBe(1);
  });
});

// ============================================================================
// static shim-census pin: none of the eight files touch the Mongo shim
// ============================================================================
describe('slice 3 census', () => {
  const FILES = [
    'app/api/chat/heartbeat/route.ts',
    'app/api/chat/online/route.ts',
    'app/api/chat/typing/route.ts',
    'app/api/player/stats/route.ts',
    'app/api/player/greeting/route.ts',
    'app/api/player/profile/route.ts',
    'app/api/clan/invite/route.ts',
    'app/api/cron/player-snapshot/route.ts',
  ];

  it('none of the eight routes reference the Mongo shim', () => {
    for (const f of FILES) {
      const src = readFileSync(f, 'utf8');
      expect(src.includes('lib/mongodb'), f).toBe(false);
      expect(/getCollection|getDatabase|connectToDatabase|getClientAndDatabase/.test(src), f).toBe(false);
    }
  });
});
