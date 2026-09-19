// @vitest-environment node
/**
 * @file __tests__/api/factory/build-unit-units-shape.test.ts
 * @overview FID-20260909-032 §2-G regression tests — the units write shape.
 *            Rebased 2026-09-19 onto the direct drizzle/pg seams (FID-20260917-017
 *            slice 5): the route no longer rides the Mongo shim, so the mock
 *            rides the real drizzle query-builder and asserts the SET payload
 *            (SQL deltas + the jsonb || append).
 *
 * The original bug (found in the live DB, repaired by
 * scripts/repair-units-each-blob.ts): the route pushed the Mongo operand
 * `{ $each: [...] }` VERBATIM through the legacy seam, so `player.units`
 * accumulated a single junk `{$each:[…]}` blob object instead of N proper
 * unit entries — while `$set totalStrength` kept power numbers looking sane.
 * The route writes quantity-folded, provenance-stamped PlayerUnit entries.
 *
 * Pinned here (the exact corruption class):
 * - The appended element is a REAL unit entry (unitId/name/quantity present),
 *   never a `$each` operand object.
 * - quantity-folded: one entry with quantity=Q, not Q entries.
 * - `producedAt` provenance stamped (§H investment reconstruction depends on it).
 * - Resource deduction and totals ride SQL deltas in the SAME update.
 * - Factory slots consumed + §7 invested columns incremented on the factory update.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTableName } from 'drizzle-orm';
import { UnitType, UNIT_CONFIGS } from '@/types';

const { state, authMock } = vi.hoisted(() => {
  const state = {
    specs: [] as Array<Record<string, unknown>>,
    responder: (_spec: Record<string, unknown>) => [] as unknown,
  };
  const authMock = { value: { username: 'tester', playerId: 'tester', isAdmin: false } };
  return { state, authMock };
});

vi.mock('@/lib/authMiddleware', () => ({
  authenticateRequest: vi.fn(async () => authMock.value),
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

vi.mock('@/lib/activityLogger', () => ({ logFactory: vi.fn(async () => undefined) }));
vi.mock('@/lib/flagBonusService', () => ({
  getBonusStack: vi.fn(async () => ({ isBearer: false, restrictions: [] })),
  assertHolderMayTransact: vi.fn(() => ({ ok: true })),
}));
vi.mock('@/lib/xpService', () => ({ awardXP: vi.fn(async () => ({ xpAwarded: 5, levelUp: false, newLevel: 16 })), XPAction: { UNIT_BUILD: 'UNIT_BUILD' } }));
vi.mock('@/lib/statTrackingService', () => ({ trackUnitBuilt: vi.fn(async () => undefined) }));
vi.mock('@/lib/specializationService', () => ({
  getPlayerDoctrineBonuses: vi.fn(async () => ({ metalCostMul: 1, energyCostMul: 1 })),
}));

import { POST as buildUnit } from '@/app/api/factory/build-unit/route';

const RIFLE = UNIT_CONFIGS[UnitType.T1_Rifleman];

/** withRequestLogging's wrapped handler expects a route context arg. */
const routeCtx = { params: Promise.resolve({}) };

function tableOf(spec: Record<string, unknown> | undefined): string {
  const t = (spec?.table ?? spec?.from) as { $inferInsert?: unknown } | undefined;
  return getTableName((t ?? {}) as never);
}

/** Flatten a drizzle SQL/chunk tree (columns → names, params → values). */
function sqlText(node: unknown, seen = new WeakSet<object>()): string {
  if (node == null || typeof node === 'number' || typeof node === 'boolean') return String(node);
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map((n) => sqlText(n, seen)).join(' ');
  if (typeof node === 'object') {
    if (seen.has(node)) return '';
    seen.add(node);
    const o = node as Record<string, unknown>;
    if (typeof o.name === 'string' && (o.table !== undefined || typeof o.columnType === 'string')) return o.name;
    if (o.value !== undefined) return sqlText(o.value, seen);
    if (Array.isArray(o.queryChunks)) return sqlText(o.queryChunks, seen);
    if (typeof o.sql === 'string') return o.sql;
    return '';
  }
  return '';
}

/** The unit entry appended via `players.units || '[…]'::jsonb`. */
function appendedUnit(unitsSql: unknown): Record<string, unknown> {
  const text = sqlText(unitsSql);
  const match = text.match(/\|\|\s*(\[.*\])\s*::jsonb/);
  expect(match, `units SQL must embed the entry JSON: ${text}`).not.toBeNull();
  const parsed = JSON.parse(match![1]) as Array<Record<string, unknown>>;
  return parsed[0];
}

function request(over: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/factory/build-unit', {
    method: 'POST',
    body: JSON.stringify({ factoryX: 33, factoryY: 1, unitType: UnitType.T1_Rifleman, quantity: 10, ...over }),
  });
}

const factoryRow = (over: Record<string, unknown> = {}) => ({
  x: 33, y: 1, owner: 'tester', defense: 1000, level: 1,
  slots: 5000, usedSlots: 0, productionRate: '0', lastSlotRegen: new Date(),
  investedMetal: 0, investedEnergy: 0, lastAttackedBy: null, lastAttackTime: null,
  ...over,
});

beforeEach(() => {
  state.specs = [];
  state.responder = (spec) => {
    if (spec.op !== 'select') return spec.op === 'update' ? [{ id: 1 }] : [];
    const t = tableOf(spec);
    if (t === 'players') {
      return [{
        units: [], resourcesMetal: 1_000_000, resourcesEnergy: 500_000,
        totalStrength: 0, totalDefense: 0,
      }];
    }
    if (t === 'factories') return [factoryRow()];
    return [];
  };
});

describe('FID-20260909-032 §2-G — build-unit units write shape', () => {
  it('appends one quantity-folded REAL unit entry — never an $each operand blob', async () => {
    const res = await buildUnit(request(), routeCtx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const playerUpdate = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'players');
    const entry = appendedUnit((playerUpdate!.set as Record<string, unknown>).units);
    // A real PlayerUnit, not the historical `{$each:[…]}` blob:
    expect(entry).not.toHaveProperty('$each');
    expect(entry.unitType).toBe(UnitType.T1_Rifleman);
    expect(entry.name).toBe(RIFLE.name);
    expect(entry.quantity).toBe(10);
  });

  it('stamps producedAt provenance (per-factory investment reconstruction)', async () => {
    await buildUnit(request({ factoryX: 12, factoryY: 8 }), routeCtx);

    const playerUpdate = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'players');
    const entry = appendedUnit((playerUpdate!.set as Record<string, unknown>).units);
    expect(entry.producedAt).toEqual({ x: 12, y: 8 });
  });

  it('deducts exact resources and bumps honest totals via SQL deltas in the SAME update', async () => {
    const res = await buildUnit(request({ quantity: 3 }), routeCtx);
    const body = await res.json();

    const set = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'players')!.set as Record<string, unknown>;
    expect(sqlText(set.resourcesMetal).replace(/\s+/g, ' ').trim()).toBe(`resources_metal - ${RIFLE.metalCost * 3}`);
    expect(sqlText(set.resourcesEnergy).replace(/\s+/g, ' ').trim()).toBe(`resources_energy - ${RIFLE.energyCost * 3}`);
    expect(sqlText(set.totalStrength).replace(/\s+/g, ' ').trim()).toBe(`total_strength + ${RIFLE.strength * 3}`);
    expect(body.resourcesSpent.metal).toBe(RIFLE.metalCost * 3);
  });

  it('consumes factory slots on the factory update (slot tracking persists)', async () => {
    await buildUnit(request({ quantity: 10 }), routeCtx);

    const factoryUpdate = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'factories');
    expect(factoryUpdate).toBeDefined();
    const set = factoryUpdate!.set as Record<string, unknown>;
    expect(set.usedSlots).toBe(RIFLE.slotCost * 10);
  });

  it('§7: increments exact invested columns by production cost (SQL delta)', async () => {
    await buildUnit(request({ quantity: 10 }), routeCtx);

    const set = state.specs.find((s) => s.op === 'update' && tableOf(s) === 'factories')!.set as Record<string, unknown>;
    expect(sqlText(set.investedMetal).replace(/\s+/g, ' ').trim()).toBe(`invested_metal + ${RIFLE.metalCost * 10}`);
    expect(sqlText(set.investedEnergy).replace(/\s+/g, ' ').trim()).toBe(`invested_energy + ${RIFLE.energyCost * 10}`);
  });

  it('rejects building when slots are exhausted (400, no writes)', async () => {
    state.responder = (spec) => {
      if (spec.op === 'select' && tableOf(spec) === 'factories') return [factoryRow({ usedSlots: 5000 })];
      if (spec.op === 'select' && tableOf(spec) === 'players') {
        return [{ units: [], resourcesMetal: 1_000_000, resourcesEnergy: 500_000, totalStrength: 0, totalDefense: 0 }];
      }
      return [];
    };

    const res = await buildUnit(request({ quantity: 10 }), routeCtx);
    expect(res.status).toBe(400);
    expect(state.specs.some((s) => s.op === 'update')).toBe(false);
  });
});
