/**
 * FID-20260912-085 — /api/admin/players loot-drilldown contract tests.
 *
 * The registry's beer-base loot drilldown renders STR / DEF / army size from
 * three fields this route exposes. These tests pin that the fields are always
 * present and numeric for every row (admin UI shouldn't guard against missing
 * keys), and that army size sums unit quantities from the players.units jsonb.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuth = vi.fn();

vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: () => mockAuth(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        orderBy: () => Promise.resolve([
          {
            // Beer base: units jsonb carries the army
            username: 'Shattered_Den',
            level: 25,
            rank: 4,
            resourcesMetal: 2900000,
            resourcesEnergy: 2900000,
            baseX: 8,
            baseY: 12,
            createdAt: new Date('2026-09-12T00:00:00Z'),
            isBot: 1,
            isSpecialBase: 1,
            botConfig: { specialization: null, tier: 4, isSpecialBase: true },
            totalStrength: 154000,
            totalDefense: 98000,
            units: [
              { unitId: 'rifleman', quantity: 120 },
              { unitId: 'sentry', quantity: 80 },
              { unitId: 'halftrack', quantity: 25 },
            ],
          },
          {
            // Human player: fields still present, empty army
            username: 'fame',
            level: 18,
            rank: 1,
            resourcesMetal: 1000,
            resourcesEnergy: 2000,
            baseX: 65,
            baseY: 66,
            createdAt: new Date('2026-09-01T00:00:00Z'),
            isBot: 0,
            isSpecialBase: 0,
            botConfig: null,
            totalStrength: 0,
            totalDefense: 0,
            units: [],
          },
          {
            // Null-coalescing path: legacy rows may null the stat block
            username: 'Old_Row',
            level: 5,
            rank: 1,
            resourcesMetal: 10,
            resourcesEnergy: 20,
            baseX: 1,
            baseY: 2,
            createdAt: new Date('2026-08-01T00:00:00Z'),
            isBot: 0,
            isSpecialBase: 0,
            botConfig: null,
            totalStrength: null,
            totalDefense: null,
            units: null,
          },
        ]),
      }),
    }),
  },
}));

vi.mock('@/lib', () => ({
  withRequestLogging: (h: unknown) => h,
  createRateLimiter: () => (h: unknown) => h,
  ENDPOINT_RATE_LIMITS: { admin: {} },
  createRouteLogger: () => ({
    info: () => {},
    time: () => () => {},
  }),
  createErrorResponse: (code: string) =>
    new Response(JSON.stringify({ success: false, code }), { status: 403 }),
  createErrorFromException: () => new Response('{}', { status: 500 }),
  ErrorCode: { AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED', ADMIN_ACCESS_REQUIRED: 'ADMIN_ACCESS_REQUIRED' },
}));

import { GET } from '@/app/api/admin/players/route';
import { NextRequest } from 'next/server';

const callGET = async () =>
  GET(new NextRequest('http://localhost/api/admin/players'), {} as unknown as Parameters<typeof GET>[1]);

describe('FID-20260912-085: admin players loot fields', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockAuth.mockResolvedValue({ username: 'admin', isAdmin: true });
  });

  it('every row exposes numeric totalStrength/totalDefense/armySize (drilldown contract)', async () => {
    const res = await callGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const rows = body.data; // route returns the list directly as data

    for (const row of rows) {
      expect(typeof row.totalStrength).toBe('number');
      expect(typeof row.totalDefense).toBe('number');
      expect(typeof row.armySize).toBe('number');
    }
  });

  it('armySize sums unit quantities from the units jsonb', async () => {
    const res = await callGET();
    const body = await res.json();
    const den = body.data.find((r: { username: string }) => r.username === 'Shattered_Den');
    expect(den.armySize).toBe(225); // 120 + 80 + 25
  });

  it('legacy null stat blocks coalesce to 0 — never undefined on the wire', async () => {
    const res = await callGET();
    const body = await res.json();
    const legacy = body.data.find((r: { username: string }) => r.username === 'Old_Row');
    expect(legacy.totalStrength).toBe(0);
    expect(legacy.totalDefense).toBe(0);
    expect(legacy.armySize).toBe(0);
  });
});
