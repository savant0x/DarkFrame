/**
 * @file __tests__/api/clusterB2PgRewrites.test.ts
 * @created 2026-09-17
 * @overview Pins for FID-20260917-016 (Cluster B batch 2): the four real pg
 *            rewrites (ban-player, clear-flags, logs-cleanup, build-unit) plus
 *            source pins proving the clientPromise class is gone from all nine
 *            batch files. Strategy: db mocked at '@/lib/db/connection', real
 *            drizzle tables identified by getTableName, where-chains are
 *            thenable with optional .returning(), drizzle-orm operators mocked
 *            over the actual module (keeps the shim's transitive `is` import).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { routeLoggerMocks } = vi.hoisted(() => {
  const routeLoggerMocks = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    time: vi.fn(() => vi.fn()),
  };
  return { routeLoggerMocks };
});

vi.mock('@/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib')>();
  return {
    ...actual,
    withRequestLogging: (h: unknown) => h,
    createRouteLogger: () => routeLoggerMocks,
    createRateLimiter: () => (h: unknown) => h,
  };
});

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown) => ({ op: 'eq', col: String(col), val }),
    and: (...parts: unknown[]) => ({ op: 'and', parts }),
    lt: (col: unknown, val: unknown) => ({ op: 'lt', col: String(col), val }),
    sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ op: 'sql', text: String(strings[0]), vals }),
  };
});

// ── drizzle mock state + builder graph ───────────────────────────────────────
type Rec = Record<string, unknown>;
const drizzleState = {
  selectResult: [] as Rec[],
  selectCalls: [] as { table: string }[],
  updateCalls: [] as { table: string; set?: unknown; where?: unknown; hasReturning?: boolean }[],
  deleteCalls: [] as { table: string; where?: unknown; hasReturning?: boolean }[],
  insertCalls: [] as { table: string; values?: unknown }[],
  updateReturning: [] as Rec[],
  deleteReturning: [] as Rec[],
};

vi.mock('@/lib/db/connection', async () => {
  const { getTableName } = await import('drizzle-orm');
  const nameOf = (t: unknown): string => {
    try {
      return getTableName(t as never);
    } catch {
      return String(t);
    }
  };

  const selectChain = () => {
    const chain: Rec & { _then?: unknown } = {
      from: vi.fn((t: unknown) => {
        drizzleState.selectCalls.push({ table: nameOf(t) });
        return chain;
      }),
      where: vi.fn((w: unknown) => {
        chain._where = w;
        return chain;
      }),
      limit: vi.fn(() => Promise.resolve(drizzleState.selectResult)),
      orderBy: vi.fn(() => chain),
      then: (res: (v: Rec[]) => void) => Promise.resolve(drizzleState.selectResult).then(res),
    };
    return chain;
  };

  const updateChain = (t: unknown) => {
    const rec: { table: string; set?: unknown; where?: unknown; hasReturning?: boolean } = { table: nameOf(t) };
    drizzleState.updateCalls.push(rec);
    const chain: Rec = {
      set: vi.fn((s: unknown) => {
        rec.set = s;
        return chain;
      }),
      where: vi.fn((w: unknown) => {
        rec.where = w;
        return chain;
      }),
      returning: vi.fn(() => {
        rec.hasReturning = true;
        return Promise.resolve(drizzleState.updateReturning);
      }),
      then: (res: (v: unknown) => void) => Promise.resolve(drizzleState.updateReturning).then(res),
    };
    return chain;
  };

  const deleteChain = (t: unknown) => {
    const rec: { table: string; where?: unknown; hasReturning?: boolean } = { table: nameOf(t) };
    drizzleState.deleteCalls.push(rec);
    const chain: Rec = {
      where: vi.fn((w: unknown) => {
        rec.where = w;
        return chain;
      }),
      returning: vi.fn(() => {
        rec.hasReturning = true;
        return Promise.resolve(drizzleState.deleteReturning);
      }),
      then: (res: (v: unknown) => void) => Promise.resolve(drizzleState.deleteReturning).then(res),
    };
    return chain;
  };

  const insertChain = (t: unknown) => {
    const rec: { table: string; values?: unknown } = { table: nameOf(t) };
    drizzleState.insertCalls.push(rec);
    return {
      values: vi.fn((v: unknown) => {
        rec.values = v;
        return Promise.resolve(undefined);
      }),
    };
  };

  const db = {
    select: vi.fn(() => selectChain()),
    update: vi.fn((t: unknown) => updateChain(t)),
    delete: vi.fn((t: unknown) => deleteChain(t)),
    insert: vi.fn((t: unknown) => insertChain(t)),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: vi.fn((t: unknown) => {
          const rec: { table: string; set?: unknown; where?: unknown } = { table: nameOf(t) };
          drizzleState.updateCalls.push(rec);
          const chain: Rec = {
            set: vi.fn((s: unknown) => {
              rec.set = s;
              return chain;
            }),
            where: vi.fn((w: unknown) => {
              rec.where = w;
              return chain;
            }),
            returning: vi.fn(() => Promise.resolve([{ x: 1 }])),
          };
          return chain;
        }),
      };
      return fn(tx);
    }),
  };
  return { db };
});

// ── service mocks ────────────────────────────────────────────────────────────
vi.mock('@/lib/authMiddleware', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}));
vi.mock('@/lib/playerService', () => ({
  getPlayer: vi.fn(),
}));
vi.mock('@/lib/flagBonusService', () => ({
  getBonusStack: vi.fn(async () => []),
  assertHolderMayTransact: vi.fn(() => ({ ok: true })),
}));
vi.mock('@/lib/specializationService', () => ({
  getPlayerDoctrineBonuses: vi.fn(async () => ({ metalCostMul: 1, energyCostMul: 1 })),
}));
vi.mock('@/lib/activityLogService', () => ({
  cleanupOldLogs: vi.fn(async () => 42),
}));
vi.mock('@/lib/statTrackingService', () => ({
  trackUnitBuilt: vi.fn(async () => undefined),
}));

import { POST as banPost, DELETE as banDelete } from '@/app/api/admin/ban-player/route';
import { POST as clearFlagsPost } from '@/app/api/admin/anti-cheat/clear-flags/route';
import { POST as cleanupPost } from '@/app/api/logs/cleanup/route';
import { GET as buildUnitGet, POST as buildUnitPost } from '@/app/api/player/build-unit/route';
import { requireAdmin, getAuthenticatedUser } from '@/lib/authMiddleware';
import { getPlayer } from '@/lib/playerService';
import { cleanupOldLogs } from '@/lib/activityLogService';

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedGetAuthUser = vi.mocked(getAuthenticatedUser);
const mockedGetPlayer = vi.mocked(getPlayer);
const mockedCleanupOldLogs = vi.mocked(cleanupOldLogs);

const banPostH = banPost as unknown as (req: NextRequest) => Promise<NextResponse>;
const banDeleteH = banDelete as unknown as (req: NextRequest) => Promise<NextResponse>;
const clearFlagsPostH = clearFlagsPost as unknown as (req: NextRequest) => Promise<NextResponse>;
const cleanupPostH = cleanupPost as unknown as (req: NextRequest) => Promise<NextResponse>;
const buildUnitGetH = buildUnitGet as unknown as (req: NextRequest) => Promise<NextResponse>;
const buildUnitPostH = buildUnitPost as unknown as (req: NextRequest) => Promise<NextResponse>;

function req(url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) {
  return new NextRequest(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  drizzleState.selectResult = [];
  drizzleState.selectCalls = [];
  drizzleState.updateCalls = [];
  drizzleState.deleteCalls = [];
  drizzleState.insertCalls = [];
  drizzleState.updateReturning = [];
  drizzleState.deleteReturning = [];
  mockedRequireAdmin.mockResolvedValue({ username: 'admin', playerId: 'admin', isAdmin: true } as never);
});

// ─────────────────────────────────────────────────────────────────────────────
// Source pins: the clientPromise class is gone from all nine batch files
// ─────────────────────────────────────────────────────────────────────────────
describe('FID-20260917-016 source pins', () => {
  const nine = [
    'app/api/friends/route.ts',
    'app/api/friends/search/route.ts',
    'app/api/dm/route.ts',
    'app/api/dm/[id]/route.ts',
    'app/api/dm/[id]/read/route.ts',
    'app/api/admin/ban-player/route.ts',
    'app/api/admin/anti-cheat/clear-flags/route.ts',
    'app/api/logs/cleanup/route.ts',
    'app/api/player/build-unit/route.ts',
  ];

  it.each(nine)('%s: no clientPromise import or shim client usage', async (file) => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/import clientPromise/);
    expect(src).not.toMatch(/import\s*\{[^}]*\}\s*from\s*'@\/lib\/mongodb'/);
    expect(src).not.toMatch(/await clientPromise/);
    expect(src).not.toMatch(/\.collection\(/);
    expect(src).not.toMatch(/\.insertOne\(|\.updateOne\(|\.deleteMany\(|\.countDocuments\(|\.bulkWrite\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ban-player POST
// ─────────────────────────────────────────────────────────────────────────────
describe('ban-player POST (pg)', () => {
  it('inserts a bans row with generated id + createdAt + smallint flags; updates the player; writes mod_log', async () => {
    drizzleState.selectResult = [{ username: 'victim', rank: 2, vipTier: null, resourcesMetal: 10, resourcesEnergy: 5 }];
    const res = await banPostH(req('http://localhost/api/admin/ban-player', {
      method: 'POST',
      body: JSON.stringify({ username: 'victim', reason: 'test ban reason', durationDays: 3, autoResolveFlags: true }),
    }));
    expect(res.status).toBe(200);

    const banInsert = drizzleState.insertCalls.find((c) => c.table === 'bans');
    expect(banInsert).toBeDefined();
    const v = banInsert!.values as Rec;
    expect(String(v.id)).toMatch(/^[0-9a-f]{24}$/);
    expect(v.createdAt).toBeInstanceOf(Date);
    expect(v.isPermanent).toBe(0); // duration set → not permanent (smallint)
    expect(v.active).toBe(1);
    expect(v.playerId).toBe('victim');
    expect(v.moderatorId).toBe('admin');
    expect(v.expiresAt).toBeInstanceOf(Date);

    const playerUpdate = drizzleState.updateCalls.find((c) => c.table === 'players');
    expect(playerUpdate).toBeDefined();
    expect((playerUpdate!.set as Rec).banned).toBe(1);

    // D5: only `resolved` flips; evidence rides metadata jsonb
    const flagUpdate = drizzleState.updateCalls.find((c) => c.table === 'player_flags');
    expect(flagUpdate).toBeDefined();
    const fset = flagUpdate!.set as Rec;
    expect(fset.resolved).toBe(1);
    expect(fset.metadata).toEqual(expect.objectContaining({ resolvedBy: 'admin' }));
    expect(fset).not.toHaveProperty('resolvedBy');
    expect(fset).not.toHaveProperty('adminNotes');

    // D1: audit lands in mod_log, keyed with NOT NULL columns supplied
    const audit = drizzleState.insertCalls.find((c) => c.table === 'mod_log');
    expect(audit).toBeDefined();
    const av = audit!.values as Rec;
    expect(av.action).toBe('BAN_PLAYER');
    expect(av.moderatorId).toBe('admin');
    expect(av.createdAt).toBeInstanceOf(Date);
  });

  it('refuses to ban admin-rank players (rank >= 5)', async () => {
    drizzleState.selectResult = [{ username: 'boss', rank: 5, vipTier: null, resourcesMetal: 0, resourcesEnergy: 0 }];
    const res = await banPostH(req('http://localhost/api/admin/ban-player', {
      method: 'POST',
      body: JSON.stringify({ username: 'boss', reason: 'nope not allowed' }),
    }));
    expect(res.status).toBe(403);
    expect(drizzleState.insertCalls.find((c) => c.table === 'bans')).toBeUndefined();
  });

  it('404s when the player does not exist', async () => {
    drizzleState.selectResult = [];
    const res = await banPostH(req('http://localhost/api/admin/ban-player', {
      method: 'POST',
      body: JSON.stringify({ username: 'ghost', reason: 'nobody home ok' }),
    }));
    expect([404, 400]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ban-player DELETE (unban)
// ─────────────────────────────────────────────────────────────────────────────
describe('ban-player DELETE (unban, pg)', () => {
  it('clears the five real ban columns (D4); no phantom unbannedAt/unbannedBy keys', async () => {
    drizzleState.updateReturning = [{ username: 'victim' }];
    const res = await banDeleteH(req('http://localhost/api/admin/ban-player?username=victim', { method: 'DELETE' }));
    expect(res.status).toBe(200);

    const playerUpdate = drizzleState.updateCalls.find((c) => c.table === 'players');
    expect(playerUpdate).toBeDefined();
    const s = playerUpdate!.set as Rec;
    expect(s.banned).toBe(0);
    expect(s.bannedAt).toBeNull();
    expect(s.bannedBy).toBeNull();
    expect(s.banReason).toBeNull();
    expect(s.banExpiresAt).toBeNull();
    expect(s).not.toHaveProperty('unbannedAt');
    expect(s).not.toHaveProperty('unbannedBy');

    const bansUpdate = drizzleState.updateCalls.find((c) => c.table === 'bans');
    expect(bansUpdate).toBeDefined();
    expect((bansUpdate!.set as Rec).active).toBe(0);

    const audit = drizzleState.insertCalls.find((c) => c.table === 'mod_log');
    expect(audit).toBeDefined();
    expect((audit!.values as Rec).action).toBe('UNBAN_PLAYER');
  });

  it('404s when no player row matched', async () => {
    drizzleState.updateReturning = [];
    const res = await banDeleteH(req('http://localhost/api/admin/ban-player?username=ghost', { method: 'DELETE' }));
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clear-flags
// ─────────────────────────────────────────────────────────────────────────────
describe('clear-flags (pg)', () => {
  it('deletes via .returning() for an honest count and writes a mod_log CLEAR_FLAGS row', async () => {
    drizzleState.selectResult = [{ flagType: 'resource_magnitude', severity: 'LOW', createdAt: new Date('2026-09-01') }];
    drizzleState.deleteReturning = [{ id: 'a' }, { id: 'b' }];
    const res = await clearFlagsPostH(req('http://localhost/api/admin/anti-cheat/clear-flags', {
      method: 'POST',
      body: JSON.stringify({ username: 'victim' }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flagsCleared).toBe(2);

    const del = drizzleState.deleteCalls.find((c) => c.table === 'player_flags');
    expect(del).toBeDefined();
    expect(del!.hasReturning).toBe(true);

    const audit = drizzleState.insertCalls.find((c) => c.table === 'mod_log');
    expect(audit).toBeDefined();
    const av = audit!.values as Rec;
    expect(av.action).toBe('CLEAR_FLAGS');
    const details = JSON.parse(av.details as string);
    expect(details.flagsCleared).toBe(2);
    expect(details.previousFlags[0].flagType).toBe('resource_magnitude');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// logs/cleanup
// ─────────────────────────────────────────────────────────────────────────────
describe('logs/cleanup (pg)', () => {
  it('dry-run counts player_activity with a single cutoff, mirroring cleanupOldLogs (D2)', async () => {
    drizzleState.selectResult = [{ id: 'x1' }, { id: 'x2' }];
    const res = await cleanupPostH(req('http://localhost/api/logs/cleanup?dryRun=true', {
      method: 'POST',
      body: JSON.stringify({ activityRetentionDays: 90, battleRetentionDays: 180, adminRetentionDays: 365 }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activityLogsToDelete).toBe(2);
    // No ActionLog anywhere — the count reads the real player_activity table
    expect(drizzleState.selectCalls.some((c) => c.table.toLowerCase().includes('actionlog'))).toBe(false);
    expect(drizzleState.selectCalls.some((c) => c.table === 'player_activity')).toBe(true);
  });

  it('non-dry-run routes activity deletion through cleanupOldLogs', async () => {
    const res = await cleanupPostH(req('http://localhost/api/logs/cleanup', { method: 'POST', body: JSON.stringify({}) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activityLogsDeleted).toBe(42);
    expect(mockedCleanupOldLogs).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// build-unit
// ─────────────────────────────────────────────────────────────────────────────
describe('build-unit (pg)', () => {
  const FAME = {
    username: 'fame', level: 10, researchPoints: 500, units: [] as unknown[],
    resources: { metal: 10000, energy: 10000 },
    totalStrength: 5, totalDefense: 0, factoryCount: 1,
  };

  it('GET reads factories from pg and returns the established wire shape', async () => {
    mockedGetAuthUser.mockResolvedValue({ username: 'fame', playerId: 'fame' } as never);
    mockedGetPlayer.mockResolvedValue({ ...FAME } as never);
    drizzleState.selectResult = [{ x: 2, y: 3, slots: 20, usedSlots: 5 }];

    const res = await buildUnitGetH(req('http://localhost/api/player/build-unit', { method: 'GET' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.playerStats.factoryBuildSlots).toBe(15); // 20 − 5, real pg values
    expect(body.playerStats.availableSlots).toBe(150);   // 100 + 1×50
    expect(Array.isArray(body.units)).toBe(true);
    expect(drizzleState.selectCalls.some((c) => c.table === 'factories')).toBe(true);
  });

  it('POST charges resources via SQL deltas on the flat columns, appends units as jsonb, and lands invested deltas (D3)', async () => {
    mockedGetAuthUser.mockResolvedValue({ username: 'fame', playerId: 'fame' } as never);
    mockedGetPlayer.mockResolvedValue({ ...FAME } as never);
    drizzleState.selectResult = [{ x: 2, y: 3, slots: 20, usedSlots: 5 }];
    drizzleState.updateReturning = [{ username: 'fame' }];

    const res = await buildUnitPostH(req('http://localhost/api/player/build-unit', {
      method: 'POST',
      body: JSON.stringify({ username: 'fame', unitTypeId: 'rifleman', quantity: 2 }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // real blueprint: 190 metal / 210 energy each
    expect(body.costPaid).toEqual({ metal: 380, energy: 420 });
    expect(body.newStats.totalStrength).toBe(195); // 5 + 2×95

    const playerUpdate = drizzleState.updateCalls.find((c) => c.table === 'players');
    expect(playerUpdate).toBeDefined();
    const s = playerUpdate!.set as Rec;
    // shim-parity charge: the old $inc 'resources.metal' dot-path → SQL delta on resourcesMetal
    expect((s.resourcesMetal as Rec).op).toBe('sql');
    expect((s.resourcesEnergy as Rec).op).toBe('sql');
    expect((s.units as Rec).op).toBe('sql'); // jsonb append
    expect(s.totalStrength).toBe(195);

    // D3: factory slot write carries investedMetal/investedEnergy deltas
    const factoryUpdates = drizzleState.updateCalls.filter((c) => c.table === 'factories');
    expect(factoryUpdates.length).toBeGreaterThan(0);
    const fset = factoryUpdates[0].set as Rec;
    expect(fset).toHaveProperty('usedSlots');
    expect((fset.investedMetal as Rec).op).toBe('sql');
    expect((fset.investedEnergy as Rec).op).toBe('sql');
  });

  it('refuses builds with no factories', async () => {
    mockedGetAuthUser.mockResolvedValue({ username: 'fame', playerId: 'fame' } as never);
    mockedGetPlayer.mockResolvedValue({ ...FAME, factoryCount: 0 } as never);
    drizzleState.selectResult = [];

    const res = await buildUnitPostH(req('http://localhost/api/player/build-unit', {
      method: 'POST',
      body: JSON.stringify({ username: 'fame', unitTypeId: 'rifleman', quantity: 1 }),
    }));
    expect(res.status).toBe(400);
  });
});
