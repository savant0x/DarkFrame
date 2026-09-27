/**
 * @file __tests__/utils/autoFarmStats.test.ts
 * @created 2026-09-25
 * @overview Pins for the auto-farm collection accounting (FID-20260925-005).
 *   The four session counters must move by the EXACT amounts the server
 *   granted — never from a local intention, never for a refused harvest — and
 *   the item counters must key on the field `/api/harvest` actually returns
 *   (`item.name`), not the `itemFound` field that exists only in the route's
 *   internal log summary and is always undefined on the wire.
 *
 *   Red-drilled 2026-09-26 against a copy of the pre-fix success-branch
 *   accounting: `metalCollected` stayed 0 where these tests require 12, and
 *   `forestItemsFound` stayed 0 where they require 1 (FID §7 obligation 3).
 */
import { describe, it, expect } from 'vitest';
import { applyHarvestGains } from '@/utils/autoFarmEngine';
import { TerrainType } from '@/types/game.types';
import {
  DEFAULT_SESSION_STATS,
  type AutoFarmSessionStats,
} from '@/types/autoFarm.types';

const BASE: AutoFarmSessionStats = { ...DEFAULT_SESSION_STATS };

describe('applyHarvestGains (FID-20260925-005)', () => {
  it('records the exact amounts the server granted, without touching the input', () => {
    const before: AutoFarmSessionStats = { ...BASE, tilesVisited: 7, attacksWon: 1 };
    const after = applyHarvestGains(before, {
      terrain: TerrainType.Metal,
      metalGained: 12,
      energyGained: 4,
    });
    // Exact non-zero delta from a representative granted response.
    expect(after.metalCollected).toBe(12);
    expect(after.energyCollected).toBe(4);
    // Every unmoved field stays exactly as it was.
    expect(after.tilesVisited).toBe(7);
    expect(after.attacksWon).toBe(1);
    expect(after.caveItemsFound).toBe(0);
    expect(after.forestItemsFound).toBe(0);
    // Purity: the input object is never mutated.
    expect(before.metalCollected).toBe(0);
    expect(before.energyCollected).toBe(0);
  });

  it('maps each of the four terrains to its own counter', () => {
    // Resource terrains accumulate the granted resource amounts.
    for (const terrain of [TerrainType.Metal, TerrainType.Energy]) {
      const after = applyHarvestGains(BASE, {
        terrain,
        metalGained: 3,
        energyGained: 5,
      });
      expect(after.metalCollected, terrain).toBe(3);
      expect(after.energyCollected, terrain).toBe(5);
      expect(after.caveItemsFound, terrain).toBe(0);
      expect(after.forestItemsFound, terrain).toBe(0);
    }
    // Item terrains count the item that actually dropped — only theirs.
    const cave = applyHarvestGains(BASE, {
      terrain: TerrainType.Cave,
      metalGained: 0,
      energyGained: 0,
      itemName: 'Old Coin',
    });
    expect(cave.caveItemsFound).toBe(1);
    expect(cave.forestItemsFound).toBe(0);
    expect(cave.metalCollected).toBe(0);
    expect(cave.energyCollected).toBe(0);

    const forest = applyHarvestGains(BASE, {
      terrain: TerrainType.Forest,
      metalGained: 0,
      energyGained: 0,
      itemName: 'Ancient Relic',
    });
    expect(forest.forestItemsFound).toBe(1);
    expect(forest.caveItemsFound).toBe(0);
    expect(forest.metalCollected).toBe(0);
    expect(forest.energyCollected).toBe(0);
  });

  it('does not inflate an item counter for an item-less Cave/Forest harvest', () => {
    for (const terrain of [TerrainType.Cave, TerrainType.Forest]) {
      const after = applyHarvestGains(BASE, {
        terrain,
        metalGained: 0,
        energyGained: 0,
        itemName: undefined,
      });
      expect(after, terrain).toEqual(BASE);
    }
  });

  it('cannot count a refused harvest as a collection', () => {
    // A refused harvest (cooldown/depleted) never reaches the helper at all:
    // attemptHarvest returns in the refusal branch before the success-branch
    // call — that structural half is pinned by the FID's reachability grep.
    // At the mapping level, the only shape a refusal could ever contribute
    // (zeroed gains) must move nothing at all.
    const after = applyHarvestGains(BASE, {
      terrain: TerrainType.Metal,
      metalGained: 0,
      energyGained: 0,
    });
    expect(after).toEqual(BASE);
  });

  it('counts the item from the field /api/harvest actually returns', () => {
    // Fixture shaped like the REAL response body of POST /api/harvest
    // (app/api/harvest/route.ts:232-248): the item is `item` (full object).
    // `itemFound` exists only in the route's internal log summary (route.ts:229)
    // and is NOT on the wire — the mismatch this FID is named for. The pre-fix
    // engine read `data.itemFound` and counted nothing, forever.
    const routeBody = {
      success: true,
      message: 'Forest explored!',
      metalGained: 0,
      energyGained: 0,
      item: { id: 'i-1', name: 'Ancient Relic', type: 'TRADEABLE_ITEM', rarity: 'RARE' },
      harvestStatus: { canHarvest: false, timeUntilReset: 300, resetPeriod: 'daily' },
    };
    // The mismatch, pinned from the outside: the old field is not in the body.
    expect('itemFound' in routeBody).toBe(false);

    // The engine's extraction rule (autoFarmEngine.ts attemptHarvest):
    const itemName = typeof routeBody.item?.name === 'string' ? routeBody.item.name : undefined;
    const after = applyHarvestGains(BASE, {
      terrain: TerrainType.Forest,
      metalGained: routeBody.metalGained,
      energyGained: routeBody.energyGained,
      itemName,
    });
    expect(after.forestItemsFound).toBe(1);
    expect(after.caveItemsFound).toBe(0);
    expect(after.metalCollected).toBe(0);
  });
});
