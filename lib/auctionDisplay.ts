/**
 * @file lib/auctionDisplay.ts
 * @created 2026-09-19 (FID-20260919-001)
 * @overview Pure display helpers for auction listings. The escrow snapshot is
 *            the truth for what a buyer receives; the scalar unitStrength/
 *            unitDefense fields predate unit escrow (FID-20260914-003) and
 *            survive only as a fallback for pre-escrow legacy listings.
 */
import type { AuctionItem } from '@/types/auction.types';

export interface UnitDisplayStats {
  strength: number;
  defense: number;
}

/**
 * The stat truth for a unit listing: the escrowed unit's snapshot when present
 * (post-escrow listings), else the stored scalar fields (pre-escrow legacy
 * listings — display-only, delivery never relied on these).
 */
export function getItemDisplayStats(item: AuctionItem): UnitDisplayStats {
  return {
    strength: item.unitSnapshot?.strength ?? item.unitStrength ?? 0,
    defense: item.unitSnapshot?.defense ?? item.unitDefense ?? 0,
  };
}
