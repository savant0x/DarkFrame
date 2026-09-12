/**
 * FID-20260912-077 — bearer-restriction enforcement parity.
 *
 * HOLDER_RESTRICTIONS lists 'build-unit', the bearer's flag panel claims unit
 * building is disabled, and /api/player/build-unit enforced it — but
 * /api/factory/build-unit (the in-game factory panel's endpoint) never did.
 * These tests pin the gate: blocked with the real reason for a bearer,
 * transparent for everyone else.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const capture: {
  playerDoc: Record<string, unknown> | null;
  factoryDoc: Record<string, unknown> | null;
  playerUpdate: { filter: unknown; update: unknown } | null;
} = { playerDoc: null, factoryDoc: null, playerUpdate: null };

// The gate is the thing under test — real implementation, controlled stack.
const bonusStack = vi.hoisted(() => ({ current: { isBearer: true, restrictions: ['build-unit'] } }));
vi.mock('@/lib/flagBonusService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/flagBonusService')>();
  return {
    ...actual,
    getBonusStack: vi.fn(async () => bonusStack.current),
  };
});

vi.mock('@/lib/authMiddleware', () => ({
  authenticateRequest: vi.fn(async () => ({ username: 'bearer1', playerId: 'bearer1', isAdmin: false })),
  verifyAuth: vi.fn(async () => ({ username: 'bearer1', playerId: 'bearer1', isAdmin: false })),
}));

vi.mock('@/lib/mongodb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mongodb')>();
  return {
    ...actual,
    connectToDatabase: async () => ({
      collection: (name: string) => ({
        findOne: async () => (name === 'players' ? capture.playerDoc : capture.factoryDoc),
        updateOne: async (filter: unknown, update: unknown) => {
          if (name === 'players') capture.playerUpdate = { filter, update };
          return { modifiedCount: 1 };
        },
      }),
    }),
  };
});

vi.mock('@/lib/activityLogger', () => ({ logFactory: vi.fn(async () => undefined) }));
vi.mock('@/lib/xpService', () => ({ awardXP: vi.fn(async () => ({ xpAwarded: 5, levelUp: false, newLevel: 16 })), XPAction: { UNIT_BUILD: 'UNIT_BUILD' } }));
vi.mock('@/lib/statTrackingService', () => ({ trackUnitBuilt: vi.fn(async () => undefined) }));

import { POST as buildUnit } from '@/app/api/factory/build-unit/route';
import { HOLDER_RESTRICTIONS } from '@/lib/flagBonusService';
import { UnitType } from '@/types/game.types';
import { NextRequest } from 'next/server';

const routeCtx = { params: Promise.resolve({}) };

function request() {
  // Route reads a sessionId cookie for telemetry — include one.
  return new NextRequest('http://localhost/api/factory/build-unit', {
    method: 'POST',
    headers: { cookie: 'sessionId=test-session' },
    body: JSON.stringify({ factoryX: 12, factoryY: 8, unitType: UnitType.T1_Rifleman, quantity: 1 }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  capture.playerDoc = { username: 'bearer1', resources: { metal: 100000, energy: 100000 } };
  capture.factoryDoc = { x: 12, y: 8, owner: 'bearer1', level: 1, usedSlots: 0, slots: 5000, lastSlotRegen: new Date() };
  capture.playerUpdate = null;
  bonusStack.current = { isBearer: true, restrictions: ['build-unit'] };
});

describe('factory build-unit bearer gate (FID-20260912-077)', () => {
  it('blocks the bearer with the real reason, before any write', async () => {
    const res = await buildUnit(request(), routeCtx);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('Flag Bearer');
    expect(capture.playerUpdate).toBeNull(); // gate fires before the write path
  });

  it('lets a non-bearer through to the build path', async () => {
    bonusStack.current = { isBearer: false, restrictions: [] };
    const res = await buildUnit(request(), routeCtx);
    expect(res.status).toBe(200);
  });

  it('docs and enforcement agree: build-unit is in HOLDER_RESTRICTIONS', () => {
    expect(HOLDER_RESTRICTIONS).toContain('build-unit');
  });
});
