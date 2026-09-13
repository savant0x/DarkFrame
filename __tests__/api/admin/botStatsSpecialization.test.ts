/**
 * FID-20260912-084 — bot-stats specialization counting regression.
 *
 * The DB stores enum VALUES in lowercase ('hoarder'), while the stats
 * buckets are PascalCase ('Hoarder'). The old case-sensitive
 * `spec in stats.bySpecialization` check matched nothing, so the admin
 * panel's "Bot Population by Specialization" and "Bot Ecosystem" counts
 * all read 0 while 52 bots had perfectly healthy distribution.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { fixture } = vi.hoisted(() => ({
  fixture: {
    bots: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => fixture.bots,
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  players: { isBot: 'is_bot' },
}));

vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: async () => ({ username: 'admin', isAdmin: true }),
}));

vi.mock('@/lib', () => ({
  withRequestLogging: (h: unknown) => h,
  createRouteLogger: () => ({ time: () => () => undefined, error: () => undefined, info: () => undefined }),
  createRateLimiter: () => (h: unknown) => h,
  ENDPOINT_RATE_LIMITS: { admin: {} },
  createErrorResponse: () => new Response(JSON.stringify({ success: false }), { status: 403 }),
  createErrorFromException: () => new Response(JSON.stringify({ success: false }), { status: 500 }),
  ErrorCode: { AUTH_UNAUTHORIZED: 'AUTH', ADMIN_ACCESS_REQUIRED: 'ADMIN', INTERNAL_ERROR: 'INTERNAL' },
}));

vi.mock('next/server', () => ({
  NextRequest: class {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
  },
  NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) },
}));

import { GET } from '@/app/api/admin/bot-stats/route';
import { NextRequest } from 'next/server';

/** The route wrapper's export type carries a 2nd route-context param — unused here. */
const callGET = (req: NextRequest) =>
  GET(req, {} as unknown as Parameters<typeof GET>[1]);

function bot(spec: string, extra: Record<string, unknown> = {}) {
  return {
    botConfig: { specialization: spec },
    resourcesMetal: 1000,
    resourcesEnergy: 1000,
    currentPositionX: 10,
    currentPositionY: 10,
    ...extra,
  };
}

describe('bot-stats specialization counting (FID-20260912-084)', () => {
  beforeEach(() => {
    fixture.bots = [];
  });

  it('counts lowercase DB enum values into the PascalCase buckets', async () => {
    fixture.bots = [bot('hoarder'), bot('hoarder'), bot('fortress'), bot('raider'), bot('ghost'), bot('balanced')];
    const res = await callGET(new NextRequest('http://localhost/api/admin/bot-stats'));
    const body = await res.json();
    expect(body.data.bySpecialization).toMatchObject({
      Hoarder: 2, Fortress: 1, Raider: 1, Ghost: 1, Balanced: 1,
    });
  });

  it('is fully case-insensitive (mixed-case rows still bucket)', async () => {
    fixture.bots = [bot('Hoarder'), bot('HOARDER'), bot('hoarder')];
    const body = await (await callGET(new NextRequest('http://localhost/api/admin/bot-stats'))).json();
    expect(body.data.bySpecialization.Hoarder).toBe(3);
  });

  it('never double-counts an unknown specialization', async () => {
    fixture.bots = [bot('boss')];
    const body = await (await callGET(new NextRequest('http://localhost/api/admin/bot-stats'))).json();
    expect(Object.values(body.data.bySpecialization as Record<string, number>).every((n) => n === 0)).toBe(true);
  });
});
