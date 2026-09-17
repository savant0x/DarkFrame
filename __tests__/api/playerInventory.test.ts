/**
 * @file __tests__/api/playerInventory.test.ts
 * @created 2026-09-17
 * @overview Pins for FID-20260917-008, GET /api/player/inventory (pg rewrite):
 *            auth pass-through, the EXACT unwrapped InventoryData contract the
 *            panel consumes (numeric strings parsed, expiresAt as ISO string),
 *            mid-request-deletion 401 envelope, DB-failure 500 envelope. Error
 *            envelopes are the REAL helpers — only requireAuth and the db
 *            handle are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { requireAuthMock, selectMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock('@/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib')>();
  return {
    ...actual,
    requireAuth: requireAuthMock,
  };
});

vi.mock('@/lib/db', () => ({
  db: { select: selectMock },
}));
// NOTE: '@/lib/db/schema' stays REAL — it is pure table definitions (no
// connection), and the real '@/lib' barrel re-exports it, so a full-replace
// mock here starves the barrel (userPresence et al.) and breaks imports.

import { GET } from '@/app/api/player/inventory/route';

// The route exports a withRequestLogging-wrapped handler whose signature is
// (request, context) with context non-optional — same call idiom as the
// repo's callGET helpers.
const callGET = (req: NextRequest) =>
  GET(req, { params: Promise.resolve({}) }) as Promise<NextResponse>;

const AUTH = { playerId: 'fame', username: 'fame' };

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/player/inventory');
}

function chainRows(rows: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(rows)),
  };
  selectMock.mockReturnValue(builder);
  return builder;
}

function fullRow(overrides: Record<string, unknown> = {}) {
  return {
    inventoryItems: [],
    inventoryCapacity: 2000,
    inventoryMetalDiggerCount: 0,
    inventoryEnergyDiggerCount: 0,
    gatheringBonusMetalBonus: '0',
    gatheringBonusEnergyBonus: '0',
    activeBoostsGatheringBoost: null,
    activeBoostsExpiresAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue(AUTH);
});

describe('GET /api/player/inventory (FID-20260917-008 pg rewrite)', () => {
  it('passes requireAuth rejections through untouched', async () => {
    const refusal = NextResponse.json(
      { success: false, error: { code: 'AUTH_INVALID_TOKEN' } },
      { status: 401 },
    );
    requireAuthMock.mockResolvedValueOnce(refusal);

    const res = await callGET(makeRequest());

    expect(res).toBe(refusal);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('returns the EXACT unwrapped contract the panel consumes (numeric strings parsed)', async () => {
    chainRows([
      fullRow({
        inventoryItems: [
          { id: 'd1', type: 'digger', name: 'Metal Digger', rarity: 'Common', bonusPercent: 0.5 },
          { producedAt: 'x', type: 'unit' }, // mixed jsonb: Unit entries ride along unfiltered
        ],
        gatheringBonusMetalBonus: '39.00', // pg numeric arrives as a string
        gatheringBonusEnergyBonus: '37.00',
      }),
    ]);

    const res = await callGET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    // UNWRAPPED — InventoryPanel does setInventory(data) directly, so the
    // payload must equal InventoryData exactly (no { success, inventory }).
    expect(body).toEqual({
      capacity: 2000,
      items: [
        { id: 'd1', type: 'digger', name: 'Metal Digger', rarity: 'Common', bonusPercent: 0.5 },
        { producedAt: 'x', type: 'unit' },
      ],
      gatheringBonus: { metalBonus: 39, energyBonus: 37 },
      metalDiggerCount: 0,
      energyDiggerCount: 0,
      activeBoosts: { gatheringBoost: null, expiresAt: null },
    });
  });

  it('serializes activeBoosts.expiresAt as an ISO string (client feeds it to new Date)', async () => {
    chainRows([
      fullRow({
        activeBoostsGatheringBoost: '12.50',
        activeBoostsExpiresAt: new Date('2026-09-18T12:00:00Z'),
      }),
    ]);

    const res = await callGET(makeRequest());
    const body = await res.json();

    expect(body.activeBoosts.gatheringBoost).toBe(12.5);
    expect(body.activeBoosts.expiresAt).toBe('2026-09-18T12:00:00.000Z');
  });

  it('maps a mid-request row deletion to the AUTH_USER_NOT_FOUND 401 envelope', async () => {
    chainRows([]);

    const res = await callGET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUTH_USER_NOT_FOUND');
  });

  it('maps a DB failure to the INTERNAL_ERROR 500 envelope', async () => {
    selectMock.mockImplementation(() => {
      throw new Error('connection refused');
    });

    const res = await callGET(makeRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
