/**
 * @file __tests__/api/admin/battle-logs.test.ts
 * @overview FID-20260909-027 §3.2 regression tests — server-side battle-log
 * filtering + pagination.
 *
 * The route previously shipped `.limit(10000)` rows for the modal to filter
 * client-side. Now: filters are SQL WHERE conditions, the response carries one
 * page plus the FILTERED total, `export=all` preserves the bulk download (10k
 * cap), and unknown outcome values 400 instead of silently matching nothing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getBattleLogs } from '@/app/api/admin/battle-logs/route';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    __selectQueue: [] as unknown[][], // each awaited db.select chain pops one result
    select: () => mockDb,
    from: () => mockDb,
    where: () => mockDb,
    orderBy: () => mockDb,
    limit: () => mockDb,
    offset: () => mockDb,
    // Thenable: whichever method ends the chain, `await chain` pops the next
    // queued result — mirrors how the real driver resolves at the final await.
    then(onFulfilled: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) {
      const value = mockDb.__selectQueue.shift() ?? [];
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
  };
  return { mockDb };
});

const mockAuth = vi.fn();

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return { ...actual };
});
vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args),
}));

function row(battleId: string) {
  return {
    battleId,
    timestamp: new Date('2026-09-09T12:00:00Z'),
    attackerUsername: 'alice',
    defenderUsername: 'bob',
    outcome: 'attacker_win',
    resourcesStolenAmount: 100,
    attackerXP: 50,
    locationX: 3,
    locationY: 4,
    attackerUnitsLost: null,
    defenderUnitsLost: null,
  };
}

function makeRequest(query = ''): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000/api/admin/battle-logs${query}`));
}

/** withRequestLogging's wrapped handler expects a route context arg. */
const routeCtx = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ username: 'admin1', isAdmin: true });
});

describe('FID-027 §3.2 — /api/admin/battle-logs server-side query', () => {
  it('returns one page plus the FILTERED total (count query, not rows.length)', async () => {
    // Queue: [count result], [page rows]
    mockDb.__selectQueue = [[{ value: 421 }], [row('b1'), row('b2')]];

    const response = await getBattleLogs(makeRequest('?page=2&limit=2'), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(421);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(2);
    expect(body.logs).toHaveLength(2);
    expect(body.logs[0]._id).toBe('b1');
  });

  it('rejects an unknown outcome value with 400 (enum column, not silent empty)', async () => {
    const response = await getBattleLogs(makeRequest('?outcome=nuclear_win'), routeCtx);
    expect(response.status).toBe(400);
  });

  it('rejects malformed date filters with 400', async () => {
    const response = await getBattleLogs(makeRequest('?dateFrom=yesterday-ish'), routeCtx);
    expect(response.status).toBe(400);
  });

  it('denies non-admin sessions', async () => {
    mockAuth.mockResolvedValue({ username: 'pleb', isAdmin: false });
    const response = await getBattleLogs(makeRequest(''), routeCtx);
    expect(response.status).toBe(403);
  });

  it('export=all returns the full matching set through the same wire mapper', async () => {
    // Only the rows query runs on the export path (no count)
    mockDb.__selectQueue = [[row('b1'), row('b2'), row('b3')]];

    const response = await getBattleLogs(makeRequest('?export=all'), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(3);
    expect(body.logs).toHaveLength(3);
  });
});
