/**
 * @file __tests__/api/shrine/activate.test.ts
 * @overview FID-20260909-028 §2.4 runtime probe — the shrine buff apply path.
 *
 * The user's live failure ("applied a shrine buff, it's broken") demanded a
 * runtime conviction, not a static read. This executes POST /api/shrine/activate
 * with the exact panel payload ({ tier, itemCount }) against a seam-contract
 * mock (findOne overlay + updateOne $set capture) and asserts the full chain:
 * auth → inventory read → tradeable narrowing → duration math → $set payload
 * → response. A NaN expiresAt or a dropped $set key convicts here.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { capture } = vi.hoisted(() => ({
  capture: {
    updateOne: [] as Array<{ filter: unknown; update: unknown }>,
    playerDoc: null as unknown,
  },
}));

vi.mock('@/lib/authMiddleware', () => ({
  verifyAuth: vi.fn(async () => ({ username: 'tester', playerId: 'tester', isAdmin: false })),
}));

vi.mock('@/lib/mongodb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mongodb')>();
  return {
    ...actual,
    getCollection: () => ({
      findOne: async () => capture.playerDoc,
      updateOne: async (filter: unknown, update: unknown) => {
        capture.updateOne.push({ filter, update });
        return { modifiedCount: 1 };
      },
    }),
  };
});

import { POST as activate } from '@/app/api/shrine/activate/route';
import { ItemRarity, ItemType } from '@/types';

/** A player whose inventory mirrors what caveItemService actually writes. */
function playerWithTradeables(count: number, rarity: ItemRarity = ItemRarity.Common) {
  return {
    username: 'tester',
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
  return new NextRequest('http://localhost:3000/api/shrine/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** withRequestLogging's wrapped handler expects a route context arg. */
const routeCtx = { params: Promise.resolve({}) };

beforeEach(() => {
  capture.updateOne = [];
});

describe('FID-028 §2.4 — shrine activate runtime probe', () => {
  it('activates a boost with the exact panel payload and writes a finite expiry + pruned inventory', async () => {
    capture.playerDoc = playerWithTradeables(19, ItemRarity.Uncommon);

    const response = await activate(makeRequest({ tier: 'spade', itemCount: 2 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.itemsConsumed).toBe(2);
    // Uncommon = 30 min each → 60 min total
    expect(body.durationMinutes).toBe(60);
    expect(new Date(body.expiresAt).getTime()).not.toBeNaN();

    expect(capture.updateOne).toHaveLength(1);
    const { update } = capture.updateOne[0] as { update: { $set: Record<string, unknown> } };
    // Both write keys must land: pruned inventory (17 left) + the new boost
    const boosts = update.$set.shrineBoosts as Array<{ tier: string; expiresAt: Date }>;
    const items = update.$set['inventory.items'] as Array<{ id: string }>;
    expect(items).toHaveLength(17);
    expect(boosts).toHaveLength(1);
    expect(boosts[0].tier).toBe('spade');
    expect(new Date(boosts[0].expiresAt).getTime()).not.toBeNaN();
  });

  it('extends an existing boost of the same tier from remaining time', async () => {
    const inTwoHours = new Date(Date.now() + 2 * 3600_000);
    capture.playerDoc = {
      ...playerWithTradeables(5, ItemRarity.Common),
      shrineBoosts: [{ tier: 'heart', yieldBonus: 0.25, expiresAt: inTwoHours }],
    };

    const response = await activate(makeRequest({ tier: 'heart', itemCount: 1 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // ~2h remaining + 15 min — must be strictly greater than the old expiry
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(inTwoHours.getTime());
  });

  it('rejects itemCount beyond the tradeable count with a loud 4xx', async () => {
    capture.playerDoc = playerWithTradeables(3);

    const response = await activate(makeRequest({ tier: 'spade', itemCount: 5 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(capture.updateOne).toHaveLength(0);
  });

  it('rejects an unknown tier', async () => {
    capture.playerDoc = playerWithTradeables(5);
    const response = await activate(makeRequest({ tier: 'joker', itemCount: 1 }), routeCtx);
    expect(response.status).toBe(400);
  });

  it('does NOT poison the DB with NaN when an inventory item has a legacy/unknown rarity', async () => {
    // Legacy rows may predate the rarity enum — the route must refuse loudly,
    // not write an Invalid Date expiry that silently never activates.
    const player = playerWithTradeables(4);
    (player.inventory.items as Array<Record<string, unknown>>)[0].rarity = 'ancient-unknown';
    capture.playerDoc = player;

    const response = await activate(makeRequest({ tier: 'diamond', itemCount: 1 }), routeCtx);
    const body = await response.json();

    // Either a loud 4xx, or a success with a FINITE expiry — never a NaN write.
    if (response.status === 200) {
      expect(new Date(body.expiresAt).getTime()).not.toBeNaN();
      const { update } = capture.updateOne[0] as { update: { $set: Record<string, unknown> } };
      const boosts = update.$set.shrineBoosts as Array<{ expiresAt: Date }>;
      expect(new Date(boosts[0].expiresAt).getTime()).not.toBeNaN();
    } else {
      expect(response.status).toBe(400);
      expect(capture.updateOne).toHaveLength(0);
    }
  });
});
