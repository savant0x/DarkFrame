/**
 * @file lib/inventoryUtils.ts
 * @created 2026-09-06
 * @overview Shared inventory predicates (Law 13 — one home per shared concept).
 *
 * The players inventory column honestly holds two item shapes: harvested/found
 * items (InventoryItem, has `foundAt`) and tutorial-granted records
 * (TutorialInventoryItem, has `source`). Tradeable/shrine logic operates only on
 * the former; these discriminators are the typed way to narrow the union.
 */

import type { InventoryItem, TutorialInventoryItem } from '@/types/game.types';

/** Type guard: is this inventory entry a harvested/found (tradeable-capable) item? */
export function isFoundItem(item: InventoryItem | TutorialInventoryItem): item is InventoryItem {
  return 'foundAt' in item;
}

/** Narrow an inventory array to only harvested/found items. */
export function foundItems(items: Array<InventoryItem | TutorialInventoryItem>): InventoryItem[] {
  return items.filter(isFoundItem);
}

/** Narrow an inventory array to tradeable found items (the shrine economy's input). */
export function tradeableItems(items: Array<InventoryItem | TutorialInventoryItem>): InventoryItem[] {
  return foundItems(items).filter((i) => i.type === 'TRADEABLE_ITEM');
}
