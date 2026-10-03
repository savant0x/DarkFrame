// @vitest-environment node
/**
 * @file __tests__/api/player/build-unit-contract.test.ts
 * @overview FID-20261002-004 §5 acceptance — the /api/player/build-unit
 *           contract after canonical procurement + tier enforcement:
 *           - blueprint identity resolves through the canonical mapping (R4:
 *             'titan' never falls back to one slot again);
 *           - core-roster builds require the PERMANENT tier unlock — Tier 5
 *             refuses at level 1 with Tier 1 only (no writes);
 *           - an already unlocked tier remains buildable with ZERO RP;
 *           - slot costs are canonical (Titan = 30), quantity scales charges;
 *           - GET availability is tier-based with the server's lock reason.
 *
 * DB-interleaving acceptance for this seam lives in
 * __tests__/lib/factoryProduceCanonical.integration.test.ts and the FID-011
 * suite; these mocks pin the call contract.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const state = vi.hoisted(() => ({
  selectResult: [] as Array<Record<string, unknown>>,
  selectCalls: [] as string[],
  updateCalls: [] as Array<{ table: string; set?: unknown; where?: unknown; hasReturning?: boolean }>,
  updateReturning: [] as Array<Record<string, unknown>>,
}));

// Partial drizzle-orm mock (clusterB2 convention): sql templates become
// inspectable { op: 'sql', text, vals } records; everything else stays real.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown) => ({ op: 'eq', col: String(col), val }),
    and: (...parts: unknown[]) => ({ op: 'and', parts }),
    sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ op: 'sql', text: String(strings[0]), vals }),
  };
});

vi.mock('@/lib/db/connection', async () => {
  const { getTableName } = await import('drizzle-orm');
  const nameOf = (t: unknown): string => {
    try { return getTableName(t as never); } catch { return String(t); }
  };

  const selectChain = () => {
    const chain: Record<string, unknown> = {
      from: vi.fn((t: unknown) => { state.selectCalls.push(nameOf(t)); return chain; }),
      where: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      for: vi.fn(() => chain),
      then: (res: (v: Array<Record<string, unknown>>) => void) =>
        Promise.resolve(state.selectResult).then(res),
    };
    return chain;
  };

  const updateChain = (t: unknown) => {
    const rec: { table: string; set?: unknown; where?: unknown; hasReturning?: boolean } = { table: nameOf(t) };
    state.updateCalls.push(rec);
    const chain: Record<string, unknown> = {
      set: vi.fn((s: unknown) => { rec.set = s; return chain; }),
      where: vi.fn((w: unknown) => { rec.where = w; return chain; }),
      returning: vi.fn(() => { rec.hasReturning = true; return Promise.resolve(state.updateReturning); }),
      then: (res: (v: unknown) => void) => Promise.resolve(state.updateReturning).then(res),
    };
    return chain;
  };

  type TxHandle = {
    select: () => Record<string, unknown>;
    update: (t: unknown) => Record<string, unknown>;
  };
  const tx: TxHandle = {
    select: vi.fn(() => selectChain()),
    update: vi.fn((t: unknown) => updateChain(t)),
  };

  return {
    db: {
      select: vi.fn(() => selectChain()),
      update: vi.fn((t: unknown) => updateChain(t)),
      delete: vi.fn(() => { throw new Error('not used'); }),
      insert: vi.fn(() => { throw new Error('not used'); }),
      transaction: vi.fn(async (fn: (tx: TxHandle) => Promise<unknown>) => fn(tx)),
    },
  };
});

vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: vi.fn(),
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}));
vi.mock('@/lib/playerService', () => ({ getPlayer: vi.fn() }));
vi.mock('@/lib/flagBonusService', () => ({
  getBonusStack: vi.fn(async () => []),
  assertHolderMayTransact: vi.fn(() => ({ ok: true })),
}));
vi.mock('@/lib/specializationService', () => ({
  getPlayerDoctrineBonuses: vi.fn(async () => ({ metalCostMul: 1, energyCostMul: 1 })),
}));
vi.mock('@/lib/statTrackingService', () => ({ trackUnitBuilt: vi.fn(async () => undefined) }));
vi.mock('@/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib')>();
  return {
    ...actual,
    withRequestLogging: (h: unknown) => h,
    createRouteLogger: () => ({
      debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined,
      time: () => () => undefined,
    }),
    createRateLimiter: () => (h: unknown) => h,
  };
});

import { GET as buildUnitGet, POST as buildUnitPost } from '@/app/api/player/build-unit/route';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { getPlayer } from '@/lib/playerService';

/** withRequestLogging's wrapped handler expects a route context arg. */
const routeCtx = { params: Promise.resolve({}) };
const post = (r: NextRequest) => (buildUnitPost as unknown as (r: NextRequest, ctx: unknown) => Promise<NextResponse>)(r, routeCtx);
const get = (r: NextRequest) => (buildUnitGet as unknown as (r: NextRequest, ctx: unknown) => Promise<NextResponse>)(r, routeCtx);

const mockedGetAuthUser = vi.mocked(getAuthenticatedUser);
const mockedGetPlayer = vi.mocked(getPlayer);

function req(url: string, init?: { method?: string; body?: string }) {
  return new NextRequest(url, init);
}

const UNLOCKED_PLAYER = {
  username: 'fame',
  level: 30,
  researchPoints: 0, // ZERO RP — tier membership, not balance, decides
  units: [],
  resources: { metal: 1_000_000, energy: 1_000_000 },
  totalStrength: 0,
  totalDefense: 0,
  factoryCount: 1,
  unlockedTiers: [1, 2, 3, 4, 5],
};

const TIER1_PLAYER = {
  ...UNLOCKED_PLAYER,
  level: 1,
  researchPoints: 100, // rich RP balance is NOT a substitute for the unlock
  unlockedTiers: [1],
};

/** Shared select fixture: the tx reads factory asset AND locks the player row. */
const FACTORY_ROW = {
  x: 2, y: 3, level: 30, usedSlots: 0, lastSlotRegen: new Date(),
  resourcesMetal: 1_000_000, resourcesEnergy: 1_000_000,
  totalStrength: 0, totalDefense: 0, unlockedTiers: [1, 2, 3, 4, 5],
};

beforeEach(() => {
  vi.clearAllMocks();
  state.selectResult = [FACTORY_ROW];
  state.selectCalls = [];
  state.updateCalls = [];
  state.updateReturning = [{ username: 'fame' }];
  mockedGetAuthUser.mockResolvedValue({ username: 'fame', playerId: 'fame' } as never);
  mockedGetPlayer.mockResolvedValue(UNLOCKED_PLAYER as never);
});

describe('FID-20261002-004 — player build-unit contract (canonical + tier enforcement)', () => {
  it('R4 closed: a titan blueprint build charges the canonical 30 slots — never a one-slot fallback', async () => {
    const res = await post(req('http://localhost/api/player/build-unit', {
      method: 'POST',
      body: JSON.stringify({ username: 'fame', unitTypeId: 'titan', quantity: 1 }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const factoryUpdate = state.updateCalls.find((c) => c.table === 'factories');
    expect(factoryUpdate).toBeDefined();
    // T5_Titan slotCost = 30 — the R4 defect built it for 1 slot.
    expect((factoryUpdate!.set as Record<string, unknown>).usedSlots).toBe(30);

    const playerUpdate = state.updateCalls.find((c) => c.table === 'players');
    const unitsSet = (playerUpdate!.set as Record<string, unknown>).units as { vals?: Array<unknown> };
    const appended = JSON.parse(String(unitsSet.vals?.[1] ?? '[]')) as Array<Record<string, unknown>>;
    expect(appended[0].unitId).toBe('titan');           // blueprint id, stored separately
    expect(appended[0].unitType).toBe('T5_TITAN');      // canonical persisted value
    expect(appended[0].strength).toBe(5000);            // real Titan stats
    expect(appended[0].quantity).toBe(1);
  });

  it('R3 contract: Tier 5 at level 1 with Tier 1 only REFUSES without any write (even with rich RP)', async () => {
    mockedGetPlayer.mockResolvedValue(TIER1_PLAYER as never);
    state.selectResult = [{ ...FACTORY_ROW, unlockedTiers: [1], totalStrength: 0, totalDefense: 0 }];

    const res = await post(req('http://localhost/api/player/build-unit', {
      method: 'POST',
      body: JSON.stringify({ username: 'fame', unitTypeId: 'titan', quantity: 1 }),
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).toContain('Tier'); // truthful refusal reason
    expect(state.updateCalls).toHaveLength(0); // refusal without writes
  });

  it('an already unlocked tier remains buildable after RP drops to zero (permanent unlock)', async () => {
    // UNLOCKED_PLAYER has researchPoints: 0 with all tiers unlocked.
    const res = await post(req('http://localhost/api/player/build-unit', {
      method: 'POST',
      body: JSON.stringify({ username: 'fame', unitTypeId: 'titan', quantity: 2 }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.costPaid.metal).toBeGreaterThan(0); // 2 × titan metal
  });

  it('quantity scales every charge (metal, energy, slots, totals)', async () => {
    const res = await post(req('http://localhost/api/player/build-unit', {
      method: 'POST',
      body: JSON.stringify({ username: 'fame', unitTypeId: 'rifleman', quantity: 3 }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // rifleman: 190 metal / 210 energy each (real blueprint prices)
    expect(body.costPaid).toEqual({ metal: 570, energy: 630 });

    const factoryUpdate = state.updateCalls.find((c) => c.table === 'factories');
    expect((factoryUpdate!.set as Record<string, unknown>).usedSlots).toBe(3); // slotCost 1 × 3

    const playerUpdate = state.updateCalls.find((c) => c.table === 'players');
    const s = playerUpdate!.set as Record<string, unknown>;
    // Relative SQL deltas (FID-20261002-002/004)
    expect((s.totalStrength as { op?: string }).op).toBe('sql');
  });

  it('GET availability is tier-based with the server lock reason (not the stale purchase price)', async () => {
    mockedGetPlayer.mockResolvedValue(TIER1_PLAYER as never);
    state.selectResult = [{ ...FACTORY_ROW }];

    const res = await get(req('http://localhost/api/player/build-unit?username=fame', { method: 'GET' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const titan = body.units.find((u: { id: string }) => u.id === 'titan');
    expect(titan.isUnlocked).toBe(false);
    expect(titan.canonicalUnitType).toBe('T5_TITAN');
    expect(String(titan.lockReason)).toContain('Tier 5');

    const infantry = body.units.find((u: { id: string }) => u.id === 'infantry');
    expect(infantry.isUnlocked).toBe(true);
  });

  it('unknown / non-buildable identifiers refuse without writes', async () => {
    const res = await post(req('http://localhost/api/player/build-unit', {
      method: 'POST',
      body: JSON.stringify({ username: 'fame', unitTypeId: 'death_star', quantity: 1 }),
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(state.updateCalls).toHaveLength(0);
  });
});
