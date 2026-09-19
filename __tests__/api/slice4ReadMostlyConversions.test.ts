/**
 * @file __tests__/api/slice4ReadMostlyConversions.test.ts
 * @created 2026-09-18
 * @overview Pins for FID-20260917-017 slice 4 (7 read-mostly conversions off
 *            the Mongo shim): admin achievement-stats/active-sessions/bot-
 *            factory-economy, auction/my-bids, clan/leaderboard, shrine
 *            activate/boost-all. Mock rides the REAL drizzle query-builder
 *            surface; specs record drizzle table objects so assertions use
 *            getTableName + column names. The shim-extraction helpers
 *            (docPathContainment, shapeRowAuctions, rowToClan) run UNMOCKED —
 *            their behavior is part of the contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { getTableName } from 'drizzle-orm';

const { state, authMock, requireAdminMock } = vi.hoisted(() => {
  const state = {
    specs: [] as Array<Record<string, unknown>>,
    raw: [] as string[],
    responder: (_spec: Record<string, unknown>) => [] as unknown,
  };
  const authMock = { value: undefined as undefined | { username: string; playerId?: string; isAdmin?: boolean } };
  const requireAdminMock = {
    value: undefined as undefined | NextResponse | { username: string; playerId?: string; isAdmin?: boolean },
  };
  return { state, authMock, requireAdminMock };
});

function tableOf(spec: Record<string, unknown> | undefined): string {
  const t = (spec?.table ?? spec?.from) as { $inferInsert?: unknown } | undefined;
  return getTableName((t ?? {}) as never);
}

/** Flatten a drizzle SQL/chunk tree into raw text (for clause assertions). */
function sqlText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(sqlText).join(' ');
  if (typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o.value === 'string') return o.value;
    if (Array.isArray(o.value)) return o.value.map(sqlText).join('');
    if (Array.isArray(o.queryChunks)) return sqlText(o.queryChunks);
    if (typeof o.sql === 'string') return o.sql;
    return '';
  }
  return '';
}

// The terminal builder lives INSIDE the factory (hoisted-state closure; every
// call RECORDS its spec). Raw SQL fragments (sql`` values) are captured for
// containment/clause assertions.
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
      offset: (n: number) => { spec.offset = n; return terminal; },
      values: (v: unknown) => { spec.values = v; return terminal; },
      set: (v: unknown) => { spec.set = v; return terminal; },
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
      execute: async (q: unknown) => {
        state.raw.push(String((q as { queryChunks?: unknown[] })?.queryChunks ?? ''));
        return { rows: [] };
      },
    },
  };
});

vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: async () => authMock.value,
  verifyAuth: async () => authMock.value,
  requireAdmin: async () => requireAdminMock.value,
}));

vi.mock('@/lib/playerService', () => ({
  getPlayer: vi.fn(),
  getPlayerSlim: vi.fn(),
}));
vi.mock('@/lib/antiCheatDetector', () => ({
  detectSessionAbuse: vi.fn(async () => ({ suspicious: false, evidence: [] })),
}));
vi.mock('@/lib/jobs/botFactoryEconomyManager', () => ({
  getBotFactoryEconomyStats: vi.fn(() => ({ lastRun: null })),
  triggerBotFactoryEconomyCycle: vi.fn(async () => ({ ok: true })),
}));
vi.mock('@/lib/inventoryUtils', () => ({
  tradeableItems: vi.fn((items: unknown[]) => items),
}));
vi.mock('@/lib/shrineServer', () => ({
  assertAtShrine: vi.fn(async () => true),
}));
vi.mock('@/lib/xpService', () => ({
  awardXP: vi.fn(async () => ({ xpAwarded: 10, levelUp: false, newLevel: undefined })),
  XPAction: { SHRINE_SACRIFICE: 'SHRINE_SACRIFICE' },
}));
vi.mock('@/lib/statTrackingService', () => ({
  trackShrineTrade: vi.fn(async () => {}),
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
  ENDPOINT_RATE_LIMITS: { STANDARD: {}, admin: {}, adminBot: {}, leaderboard: {}, SHRINE_SACRIFICE: {} },
  createErrorFromException: (e: unknown, code: string) =>
    NextResponse.json({ error: String(e), code }, { status: 500 }),
  createErrorResponse: (code: string, details?: unknown) =>
    NextResponse.json({ error: { code, details } }, { status: code === 'AUTH_UNAUTHORIZED' || code === 'AUTH_USER_NOT_FOUND' ? 401 : code === 'ADMIN_ACCESS_REQUIRED' ? 403 : 400 }),
  ErrorCode: {
    AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
    AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
    ADMIN_ACCESS_REQUIRED: 'ADMIN_ACCESS_REQUIRED',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    INSUFFICIENT_RESOURCES: 'INSUFFICIENT_RESOURCES',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
}));

import { GET as achievementStatsGET } from '@/app/api/admin/achievement-stats/route';
import { GET as activeSessionsGET } from '@/app/api/admin/active-sessions/route';
import { GET as botFactoryGET } from '@/app/api/admin/bot-factory-economy/route';
import { GET as myBidsGET } from '@/app/api/auction/my-bids/route';
import { GET as clanLeaderboardGET } from '@/app/api/clan/leaderboard/route';
import { POST as shrineActivatePOST } from '@/app/api/shrine/activate/route';
import { POST as shrineBoostAllPOST } from '@/app/api/shrine/boost-all/route';
import { getPlayer } from '@/lib/playerService';

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
  state.raw.length = 0;
  state.responder = () => [];
  authMock.value = undefined;
  requireAdminMock.value = undefined;
  vi.mocked(getPlayer).mockReset();
});

// ============================================================================
// admin/achievement-stats
// ============================================================================
describe('GET /api/admin/achievement-stats', () => {
  it('401s unauthenticated and 403s non-admins', async () => {
    const anon = await asHandler(achievementStatsGET)(getReq('/api/admin/achievement-stats'));
    expect(anon.status).toBe(401);

    authMock.value = { username: 'pleb', isAdmin: false };
    const pleb = await asHandler(achievementStatsGET)(getReq('/api/admin/achievement-stats'));
    expect(pleb.status).toBe(403);
  });

  it('rolls up unlocks with a real GROUP BY over achievements + bot-free player count', async () => {
    authMock.value = { username: 'chief', isAdmin: true };
    state.responder = (spec) => {
      if (tableOf(spec) === 'achievements') {
        return [{ achievementId: 'first_blood', unlockCount: 7, firstUnlock: new Date('2026-01-01'), lastUnlock: new Date('2026-02-01') }];
      }
      if (tableOf(spec) === 'players') return [{ n: 40 }];
      return [];
    };
    const res = await asHandler(achievementStatsGET)(getReq('/api/admin/achievement-stats'));
    const body = (await res.json()) as { achievements: Array<{ achievementId: string; unlockCount: number; unlockPercentage: number }>; totalPlayers: number };
    expect(body.totalPlayers).toBe(40);
    const firstBlood = body.achievements.find((a) => a.achievementId === 'first_blood');
    expect(firstBlood?.unlockCount).toBe(7);
    expect(firstBlood?.unlockPercentage).toBeCloseTo(17.5);
    const groups = state.specs.filter((s) => tableOf(s) === 'achievements');
    expect(groups[0].groupBy).toBeTruthy();
  });
});

// ============================================================================
// admin/active-sessions
// ============================================================================
describe('GET /api/admin/active-sessions', () => {
  it('refuses non-admins via requireAdmin', async () => {
    requireAdminMock.value = NextResponse.json({}, { status: 403 });
    const res = await asHandler(activeSessionsGET)(getReq('/api/admin/active-sessions'));
    expect(res.status).toBe(403);
  });

  it('reads open sessions, computes durations, and summarizes', async () => {
    requireAdminMock.value = { username: 'chief', isAdmin: true };
    const startRecent = new Date(Date.now() - 60_000);
    const startOld = new Date(Date.now() - 15 * 3_600_000);
    state.responder = () => [
      { id: 's1', userId: 'alice', sessionId: 'sess-1', startTime: startRecent, endTime: null, actionsCount: 5 },
      { id: 's2', userId: 'bob', sessionId: 'sess-2', startTime: startOld, endTime: null, actionsCount: 2 },
    ];
    const res = await asHandler(activeSessionsGET)(getReq('/api/admin/active-sessions'));
    const body = (await res.json()) as {
      totalActive: number; longestSession: number; totalActions: number; averageDuration: number;
      sessions: Array<{ userId: string; currentDuration: number }>;
      abusiveSessions: Array<{ userId: string }>;
    };
    expect(body.totalActive).toBe(2);
    expect(body.totalActions).toBe(7);
    expect(body.sessions[0].userId).toBe('alice');
    expect(body.abusiveSessions.map((s) => s.userId)).toEqual(['bob']); // >14h
    const spec = state.specs[0];
    expect(tableOf(spec)).toBe('player_sessions');
    expect(spec.orderBy).toBeTruthy();
  });
});

// ============================================================================
// admin/bot-factory-economy
// ============================================================================
describe('GET /api/admin/bot-factory-economy', () => {
  it('assembles factories, bots, and curves from pg tables', async () => {
    requireAdminMock.value = { username: 'chief', isAdmin: true };
    state.responder = (spec) => {
      const t = tableOf(spec);
      if (t === 'factories') {
        const f0 = (spec.fields as Array<Record<string, unknown>> | undefined)?.[0];
        // Ownership leg selects { owner } with an innerJoin; the main leg selects { level, owner }.
        return f0 && !('level' in f0)
          ? [{ owner: 'fame' }]
          : [{ level: 3, owner: 'fame' }, { level: 1, owner: null }];
      }
      if (t === 'players') return [{ username: 'botX', totalStrength: 20000, botConfig: { tier: 2 } }]; // L2 defense = 12500, tier 2 = eligible
      return [];
    };
    const res = await asHandler(botFactoryGET)(getReq('/api/admin/bot-factory-economy'));
    const body = (await res.json()) as { data: { factories: { total: number; wild: number; playerOwned: number }; raids: { stats: { eligibleBots: number } } } };
    expect(body.data.factories.total).toBe(2);
    expect(body.data.factories.wild).toBe(1);
    expect(body.data.factories.playerOwned).toBe(1);
    expect(body.data.raids.stats.eligibleBots).toBe(1);
    const tables = state.specs.map(tableOf);
    expect(tables).toContain('factories');
    expect(tables).toContain('players');
  });
});

// ============================================================================
// auction/my-bids
// ============================================================================
describe('GET /api/auction/my-bids', () => {
  it('401s unauthenticated', async () => {
    const res = await asHandler(myBidsGET)(getReq('/api/auction/my-bids'));
    expect(res.status).toBe(401);
  });

  it('matches bidder via doc-path containment and returns the domain shape', async () => {
    authMock.value = { username: 'alice' };
    state.responder = () => [
      {
        id: 'a1', doc: {
          auctionId: 'a1', item: { name: 'Sword' }, bids: [
            { bidderUsername: 'alice', bidAmount: 50, bidTime: '2026-09-01T00:00:00Z' },
            { bidderUsername: 'mallory', bidAmount: 90, bidTime: '2026-09-02T00:00:00Z' },
          ], highestBidder: 'mallory', status: 'active', startingBid: 10,
        }, itemData: { name: 'Sword' }, startingPrice: 10,
      },
    ];
    const res = await asHandler(myBidsGET)(getReq('/api/auction/my-bids'));
    const body = (await res.json()) as { bids: Array<{ myBid: { bidAmount: number }; isWinning: boolean }>; totalCount: number };
    expect(body.totalCount).toBe(1);
    expect(body.bids[0].myBid.bidAmount).toBe(50);   // alice's own highest bid
    expect(body.bids[0].isWinning).toBe(false);      // mallory leads

    const spec = state.specs[0];
    expect(tableOf(spec)).toBe('auctions');
    // The WHERE must carry the doc-path containment probe (raw SQL chunks).
    expect(sqlText(spec.where)).toContain('@>');
  });
});

// ============================================================================
// clan/leaderboard
// ============================================================================
describe('GET /api/clan/leaderboard', () => {
  it('rejects invalid categories', async () => {
    const res = await asHandler(clanLeaderboardGET)(getReq('/api/clan/leaderboard?category=shininess'));
    expect(res.status).toBe(400);
  });

  it('ranks clans by the category value expression and returns the domain shape', async () => {
    state.responder = (spec) => {
      if ((spec.fields as Array<Record<string, unknown>>)?.some((f) => f && typeof f === 'object' && 'n' in f)) {
        return [{ n: 2 }];
      }
      return [
        { row: { id: 'c1', name: 'Alpha', tag: 'ALP', description: '', leaderId: 'queen', members: [], maxMembers: 20, levelCurrentLevel: 3, levelTotalXP: 0, levelCurrentLevelXP: 0, levelXpToNextLevel: 100, levelFeaturesUnlocked: [], levelMilestonesCompleted: [], levelLastLevelUp: null, createdAt: new Date(), settingsMessageOfTheDay: '', settingsIsRecruiting: 1, settingsMinLevelToJoin: 1, settingsRequiresApproval: 0, settingsAllowTerritoryControl: 0, settingsAllowWarDeclarations: 0, statsTotalPower: 500, statsTotalTerritories: 2, statsTotalMonuments: 0, statsWarsWon: 4, statsWarsLost: 1, statsTotalRP: 0, researchResearchPoints: 0, researchUnlockedTechs: [], researchActiveResearch: null, bankTreasuryMetal: 100, bankTreasuryEnergy: 50, bankTreasuryResearchPoints: 0, bankTaxRatesMetal: '0', bankTaxRatesEnergy: '0', bankTaxRatesResearchPoints: '0', bankLog: [] }, value: 500 },
        { row: { id: 'c2', name: 'Beta', tag: 'BET', description: '', leaderId: 'king', members: [], maxMembers: 20, levelCurrentLevel: 2, levelTotalXP: 0, levelCurrentLevelXP: 0, levelXpToNextLevel: 100, levelFeaturesUnlocked: [], levelMilestonesCompleted: [], levelLastLevelUp: null, createdAt: new Date(), settingsMessageOfTheDay: '', settingsIsRecruiting: 1, settingsMinLevelToJoin: 1, settingsRequiresApproval: 0, settingsAllowTerritoryControl: 0, settingsAllowWarDeclarations: 0, statsTotalPower: 300, statsTotalTerritories: 1, statsTotalMonuments: 0, statsWarsWon: 1, statsWarsLost: 2, statsTotalRP: 0, researchResearchPoints: 0, researchUnlockedTechs: [], researchActiveResearch: null, bankTreasuryMetal: 10, bankTreasuryEnergy: 5, bankTreasuryResearchPoints: 0, bankTaxRatesMetal: '0', bankTaxRatesEnergy: '0', bankTaxRatesResearchPoints: '0', bankLog: [] }, value: 300 },
      ];
    };
    const res = await asHandler(clanLeaderboardGET)(getReq('/api/clan/leaderboard?category=power'));
    const body = (await res.json()) as { leaderboard: Array<{ rank: number; clan: { _id?: string; name: string; level: { currentLevel: number } }; value: number }>; total: number };
    expect(body.total).toBe(2);
    expect(body.leaderboard[0].rank).toBe(1);
    expect(body.leaderboard[0].clan.name).toBe('Alpha');
    expect(body.leaderboard[0].clan.level.currentLevel).toBe(3); // rowToClan mapping ran
    expect(body.leaderboard[0].value).toBe(500);
    const spec = state.specs.filter((s) => tableOf(s) === 'clans').find((s) => s.orderBy);
    expect(spec?.limit).toBe(25); // default page size
  });
});

// ============================================================================
// shrine/activate + shrine/boost-all
// ============================================================================
describe('shrine activate / boost-all (pg jsonb writes)', () => {
  const inventoryItem = (id: string) => ({
    id, type: 'TRADEABLE_ITEM' as const, name: `Item ${id}`, rarity: 'COMMON',
    bonusPercent: 0, foundAt: { x: 1, y: 1 }, foundDate: new Date(),
  });

  it('activate 401s unauthenticated and 400s invalid tier/count', async () => {
    const anon = await asHandler(shrineActivatePOST)(postReq('/api/shrine/activate', { tier: 'spade', itemCount: 1 }));
    expect(anon.status).toBe(401);

    authMock.value = { username: 'fame' };
    const badTier = await asHandler(shrineActivatePOST)(postReq('/api/shrine/activate', { tier: 'joker', itemCount: 1 }));
    expect(badTier.status).toBe(400);
    const badCount = await asHandler(shrineActivatePOST)(postReq('/api/shrine/activate', { tier: 'spade', itemCount: 1.5 }));
    expect(badCount.status).toBe(400);
  });

  it('activate writes both jsonb columns through the domain shape', async () => {
    authMock.value = { username: 'fame' };
    vi.mocked(getPlayer).mockResolvedValue({
      username: 'fame',
      currentPosition: { x: 1, y: 1 },
      inventory: { items: [inventoryItem('i1'), inventoryItem('i2')] },
      shrineBoosts: [],
    } as never);
    state.responder = () => [{ username: 'fame' }];

    const res = await asHandler(shrineActivatePOST)(postReq('/api/shrine/activate', { tier: 'spade', itemCount: 2 }));
    const body = (await res.json()) as { success: boolean; itemsConsumed: number; durationMinutes: number; xpAwarded: number };
    expect(body.success).toBe(true);
    expect(body.itemsConsumed).toBe(2);
    expect(body.durationMinutes).toBe(30); // 2 × COMMON(15)
    expect(body.xpAwarded).toBe(10);

    const spec = state.specs[0];
    expect(tableOf(spec)).toBe('players');
    expect(spec.op).toBe('update');
    const set = spec.set as Record<string, unknown>;
    expect(Array.isArray(set.inventoryItems)).toBe(true);
    expect((set.inventoryItems as unknown[]).length).toBe(0); // both consumed
    const boosts = set.shrineBoosts as Array<{ tier: string; yieldBonus: number; expiresAt: Date }>;
    expect(boosts).toHaveLength(1);
    expect(boosts[0].tier).toBe('spade');
    expect(boosts[0].yieldBonus).toBe(0.25);
    expect(boosts[0].expiresAt).toBeInstanceOf(Date);
  });

  it('activate refuses NaN durations before any write', async () => {
    authMock.value = { username: 'fame' };
    vi.mocked(getPlayer).mockResolvedValue({
      username: 'fame',
      currentPosition: { x: 1, y: 1 },
      inventory: { items: [{ ...inventoryItem('i1'), rarity: 'LEGACY_LOL' }] },
      shrineBoosts: [],
    } as never);

    const res = await asHandler(shrineActivatePOST)(postReq('/api/shrine/activate', { tier: 'spade', itemCount: 1 }));
    expect(res.status).toBe(400);
    expect(state.specs).toHaveLength(0); // no write attempted
  });

  it('activate 400s when tradeables are insufficient', async () => {
    authMock.value = { username: 'fame' };
    vi.mocked(getPlayer).mockResolvedValue({
      username: 'fame',
      currentPosition: { x: 1, y: 1 },
      inventory: { items: [inventoryItem('i1')] },
      shrineBoosts: [],
    } as never);

    const res = await asHandler(shrineActivatePOST)(postReq('/api/shrine/activate', { tier: 'spade', itemCount: 5 }));
    expect(res.status).toBe(400);
    expect(state.specs).toHaveLength(0);
  });

  it('boost-all consumes 4×items, writes all four tiers, one trade + one XP', async () => {
    authMock.value = { username: 'fame' };
    vi.mocked(getPlayer).mockResolvedValue({
      username: 'fame',
      currentPosition: { x: 1, y: 1 },
      inventory: { items: Array.from({ length: 4 }, (_, i) => inventoryItem(`i${i}`)) },
      shrineBoosts: [],
    } as never);
    state.responder = () => [{ username: 'fame' }];

    const res = await asHandler(shrineBoostAllPOST)(postReq('/api/shrine/boost-all', { itemCount: 1 }));
    const body = (await res.json()) as { success: boolean; itemsConsumed: number; results: Array<{ tier: string }> };
    expect(body.success).toBe(true);
    expect(body.itemsConsumed).toBe(4);
    expect(body.results.map((r) => r.tier).sort()).toEqual(['club', 'diamond', 'heart', 'spade']);

    const spec = state.specs[0];
    const set = spec.set as Record<string, unknown>;
    expect((set.inventoryItems as unknown[]).length).toBe(0);
    expect((set.shrineBoosts as unknown[]).length).toBe(4);
  });

  it('boost-all 400s when the 4× requirement is not met', async () => {
    authMock.value = { username: 'fame' };
    vi.mocked(getPlayer).mockResolvedValue({
      username: 'fame',
      currentPosition: { x: 1, y: 1 },
      inventory: { items: [inventoryItem('i1')] },
      shrineBoosts: [],
    } as never);

    const res = await asHandler(shrineBoostAllPOST)(postReq('/api/shrine/boost-all', { itemCount: 1 }));
    expect(res.status).toBe(400);
    expect(state.specs).toHaveLength(0);
  });
});

// ============================================================================
// static census: none of the seven files touch the Mongo shim
// ============================================================================
describe('slice 4 census', () => {
  const FILES = [
    'app/api/admin/achievement-stats/route.ts',
    'app/api/admin/active-sessions/route.ts',
    'app/api/admin/bot-factory-economy/route.ts',
    'app/api/auction/my-bids/route.ts',
    'app/api/clan/leaderboard/route.ts',
    'app/api/shrine/activate/route.ts',
    'app/api/shrine/boost-all/route.ts',
  ];

  it('none of the seven routes reference the Mongo shim', () => {
    for (const f of FILES) {
      const src = readFileSyncShim(f);
      expect(src.includes('lib/mongodb'), f).toBe(false);
      expect(/getCollection|getDatabase|connectToDatabase|getClientAndDatabase/.test(src), f).toBe(false);
    }
  });
});

function readFileSyncShim(f: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node:fs').readFileSync(f, 'utf8') as string;
}
