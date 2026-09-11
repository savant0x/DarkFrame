/**
 * @file __tests__/api/admin/player-tracking/activity.test.ts
 * @overview FID-20260909-032 §2-A regression tests — the admin Activity route.
 *
 * The previous aggregate used `mode() within (group by action)` — invalid
 * Postgres — so the route 500ed on every call and the modal's Activity tab
 * rendered silently EMPTY while the player had 15k+ tracked rows. The rewrite
 * uses a grouped top-1 subquery and returns an honest per-action breakdown.
 *
 * Pinned here:
 * - 200 + full response shape (activities, stats, perAction) on the happy path.
 * - Empty-history player returns zeroed stats and [] lists, not an error.
 * - perAction rows are count-sorted, wire-serialized lastSeen strings.
 * - Non-admin sessions are rejected.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET as getActivity } from '@/app/api/admin/player-tracking/activity/route';

const { mockDb, mockAuth } = vi.hoisted(() => {
  const mockDb = {
    __selectQueue: [] as unknown[][], // each awaited db.select chain pops one result
    select: () => mockDb,
    from: () => mockDb,
    where: () => mockDb,
    orderBy: () => mockDb,
    groupBy: () => mockDb,
    limit: () => mockDb,
    then(onFulfilled: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) {
      const value = mockDb.__selectQueue.shift() ?? [];
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
  };
  const mockAuth = vi.fn();
  return { mockDb, mockAuth };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return { ...actual };
});
vi.mock('@/lib/authMiddleware', () => ({
  requireAdmin: (...args: unknown[]) => mockAuth(...args),
}));

function makeRequest(query: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000/api/admin/player-tracking/activity${query}`));
}

/** withRequestLogging's wrapped handler expects a route context arg. */
const routeCtx = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  // Mirrors the real requireAdmin contract: an AuthResult on success, a
  // NextResponse (403) on denial — instanceof is what the route checks.
  mockAuth.mockResolvedValue({ username: 'admin1', isAdmin: true });
});

describe('FID-20260909-032 §2-A — /api/admin/player-tracking/activity', () => {
  it('returns activities + stats + perAction (the shape the modal renders)', async () => {
    mockDb.__selectQueue = [
      [
        { actionType: 'MOVE', timestamp: new Date('2026-09-09T12:00:00Z'), details: {} },
        { actionType: 'HARVEST', timestamp: new Date('2026-09-09T11:00:00Z'), details: {} },
      ],
      [{ totalActions: 15130, mostCommonAction: 'HARVEST' }],
      [
        { action: 'HARVEST', count: 12000, lastSeen: new Date('2026-09-09T11:00:00Z') },
        { action: 'MOVE', count: 3130, lastSeen: new Date('2026-09-09T12:00:00Z') },
      ],
    ];

    const response = await getActivity(makeRequest('?username=fame&limit=50'), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.activities).toHaveLength(2);
    expect(body.stats.totalActions).toBe(15130);
    expect(body.stats.mostCommonAction).toBe('HARVEST');
    expect(body.perAction[0].action).toBe('HARVEST');
    expect(body.perAction[0].count).toBe(12000);
    expect(typeof body.perAction[0].lastSeen).toBe('string');
  });

  it('a player with NO history returns zeroed stats and empty lists (200, not 500)', async () => {
    mockDb.__selectQueue = [
      [], // no recent activities
      [{ totalActions: 0, mostCommonAction: '' }],
      [], // no perAction rows
    ];

    const response = await getActivity(makeRequest('?username=p3probe'), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.stats.totalActions).toBe(0);
    expect(body.stats.mostCommonAction).toBe('');
    expect(body.activities).toEqual([]);
    expect(body.perAction).toEqual([]);
  });

  it('rejects a missing username parameter as a validation error', async () => {
    const response = await getActivity(makeRequest(''), routeCtx);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it('denies non-admin sessions (requireAdmin returns a 403 response)', async () => {
    mockAuth.mockResolvedValue(
      NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    );
    const response = await getActivity(makeRequest('?username=fame'), routeCtx);
    expect(response.status).toBe(403);
  });
});
