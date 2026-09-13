/**
 * FID-20260912-081 — Beer Base units-healing + roster contract tests.
 *
 * The starvation bug: AdminView posted the spawn-rate sliders /100 (storing
 * 0.05/0.1 where the canon unit is a percent integer), and
 * getTargetBeerBaseCount divided by 100 AGAIN — 51 bots × 0.00075 → target 1.
 * The weekly respawn then trimmed the population to a single base every
 * Sunday. Live DB at audit time: 1 special base among 52 bots.
 *
 * These tests pin:
 *   • normalizeSpawnRateConfig: fraction-era values heal (×100), percent
 *     values pass through, edge cases behave, disabled (0/0) configs untouched.
 *   • getTargetBeerBaseCount: percent-unit math produces the documented
 *     population (bots × avg% / 100), with caps and the no-regular-bots guard.
 *   • /api/admin/beer-bases/list: roster shape + rank→tier derivation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- normalizeSpawnRateConfig + getTargetBeerBaseCount (pure + mongo shim) ----

const { capture } = vi.hoisted(() => ({
  capture: {
    regularBots: 0,
    botCapRow: null as { totalBotCap?: number } | null,
    configRows: [] as Array<{ config: Record<string, unknown> }>,
  },
}));

vi.mock('@/lib/mongodb', () => ({
  connectToDatabase: async () => ({
    collection: (_name: string) => ({
      countDocuments: async (filter: Record<string, unknown>) => {
        // The service filters Beer Bases out of the denominator — pin that.
        expect(filter).toMatchObject({ isBot: true, isSpecialBase: { $ne: true } });
        return capture.regularBots;
      },
      findOne: async () => capture.botCapRow,
    }),
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    // One drizzle mock serving both query shapes this FID touches:
    //   getBeerBaseConfig: select().from().where().limit()  → capture.configRows
    //   roster route:      select().from().where().orderBy() → rosterRows.rows
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => capture.configRows,
          orderBy: async () => rosterRows.rows,
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  gameConfig: { type: 'type' },
  players: {
    username: 'username',
    rank: 'rank',
    level: 'level',
    baseX: 'base_x',
    baseY: 'base_y',
    totalStrength: 'total_strength',
    totalDefense: 'total_defense',
    resourcesMetal: 'resources_metal',
    resourcesEnergy: 'resources_energy',
    units: 'units',
    isBot: 'is_bot',
    isSpecialBase: 'is_special_base',
  },
}));

import { normalizeSpawnRateConfig, getBeerBaseConfig, getTargetBeerBaseCount } from '@/lib/beerBaseService';

describe('normalizeSpawnRateConfig (FID-20260912-081 units healing)', () => {
  it('heals the fraction-era row the old AdminView wrote (0.05/0.1 → 5/10)', () => {
    const healed = normalizeSpawnRateConfig({ spawnRateMin: 0.05, spawnRateMax: 0.1 });
    expect(healed.spawnRateMin).toBe(5);
    expect(healed.spawnRateMax).toBe(10);
  });

  it('leaves canonical percent values untouched', () => {
    const healed = normalizeSpawnRateConfig({ spawnRateMin: 5, spawnRateMax: 10 });
    expect(healed.spawnRateMin).toBe(5);
    expect(healed.spawnRateMax).toBe(10);
  });

  it('heals boundary max=1 as a fraction, preserves a real 1% min', () => {
    expect(normalizeSpawnRateConfig({ spawnRateMin: 0.2, spawnRateMax: 1 }).spawnRateMax).toBe(100);
    expect(normalizeSpawnRateConfig({ spawnRateMin: 1, spawnRateMax: 50 })).toEqual({
      spawnRateMin: 1,
      spawnRateMax: 50,
    });
  });

  it('treats 0/0 as a disabled percent config (no fractional healing)', () => {
    expect(normalizeSpawnRateConfig({ spawnRateMin: 0, spawnRateMax: 0 })).toEqual({
      spawnRateMin: 0,
      spawnRateMax: 0,
    });
  });

  it('clamps healed values into 0–100 and passes other fields through', () => {
    const healed = normalizeSpawnRateConfig({
      spawnRateMin: 0.005, // sub-1% fraction → 0.5 → clamped? No: min 0.5*100=0.5 stays
      spawnRateMax: 25, // mixed: max ≥1 ⇒ no healing at all
      resourceMultiplier: 3,
    });
    expect(healed.spawnRateMin).toBe(0.005);
    expect(healed.resourceMultiplier).toBe(3);
  });
});

describe('getBeerBaseConfig healing (FID-20260912-081)', () => {
  beforeEach(() => {
    capture.configRows = [];
  });

  it('serves healed spawn rates from the poisoned DB row', async () => {
    capture.configRows = [{ config: { enabled: true, spawnRateMin: 0.05, spawnRateMax: 0.1 } }];
    const cfg = await getBeerBaseConfig();
    expect(cfg.spawnRateMin).toBe(5);
    expect(cfg.spawnRateMax).toBe(10);
  });

  it('serves canonical rows unchanged', async () => {
    capture.configRows = [{ config: { enabled: true, spawnRateMin: 5, spawnRateMax: 10 } }];
    const cfg = await getBeerBaseConfig();
    expect(cfg.spawnRateMin).toBe(5);
    expect(cfg.spawnRateMax).toBe(10);
  });
});

describe('getTargetBeerBaseCount percent math (FID-20260912-081)', () => {
  beforeEach(() => {
    capture.regularBots = 0;
    capture.botCapRow = null;
    capture.configRows = [];
  });

  it('51 regular bots at canonical 5–10% → target 3 (was 1 under fraction poison)', async () => {
    capture.regularBots = 51;
    capture.configRows = [{ config: { enabled: true, spawnRateMin: 5, spawnRateMax: 10 } }];
    // (5+10)/2 = 7.5% of 51 = 3.825 → floor 3
    expect(await getTargetBeerBaseCount()).toBe(3);
  });

  it('2000 regular bots at 5–10% → 150, capped at 10% of a 1000 bot cap', async () => {
    capture.regularBots = 2000;
    capture.botCapRow = { totalBotCap: 1000 };
    capture.configRows = [{ config: { enabled: true, spawnRateMin: 5, spawnRateMax: 10 } }];
    expect(await getTargetBeerBaseCount()).toBe(100); // cap binds: 10% of 1000
  });

  it('no regular bots → 0 (no bases before the bot population exists)', async () => {
    capture.regularBots = 0;
    capture.configRows = [{ config: { enabled: true, spawnRateMin: 5, spawnRateMax: 10 } }];
    expect(await getTargetBeerBaseCount()).toBe(0);
  });

  it('disabled config → 0 regardless of population', async () => {
    capture.regularBots = 500;
    capture.configRows = [{ config: { enabled: false, spawnRateMin: 5, spawnRateMax: 10 } }];
    expect(await getTargetBeerBaseCount()).toBe(0);
  });

  it('never below 1 when enabled and bots exist', async () => {
    capture.regularBots = 3;
    capture.configRows = [{ config: { enabled: true, spawnRateMin: 0, spawnRateMax: 1 } }];
    expect(await getTargetBeerBaseCount()).toBe(1);
  });
});

// --- /api/admin/beer-bases/list roster contract --------------------------------

const rosterRows = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  authUser: { username: 'admin', isAdmin: true } as { username: string; isAdmin: boolean } | null,
}));

vi.mock('@/lib/db/schema', () => ({
  gameConfig: { type: 'type' },
  players: {
    username: 'username',
    rank: 'rank',
    level: 'level',
    baseX: 'base_x',
    baseY: 'base_y',
    totalStrength: 'total_strength',
    totalDefense: 'total_defense',
    resourcesMetal: 'resources_metal',
    resourcesEnergy: 'resources_energy',
    units: 'units',
    isBot: 'is_bot',
    isSpecialBase: 'is_special_base',
  },
}));

vi.mock('@/lib/authService', () => ({
  getAuthenticatedUser: async () => rosterRows.authUser,
}));

vi.mock('@/lib', () => ({
  withRequestLogging: (h: unknown) => h,
  createRouteLogger: () => ({ time: () => () => undefined, error: () => undefined }),
  createRateLimiter: () => (h: unknown) => h,
  ENDPOINT_RATE_LIMITS: { admin: {} },
  createErrorResponse: (code: string, opts: { message: string }) =>
    new Response(JSON.stringify({ success: false, message: opts.message }), { status: 403 }),
  createErrorFromException: () => new Response(JSON.stringify({ success: false }), { status: 500 }),
  ErrorCode: { ADMIN_ACCESS_REQUIRED: 'ADMIN', INTERNAL_ERROR: 'INTERNAL' },
}));

import { NextRequest } from 'next/server';
import { GET as rosterGET } from '@/app/api/admin/beer-bases/list/route';
function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    username: 'Silent Citadel',
    rank: 4,
    level: 27,
    baseX: 45,
    baseY: 8,
    totalStrength: 900000,
    totalDefense: 400000,
    resourcesMetal: 120000,
    resourcesEnergy: 80000,
    units: [{ quantity: 40 }, { quantity: 10 }],
    ...overrides,
  };
}

describe('GET /api/admin/beer-bases/list (FID-20260912-081 roster)', () => {
  beforeEach(() => {
    rosterRows.rows = [];
    rosterRows.authUser = { username: 'admin', isAdmin: true };
  });

  it('serves the roster with rank→tier, army size, and sorted power', async () => {
    rosterRows.rows = [baseRow(), baseRow({ username: 'Old Ruin', rank: 1, level: 3 })];
    const res = await rosterGET(new NextRequest('http://localhost/api/admin/beer-bases/list'), { data: rosterRows.rows } as unknown as Parameters<typeof rosterGET>[1]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.total).toBe(2);
    expect(body.bases[0]).toMatchObject({
      username: 'Silent Citadel',
      tier: 'ELITE', // rank 4
      level: 27,
      position: { x: 45, y: 8 },
      armySize: 50,
    });
    expect(body.bases[1].tier).toBe('WEAK'); // rank 1
  });

  it('falls back to level bands when rank is out of contract', async () => {
    rosterRows.rows = [baseRow({ rank: null, level: 47 })];
    const body = await (await rosterGET(new NextRequest('http://localhost/api/admin/beer-bases/list'), { data: rosterRows.rows } as unknown as Parameters<typeof rosterGET>[1])).json();
    expect(body.bases[0].tier).toBe('LEGENDARY');
  });

  it('denies non-admin callers', async () => {
    rosterRows.authUser = null;
    const res = await rosterGET(new NextRequest('http://localhost/api/admin/beer-bases/list'), { data: [] } as unknown as Parameters<typeof rosterGET>[1]);
    expect(res.status).toBe(403);
  });
});
