/**
 * @file __tests__/api/factory/list-investment.test.ts
 * @overview FID-20260909-032 §H + §7 regression tests — factory investment.
 *
 * §7 superseded §H's reconstruction: factories now carry exact
 * invested_metal/invested_energy columns, maintained at write time by
 * build-unit ($inc production cost) and upgrade ($inc paid level cost),
 * zeroed by abandon/release. The list route reads the columns directly.
 *
 * Pinned here:
 * - Column values flow to per-card `invested` and totals verbatim.
 * - Pre-migration rows (columns 0/undefined) report 0 without NaN.
 * - Per-card sums equal the header totals.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { capture } = vi.hoisted(() => ({
  capture: {
    playerDoc: null as unknown,
    factoryDocs: [] as unknown[],
  },
}));

vi.mock('@/lib/authMiddleware', () => ({
  verifyAuth: vi.fn(async () => ({ username: 'tester', playerId: 'tester', isAdmin: false })),
}));

vi.mock('@/lib/mongodb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mongodb')>();
  return {
    ...actual,
    connectToDatabase: async () => ({
      collection: (name: string) => {
        if (name === 'players') {
          return { findOne: async () => capture.playerDoc };
        }
        if (name === 'factories') {
          return { find: () => ({ toArray: async () => capture.factoryDocs }) };
        }
        return {};
      },
    }),
    getCollection: actual.getCollection,
  };
});

import { GET as listFactories } from '@/app/api/factory/list/route';

function basePlayer() {
  return {
    username: 'tester',
    resources: { metal: 50000, energy: 25000 },
    units: [],
  };
}

function factory(x: number, y: number, over: Record<string, unknown> = {}) {
  return {
    x, y, owner: 'tester', defense: 1000, level: 1,
    slots: 5000, usedSlots: 10, productionRate: 0,
    lastSlotRegen: new Date(),
    ...over,
  };
}

function get(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

beforeEach(() => {
  capture.playerDoc = null;
  capture.factoryDocs = [];
});

describe('FID-20260909-032 §7 — exact factory investment columns', () => {
  it('per-card invested and header totals read the exact columns', async () => {
    capture.playerDoc = basePlayer();
    capture.factoryDocs = [
      factory(33, 1, { investedMetal: 2200, investedEnergy: 1100 }),
      factory(12, 8, { investedMetal: 4500, investedEnergy: 2250 }),
    ];

    const res = await listFactories(get('/api/factory/list'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalInvestment.metal).toBe(6700);
    expect(body.totalInvestment.energy).toBe(3350);
    expect(body.totalInvestment.total).toBe(10050);
    const byLoc = new Map(body.factories.map((f: { factory: { x: number; y: number }; invested: { metal: number; energy: number } }) => [`${f.factory.x},${f.factory.y}`, f.invested]));
    expect(byLoc.get('33,1')).toEqual({ metal: 2200, energy: 1100 });
    expect(byLoc.get('12,8')).toEqual({ metal: 4500, energy: 2250 });
  });

  it('pre-migration rows without the columns report 0, never NaN', async () => {
    capture.playerDoc = basePlayer();
    capture.factoryDocs = [factory(8, 9)]; // no invested* fields at all

    const res = await listFactories(get('/api/factory/list'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalInvestment.metal).toBe(0);
    expect(Number.isFinite(body.totalInvestment.metal)).toBe(true);
    expect(body.factories[0].invested).toEqual({ metal: 0, energy: 0 });
  });
});
