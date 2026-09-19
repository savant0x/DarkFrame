/**
 * FID-20260919-008: the item catalog — the single truth of what "an item" is
 * in DarkFrame.
 *
 * History: chat item validation was a stub (chatService.validateItem returned
 * false with a "items table not in schema" TODO), so the item-link route's
 * honest plumbing reported that nothing exists. Ground truth: there is no items
 * table and the auction card renders tradeables as the literal string
 * "Tradeable Item" — the real, player-meaningful catalog is every unit type in
 * UNIT_CONFIGS plus the resource types. Everything item-validation rides this.
 */
import { UNIT_CONFIGS, type UnitType } from '@/types/game.types';
import { ResourceType } from '@/types/auction.types';

export type CatalogKind = 'unit' | 'resource' | 'verified-listing';

export interface CatalogEntry {
  name: string;
  kind: CatalogKind;
}

/** Every catalog name indexed by its lowercase form (case-insensitive matching). */
const catalogEntries: Array<[string, CatalogEntry]> = [];
for (const unitType of Object.keys(UNIT_CONFIGS) as UnitType[]) {
  catalogEntries.push([unitType.toLowerCase(), { name: unitType, kind: 'unit' }]);
}
for (const resourceType of Object.values(ResourceType)) {
  catalogEntries.push([resourceType.toLowerCase(), { name: resourceType, kind: 'resource' }]);
}
const CATALOG_BY_LOWER: ReadonlyMap<string, CatalogEntry> = new Map(catalogEntries);

/** All valid catalog names in their canonical form. */
export const ITEM_CATALOG_NAMES: readonly string[] = [...CATALOG_BY_LOWER.values()].map((e) => e.name);

/**
 * Validate an item name against the catalog (case-insensitive, trimmed).
 * Replaces the chatService stub — the item-link route's plumbing stays, the
 * engine becomes truthful.
 */
export function validateItem(name: string): boolean {
  if (typeof name !== 'string') return false;
  return CATALOG_BY_LOWER.has(name.trim().toLowerCase());
}

/**
 * Resolve a catalog name to its canonical entry, or null when unknown.
 */
export function resolveCatalogEntry(name: string): CatalogEntry | null {
  if (typeof name !== 'string') return null;
  return CATALOG_BY_LOWER.get(name.trim().toLowerCase()) ?? null;
}
