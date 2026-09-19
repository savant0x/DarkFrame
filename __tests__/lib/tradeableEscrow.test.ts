/**
 * @file __tests__/lib/tradeableEscrow.test.ts
 * @created 2026-09-19
 * @overview Pins for FID-20260919-009's pure escrow planner, against its real
 *            contract: id-based whole-instance selection (D2b as quantity-N
 *            over N instances), snapshot-free escrow (identity lives on the
 *            instance), and delivery/refund builders that preserve identities.
 */
import { describe, it, expect } from 'vitest';
import {
  planTradeableEscrow,
  buildDeliveryInstances,
  buildRefundInstances,
} from '@/lib/tradeableEscrow';
import { ItemType, ItemRarity } from '@/types/game.types';
import type { InventoryItem } from '@/types/game.types';

const NAME = 'Aetherforged Bastard Sword of the Crimson Dawn';

function tradeable(id: string, name = NAME): InventoryItem {
  return {
    id,
    type: ItemType.TradeableItem,
    name,
    rarity: ItemRarity.Epic,
    bonusPercent: 0,
    foundAt: { x: 1, y: 2 },
    foundDate: new Date('2026-09-01T00:00:00Z'),
  };
}

function digger(id: string): InventoryItem {
  return { ...tradeable(id, 'Crusty Trowel'), type: ItemType.MetalDigger, bonusPercent: 1.5 };
}

describe('planTradeableEscrow — whole-instance selection', () => {
  it('escrows exactly the requested quantity of the selected ids; extra ids ignored', () => {
    const plan = planTradeableEscrow(
      [tradeable('a'), tradeable('b'), tradeable('c')],
      { tradeableItemIds: ['a', 'b', 'c'], tradeableItemQuantity: 2 }
    );
    expect(plan.ok).toBe(true);
    expect(plan.escrowed.map((i) => i.id)).toEqual(['a', 'b']);
    expect(plan.remaining.map((i) => i.id)).toEqual(['c']);
  });

  it('defaults quantity to 1', () => {
    const plan = planTradeableEscrow([tradeable('a'), tradeable('b')], {
      tradeableItemIds: ['a', 'b'],
    });
    expect(plan.ok).toBe(true);
    expect(plan.escrowed.map((i) => i.id)).toEqual(['a']);
  });

  it('no partial escrow: short selection fails whole with ITEMS_NOT_FOUND', () => {
    const plan = planTradeableEscrow([tradeable('a')], {
      tradeableItemIds: ['a', 'ghost'],
      tradeableItemQuantity: 2,
    });
    expect(plan.ok).toBe(false);
    expect(plan.error).toBe('ITEMS_NOT_FOUND');
    expect(plan.escrowed).toEqual([]);
    // inventory untouched
    expect(plan.remaining.map((i) => i.id)).toEqual(['a']);
  });

  it('only TRADEABLE_ITEM instances are selectable — a digger id can never be escrowed', () => {
    const plan = planTradeableEscrow([digger('d1')], {
      tradeableItemIds: ['d1'],
      tradeableItemQuantity: 1,
    });
    expect(plan.ok).toBe(false);
    expect(plan.error).toBe('ITEMS_NOT_FOUND');
  });

  it('tolerates a garbage/non-array inventory without throwing (defensive)', () => {
    const plan = planTradeableEscrow(null as unknown as InventoryItem[], {
      tradeableItemIds: ['a'],
    });
    expect(plan.ok).toBe(false);
    expect(plan.escrowed).toEqual([]);
  });
});

describe('buildDeliveryInstances — buyer receives the identity, not the instance', () => {
  it('mints fresh ids, preserves name/rarity/type, refreshes foundDate', () => {
    const [src] = [tradeable('orig')];
    const out = buildDeliveryInstances([src]);
    expect(out).toHaveLength(1);
    expect(out[0].id).not.toBe('orig');
    expect(out[0].name).toBe(NAME);
    expect(out[0].rarity).toBe(ItemRarity.Epic);
    expect(out[0].type).toBe(ItemType.TradeableItem);
    expect(out[0].foundDate).toBeInstanceOf(Date);
  });

  it('every delivered instance gets a unique fresh id', () => {
    const out = buildDeliveryInstances([tradeable('a'), tradeable('b')]);
    expect(new Set(out.map((i) => i.id)).size).toBe(2);
  });
});

describe('buildRefundInstances — escrow returns as it left', () => {
  it('clones with identical ids and identities (no re-mint on refund)', () => {
    const src = tradeable('orig');
    const out = buildRefundInstances([src]);
    expect(out).toEqual([{ ...src }]);
    expect(out[0].id).toBe('orig');
  });

  it('maps snapshot entries (itemId) back to the original instance id', () => {
    // Listing snapshots store the instance id under itemId; a refund that
    // spread them verbatim would mint id-less inventory rows (FID-009 probe).
    const snap = { ...tradeable('orig'), itemId: 'orig' } as unknown as InventoryItem;
    delete (snap as unknown as Record<string, unknown>).id;
    const out = buildRefundInstances([snap]);
    expect(out[0].id).toBe('orig');
    expect(out[0].name).toBe(NAME);
  });
});
