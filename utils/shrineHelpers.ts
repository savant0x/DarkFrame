/**
 * @file utils/shrineHelpers.ts
 * @created 2025-10-25
 * @overview Shrine buff calculation utilities
 * 
 * OVERVIEW:
 * Helper functions for calculating shrine buff durations based on item rarity.
 * Implements direct time purchase system where players sacrifice tradeable items
 * to activate gathering buffs with duration determined by item rarity.
 * 
 * Rarity-to-Duration Mapping:
 * - Common: 15 minutes per item
 * - Uncommon: 30 minutes per item
 * - Rare: 1 hour per item
 * - Epic: 1.5 hours per item
 * - Legendary: 2 hours per item
 * 
 * Max duration per buff: 8 hours
 */

import { ItemRarity } from '@/types';

/**
 * Duration in minutes for each rarity tier
 */
export const RARITY_DURATION_MINUTES: Record<ItemRarity, number> = {
  [ItemRarity.Common]: 15,
  [ItemRarity.Uncommon]: 30,
  [ItemRarity.Rare]: 60,
  [ItemRarity.Epic]: 90,
  [ItemRarity.Legendary]: 120
};

/**
 * Maximum buff duration in hours
 */
export const MAX_BUFF_DURATION_HOURS = 8;

/**
 * Calculate total duration in minutes for a collection of items
 * 
 * @param items - Array of items with rarity property
 * @returns Total duration in minutes (capped at 8 hours)
 * 
 * @example
 * ```typescript
 * const items = [
 *   { rarity: ItemRarity.Common },
 *   { rarity: ItemRarity.Legendary }
 * ];
 * const duration = calculateDuration(items); // 15 + 120 = 135 minutes (2.25 hours)
 * ```
 */
export function calculateDuration(items: { rarity: ItemRarity }[]): number {
  const totalMinutes = items.reduce((sum, item) => {
    return sum + RARITY_DURATION_MINUTES[item.rarity];
  }, 0);
  
  const maxMinutes = MAX_BUFF_DURATION_HOURS * 60;
  return Math.min(totalMinutes, maxMinutes);
}

/**
 * Format duration in minutes to human-readable string
 * 
 * @param minutes - Duration in minutes
 * @returns Formatted string like "2h 30m" or "45m"
 * 
 * @example
 * ```typescript
 * formatDuration(150); // "2h 30m"
 * formatDuration(45);  // "45m"
 * formatDuration(120); // "2h"
 * ```
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}m`;
  } else if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${mins}m`;
  }
}

/**
 * Calculate average duration per item based on rarity distribution
 * Useful for showing "X items = ~Y hours" estimates
 * 
 * @param itemCount - Number of items to calculate for
 * @param rarityDistribution - Optional custom distribution, defaults to expected drop rates
 * @returns Estimated total minutes
 * 
 * @example
 * ```typescript
 * estimateDuration(10); // ~225 minutes (assumes mixed rarity)
 * ```
 */
export function estimateDuration(
  itemCount: number,
  rarityDistribution?: Record<ItemRarity, number>
): number {
  // Default distribution matches cave drop rates (60/25/10/4/1)
  const distribution = rarityDistribution || {
    [ItemRarity.Common]: 0.60,
    [ItemRarity.Uncommon]: 0.25,
    [ItemRarity.Rare]: 0.10,
    [ItemRarity.Epic]: 0.04,
    [ItemRarity.Legendary]: 0.01
  };
  
  const avgMinutesPerItem = Object.entries(distribution).reduce((sum, [rarity, probability]) => {
    return sum + (RARITY_DURATION_MINUTES[rarity as ItemRarity] * probability);
  }, 0);
  
  const totalMinutes = avgMinutesPerItem * itemCount;
  const maxMinutes = MAX_BUFF_DURATION_HOURS * 60;
  
  return Math.min(totalMinutes, maxMinutes);
}

/**
 * Calculate how many items of a specific rarity are needed to reach 8-hour max
 * 
 * @param rarity - Item rarity tier
 * @returns Number of items needed for max duration
 * 
 * @example
 * ```typescript
 * itemsForMaxDuration(ItemRarity.Common);     // 32 items
 * itemsForMaxDuration(ItemRarity.Legendary);  // 4 items
 * ```
 */
export function itemsForMaxDuration(rarity: ItemRarity): number {
  const maxMinutes = MAX_BUFF_DURATION_HOURS * 60;
  const minutesPerItem = RARITY_DURATION_MINUTES[rarity];
  return Math.ceil(maxMinutes / minutesPerItem);
}

/**
 * Get rarity display color for UI
 * 
 * @param rarity - Item rarity tier
 * @returns Tailwind CSS color class
 */
export function getRarityColor(rarity: ItemRarity): string {
  const colors: Record<ItemRarity, string> = {
    [ItemRarity.Common]: 'text-gray-400',
    [ItemRarity.Uncommon]: 'text-green-400',
    [ItemRarity.Rare]: 'text-blue-400',
    [ItemRarity.Epic]: 'text-purple-400',
    [ItemRarity.Legendary]: 'text-yellow-400'
  };
  
  return colors[rarity];
}
