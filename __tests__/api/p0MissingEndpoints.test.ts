/**
 * @file __tests__/api/p0MissingEndpoints.test.ts
 * @created 2026-09-16
 * @overview Contract pins for the three rebuilt player-side endpoints
 *            (FID-20260916-010). The panels' fetch contracts are the spec:
 *            DiscoveryLogPanel.tsx:139, FriendsList.tsx:138-148,
 *            FriendActionsMenu.tsx:142-152. Route handlers are invoked
 *            directly over mocked auth/service/db layers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { requireAuthMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
}));

vi.mock('@/lib/authMiddleware', () => ({
  requireAuth: requireAuthMock,
}));

vi.mock('@/lib', () => ({
  withRequestLogging: (h: unknown) => h,
  createRouteLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    time: () => vi.fn(),
  }),
  createErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ success: false, error: message, code }), { status: code === 'RESOURCE_NOT_FOUND' ? 404 : 400 }),
  createErrorFromException: (_e: unknown, _code: string) =>
    new Response(JSON.stringify({ success: false, error: 'internal' }), { status: 500 }),
  ErrorCode: {
    VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
}));

vi.mock('@/lib/discoveryService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/discoveryService')>();
  return {
    ...actual,
    getDiscoveryProgress: vi.fn(),
  };
});

vi.mock('@/lib/friendService', () => ({
  blockUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { GET as discoveriesGET } from '@/app/api/discoveries/route';
import { GET as onlineGET } from '@/app/api/friends/online/route';
import { POST as blockPOST } from '@/app/api/friends/block/route';
import { getDiscoveryProgress } from '@/lib/discoveryService';
import { blockUser } from '@/lib/friendService';
import { db } from '@/lib/db';
import { ValidationError } from '@/lib/common/errors';  function req(url: string, init?: RequestInit): NextRequest {
    return new NextRequest(new Request(url, init));
  }

  const ROUTE_CONTEXT = {} as { params: Promise<Record<string, string>> };

const PANEL_DISCOVERY_BASE = {
  id: 'ancient_grid',
  name: 'Ancient Grid',
  description: 'A humming lattice.',
  bonus: '+5% metal',
  discoveredInCave: { x: 3, y: 4 },
};

describe('GET /api/discoveries (DiscoveryLogPanel contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('400 when username is missing', async () => {
    const res = await discoveriesGET(req('http://localhost/api/discoveries'), ROUTE_CONTEXT);
    expect(res.status).toBe(400);
  });

  it('404 when the player is unknown', async () => {
    vi.mocked(getDiscoveryProgress).mockResolvedValueOnce(null);
    const res = await discoveriesGET(req('http://localhost/api/discoveries?username=ghost'), ROUTE_CONTEXT);
    expect(res.status).toBe(404);
    expect(getDiscoveryProgress).toHaveBeenCalledWith('ghost');
  });

  it('adapts the service shape to the panel contract', async () => {
    vi.mocked(getDiscoveryProgress).mockResolvedValueOnce({
      totalDiscovered: 2,
      totalAvailable: 15,
      progressPercent: 13,
      byCategory: {
        [undefined as unknown as string]: 0, // guard: only the three enum keys are read
        industrial: 1,
        combat: 1,
        strategic: 0,
      },
      discoveries: [
        {
          ...PANEL_DISCOVERY_BASE,
          category: 'industrial',
          discoveredAt: new Date('2026-09-16T12:00:00.000Z'),
        } as never,
      ],
      undiscovered: [],
      completionStatus: 'IN_PROGRESS',
    } as never);

    const res = await discoveriesGET(req('http://localhost/api/discoveries?username=hero'), ROUTE_CONTEXT);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    // category → UPPERCASE; Date → epoch ms
    expect(data.discoveries[0]).toMatchObject({
      id: 'ancient_grid',
      category: 'INDUSTRIAL',
      discoveredAt: Date.parse('2026-09-16T12:00:00.000Z'),
    });
    // field renames + by-category {discovered,total} + status mapping
    expect(data.progress).toEqual({
      totalDiscovered: 2,
      totalPossible: 15,
      percentComplete: 13,
      byCategory: {
        INDUSTRIAL: { discovered: 1, total: 5 },
        COMBAT: { discovered: 1, total: 5 },
        STRATEGIC: { discovered: 0, total: 5 },
      },
      completionStatus: 'INCOMPLETE',
    });
  });

  it('maps COMPLETE through unchanged', async () => {
    vi.mocked(getDiscoveryProgress).mockResolvedValueOnce({
      totalDiscovered: 15,
      totalAvailable: 15,
      progressPercent: 100,
      byCategory: { industrial: 5, combat: 5, strategic: 5 },
      discoveries: [],
      undiscovered: [],
      completionStatus: 'COMPLETE',
    } as never);
    const res = await discoveriesGET(req('http://localhost/api/discoveries?username=hero'), ROUTE_CONTEXT);
    const data = await res.json();
    expect(data.progress.completionStatus).toBe('COMPLETE');
    expect(data.progress.percentComplete).toBe(100);
  });
});

describe('GET /api/friends/online (FriendsList polling contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ playerId: 'hero', username: 'hero' });
  });

  function mockPresence(onlineIds: string[]) {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(onlineIds.map((userId) => ({ userId }))),
    };
    vi.mocked(db.select).mockReturnValue(chain as never);
  }

  it('401 without auth (requireAuth passthrough)', async () => {
    requireAuthMock.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    const res = await onlineGET(req('http://localhost/api/friends/online?ids=a'));
    expect(res.status).toBe(401);
  });

  it('400 on empty id list', async () => {
    const res = await onlineGET(req('http://localhost/api/friends/online?ids='));
    expect(res.status).toBe(400);
  });

  it('400 over the 200-id cap', async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `u${i}`).join(',');
    const res = await onlineGET(req(`http://localhost/api/friends/online?ids=${ids}`));
    expect(res.status).toBe(400);
  });

  it('returns every requested id; unknown map to offline (total statuses)', async () => {
    mockPresence(['friendA']);
    const res = await onlineGET(req('http://localhost/api/friends/online?ids=friendA,friendB,ghost'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.statuses).toEqual({ friendA: 'online', friendB: 'offline', ghost: 'offline' });
  });
});

describe('POST /api/friends/block (FriendActionsMenu contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ playerId: 'hero', username: 'hero' });
  });

  function post(body: unknown): NextRequest {
    return req('http://localhost/api/friends/block', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('401 without auth', async () => {
    requireAuthMock.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    const res = await blockPOST(post({ userId: 'victim' }));
    expect(res.status).toBe(401);
  });

  it('400 when userId is missing', async () => {
    const res = await blockPOST(post({}));
    expect(res.status).toBe(400);
  });

  it('calls blockUser with the SESSION caller and body target only', async () => {
    vi.mocked(blockUser).mockResolvedValueOnce(true);
    const res = await blockPOST(post({ userId: 'villain' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(blockUser).toHaveBeenCalledWith('hero', 'villain');
  });

  it('maps ValidationError → 400 {success:false,error} (self-block path)', async () => {
    vi.mocked(blockUser).mockRejectedValueOnce(new ValidationError('Cannot block yourself'));
    const res = await blockPOST(post({ userId: 'hero' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Cannot block yourself');
  });
});
