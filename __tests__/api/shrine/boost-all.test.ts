// @vitest-environment node
/**
 * @file __tests__/api/shrine/boost-all.test.ts
 * @overview FID-20260917-002 — boost-all parity pins (created; no test file
 * existed for this route).
 *
 * Pins the FID-20260917-002 contract on the second live shrine write surface:
 * server-side shrine presence (fail-closed), all-four-suit activation, and the
 * operator ruling (2026-09-17) that ONE call = ONE trade + ONE XP award —
 * four suits are one transaction, not four.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { capture } = vi.hoisted(() => ({
  capture: {
    updateOne: [] as Array<{ filter: unknown; update: unknown }>,
    playerDoc: null as unknown,
    shrineTile: null as unknown,
  },
}));

vi.mock('@/lib/authMiddleware', () => ({
  verifyAuth: vi.fn(async () => ({ username: 'tester', playerId: 'tester', isAdmin: false })),
}));

vi.mock('@/lib/mongodb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mongodb')>();
  return {
    ...actual,
    getCollection: (name: string) => ({
      findOne: async () => (name === 'tiles' ? capture.shrineTile : capture.playerDoc),
      updateOne: async (filter: unknown, update: unknown) => {
        capture.updateOne.push({ filter, update });
        return { modifiedCount: 1 };
      },
    }),
  };
});

vi.mock('@/lib/xpService', () => ({
  awardXP: vi.fn(async () => ({
    xpAwarded: 40,
    totalXP: 1040,
    oldLevel: 1,
    newLevel: 1,
    levelUp: false,
  })),
  XPAction: { SHRINE_SACRIFICE: 'shrine_sacrifice' },
}));

vi.mock('@/lib/statTrackingService', () => ({
  trackShrineTrade: vi.fn(async () => {}),
}));

import { POST as boostAll } from '@/app/api/shrine/boost-all/route';
import { awardXP } from '@/lib/xpService';
import { trackShrineTrade } from '@/lib/statTrackingService';
import { ItemRarity, ItemType, TerrainType } from '@/types';

function playerWithTradeables(count: number, rarity: ItemRarity = ItemRarity.Common) {
  return {
    username: 'tester',
    currentPosition: { x: 1, y: 1 },
    inventory: {
      items: Array.from({ length: count }, (_, i) => ({
        id: `item-${i}`,
        type: ItemType.TradeableItem,
        name: `${rarity} Tradeable Item`,
        rarity,
        bonusPercent: 0,
        foundAt: { x: 1, y: 1 },
        foundDate: new Date(),
      })),
    },
    shrineBoosts: [],
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/shrine/boost-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const routeCtx = { params: Promise.resolve({}) };

beforeEach(() => {
  capture.updateOne = [];
  capture.shrineTile = { x: 1, y: 1, terrain: TerrainType.Shrine };
  vi.mocked(awardXP).mockClear();
  vi.mocked(trackShrineTrade).mockClear();
});

describe('FID-20260917-002 — boost-all presence + one-transaction parity', () => {
  it('activates all four suits with finite expiries and prunes the inventory once', async () => {
    capture.playerDoc = playerWithTradeables(12, ItemRarity.Uncommon);

    const response = await boostAll(makeRequest({ itemCount: 2 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.itemsConsumed).toBe(8);
    expect(body.results).toHaveLength(4);
    for (const result of body.results as Array<{ tier: string; expiresAt: string }>) {
      expect(new Date(result.expiresAt).getTime()).not.toBeNaN();
    }

    expect(capture.updateOne).toHaveLength(1);
    const { update } = capture.updateOne[0] as { update: { $set: Record<string, unknown> } };
    const items = update.$set['inventory.items'] as Array<{ id: string }>;
    const boosts = update.$set.shrineBoosts as Array<{ tier: string }>;
    expect(items).toHaveLength(4); // 12 − 8
    expect(boosts).toHaveLength(4);
    expect(boosts.map((b) => b.tier).sort()).toEqual(['club', 'diamond', 'heart', 'spade']);
  });

  it('refuses off-shrine server-side with zero mutation', async () => {
    capture.playerDoc = playerWithTradeables(12);
    capture.shrineTile = { x: 50, y: 50, terrain: TerrainType.Wasteland };

    const response = await boostAll(makeRequest({ itemCount: 2 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(capture.updateOne).toHaveLength(0);
    expect(vi.mocked(awardXP)).not.toHaveBeenCalled();
    expect(vi.mocked(trackShrineTrade)).not.toHaveBeenCalled();
  });

  it('counts ONE trade and awards XP ONCE per call — four suits are one transaction', async () => {
    capture.playerDoc = playerWithTradeables(12, ItemRarity.Uncommon);

    const response = await boostAll(makeRequest({ itemCount: 2 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.xpAwarded).toBe(40);
    expect(vi.mocked(awardXP)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(trackShrineTrade)).toHaveBeenCalledTimes(1);
  });

  it('does not fail the transaction when bookkeeping throws', async () => {
    capture.playerDoc = playerWithTradeables(12);
    vi.mocked(trackShrineTrade).mockRejectedValueOnce(new Error('stats outage'));

    const response = await boostAll(makeRequest({ itemCount: 1 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.xpAwarded).toBeUndefined();
    expect(capture.updateOne).toHaveLength(1);
  });
});
