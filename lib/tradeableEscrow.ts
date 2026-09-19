/**
 * FID-20260919-009: the tradeable-item escrow planner — pure module.
 *
 * Design (operator decisions D1b + D2b): no items table exists; a tradeable
 * item IS its inventory instance (procedural name + rarity minted per cave
 * harvest). "Stack quantity" (D2b) is implemented as quantity-N listings over
 * N whole instances — partial-stack math on stacked jsonb entries would touch
 * the shrine consumption contract (instance-id filtering) for no live demand.
 * Escrow = whole instances; this module computes every write from the seller's
 * inventory and the request so the risky logic is pinned directly and the
 * service seams stay thin.
 */
import type { InventoryItem } from '@/types/game.types';

/** The request shape the route's zod schema allows (before snapshotting). */
export interface TradeableRequest {
  tradeableItemQuantity?: number;
  /** Seller-selected instance ids (client supplies; server derives the truth). */
  tradeableItemIds?: string[];
}

export interface TradeableEscrowPlan {
  ok: boolean;
  error?: string;
  message?: string;
  /** Whole instances removed from the seller and frozen into the listing. */
  escrowed: InventoryItem[];
  /** Seller's inventory items array after escrow (write as inventoryItems). */
  remaining: InventoryItem[];
}

/**
 * Plan the escrow of `quantity` tradeable instances (D2b) from the seller's
 * inventory. Quantity defaults to 1; ids beyond quantity are ignored
 * (client-supplied lists are never trusted beyond selection).
 */
export function planTradeableEscrow(
  inventory: Array<InventoryItem | unknown>,
  request: TradeableRequest
): TradeableEscrowPlan {
  const items = (Array.isArray(inventory) ? inventory : []).filter(
    (it): it is InventoryItem =>
      typeof it === 'object' && it !== null && 'foundAt' in it && 'type' in it
  );
  const tradeables = items.filter((it) => it.type === 'TRADEABLE_ITEM');
  const quantity = Math.max(1, Math.floor(request.tradeableItemQuantity ?? 1));

  const selected = tradeables.filter((it) => request.tradeableItemIds?.includes(it.id));

  if (selected.length < quantity) {
    return {
      ok: false,
      error: 'ITEMS_NOT_FOUND',
      message:
        selected.length === 0
          ? 'Tradeable item not found in your inventory'
          : `You have ${selected.length} matching tradeable item(s) but asked to list ${quantity}`,
      escrowed: [],
      remaining: items,
    };
  }

  const escrowed = selected.slice(0, quantity);
  const escrowedIds = new Set(escrowed.map((it) => it.id));

  return {
    ok: true,
    escrowed,
    remaining: items.filter((it) => !escrowedIds.has(it.id)),
  };
}

/**
 * The buyer-side delivery entries: fresh instance ids (the seller's originals
 * were consumed by escrow provenance), identities preserved.
 */
export function buildDeliveryInstances(escrowed: InventoryItem[]): InventoryItem[] {
  const now = new Date();
  return escrowed.map((it) => ({
    ...it,
    id: `inv_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`,
    foundDate: now,
  }));
}

/**
 * The seller-side refund entries: the escrowed instances return as they left.
 * Accepts both live InventoryItem shapes (id) and listing-snapshot shapes
 * (itemId) — snapshots must map back to the original instance id or the
 * refunded row would land in the inventory without an id (caught live by the
 * FID-009 probe).
 */
export function buildRefundInstances(escrowed: InventoryItem[]): InventoryItem[] {
  return escrowed.map((it) => {
    const entry = it as InventoryItem & { itemId?: string };
    return { ...entry, id: entry.itemId ?? entry.id } as InventoryItem;
  });
}
