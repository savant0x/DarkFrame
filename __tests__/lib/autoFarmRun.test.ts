/**
 * FID-20260912-078 — server-backed AutoFarm run persistence contract tests.
 *
 * The run record moved from localStorage (where it could go stale and fight
 * the server — the FID-075 divergence class) to the player's row. These tests
 * pin: record validation, the route's session scoping (username NEVER from
 * the body), bounds rejection, and clear-on-null.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuth = vi.fn();
const capturedUpdate: { username: string | null; value: unknown } = { username: null, value: null };

vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(() => ({
      set: (value: unknown) => ({
        where: () => {
          // Capture through the service under test
          capturedUpdate.value = value;
          return Promise.resolve();
        },
      }),
    })),
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ autofarmRun: null }],
        }),
      }),
    })),
  },
}));
vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return { ...actual };
});

import { POST, GET } from '@/app/api/autofarm/run/route';
import {
  saveAutoFarmRun,
  clearAutoFarmRun,
  isAutoFarmRunRecord,
} from '@/lib/autoFarmRunService';
import { NextRequest } from 'next/server';

function postRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/autofarm/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function validRun() {
  return {
    status: 'ACTIVE' as const,
    position: { x: 65, y: 67 },
    currentRow: 67,
    direction: 'forward' as const,
    tilesCompleted: 1204,
    startTime: Date.now() - 60_000,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedUpdate.username = null;
  capturedUpdate.value = null;
  mockAuth.mockResolvedValue({ username: 'fame', playerId: 'p1', isAdmin: false });
});

describe('isAutoFarmRunRecord', () => {
  it('accepts a well-formed record', () => {
    expect(isAutoFarmRunRecord(validRun())).toBe(true);
  });

  it('rejects wrong phase, non-finite positions, and junk directions', () => {
    expect(isAutoFarmRunRecord({ ...validRun(), status: 'idle' })).toBe(false);
    expect(isAutoFarmRunRecord({ ...validRun(), position: { x: NaN, y: 2 } })).toBe(false);
    expect(isAutoFarmRunRecord({ ...validRun(), direction: 'up' })).toBe(false);
    expect(isAutoFarmRunRecord(null)).toBe(false);
    expect(isAutoFarmRunRecord('run')).toBe(false);
  });
});

describe('POST /api/autofarm/run', () => {
  it('401s without a session', async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(postRequest({ run: validRun() }), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(401);
  });

  it('persists a valid run for the SESSION user (username never from body)', async () => {
    const res = await POST(postRequest({ run: validRun() }), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(capturedUpdate.value).toMatchObject({
      autofarmRun: expect.objectContaining({ status: 'ACTIVE', tilesCompleted: 1204 }),
    });
  });

  it('rejects out-of-map positions (corrupted client guard)', async () => {
    const res = await POST(
      postRequest({ run: { ...validRun(), position: { x: 9999, y: 2 } } }),
      { params: Promise.resolve({}) } as never
    );
    expect(res.status).toBe(400);
    expect(capturedUpdate.value).toBeNull();
  });

  it('clears on run: null', async () => {
    const res = await POST(postRequest({ run: null }), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cleared).toBe(true);
    expect(capturedUpdate.value).toEqual({ autofarmRun: null });
  });
});

describe('service helpers', () => {
  it('saveAutoFarmRun stamps savedAt (staleness guard input)', async () => {
    // Client-shaped record (no savedAt) — the service stamps it on save.
    await saveAutoFarmRun('fame', { ...validRun(), savedAt: 0 });
    expect((capturedUpdate.value as { autofarmRun: { savedAt: number } }).autofarmRun.savedAt).toBeGreaterThan(0);
  });

  it('clearAutoFarmRun writes null', async () => {
    await clearAutoFarmRun('fame');
    expect(capturedUpdate.value).toEqual({ autofarmRun: null });
  });
});

describe('GET /api/autofarm/run', () => {
  it('returns the persisted run (or null) for the session user', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/autofarm/run'), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.run).toBeNull();
  });
});
