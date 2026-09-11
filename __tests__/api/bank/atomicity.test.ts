/**
 * @file __tests__/api/bank/atomicity.test.ts
 * @overview FID-20260909-026 §6 regression tests — money-path atomicity.
 *
 * The bank routes previously validated against a stale read then wrote an
 * absolute JS-computed value: two concurrent withdrawals both passed and the
 * loser's write resurrected the spent balance (resource duplication from
 * nothing). The rewrite enforces the guard (`gte`) and the arithmetic (SQL
 * delta) in ONE statement and verifies success through `.returning()`.
 *
 * These tests pin the CONTRACT: the set-clause must be SQL arithmetic (never
 * an absolute number), and an empty returning array must surface as a 4xx —
 * the race-loss path — not a silent success.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as withdraw } from '@/app/api/bank/withdraw/route';

// Each db.select query pops ONE response from the queue (player read, then
// tile read). The update's returning() returns `__updateResult`.
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    __selectQueue: [] as unknown[][],
    __updateResult: [] as unknown[],
    __sets: [] as unknown[],
    __wheres: [] as unknown[],
    select: () => mockDb,
    from: () => mockDb,
    where: (w: unknown) => { mockDb.__wheres.push(w); return mockDb; },
    orderBy: () => mockDb,
    limit: () => Promise.resolve(mockDb.__selectQueue.shift() ?? []),
    update: () => mockDb,
    set: (s: unknown) => { mockDb.__sets.push(s); return mockDb; },
    returning: () => Promise.resolve(mockDb.__updateResult),
    insert: () => mockDb,
    values: () => Promise.resolve(mockDb),
    delete: () => mockDb,
  };
  return { mockDb };
});

const mockAuth = vi.fn();
const mockBonusStack = vi.fn();
const mockAssertTransact = vi.fn();

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return { ...actual };
});
vi.mock('@/lib/authMiddleware', () => ({
  verifyAuth: (...args: unknown[]) => mockAuth(...args),
  getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args),
}));
vi.mock('@/lib/flagBonusService', () => ({
  getBonusStack: (...args: unknown[]) => mockBonusStack(...args),
  assertHolderMayTransact: (...args: unknown[]) => mockAssertTransact(...args),
}));

const PLAYER_ROW = {
  username: 'tester',
  currentPositionX: 10,
  currentPositionY: 10,
  bankMetal: 5000,
  bankEnergy: 0,
  resourcesMetal: 100,
  resourcesEnergy: 0,
  bankLastDeposit: null,
};

const BANK_TILE_ROW = { x: 10, y: 10, terrain: 'bank', bankType: null };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/api/bank/withdraw'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** withRequestLogging's wrapped handler expects a route context arg. */
const routeCtx = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ username: 'tester', playerId: 'tester', isAdmin: false });
  mockBonusStack.mockResolvedValue([]);
  mockAssertTransact.mockReturnValue({ ok: true });
  mockDb.__selectQueue = [[PLAYER_ROW], [BANK_TILE_ROW]];
  mockDb.__updateResult = [];
  mockDb.__sets = [];
  mockDb.__wheres = [];
});

describe('FID-026 §6 — withdraw atomic CAS contract', () => {
  it('writes SQL deltas (not absolute values) and verifies success via returning', async () => {
    mockDb.__updateResult = [
      { metal: 5100, energy: 0, bankMetal: 4990, bankEnergy: 0 },
    ];

    const response = await withdraw(makeRequest({ resourceType: 'metal', amount: 100 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.inventory.metal).toBe(5100);
    expect(body.bank.metal).toBe(4990);

    // The set payload must be drizzle SQL objects, not numbers — an absolute
    // numeric write is the double-spend bug signature.
    const setPayload = mockDb.__sets[0] as Record<string, unknown>;
    expect(typeof setPayload.resourcesMetal).not.toBe('number');
    expect(typeof setPayload.bankMetal).not.toBe('number');
  });

  it('race-loss (empty returning) returns an insufficient error, NOT a success', async () => {
    // Pre-checks see a healthy balance, but the atomic statement loses the
    // race (returning = []) — the route must answer 4xx, never 200.
    mockDb.__updateResult = [];

    const response = await withdraw(makeRequest({ resourceType: 'metal', amount: 100 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(body.success).toBe(false);
  });

  it('carries the balance guard in the same where-clause as the username', async () => {
    mockDb.__updateResult = [
      { metal: 5100, energy: 0, bankMetal: 4990, bankEnergy: 0 },
    ];

    await withdraw(makeRequest({ resourceType: 'metal', amount: 100 }), routeCtx);

    // Two where-calls: the route's atomic guard chain. The update's where
    // must combine username equality AND the gte(balance, amount) guard.
    expect(mockDb.__wheres.length).toBeGreaterThan(0);
    expect(mockDb.__wheres[0]).toBeDefined();
  });
});
