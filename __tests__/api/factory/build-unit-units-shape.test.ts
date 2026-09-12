/**
 * @file __tests__/api/factory/build-unit-units-shape.test.ts
 * @overview FID-20260909-032 §2-G regression tests — the units write shape.
 *
 * The original bug (found in the live DB, repaired by
 * scripts/repair-units-each-blob.ts): the route pushed the Mongo operand
 * `{ $each: [...] }` VERBATIM through the legacy seam, so `player.units`
 * accumulated a single junk `{$each:[…]}` blob object instead of N proper
 * unit entries — while `$set totalStrength` kept power numbers looking sane.
 * The rewrite writes quantity-folded, provenance-stamped PlayerUnit entries.
 *
 * Pinned here (the exact corruption class):
 * - Every pushed element is a REAL unit entry (unitId/name/quantity present),
 *   never a `$each` operand object.
 * - quantity-folded: one entry with quantity=Q, not Q entries.
 * - `producedAt` provenance stamped (§H investment reconstruction depends on it).
 * - Resource deduction and totals still applied atomically in one update.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { UnitType, UNIT_CONFIGS } from '@/types';

const { capture } = vi.hoisted(() => ({
  capture: {
    playerUpdate: null as { filter: unknown; update: unknown } | null,
    factoryUpdate: null as { filter: unknown; update: unknown } | null,
    playerDoc: null as unknown,
    factoryDoc: null as unknown,
  },
}));

vi.mock('@/lib/authMiddleware', () => ({
  authenticateRequest: vi.fn(async () => ({ username: 'tester', playerId: 'tester', isAdmin: false })),
  verifyAuth: vi.fn(async () => ({ username: 'tester', playerId: 'tester', isAdmin: false })),
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
          if (name === 'factories') capture.factoryUpdate = { filter, update };
          return { modifiedCount: 1 };
        },
      }),
    }),
  };
});

vi.mock('@/lib/activityLogger', () => ({ logFactory: vi.fn(async () => undefined) }));
// FID-20260912-077: the route now runs the bearer gate — mock as non-bearer
// (empty restrictions) so these tests exercise the build write path.
vi.mock('@/lib/flagBonusService', () => ({
  getBonusStack: vi.fn(async () => ({ isBearer: false, restrictions: [] })),
  assertHolderMayTransact: vi.fn(() => ({ ok: true })),
}));
vi.mock('@/lib/xpService', () => ({ awardXP: vi.fn(async () => ({ xpAwarded: 5, levelUp: false, newLevel: 16 })), XPAction: { UNIT_BUILD: 'UNIT_BUILD' } }));
vi.mock('@/lib/statTrackingService', () => ({ trackUnitBuilt: vi.fn(async () => undefined) }));

import { POST as buildUnit } from '@/app/api/factory/build-unit/route';

const RIFLE = UNIT_CONFIGS[UnitType.T1_Rifleman];

/** withRequestLogging's wrapped handler expects a route context arg. */
const routeCtx = { params: Promise.resolve({}) };

function request(over: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/factory/build-unit', {
    method: 'POST',
    body: JSON.stringify({ factoryX: 33, factoryY: 1, unitType: UnitType.T1_Rifleman, quantity: 10, ...over }),
  });
}

beforeEach(() => {
  capture.playerUpdate = null;
  capture.factoryUpdate = null;
  capture.factoryDoc = {
    x: 33, y: 1, owner: 'tester', defense: 1000, level: 1,
    slots: 5000, usedSlots: 0, productionRate: 0, lastSlotRegen: new Date(),
  };
  capture.playerDoc = {
    username: 'tester',
    resources: { metal: 1_000_000, energy: 500_000 },
    units: [],
    totalStrength: 0,
    totalDefense: 0,
  };
});

describe('FID-20260909-032 §2-G — build-unit units write shape', () => {
  it('pushes quantity-folded REAL unit entries — never an $each operand blob', async () => {
    const res = await buildUnit(request(), routeCtx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const pushed = (capture.playerUpdate!.update as { $push: { units: Array<Record<string, unknown>> } }).$push.units;
    expect(Array.isArray(pushed)).toBe(true);
    expect(pushed).toHaveLength(1); // folded: one entry for 10 units

    const entry = pushed[0] as Record<string, unknown>;
    // A real PlayerUnit, not the historical `{$each:[…]}` blob:
    expect(entry).not.toHaveProperty('$each');
    expect(entry.unitType).toBe(UnitType.T1_Rifleman);
    expect(entry.name).toBe(RIFLE.name);
    expect(entry.quantity).toBe(10);
  });

  it('stamps producedAt provenance (per-factory investment reconstruction)', async () => {
    await buildUnit(request({ factoryX: 12, factoryY: 8 }), routeCtx);

    const pushed = (capture.playerUpdate!.update as { $push: { units: Array<Record<string, unknown>> } }).$push.units;
    expect(pushed[0].producedAt).toEqual({ x: 12, y: 8 });
  });

  it('deducts exact resources and sets honest totals in the SAME update', async () => {
    const res = await buildUnit(request({ quantity: 3 }), routeCtx);
    const body = await res.json();

    const update = capture.playerUpdate!.update as {
      $inc: Record<string, number>;
      $set: Record<string, number>;
    };
    expect(update.$inc['resources.metal']).toBe(-(RIFLE.metalCost * 3));
    expect(update.$inc['resources.energy']).toBe(-(RIFLE.energyCost * 3));
    expect(update.$set.totalStrength).toBe(RIFLE.strength * 3);
    expect(body.resourcesSpent.metal).toBe(RIFLE.metalCost * 3);
  });

  it('consumes factory slots on the factory update (slot tracking persists)', async () => {
    await buildUnit(request({ quantity: 10 }), routeCtx);

    expect(capture.factoryUpdate).not.toBeNull();
    const set = (capture.factoryUpdate!.update as { $set: Record<string, unknown> }).$set;
    expect(set.usedSlots).toBe(RIFLE.slotCost * 10);
  });

  it('§7: increments exact invested columns by production cost (SQL delta)', async () => {
    await buildUnit(request({ quantity: 10 }), routeCtx);

    const inc = (capture.factoryUpdate!.update as { $inc: Record<string, number> }).$inc;
    expect(inc.investedMetal).toBe(RIFLE.metalCost * 10);
    expect(inc.investedEnergy).toBe(RIFLE.energyCost * 10);
  });

  it('rejects building when slots are exhausted (400, no writes)', async () => {
    capture.factoryDoc = { ...(capture.factoryDoc as Record<string, unknown>), usedSlots: 5000 }; // capacity full

    const res = await buildUnit(request({ quantity: 10 }), routeCtx);
    expect(res.status).toBe(400);
    expect(capture.playerUpdate).toBeNull();
    expect(capture.factoryUpdate).toBeNull();
  });
});
