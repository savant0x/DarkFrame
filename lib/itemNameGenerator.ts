/**
 * @file lib/itemNameGenerator.ts
 * @created 2026-09-12
 * @overview FID-20260912-066 — procedural item name generator.
 *
 * Replaces the placeholder names ("COMMON Tradeable Item", "Metal Digger") with
 * flavor-generated names that fit DarkFrame's industrial scrapworld setting.
 * Names are cosmetic: they never affect item mechanics (bonusPercent, type,
 * shrine value all come from the item row itself).
 *
 * Structure:
 *   Tradeable: [prefix by rarity] [material] [object] [suffix?]
 *     e.g. "Corroded Aurium Relay", "Scavenged Ferrocore Manifold of the First Digs"
 *   Digger:    [era] [material] [digger-kind] (e.g. "Ancient Cobalt Borehead MK-II")
 *   Materials and prefix pools scale with rarity so a Legendary reads stronger
 *   than a Common without any mechanical coupling.
 *
 * Determinism: every function takes an optional `rand` (default Math.random),
 * so tests pin exact outputs and future loot-seeding can replay worlds.
 */

import { ItemRarity } from '@/types/game.types';

type Rand = () => number;

function pick<T>(pool: readonly T[], rand: Rand): T {
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

function chance(p: number, rand: Rand): boolean {
  return rand() < p;
}

/** Materials — each rarity tier adds shinier entries (cumulative pools). */
const MATERIALS: Record<ItemRarity, readonly string[]> = {
  [ItemRarity.Common]: ['Rust', 'Scrap', 'Iron', 'Slag', 'Grit'],
  [ItemRarity.Uncommon]: ['Copper', 'Lead', 'Zinc', 'Nickel', 'Ashsteel'],
  [ItemRarity.Rare]: ['Cobalt', 'Titanium', 'Aurium', 'Ferrocore', 'Vaultglass'],
  [ItemRarity.Epic]: ['Adamant', 'Starfall Iron', 'Nullstone', 'Chronal Alloy'],
  [ItemRarity.Legendary]: ['Void-Tempered Aurium', 'Heartsteel', 'Sunken Gold', 'Foundry Mythril'],
};

/** Tradeable object nouns — machine-age relics a scavver would haul out. */
const TRADEABLE_OBJECTS = [
  'Relay', 'Manifold', 'Regulator', 'Servo', 'Capacitor', 'Coupling',
  'Gauge', 'Valve', 'Intake', 'Coil', 'Gearwork', 'Bearing',
  'Transistor', 'Compressor', 'Aerator', 'Sifter', 'Crucible', 'Foundry Stamp',
] as const;

/** Tradeable prefixes — weight by rarity for condition/lore. */
const TRADEABLE_PREFIXES: Record<ItemRarity, readonly string[]> = {
  [ItemRarity.Common]: ['Dusty', 'Corroded', 'Battered', 'Scavenged', 'Oil-Stained'],
  [ItemRarity.Uncommon]: ['Refurbished', 'Polished', 'Workshop-Grade', 'Sealed'],
  [ItemRarity.Rare]: ['Calibrated', 'Vault-Clean', 'Precision', 'Factory-Fresh'],
  [ItemRarity.Epic]: ['Masterworked', 'Pre-Collapse', 'Zero-Point'],
  [ItemRarity.Legendary]: ['Mythic', 'Founder-Locked', 'One-of-a-Kind'],
};

/** Optional tradeable suffix lore (20% chance) — provenance hooks. */
const TRADEABLE_SUFFIXES = [
  'of the First Digs', 'of the Deep Vein', 'of Sector Zero',
  'of the Buried Foundry', "of the Old Union", 'of the Last Shaft',
] as const;

/** Digger eras/kinds — combine with material for the full name. */
const DIGGER_ERAS: Record<ItemRarity, readonly string[]> = {
  [ItemRarity.Common]: ['Standard', 'Field', 'Workshop'],
  [ItemRarity.Uncommon]: ['Reinforced', 'Tuned', 'Hardened'],
  [ItemRarity.Rare]: ['Ancient', 'Precision-Cut', 'Deep-Vein'],
  [ItemRarity.Epic]: ['Pre-Collapse', 'Titan-Forged'],
  [ItemRarity.Legendary]: ['Relic', 'Primeval'],
};

const DIGGER_KINDS: Record<'metal' | 'energy' | 'universal', readonly string[]> = {
  metal: ['Borehead', 'Drill', 'Excavator Claw', 'Ore-Biter'],
  energy: ['Siphon', 'Arc-Lance', 'Flux Drill', 'Coil Harvester'],
  universal: ['Digging Rig', 'Harvest Engine', 'All-Terrain Extractor', 'Mother Auger'],
};

/** MK revision: higher rarities get flashier suffixes. */
function mkSuffix(rarity: ItemRarity, rand: Rand): string {
  if (rarity === ItemRarity.Common) return chance(0.3, rand) ? ' MK-I' : '';
  if (rarity === ItemRarity.Uncommon) return chance(0.5, rand) ? ` MK-${1 + Math.floor(rand() * 3)}` : '';
  if (rarity === ItemRarity.Rare) return chance(0.7, rand) ? ` MK-${2 + Math.floor(rand() * 4)}` : '';
  return ` MK-${3 + Math.floor(rand() * 8)}`; // Epic/Legendary always carry a rev
}

/** Generate a tradeable item name for the given rarity. */
export function generateTradeableItemName(rarity: ItemRarity, rand: Rand = Math.random): string {
  const prefix = pick(TRADEABLE_PREFIXES[rarity], rand);
  const material = pick(MATERIALS[rarity], rand);
  const object = pick(TRADEABLE_OBJECTS, rand);
  const suffix = chance(0.2, rand) ? ` ${pick(TRADEABLE_SUFFIXES, rand)}` : '';
  return `${prefix} ${material} ${object}${suffix}`;
}

/** Generate a digger name for the given kind + rarity. */
export function generateDiggerName(
  kind: 'metal' | 'energy' | 'universal',
  rarity: ItemRarity,
  rand: Rand = Math.random
): string {
  const era = pick(DIGGER_ERAS[rarity], rand);
  const material = pick(MATERIALS[rarity], rand);
  const kindName = pick(DIGGER_KINDS[kind], rand);
  return `${era} ${material} ${kindName}${mkSuffix(rarity, rand)}`;
}

/** ItemRarity enum value for a roll table (shared 60/25/10/4/1 default curve). */
export function rollRarity(rand: Rand = Math.random): ItemRarity {
  const roll = rand();
  if (roll < 0.60) return ItemRarity.Common;
  if (roll < 0.85) return ItemRarity.Uncommon;
  if (roll < 0.95) return ItemRarity.Rare;
  if (roll < 0.99) return ItemRarity.Epic;
  return ItemRarity.Legendary;
}
