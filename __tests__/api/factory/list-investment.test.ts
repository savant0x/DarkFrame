/**
 * @file __tests__/api/factory/list-investment.test.ts
 * @overview FID-20260909-032 §H + §7 regression tests — factory investment.
 *            Rebased 2026-09-19 onto the direct drizzle seams (FID-20260917-017
 *            slice 5): the route reads resources over the flat pg columns and
 *            factories via a drizzle select.
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
import { getTableName } from 'drizzle-orm';

const { state, authMock } = vi.hoisted(() => {
  const state = {
    specs: [] as Array<Record<string, unknown>>,
    responder: (_spec: Record<string, unknown>) => [] as unknown,
  };
  const authMock = { value: { username: 'tester', playerId: 'tester', isAdmin: false } };
  return { state, authMock };
});

vi.mock('@/lib/authMiddleware', () => ({
  verifyAuth: vi.fn(async () => authMock.value),
}));

vi.mock('@/lib/db/connection', () => {
  const mk = (spec: Record<string, unknown>): Record<string, unknown> => {
    state.specs.push(spec);
    const terminal = {
      from: (t: unknown) => { spec.from = t; return terminal; },
      where: (c: unknown) => { spec.where = c; return terminal; },
      limit: (n: number) => { spec.limit = n; return terminal; },
      offset: (n: number) => { spec.offset = n; return terminal; },
      values: (v: unknown) => { spec.values = v; return terminal; },
      set: (v: unknown) => { spec.set = v; return terminal; },
      returning: () => { spec.returning = true; return terminal; },
      then: (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(state.responder(spec)).then(onF, onR),
    };
    return terminal;
  };
  return {
    db: {
      insert: (t: unknown) => mk({ op: 'insert', table: t }),
      update: (t: unknown) => mk({ op: 'update', table: t }),
      delete: (t: unknown) => mk({ op: 'delete', table: t }),
      select: (...fields: unknown[]) => mk({ op: 'select', fields }),
      execute: async () => ({ rows: [] }),
    },
  };
});

import { GET as listFactories } from '@/app/api/factory/list/route';

function tableOf(spec: Record<string, unknown> | undefined): string {
  const t = (spec?.table ?? spec?.from) as { $inferInsert?: unknown } | undefined;
  return getTableName((t ?? {}) as never);
}

function factory(x: number, y: number, over: Record<string, unknown> = {}) {
  return {
    x, y, owner: 'tester', defense: 1000, level: 1,
    slots: 5000, usedSlots: 10, productionRate: '0',
    lastSlotRegen: new Date(),
    investedMetal: 0, investedEnergy: 0,
    lastAttackedBy: null, lastAttackTime: null,
    ...over,
  };
}

function get(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

beforeEach(() => {
  state.specs = [];
  state.responder = (spec) => {
    if (spec.op !== 'select') return [];
    const t = tableOf(spec);
    if (t === 'players') return [{ resourcesMetal: 50000, resourcesEnergy: 25000 }];
    if (t === 'factories') return [];
    return [];
  };
});

describe('FID-20260909-032 §7 — exact factory investment columns', () => {
  it('per-card invested and header totals read the exact columns', async () => {
    state.responder = (spec) => {
      if (spec.op !== 'select') return [];
      const t = tableOf(spec);
      if (t === 'players') return [{ resourcesMetal: 50000, resourcesEnergy: 25000 }];
      if (t === 'factories') {
        return [
          factory(33, 1, { investedMetal: 2200, investedEnergy: 1100 }),
          factory(12, 8, { investedMetal: 4500, investedEnergy: 2250 }),
        ];
      }
      return [];
    };

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
    state.responder = (spec) => {
      if (spec.op !== 'select') return [];
      const t = tableOf(spec);
      if (t === 'players') return [{ resourcesMetal: 50000, resourcesEnergy: 25000 }];
      if (t === 'factories') return [factory(8, 9)]; // invested columns default 0
      return [];
    };

    const res = await listFactories(get('/api/factory/list'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalInvestment.metal).toBe(0);
    expect(Number.isFinite(body.totalInvestment.metal)).toBe(true);
    expect(body.factories[0].invested).toEqual({ metal: 0, energy: 0 });
  });
});
