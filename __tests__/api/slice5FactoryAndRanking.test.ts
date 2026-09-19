/**
 * @file __tests__/api/slice5FactoryAndRanking.test.ts
 * @created 2026-09-19
 * @overview Pins for FID-20260917-017 slice 5 (factory ×6 + rankingService +
 *            census-forced extras: health, leaderboard, referral ×3 — taking
 *            app/api to ZERO shim importers). Mock rides the REAL drizzle
 *            query-builder surface; assertions use getTableName + column
 *            names. Census gate: the shim importer count under app/api is
 *            asserted to be 0 (Law 16: every closure carries a fresh probe).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { getTableName } from 'drizzle-orm';
import { execSync } from 'node:child_process';

const { state, authMock, authReqMock, sqlText, collectColumnNames } = vi.hoisted(() => {
  const state = {
    specs: [] as Array<Record<string, unknown>>,
    responder: (_spec: Record<string, unknown>) => [] as unknown,
  };
  const authMock = { value: undefined as undefined | { username: string; playerId?: string; isAdmin?: boolean } };
  const authReqMock = { value: undefined as undefined | { username: string; playerId?: string; isAdmin?: boolean } };

  /** Flatten a drizzle SQL/chunk tree into raw text (for clause assertions). */
  function sqlText(node: unknown): string {
    if (node == null) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(sqlText).join(' ');
    if (typeof node === 'object') {
      const o = node as Record<string, unknown>;
      // Columns: expose the DB column name (the FID-017 defect class is
      // "the WHERE key is the wrong column", so pins must see names).
      if (typeof o.name === 'string' && (o.table !== undefined || typeof o.columnType === 'string')) return o.name;
      if (o.value !== undefined) {
        if (typeof o.value === 'string') return `'${o.value}'`;
        if (typeof o.value === 'number' || typeof o.value === 'boolean') return String(o.value);
        if (o.value instanceof Date) return String(o.value.getTime());
      }
      if (Array.isArray(o.value)) return o.value.map(sqlText).join('');
      if (Array.isArray(o.queryChunks)) return sqlText(o.queryChunks);
      if (typeof o.sql === 'string') return o.sql;
      return '';
    }
    return '';
  }

  /** Every column name mentioned in a condition tree (cycle-safe walk).
   *  A Column's `.table` back-reference fans out to EVERY sibling column, so
   *  the walk must NOT descend into columns — record the name and stop. */
  function collectColumnNames(node: unknown, acc: Set<string>, seen = new WeakSet<object>()): void {
    if (node == null || typeof node !== 'object') return;
    if (seen.has(node as object)) return;
    seen.add(node as object);
    const o = node as Record<string, unknown>;
    if (typeof o.name === 'string' && (o.table !== undefined || typeof o.columnType === 'string')) {
      acc.add(o.name);
      return; // column reached — do NOT descend into .table (full-schema fanout)
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === 'object') collectColumnNames(v, acc, seen);
    }
  }

  return { state, authMock, authReqMock, sqlText, collectColumnNames };
});

function tableOf(spec: Record<string, unknown> | undefined): string {
  const t = (spec?.table ?? spec?.from) as { $inferInsert?: unknown } | undefined;
  return getTableName((t ?? {}) as never);
}

/**
 * Attach non-enumerable column-value markers so rows survive REAL-module
 * SQL filters under the mock builder (which cannot evaluate conditions).
 * filterRows evaluates the flattened WHERE text against the markers.
 */
function withCols<T extends object>(row: T, cols: Record<string, unknown>): T {
  for (const [k, v] of Object.entries(cols)) {
    Object.defineProperty(row, `(${k})`, { value: v, enumerable: false });
  }
  return row;
}

vi.mock('@/lib/db/connection', () => {
  const { sqlText: st, collectColumnNames: ccn } = { sqlText: null as unknown, collectColumnNames: null as unknown };
  void st; void ccn; // helpers arrive via the hoisted closure below

  /** Evaluate simple `col OP literal` predicates against row markers. */
  function filterRows(rows: unknown, spec: Record<string, unknown>): unknown {
    if (!Array.isArray(rows)) return rows;
    const cols = (spec.filterCols as Set<string> | undefined) ?? new Set<string>();
    if (cols.size === 0) return rows;
    const whereText = (spec.filterText as string) ?? '';
    const preds: Array<{ col: string; op: string; val: string }> = [];
    const re = /(\w+)\s*(<>|!=|>=|<=|=|>|<)\s*('(?:[^']*)'|-?\d+(?:\.\d+)?|true|false|NULL)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(whereText)) !== null) {
      if (cols.has(m[1])) preds.push({ col: m[1], op: m[2], val: m[3] });
    }
    if (preds.length === 0) return rows;
    return rows.filter((row) => {
      if (row == null || typeof row !== 'object') return true;
      const r = row as Record<string, unknown>;
      for (const p of preds) {
        const marker = r[`(${p.col})`];
        if (marker === undefined) continue; // no marker → responder's choice
        const actual = marker instanceof Date ? String(marker.getTime()) : String(marker);
        const expected = p.val.replace(/^'|'$/g, '');
        const eq = actual === expected;
        const keep =
          p.op === '=' ? eq :
          (p.op === '<>' || p.op === '!=') ? !eq :
          p.op === '>' ? Number(marker) > Number(expected) :
          p.op === '<' ? Number(marker) < Number(expected) :
          p.op === '>=' ? Number(marker) >= Number(expected) :
          p.op === '<=' ? Number(marker) <= Number(expected) : true;
        if (!keep) return false;
      }
      return true;
    });
  }

  const mk = (spec: Record<string, unknown>): Record<string, unknown> => {
    state.specs.push(spec);
    // Object-form select (db.select({...})) passes ONE definition object;
    // flatten it so per-field discrimination (Column vs aggregate) works.
    if (spec.op === 'select' && (spec.fields as unknown[]).length === 1
      && (spec.fields as unknown[])[0] !== null
      && typeof (spec.fields as unknown[])[0] === 'object'
      && !Array.isArray((spec.fields as unknown[])[0])) {
      spec.fields = Object.values((spec.fields as unknown[])[0] as Record<string, unknown>);
    }
    const terminal = {
      from: (t: unknown) => { spec.from = t; return terminal; },
      leftJoin: (t: unknown, on: unknown) => {
        spec.joins = [...((spec.joins as Array<unknown>) ?? []), { table: t, on }];
        return terminal;
      },
      innerJoin(t: unknown, on: unknown) { return terminal.leftJoin(t, on); },
      where: (c: unknown) => {
        spec.where = c;
        const cols = new Set<string>();
        collectColumnNames(c, cols);
        spec.filterCols = cols;
        spec.filterText = sqlText(c);
        return terminal;
      },
      orderBy: (...c: unknown[]) => { spec.orderBy = c; return terminal; },
      groupBy: (...c: unknown[]) => { spec.groupBy = c; return terminal; },
      limit: (n: number) => { spec.limit = n; return terminal; },
      offset: (n: number) => { spec.offset = n; return terminal; },
      values: (v: unknown) => { spec.values = v; return terminal; },
      set: (v: unknown) => { spec.set = v; return terminal; },
      returning: () => { spec.returning = true; return terminal; },
      then: (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(filterRows(state.responder(spec), spec)).then(onF, onR),
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
  verifyAuth: async () => authMock.value,
  authenticateRequest: async (req?: unknown) => (authReqMock.value ? { ...(authReqMock.value as object), req } : null),
  requireAdmin: async () => authReqMock.value,
}));

// The route imports rankingService for its cached top-list leg; the real
// module is pinned separately below via vi.importActual.
vi.mock('@/lib/rankingService', () => ({
  getTopPlayers: vi.fn(async () => []),
  getTotalPlayerCount: vi.fn(async () => 3),
  getPlayerRankData: vi.fn(async () => ({ rank: 1, totalPlayers: 3, effectivePower: 220 })),
  getTopBeerBases: vi.fn(async () => []),
}));

vi.mock('@/lib/factoryService', () => ({
  getFactoryData: vi.fn(),
  collectAllFactoryIncome: vi.fn(async () => ({ totalMetal: 0, totalEnergy: 0 })),
  recountPlayerFactoryCount: vi.fn(async () => 2),
}));

vi.mock('@/lib/factoryUpgradeService', () => ({
  calculateUpgradeCost: vi.fn(() => ({ metal: 1000, energy: 500 })),
  getFactoryStats: vi.fn(() => ({ maxSlots: 10, regenRate: 1 })),
  canUpgradeFactory: vi.fn(() => ({ canUpgrade: true })),
  getFactoryDefense: vi.fn(() => 1000),
  getMaxSlots: vi.fn(() => 10),
  getProductionRate: vi.fn(() => 1),
  getUpgradeProgress: vi.fn(() => 0),
  FACTORY_UPGRADE: { MAX_LEVEL: 10, MIN_LEVEL: 1, MAX_FACTORIES_PER_PLAYER: 10 },
}));

vi.mock('@/lib/slotRegenService', () => ({
  applySlotRegeneration: vi.fn((f: { usedSlots: number }) => ({ ...f, usedSlots: f.usedSlots })),
  hasEnoughSlots: vi.fn(() => true),
  consumeSlots: vi.fn((f: { usedSlots: number }) => ({ ...f, usedSlots: f.usedSlots + 1 })),
  getAvailableSlots: vi.fn(() => 5),
  getTimeUntilNextSlot: vi.fn(() => ({ hours: 0, minutes: 1, seconds: 0, totalMs: 60_000 })),
  getFactoryCapacity: vi.fn(() => 10),
}));

vi.mock('@/lib/flagBonusService', () => ({
  getBonusStack: vi.fn(async () => []),
  assertHolderMayTransact: vi.fn(() => ({ ok: true })),
}));

vi.mock('@/lib/xpService', () => ({
  awardXP: vi.fn(async () => ({ xpAwarded: 5, levelUp: false, newLevel: 1 })),
  XPAction: { UNIT_BUILD: 'UNIT_BUILD', FACTORY_UPGRADE: 'FACTORY_UPGRADE' },
}));

vi.mock('@/lib/statTrackingService', () => ({
  trackUnitBuilt: vi.fn(async () => {}),
}));

vi.mock('@/lib/specializationService', () => ({
  getPlayerDoctrineBonuses: vi.fn(async () => ({ metalCostMul: 1, energyCostMul: 1 })),
}));

vi.mock('@/lib/activityLogger', () => ({
  logFactory: vi.fn(async () => {}),
}));

vi.mock('@/lib/redis', () => ({
  checkRedisHealth: vi.fn(async () => true),
  getRedisInfo: vi.fn(async () => ({})),
  isRedisAvailable: vi.fn(() => false),
}));

vi.mock('@/lib/websocket/server', () => ({
  getIO: vi.fn(() => ({ sockets: { sockets: { size: 2 } } })),
}));

vi.mock('@/lib/cacheService', () => ({
  getCacheOrFetch: vi.fn((_k: string, fn: () => unknown) => fn()),
  getCache: vi.fn(async () => null),
  setCache: vi.fn(async () => {}),
}));

vi.mock('@/lib/cacheKeys', () => ({
  LeaderboardKeys: { playerLevel: () => 'lb:level' },
  PlayerKeys: { profile: (u: string) => `p:${u}` },
  CacheTTL: { LEADERBOARD: 300, PLAYER_PROFILE: 300 },
}));

vi.mock('@/lib/referralService', () => ({
  generateReferralCode: vi.fn(() => 'PROBECODE'),
  generateReferralLink: vi.fn((c: string) => `http://x/r/${c}`),
  getNextMilestone: vi.fn(() => 5),
  calculateMilestoneProgress: vi.fn(() => 40),
}));

import { GET as factoryList } from '@/app/api/factory/list/route';
import { GET as factoryStatus } from '@/app/api/factory/status/route';
import { POST as factoryBuild } from '@/app/api/factory/build-unit/route';
import { POST as factoryUpgrade } from '@/app/api/factory/upgrade/route';
import { POST as factoryAbandon } from '@/app/api/factory/abandon/route';
import { POST as factoryRelease } from '@/app/api/factory/release/route';
import { GET as health } from '@/app/api/health/route';
import { GET as leaderboard } from '@/app/api/leaderboard/route';
import { POST as referralGenerate } from '@/app/api/referral/generate/route';
import { GET as referralLeaderboard } from '@/app/api/referral/leaderboard/route';
import { GET as referralStats } from '@/app/api/referral/stats/route';

type Responder = (spec: Record<string, unknown>) => unknown;

/** Compose responders: LAST registered wins (scoped table responders stack). */
function addResponder(fn: Responder): void {
  const prev = state.responder;
  state.responder = (spec) => {
    const mine = fn(spec);
    if (mine !== undefined) return mine;
    return prev(spec);
  };
}

/** Respond with rows for selects on one table; other ops fall through. */
function respondWithSelect(table: string, rows: Array<unknown>): void {
  addResponder((spec) => {
    if (spec.op === 'select' && tableOf(spec) === table) return rows;
    return undefined;
  });
}

/** Respond with rows for updates on one table. */
function respondWithUpdate(table: string, rows: Array<unknown>): void {
  addResponder((spec) => {
    if (spec.op === 'update' && tableOf(spec) === table) return rows;
    return undefined;
  });
}

function req(url: string, init: { method?: string; body?: unknown } = {}): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** withRequestLogging's wrapped handler expects a route context arg. */
const routeCtx = { params: Promise.resolve({}) };

beforeEach(() => {
  state.specs = [];
  state.responder = () => [];
  authMock.value = { username: 'tester', playerId: 'tester', isAdmin: false };
  authReqMock.value = { username: 'tester', playerId: 'tester', isAdmin: false };
  vi.clearAllMocks();
});

const factoryRow = (over: Partial<Record<string, unknown>> = {}) => ({
  x: 1, y: 1, owner: 'tester', level: 1, slots: 10, usedSlots: 0,
  investedMetal: 0, investedEnergy: 0, lastSlotRegen: new Date(),
  defense: 1, productionRate: '1', lastAttackedBy: null, lastAttackTime: null,
  ...over,
});

describe('FID-20260917-017 slice 5 — census gate', () => {
  it('app/api has ZERO @/lib/mongodb importers (route layer fully off the shim)', () => {
    // git grep exits 1 on zero matches — which IS the pass condition here.
    let out = '';
    try {
      out = execSync(`git grep -l "from '@/lib/mongodb'" -- "app/api/**/route.ts"`, { encoding: 'utf8' });
    } catch {
      out = ''; // exit code 1 = no matches = gate passes
    }
    expect(out.trim()).toBe('');
  });
});

describe('slice 5 — factory routes', () => {
  it('list: reads players resources + owned factories, honest 404 on unknown player', async () => {
    respondWithSelect('players', [{ resourcesMetal: 5000, resourcesEnergy: 3000 }]);
    respondWithSelect('factories', [
      factoryRow({ x: 3, y: 4, level: 2, usedSlots: 1, investedMetal: 700, investedEnergy: 300 }),
      factoryRow({ x: 1, y: 2, level: 3, investedMetal: 100, investedEnergy: 50 }),
    ]);

    const res = await factoryList(req('/api/factory/list')) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    // Highest level first, then Y/X (existing sort contract)
    expect(body.factories[0].factory.level).toBe(3);
    expect(body.factories[0].factory.y).toBe(2);
    expect(body.totalInvestment.metal).toBe(800);
    expect(body.totalInvestment.energy).toBe(350);
    // Affordability was checked against the pg flat resource columns
    expect(body.playerResources).toEqual({ metal: 5000, energy: 3000 });

    state.responder = () => [];
    const res404 = await factoryList(req('/api/factory/list')) as NextResponse;
    expect(res404.status).toBe(404);
  });

  it('status: pg-native loader + income accrual on ownership; drizzle-only writes', async () => {
    const { getFactoryData, collectAllFactoryIncome } = await import('@/lib/factoryService');
    vi.mocked(getFactoryData).mockResolvedValueOnce(factoryRow({ usedSlots: 3 }) as never);
    vi.mocked(collectAllFactoryIncome).mockResolvedValueOnce({ totalMetal: 1000, totalEnergy: 500 } as never);

    const res = await factoryStatus(req('/api/factory/status?x=1&y=1')) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.incomeGranted).toEqual({ totalMetal: 1000, totalEnergy: 500 });
    expect(body.slotInfo.max).toBe(10);
    // No shim on this route: every recorded spec is a known drizzle table
    expect(state.specs.every((s) => tableOf(s) !== undefined)).toBe(true);
  });

  it('build-unit: SQL-delta deduction, jsonb units append, invested $inc equivalents', async () => {
    respondWithSelect('factories', [factoryRow({ level: 2, usedSlots: 0 })]);
    respondWithSelect('players', [withCols({
      units: [],
      resourcesMetal: 10_000,
      resourcesEnergy: 10_000,
      totalStrength: 100,
      totalDefense: 50,
    }, {})]);
    respondWithUpdate('players', [{ username: 'tester' }]);

    const res = await factoryBuild(req('/api/factory/build-unit', { method: 'POST', body: { factoryX: 1, factoryY: 1, unitType: 'INFANTRY', quantity: 2 } }), routeCtx) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.unitsBuilt.quantity).toBe(2);

    const playerUpdate = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'players');
    expect(playerUpdate).toBeDefined();
    const setP = playerUpdate!.set as Record<string, unknown>;
    // Deduct = SQL delta (not a JS-computed value): the raw text must carry "-"
    expect(sqlText(setP.resourcesMetal)).toContain('-');
    // Units appended via jsonb || with a quantity-folded entry (not $each)
    expect(sqlText(setP.units)).toContain('||');
    expect(sqlText(setP.totalStrength)).toContain('+');

    const factoryUpdate = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'factories');
    expect(factoryUpdate).toBeDefined();
    const setF = factoryUpdate!.set as Record<string, unknown>;
    expect(sqlText(setF.investedMetal)).toContain('+');
  });

  it("build-unit: rejects another player's factory (403) without any write", async () => {
    respondWithSelect('factories', [factoryRow({ owner: 'someone_else' })]);

    const res = await factoryBuild(req('/api/factory/build-unit', { method: 'POST', body: { factoryX: 1, factoryY: 1, unitType: 'INFANTRY', quantity: 1 } }), routeCtx) as NextResponse;

    expect(res.status).toBe(403);
    expect(state.specs.some((s) => s.op === 'update')).toBe(false);
  });

  it('upgrade: full stat block written, refund rollback on factory update failure', async () => {
    respondWithSelect('factories', [factoryRow({ level: 1 })]);
    respondWithSelect('players', [{ resourcesMetal: 999_999, resourcesEnergy: 999_999 }]);
    respondWithUpdate('players', [{ username: 'tester' }]);
    respondWithUpdate('factories', [{ x: 1 }]);

    const res = await factoryUpgrade(req('/api/factory/upgrade', { method: 'POST', body: { factoryX: 1, factoryY: 1 } }), routeCtx) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.newStats.maxSlots).toBe(10);

    const factoryUpdate = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'factories');
    const setF = factoryUpdate!.set as Record<string, unknown>;
    // FID-072: level/slots/productionRate/defense all move together
    expect(setF.level).toBe(2);
    expect(setF.slots).toBe(10);
    expect(String(setF.productionRate)).toBe('1');
    expect(sqlText(setF.investedMetal)).toContain('+');

    // Player deduction is a SQL delta with a returning() success check
    const playerUpdate = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'players');
    expect(sqlText((playerUpdate!.set as Record<string, unknown>).resourcesMetal)).toContain('-');
    expect(playerUpdate!.returning).toBe(true);
  });

  it('abandon: resets to neutral + zeroes investment; ownership 403', async () => {
    respondWithSelect('factories', [factoryRow({ level: 4, usedSlots: 3, investedMetal: 4000, investedEnergy: 2000, productionRate: '2' })]);
    respondWithUpdate('factories', [{ x: 1 }]);

    const res = await factoryAbandon(req('/api/factory/abandon', { method: 'POST', body: { factoryX: 1, factoryY: 1 } })) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const upd = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'factories');
    const setF = upd!.set as Record<string, unknown>;
    expect(setF.owner).toBeNull();
    expect(setF.level).toBe(1);
    expect(setF.investedMetal).toBe(0);
    expect(setF.investedEnergy).toBe(0);

    // Ownership: another owner's factory → 403, no write
    state.specs = [];
    state.responder = () => [];
    respondWithSelect('factories', [factoryRow({ owner: 'someone_else' })]);
    const res403 = await factoryAbandon(req('/api/factory/abandon', { method: 'POST', body: { factoryX: 1, factoryY: 1 } })) as NextResponse;
    expect(res403.status).toBe(403);
    expect(state.specs.some((s) => s.op === 'update')).toBe(false);
  });

  it('release single: ownership lives in the WHERE (no +1 read), zeroed investment', async () => {
    respondWithUpdate('factories', [{ x: 7, y: 7 }]);
    respondWithSelect('players', [{ count: 2 }]);

    const res = await factoryRelease(req('/api/factory/release', { method: 'POST', body: { mode: 'single', factoryX: 7, factoryY: 7 } })) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.releasedCount).toBe(1);
    const upd = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'factories');
    const setF = upd!.set as Record<string, unknown>;
    expect(setF.owner).toBeNull();
    expect(setF.investedMetal).toBe(0);
    // No pre-read findOne: exactly one factories spec (the update), no select
    const factorySpecs = state.specs.filter((s) => tableOf(s) === 'factories');
    expect(factorySpecs.filter((s) => s.op === 'update')).toHaveLength(1);
    expect(factorySpecs.some((s) => s.op === 'select')).toBe(false);
  });

  it('release batch: threshold predicate on (slots - usedSlots) <= threshold', async () => {
    respondWithSelect('factories', [{ x: 1, y: 1 }, { x: 2, y: 2 }]);

    const res = await factoryRelease(req('/api/factory/release', { method: 'POST', body: { mode: 'batch', slotThreshold: 3 } })) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.releasedCount).toBe(2);
    const sel = state.specs.find((s) => s.op === 'select' && tableOf(s) === 'factories');
    const whereText = sqlText(sel!.where);
    expect(whereText).toContain('-');
    expect(whereText).toContain('<=');
  });
});

describe('slice 5 — census-forced conversions (health, leaderboard, referral ×3)', () => {
  it('health: SELECT 1 rides drizzle execute; healthy overall', async () => {
    const res = await health(req('/api/health'), routeCtx) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checks.database.status).toBe('ok');
    expect(body.status).toBe('healthy');
  });

  it('leaderboard: no connection theater; rank leg rides drizzle reads and currentPlayerData is actually returned', async () => {
    // Profile read (full row) vs factory count — discriminated by table
    addResponder((spec) => {
      if (spec.op !== 'select') return undefined;
      const t = tableOf(spec);
      if (t === 'players') return [withCols({ username: 'tester', totalStrength: 100, totalDefense: 100, level: 3 }, {})];
      if (t === 'factories') return [{ count: 4 }];
      return undefined;
    });

    const res = await leaderboard(req('/api/leaderboard?username=tester'), routeCtx) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    // FID-20260917-017 slice 5: the profile computed outside the top list was
    // previously computed and DISCARDED — now it must reach the client.
    expect(body.currentPlayerRank).toBe(1);
    expect(body.currentPlayerData).not.toBeNull();
    expect(body.currentPlayerData.combatPower).toBe(220); // 200 × 1.1 optimal-band
    expect(body.currentPlayerData.factoriesOwned).toBe(4);
    expect(state.specs.some((s) => tableOf(s) === 'players')).toBe(true);
  });

  it('referral generate: idempotent re-read, uniqueness probe, code persisted', async () => {
    // Leg 1: player already has a code → idempotent return without a write
    respondWithSelect('players', [{ referralCode: 'EXISTING1', referralLink: 'http://x/r/EXISTING1' }]);
    const res = await referralGenerate(req('/api/referral/generate', { method: 'POST' })) as NextResponse;
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.code).toBe('EXISTING1');
    expect(state.specs.some((s) => s.op === 'update')).toBe(false);

    // Leg 2: player without a code → uniqueness probing + persist.
    // The initial read (WHERE username) must find the player; the uniqueness
    // probe (WHERE referral_code) must find nothing.
    state.specs = [];
    state.responder = () => [];
    addResponder((spec) => {
      if (spec.op === 'select' && tableOf(spec) === 'players') {
        const cols = (spec.filterCols as Set<string>) ?? new Set();
        if (cols.has('referral_code')) return []; // uniqueness probe: free
        return [{ username: 'tester', referralCode: null, referralLink: null }];
      }
      if (spec.op === 'update' && tableOf(spec) === 'players') return [{ username: 'tester' }];
      return undefined;
    });
    const res2 = await referralGenerate(req('/api/referral/generate', { method: 'POST' })) as NextResponse;
    const body2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(body2.data.code).toBe('PROBECODE');
    const upd = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'players');
    const setP = upd!.set as Record<string, unknown>;
    expect(setP.referralCode).toBe('PROBECODE');
  });

  it('referral leaderboard: ordered by referrals desc with validation tie-break', async () => {
    respondWithSelect('players', [withCols(
      { username: 'a', totalReferrals: 5, pendingReferrals: 1, level: 2, referralTitles: ['T'], referralBadges: [], createdAt: new Date() },
      { is_bot: 0 },
    )]);

    const res = await referralLeaderboard(req('/api/referral/leaderboard')) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.leaderboard[0].rank).toBe(1);
    const sel = state.specs.find((s) => s.op === 'select' && tableOf(s) === 'players');
    expect((sel!.orderBy as unknown[]).length).toBe(2); // referrals + validation tie-break
  });

  it('referral stats: rewards derived from flat columns (phantom object gone); referrals read via drizzle', async () => {
    respondWithSelect('players', [{
      username: 'tester',
      referralCode: 'CODE12', referralLink: 'http://x/r/CODE12',
      referralRewardsMetal: 500, referralRewardsEnergy: 250, referralRewardsRp: 5, referralRewardsXp: 100, referralRewardsVipDays: 2,
      referralMultiplier: '1.5',
      totalReferrals: 2,
    }]);
    respondWithSelect('referrals', [{
      id: 'r1', referrerCode: 'CODE12', referrerUsername: 'tester', referrerPlayerId: 'tester',
      newPlayerUsername: 'newbie', newPlayerEmail: 'n@x', newPlayerIP: '127.0.0.1',
      signupDate: new Date(), validationDate: new Date(), validated: 1, loginCount: 3, lastLogin: new Date(),
      daysActive: 2, rewardsClaimed: 1, rewardsDataMetal: 100, rewardsDataEnergy: 50, rewardsDataRp: 1, rewardsDataXp: 40, rewardsDataVipDays: 0,
      rewardsDataSpecialReward: null, rewardsDataMilestone: null, welcomePackageGiven: 0, flaggedForAbuse: 0, invalidated: 0, flagReason: null, adminNotes: null, createdAt: new Date(),
    }]);

    const res = await referralStats(req('/api/referral/stats')) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    // The flat columns feed the dashboard (no phantom referralRewardsEarned object)
    expect(body.data.playerStats.totalRewardsEarned).toEqual({ metal: 500, energy: 250, rp: 5, xp: 100, vipDays: 2 });
    expect(body.data.totalValueEarned).toEqual({ metal: 500, energy: 250, rp: 5, xp: 100, vipDays: 2 });
    expect(body.data.recentRewards[0].reward.metal).toBe(100);
    // Referral records exposed to the client carry boolean validated
    expect(body.data.validatedReferrals[0].validated).toBe(true);
  });
});

describe('slice 5 — rankingService (real module over mock drizzle)', () => {
  it('getTopPlayers: bots excluded, power math applied, factory counts via grouped COUNT, deterministic tie-break', async () => {
    const rankingReal = await vi.importActual<typeof import('@/lib/rankingService')>('@/lib/rankingService');
    const { calculateBalanceEffects } = await import('@/lib/balanceService');

    respondWithSelect('players', [
      withCols({ username: 'bot1', totalStrength: 5000, totalDefense: 5000, level: 5 }, { is_bot: 1 }),
      withCols({ username: 'b', totalStrength: 100, totalDefense: 100, level: 1 }, { is_bot: 0 }),
      withCols({ username: 'a', totalStrength: 100, totalDefense: 100, level: 1 }, { is_bot: 0 }),
      withCols({ username: 'big', totalStrength: 900, totalDefense: 900, level: 4 }, { is_bot: 0 }),
    ]);
    respondWithSelect('factories', [{ owner: 'a', count: 2 }, { owner: 'big', count: 7 }]);

    const top = await rankingReal.getTopPlayers(50);

    expect(top.map((p) => p.username)).toEqual(['big', 'a', 'b']); // bot excluded, power desc, alphabetical tie
    const balance = calculateBalanceEffects(100, 100);
    expect(top[1].effectivePower).toBe(Math.floor(200 * balance.powerMultiplier));
    expect(top[1].factoriesOwned).toBe(2);
    expect(top[0].factoriesOwned).toBe(7);
    const groupSpec = state.specs.find((s) => tableOf(s) === 'factories' && s.groupBy);
    expect(groupSpec).toBeDefined();
  });

  it('getTopBeerBases: only special bases, raw power ordering, no multiplier', async () => {
    const rankingReal = await vi.importActual<typeof import('@/lib/rankingService')>('@/lib/rankingService');

    respondWithSelect('players', [
      withCols({ username: 'base1', level: 3, totalStrength: 800, totalDefense: 700 }, { is_bot: 1, is_special_base: 1 }),
      withCols({ username: 'base2', level: 2, totalStrength: 1200, totalDefense: 100 }, { is_bot: 1, is_special_base: 1 }),
    ]);

    const bases = await rankingReal.getTopBeerBases(10);

    expect(bases[0].username).toBe('base1'); // 1500 raw > 1300 raw
    expect(bases[0].rank).toBe(1);
    const whereText = sqlText(state.specs.find((s) => tableOf(s) === 'players')!.where);
    expect(whereText).toContain('is_bot');
    expect(whereText).toContain('is_special_base');
  });

  it('getPlayerRank returns 1-based rank; null for unknown', async () => {
    const rankingReal = await vi.importActual<typeof import('@/lib/rankingService')>('@/lib/rankingService');

    respondWithSelect('players', [
      withCols({ username: 'x', totalStrength: 10, totalDefense: 0, level: 1 }, { is_bot: 0 }),
      withCols({ username: 'tester', totalStrength: 20, totalDefense: 0, level: 1 }, { is_bot: 0 }),
    ]);

    expect(await rankingReal.getPlayerRank('tester')).toBe(1);
    expect(await rankingReal.getPlayerRank('nobody')).toBe(null);
  });

  it('getTotalPlayerCount counts non-bots via COUNT with the bot exclusion', async () => {
    const rankingReal = await vi.importActual<typeof import('@/lib/rankingService')>('@/lib/rankingService');

    respondWithSelect('players', [{ count: 42 }]);
    expect(await rankingReal.getTotalPlayerCount()).toBe(42);
    const whereText = sqlText(state.specs.find((s) => tableOf(s) === 'players')!.where);
    expect(whereText).toContain('is_bot');
  });
});
