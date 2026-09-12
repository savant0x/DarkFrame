/**
 * @file __tests__/api/research/rp-unlock.test.ts
 * @overview FID-20260909-029 §2.2 regression — the /api/research Mongo-zombie
 * migration.
 *
 * The route previously spent a phantom `gold` field through the Mongo compat
 * seam and wrote a phantom `unlockedTechnologies` array, so every unlock
 * failed "Insufficient gold" and no unlock ever persisted. The migrated route
 * must:
 *  - spend RP via the audited spendResearchPoints service,
 *  - persist the unlock on players.unlockedTechs (drizzle update),
 *  - refuse loudly on insufficient RP / unknown tech / duplicate / prereq gap.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { capture } = vi.hoisted(() => ({
  capture: {
    playerRow: { unlockedTechs: null as string[] | null, researchPoints: 0 } as {
      unlockedTechs: string[] | null;
      researchPoints: number;
    },
    updates: [] as Array<{ set: Record<string, unknown>; whereUsername: string }>,
    spendCalls: [] as Array<{ playerId: string; amount: number; reason: string }>,
  },
}));

vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: vi.fn(async () => ({ username: 'tester', playerId: 'tester', isAdmin: false })),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [capture.playerRow],
        }),
      }),
    }),
    update: () => ({
      set: (set: Record<string, unknown>) => ({
        where: async (expr: unknown) => {
          capture.updates.push({ set, whereUsername: String(expr) });
        },
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/schema')>()),
  players: { username: 'username', unlockedTechs: 'unlocked_techs' },
}));

vi.mock('@/lib/xpService', () => ({
  spendResearchPoints: vi.fn(async (playerId: string, amount: number, reason: string) => {
    capture.spendCalls.push({ playerId, amount, reason });
    if (capture.playerRow.researchPoints < amount) {
      return {
        success: false,
        newBalance: capture.playerRow.researchPoints,
        message: `Insufficient research points. Need ${amount}, have ${capture.playerRow.researchPoints}`,
      };
    }
    const newBalance = capture.playerRow.researchPoints - amount;
    capture.playerRow.researchPoints = newBalance;
    return { success: true, newBalance, message: `Spent ${amount} RP on ${reason}` };
  }),
}));

vi.mock('@/lib/activityLogger', () => ({
  logTechUnlock: vi.fn(async () => undefined),
}));

vi.mock('@/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib')>();
  return {
    ...actual,
    createRateLimiter: () => (fn: unknown) => fn,
    withRequestLogging: (fn: unknown) => fn,
  };
});

import { POST as researchPOST } from '@/app/api/research/route';

type RouteHandler = (req: NextRequest) => Promise<Response>;
// withRequestLogging/rateLimiter are unrolled in the mock; the real export is
// the wrapped handler whose second (route-context) arg is optional at runtime.
const POST = researchPOST as unknown as RouteHandler;

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/research — RP-based unlock (FID-029)', () => {
  beforeEach(() => {
    capture.updates.length = 0;
    capture.spendCalls.length = 0;
    capture.playerRow = { unlockedTechs: null, researchPoints: 0 };
  });

  it('spends RP and persists the unlock on unlockedTechs', async () => {
    capture.playerRow = { unlockedTechs: null, researchPoints: 20000 };

    const res = await POST(post({ technologyId: 'advanced-mining' }));
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(capture.spendCalls).toHaveLength(1);
    // FID-20260912-058 T2: advanced-mining repriced 5,000 → 3,000 RP.
    expect(capture.spendCalls[0]).toMatchObject({ playerId: 'tester', amount: 3000 });
    expect(data.researchPoints).toBe(17000); // 20000 − 3000 (T2 repricing)

    expect(capture.updates).toHaveLength(1);
    expect(capture.updates[0].set.unlockedTechs).toEqual(['advanced-mining']);
  });

  it('refuses when RP is insufficient (no update, no unlock)', async () => {
    capture.playerRow = { unlockedTechs: null, researchPoints: 100 };

    const res = await POST(post({ technologyId: 'advanced-mining' }));
    const data = await res.json();

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(data.success).toBe(false);
    expect(JSON.stringify(data)).toContain('Insufficient');
    expect(capture.updates).toHaveLength(0);
  });

  it('enforces prerequisites from the persisted tech list', async () => {
    capture.playerRow = { unlockedTechs: [], researchPoints: 50000 };

    const res = await POST(post({ technologyId: 'tactical-warfare' })); // requires fortification
    const data = await res.json();

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(data.success).toBe(false);
    expect(JSON.stringify(data)).toContain('Prerequisite not met');
    expect(capture.updates).toHaveLength(0);
    expect(capture.spendCalls).toHaveLength(0);
  });

  it('refuses a duplicate unlock', async () => {
    capture.playerRow = { unlockedTechs: ['fortification'], researchPoints: 50000 };

    const res = await POST(post({ technologyId: 'fortification' }));
    const data = await res.json();

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(data.success).toBe(false);
    expect(JSON.stringify(data)).toContain('already unlocked');
    expect(capture.spendCalls).toHaveLength(0);
  });

  it('refuses an unknown technology id', async () => {
    capture.playerRow = { unlockedTechs: [], researchPoints: 50000 };

    const res = await POST(post({ technologyId: 'gold-printer' }));
    const data = await res.json();

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(data.success).toBe(false);
    expect(capture.updates).toHaveLength(0);
  });
});
