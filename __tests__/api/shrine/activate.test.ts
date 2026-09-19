// @vitest-environment node
/**
 * @file __tests__/api/shrine/activate.test.ts
 * @overview FID-20260909-028 §2.4 runtime probe — the shrine buff apply path —
 * extended by FID-20260917-002 (presence enforcement + trade/XP parity wiring).
 *
 * The FID-028 half executes POST /api/shrine/activate with the exact panel
 * payload ({ tier, itemCount }) against a seam-contract mock (findOne overlay +
 * updateOne $set capture) and asserts the full chain: auth → inventory read →
 * tradeable narrowing → duration math → $set payload → response. A NaN
 * expiresAt or a dropped $set key convicts here.
 *
 * The FID-20260917-002 half pins the parity contract restored from the deleted
 * legacy economy: server-side shrine presence (fail-closed), exactly ONE
 * trackShrineTrade + ONE awardXP per transaction, and bookkeeping failures
 * never reported as transaction failures.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTableName } from 'drizzle-orm';

const { capture } = vi.hoisted(() => ({
  capture: {
    updates: [] as Array<{ table: unknown; set: unknown }>,
    playerDoc: null as unknown,
    shrineTile: null as unknown,
  },
}));

vi.mock('@/lib/authMiddleware', () => ({
  verifyAuth: vi.fn(async () => ({ username: 'tester', playerId: 'tester', isAdmin: false })),
}));

// FID-20260917-017 slice 4 + batch-4 part 1: the route reads through the pg
// domain loader and assertAtShrine's tile read rides drizzle db.select (the
// connection mock serves capture.shrineTile) — writes go through drizzle.
// Every seam is off the Mongo shim; no shim mock is needed (Gate 3 would
// catch any regression that re-imports it).
vi.mock('@/lib/playerService', () => ({
  getPlayer: vi.fn(async () => capture.playerDoc),
}));

vi.mock('@/lib/db/connection', () => ({
  db: {
    // assertAtShrine (shrineServer, drizzle since batch-4 part 1) reads the
    // tile through db.select(); the tiles seam itself is scripted per-test via
    // capture.shrineTile ({x,y,terrain} or null = unreadable/no tile).
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (capture.shrineTile ? [capture.shrineTile] : []),
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: (payload: unknown) => {
        capture.updates.push({ table, set: payload });
        return {
          where: () => ({
            returning: async () => [{ username: 'tester' }],
          }),
        };
      },
    }),
  },
}));

// FID-20260917-002: bookkeeping is mocked at the module seam — the real
// awardXP/trackShrineTrade write through the DB and would pollute the
// updateOne capture the FID-028 pins count on.
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

import { POST as activate } from '@/app/api/shrine/activate/route';
import { awardXP } from '@/lib/xpService';
import { trackShrineTrade } from '@/lib/statTrackingService';
import { ItemRarity, ItemType, TerrainType } from '@/types';

/** A player whose inventory mirrors what caveItemService actually writes. */
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
  return new NextRequest('http://localhost:3000/api/shrine/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** withRequestLogging's wrapped handler expects a route context arg. */
const routeCtx = { params: Promise.resolve({}) };

beforeEach(() => {
  capture.updates = [];
  // Default: the player stands on the Shrine tile (the FID-028 premise).
  capture.shrineTile = { x: 1, y: 1, terrain: TerrainType.Shrine };
  vi.mocked(awardXP).mockClear();
  vi.mocked(trackShrineTrade).mockClear();
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

    expect(capture.updates).toHaveLength(1);
    // The write must target the players table (the pg-pivot defect class:
    // wrong-target writes).
    expect(getTableName(capture.updates[0].table as never)).toBe('players');
    const { set } = capture.updates[0] as { set: Record<string, unknown> };
    // Both write keys must land: pruned inventory (17 left) + the new boost
    const boosts = set.shrineBoosts as Array<{ tier: string; expiresAt: Date }>;
    const items = set.inventoryItems as Array<{ id: string }>
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
    expect(capture.updates).toHaveLength(0);
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
      const { set } = capture.updates[0] as { set: Record<string, unknown> };
      const boosts = set.shrineBoosts as Array<{ expiresAt: Date }>;
      expect(new Date(boosts[0].expiresAt).getTime()).not.toBeNaN();
    } else {
      expect(response.status).toBe(400);
      expect(capture.updates).toHaveLength(0);
    }
  });
});

describe('FID-20260917-002 — presence enforcement + trade/XP parity', () => {
  it('refuses activation off-shrine server-side — client gate is no longer the only gate', async () => {
    capture.playerDoc = playerWithTradeables(10);
    capture.shrineTile = { x: 50, y: 50, terrain: TerrainType.Wasteland };

    const response = await activate(makeRequest({ tier: 'spade', itemCount: 1 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    // Zero mutation — the refusal happens before any write.
    expect(capture.updates).toHaveLength(0);
    expect(vi.mocked(awardXP)).not.toHaveBeenCalled();
    expect(vi.mocked(trackShrineTrade)).not.toHaveBeenCalled();
  });

  it('fails closed when the current tile cannot be read', async () => {
    capture.playerDoc = playerWithTradeables(10);
    capture.shrineTile = null;

    const response = await activate(makeRequest({ tier: 'heart', itemCount: 1 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(capture.updates).toHaveLength(0);
  });

  it('counts ONE shrine trade and awards XP once per transaction (parity wiring)', async () => {
    capture.playerDoc = playerWithTradeables(10, ItemRarity.Uncommon);

    const response = await activate(makeRequest({ tier: 'spade', itemCount: 2 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.xpAwarded).toBe(40);
    expect(body.levelUp).toBe(false);
    expect(body.newLevel).toBe(1);
    expect(vi.mocked(awardXP)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(awardXP)).toHaveBeenCalledWith('tester', 'shrine_sacrifice');
    expect(vi.mocked(trackShrineTrade)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(trackShrineTrade)).toHaveBeenCalledWith('tester');
    // Exactly one primary write — bookkeeping must not add $set writes.
    expect(capture.updates).toHaveLength(1);
  });

  it('does not fail the transaction when bookkeeping throws — primary write already committed', async () => {
    capture.playerDoc = playerWithTradeables(10);
    vi.mocked(awardXP).mockRejectedValueOnce(new Error('xp service outage'));

    const response = await activate(makeRequest({ tier: 'club', itemCount: 1 }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // Bookkeeping outcomes are absent when bookkeeping failed — not an error response.
    expect(body.xpAwarded).toBeUndefined();
    // The primary write still landed exactly once.
    expect(capture.updates).toHaveLength(1);
  });
});
