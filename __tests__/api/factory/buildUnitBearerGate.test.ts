// @vitest-environment node
/**
 * FID-20260912-077 — bearer-restriction enforcement parity.
 *            Rebased 2026-09-19 onto the direct drizzle seams (FID-20260917-017
 *            slice 5); the gate contract is unchanged.
 *
 * HOLDER_RESTRICTIONS lists 'build-unit', the bearer's flag panel claims unit
 * building is disabled, and /api/player/build-unit enforced it — but
 * /api/factory/build-unit (the in-game factory panel's endpoint) never did.
 * These tests pin the gate: blocked with the real reason for a bearer,
 * transparent for everyone else.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';

const { state, authMock, bonusStack } = vi.hoisted(() => {
  const state = {
    specs: [] as Array<Record<string, unknown>>,
    responder: (_spec: Record<string, unknown>) => [] as unknown,
  };
  const authMock = { value: { username: 'bearer1', playerId: 'bearer1', isAdmin: false } };
  const bonusStack = { current: { isBearer: true, restrictions: ['build-unit'] } };
  return { state, authMock, bonusStack };
});

// The gate is the thing under test — real implementation, controlled stack.
vi.mock('@/lib/flagBonusService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/flagBonusService')>();
  return {
    ...actual,
    getBonusStack: vi.fn(async () => bonusStack.current),
  };
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
vi.mock('@/lib/xpService', () => ({ awardXP: vi.fn(async () => ({ xpAwarded: 5, levelUp: false, newLevel: 16 })), XPAction: { UNIT_BUILD: 'UNIT_BUILD' } }));
vi.mock('@/lib/statTrackingService', () => ({ trackUnitBuilt: vi.fn(async () => undefined) }));
vi.mock('@/lib/specializationService', () => ({
  getPlayerDoctrineBonuses: vi.fn(async () => ({ metalCostMul: 1, energyCostMul: 1 })),
}));

import { POST as buildUnit } from '@/app/api/factory/build-unit/route';
import { HOLDER_RESTRICTIONS } from '@/lib/flagBonusService';
import { UnitType } from '@/types/game.types';
import { NextRequest } from 'next/server';

const routeCtx = { params: Promise.resolve({}) };

function tableOf(spec: Record<string, unknown> | undefined): string {
  const t = (spec?.table ?? spec?.from) as { $inferInsert?: unknown } | undefined;
  return getTableName((t ?? {}) as never);
}

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
  state.specs = [];
  state.responder = (spec) => {
    if (spec.op !== 'select') return spec.op === 'update' ? [{ id: 1 }] : [];
    const t = tableOf(spec);
    if (t === 'players') {
      return [{ units: [], resourcesMetal: 100000, resourcesEnergy: 100000, totalStrength: 0, totalDefense: 0 }];
    }
    if (t === 'factories') {
      return [{ x: 12, y: 8, owner: 'bearer1', defense: 1000, level: 1, slots: 5000, usedSlots: 0, productionRate: '0', lastSlotRegen: new Date(), investedMetal: 0, investedEnergy: 0 }];
    }
    return [];
  };
  bonusStack.current = { isBearer: true, restrictions: ['build-unit'] };
});

describe('factory build-unit bearer gate (FID-20260912-077)', () => {
  it('blocks the bearer with the real reason, before any write', async () => {
    const res = await buildUnit(request(), routeCtx);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('Flag Bearer');
    // gate fires before the write path AND before the data reads
    expect(state.specs.some((s) => s.op === 'update')).toBe(false);
    expect(state.specs.some((s) => tableOf(s) === 'players')).toBe(false);
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
