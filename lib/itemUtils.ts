/**
 * @file lib/itemUtils.ts
 * @created 2026-05-04
 * @updated 2026-05-05 — Tiered name pools, DIGGER_TIERS bonus math, rarity-aware normalization
 * @overview SINGLE SOURCE OF TRUTH for item name/pool randomization, digger bonus computation, and display normalization.
 *
 * Used by: caveItemService, referralService, tutorialService, inventory API routes, inventory page.
 */

import { GAME_CONSTANTS } from '@/types';

// ============================================================================
// TIERED NAME POOLS (4 types × 5 rarities × 3-5 names)
// ============================================================================

const RARITY_NAME_POOLS: Record<string, Record<string, string[]>> = {
  METAL_DIGGER: {
    Common: ['Rusty Shovel', 'Bent Crowbar', 'Worn Pick', 'Cracked Spade', 'Dull Mattock'],
    Uncommon: ['Iron Pick', 'Steel Spade', 'Heavy Drill', 'Sharpened Shovel', 'Reinforced Crowbar'],
    Rare: ['Titanium Excavator', 'Plasma Cutter', 'Diamond Bit', 'Magma Drill', 'Crystal Auger'],
    Epic: ['Quantum Auger', 'Mole Machine', 'Seismic Borer', 'Tectonic Harvester', 'Void Pick'],
    Legendary: ['World Eater', 'Core Drill', 'Planet Cracker', 'Star Forge', "Gaia's Tear"],
  },
  ENERGY_DIGGER: {
    Common: ['Copper Coil', 'Tin Capacitor', 'Old Battery', 'Rusty Dynamo', 'Cracked Magnet'],
    Uncommon: ['Silver Conduit', 'Crystal Diode', 'Pulse Cell', 'Charged Inductor', 'Ionic Capacitor'],
    Rare: ['Gold Transformer', 'Arc Reactor', 'Ion Collector', 'Flux Harvester', 'Plasma Capacitor'],
    Epic: ['Plasma Dynamo', 'Tesla Core', 'Lightning Rod', 'Storm Chamber', 'Fusion Coil'],
    Legendary: ['Void Heart', 'Singularity Battery', 'Dyson Shard', 'Eternal Dynamo', 'Nova Core'],
  },
  UNIVERSAL_DIGGER: {
    Common: ['Broken Compass', 'Rusty Detector', 'Old Scanner', 'Cracked Lens', 'Faded Map'],
    Uncommon: ["Surveyor's Kit", 'Geo-Probe', 'Alloy Finder', 'Metal Detector', 'Signal Locator'],
    Rare: ['Terrain Scanner', 'Element Mapper', 'Pulse Seeker', 'Vein Tracker', 'Resonance Probe'],
    Epic: ['Omni-Extractor', 'Matter Sweeper', 'Phase Harvester', 'Dimensional Pick', 'Reality Auger'],
    Legendary: ['Gaia Engine', 'Reality Drill', 'Creation Spike', 'Cosmic Extractor', 'Genesis Array'],
  },
  TRADEABLE_ITEM: {
    Common: ['Rusty Gear', 'Torn Map', 'Old Battery', 'Bent Key', 'Scrap Metal'],
    Uncommon: ['War Medal', 'Ancient Coin', 'Data Slate', 'Ivory Figurine', 'Silver Ring'],
    Rare: ['Pulse Crystal', 'Precursor Artifact', 'Energy Cell', 'Gold Ingot', 'Star Chart'],
    Epic: ['Titan Circuit', 'Dark Matter Shard', 'Phoenix Feather', 'Chrono Lens', 'Void Pearl'],
    Legendary: ['Star Core Fragment', 'Omega Relic', 'Creation Seed', 'Eternity Prism', "God's Tear"],
  },
};

// ============================================================================
// EFFECT DESCRIPTIONS (tiered by rarity)
// ============================================================================

const RARITY_EFFECTS: Record<string, string> = {
  Common: 'A simple find. Improves gathering slightly.',
  Uncommon: 'A useful discovery. Noticeable bonus to harvesting.',
  Rare: 'A prized possession. Significant gathering improvement.',
  Epic: 'A remarkable artifact. Major boost to resource collection.',
  Legendary: 'A legendary treasure. Massive permanent gathering bonus.',
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Pick a random name from the tiered pool for a given item type and rarity.
 * Falls back to "{Rarity} {Type}" if pool is missing.
 */
export function pickRandomName(itemType: string, rarity: string): string {
  // Normalize rarity to title case (DB stores UPPERCASE: COMMON -> Common)
  const normalizedRarity = rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
  const pool = RARITY_NAME_POOLS[itemType]?.[normalizedRarity];
  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const typeLabel = itemType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `${normalizedRarity} ${typeLabel}`;
}

/**
 * Get the effect description for a given rarity tier.
 */
export function getRarityEffect(rarity: string): string {
  return RARITY_EFFECTS[rarity] || 'Found in a cave';
}

/**
 * Compute the correct bonus percentage for a new digger based on
 * the exponential decay formula: Bonus = 200 × (1 - e^(-0.008×n))
 *
 * @param diggerType - METAL_DIGGER, ENERGY_DIGGER, or UNIVERSAL_DIGGER
 * @param currentCount - How many diggers of this type the player already has
 * @returns Bonus percentage to apply (e.g., 2 for +2%)
 */
export function getDiggerBonus(diggerType: string, currentCount: number): number {
  const DIGGER_BONUS_CAP = 200;
  const DIGGER_DECAY_CONSTANT = 0.008;
  const count = currentCount + 1;
  if (count <= 0) return 0;
  const bonus = Math.floor(DIGGER_BONUS_CAP * (1 - Math.exp(-DIGGER_DECAY_CONSTANT * count)) * 100) / 100;
  return Math.max(0.5, bonus);
}

/**
 * Total bonus accumulated from all diggers based on count.
 * Uses exponential decay formula: Bonus = 200 × (1 - e^(-0.008×n))
 * Used for displaying tooltips and harvest calculator.
 */
export function getTotalDiggerBonus(count: number): number {
  if (count === 0) return 0;
  const DIGGER_BONUS_CAP = 200;
  const DIGGER_DECAY_CONSTANT = 0.008;
  return Math.floor(DIGGER_BONUS_CAP * (1 - Math.exp(-DIGGER_DECAY_CONSTANT * count)) * 100) / 100;
}

const LEGACY_NAME_RE = /_\d{5,}$/;
const GENERIC_NAME_RE = /^(Common|Uncommon|Rare|Epic|Legendary)\s+(Metal\s+Digger|Energy\s+Digger|Universal\s+Digger|Tradeable\s+Item)$/i;

/**
 * Normalize a single item row from the database into a display-ready object.
 * Adds `category`, `gatheringBonus`, and resolves legacy generated names.
 *
 * Call this in EVERY place items are read from the database.
 */
export function normalizeItemRow(row: {
  name?: string | null;
  item_type?: string | null;
  description?: string | null;
  rarity?: string | null;
  bonus_percent?: number | null;
  quantity?: number | null;
  [key: string]: unknown;
}): {
  name: string;
  type: string;
  category: string;
  description: string;
  rarity: string;
  gatheringBonus: number;
  quantity: number;
} {
  const rawType = String(row.item_type || '');
  const rawName = String(row.name || '');
  const rawRarity = String(row.rarity || 'Common');
  const rawDescription = String(row.description || '');

  const isLegacy = LEGACY_NAME_RE.test(rawName);
  const isGeneric = ['Metal Digger', 'Energy Digger', 'Universal Digger', 'Tradeable Item', 'Ancient Relic'].includes(rawName)
    || GENERIC_NAME_RE.test(rawName);

  const shouldReplace = isLegacy || isGeneric;
  const cleanName = shouldReplace
    ? pickRandomName(rawType, rawRarity)
    : rawName;

  const category = rawType.includes('DIGGER') ? 'digger' : 'tradeable';
  const description = rawDescription || getRarityEffect(rawRarity);
  const gatheringBonus = category === 'digger' ? (row.bonus_percent || 5) : 0;

  return {
    name: cleanName,
    type: rawType,
    category,
    description,
    rarity: rawRarity,
    gatheringBonus,
    quantity: (row.quantity as number) || 1,
  };
}

export { RARITY_NAME_POOLS };
