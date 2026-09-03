/**
 * @file lib/tileMessages.ts
 * @created 2025-10-18
 * @overview Randomized flavor text messages for all terrain types
 * 
 * OVERVIEW:
 * Provides variety and immersion through randomized messages when viewing different tile types.
 * Similar to harvestMessages.ts but covers ALL terrains with multiple message pools.
 */

import { TerrainType } from '@/types';

/**
 * Wasteland tile messages - Empty, desolate terrain
 */
const WASTELAND_MESSAGES = [
  "Empty wasteland - Safe for base placement",
  "A barren stretch of desolation awaits your command",
  "The winds howl across this forgotten land",
  "Nothing but dust and memories remain here",
  "A perfect canvas for your empire's expansion",
  "The silence is deafening in this lifeless expanse",
  "Scorched earth - ready for new beginnings",
  "Your boots crunch on the dry, cracked ground",
  "This wasteland hungers for purpose and structure",
  "An empty slate awaits your strategic vision"
];

/**
 * Metal resource tile messages
 */
const METAL_MESSAGES = [
  "Resource tile - Gather metal for construction",
  "Rich metal deposits glint in the sunlight",
  "Your sensors detect high-grade ore concentrations",
  "The earth here is heavy with raw materials",
  "Metal veins run deep beneath this ground",
  "Industrial potential radiates from this site",
  "Your mining equipment will feast here",
  "The bedrock hums with metallic resonance",
  "Fortunes await those who excavate these deposits",
  "This metal could forge an army"
];

/**
 * Energy resource tile messages
 */
const ENERGY_MESSAGES = [
  "Resource tile - Harvest energy for power",
  "Raw energy crackles across this terrain",
  "The air shimmers with untapped potential",
  "Your sensors overload with power readings",
  "Energy flows freely from this nexus point",
  "The ground pulses with electromagnetic force",
  "Harness this power to fuel your war machine",
  "Ancient generators still hum beneath the surface",
  "This energy could power your entire operation",
  "The very air tastes of electricity and possibility"
];

/**
 * Cave tile messages - Mysterious exploration sites
 */
const CAVE_MESSAGES = [
  "Mysterious cave - Explore for secrets",
  "Dark passages beckon the brave",
  "Ancient mysteries hide in these depths",
  "Your torchlight barely penetrates the darkness",
  "Strange echoes emanate from below",
  "What treasures lie in wait?",
  "The cave mouth yawns like a hungry beast",
  "Legends speak of riches hidden here",
  "Only the fearless dare enter these depths",
  "The darkness holds both danger and reward"
];

/**
 * Forest tile messages - Premium exploration
 */
const FOREST_MESSAGES = [
  "🌲 Ancient Forest - Explore for rare treasures (Better loot than caves!)",
  "🌲 Towering trees conceal untold riches",
  "🌲 The forest whispers of ancient secrets",
  "🌲 Rare artifacts are said to rest here",
  "🌲 Nature's bounty awaits the persistent seeker",
  "🌲 These woods have seen countless ages pass",
  "🌲 Premium loot lies hidden among the roots",
  "🌲 The canopy shields mysteries from prying eyes",
  "🌲 Your chances of discovery increase dramatically here",
  "🌲 Legendary items have been found in these groves"
];

/**
 * Factory tile messages
 */
const FACTORY_MESSAGES = [
  "Factory building - Attack to capture or manage production",
  "Industrial machinery churns day and night",
  "This factory is a strategic asset worth fighting for",
  "Production lines create an endless supply of units",
  "The smokestacks rise like pillars of power",
  "Whoever controls this controls the battlefield",
  "Your forces could turn the tide with this factory",
  "The clang of metal on metal echoes constantly",
  "This industrial complex is a force multiplier",
  "Capture this and your army will grow unstoppable"
];

/**
 * Bank tile messages - Safe storage locations
 */
const BANK_MESSAGES = {
  metal: [
    "🏦 Metal Bank - Store metal safely (1,000 deposit fee)",
    "🏦 Secure vaults protect your hard-earned metal",
    "🏦 The safest place for your industrial wealth",
    "🏦 Armored doors guard untold riches within",
    "🏦 Your metal is protected from raiders here",
    "🏦 Banking fees are a small price for peace of mind",
    "🏦 Countless ingots rest in these vaults",
    "🏦 The bank's reputation for security is legendary",
    "🏦 Store now, build later - your metal stays safe",
    "🏦 These walls have never been breached"
  ],
  energy: [
    "🏦 Energy Bank - Store energy safely (1,000 deposit fee)",
    "🏦 Power cells stack to the ceiling in perfect order",
    "🏦 Your energy reserves are shielded from theft",
    "🏦 Advanced containment keeps your power secure",
    "🏦 The hum of stored energy fills the air",
    "🏦 Banking fees ensure professional protection",
    "🏦 Massive capacitors store limitless potential",
    "🏦 This bank has weathered every storm",
    "🏦 Your energy will be here when you need it",
    "🏦 The most secure storage in the wasteland"
  ],
  exchange: [
    "🏦 Exchange Bank - Convert Metal ↔ Energy (20% fee)",
    "🏦 The exchange rate fluctuates with the market",
    "🏦 Convert your surplus into what you need",
    "🏦 Traders from across the wasteland gather here",
    "🏦 The 20% fee supports the exchange infrastructure",
    "🏦 Flexible resource management begins here",
    "🏦 Smart commanders know when to exchange",
    "🏦 Turn excess metal into pure energy",
    "🏦 Economic warfare starts with resource conversion",
    "🏦 Balance your reserves through strategic trading"
  ]
};

/**
 * Shrine tile messages - Sacred sacrifice locations
 */
const SHRINE_MESSAGES = [
  "⛩️ Ancient Shrine - Sacrifice items for gathering boosts (+25% per tier)",
  "⛩️ The shrine hums with ancient power",
  "⛩️ Offerings made here echo through eternity",
  "⛩️ The gods reward those who sacrifice wisely",
  "⛩️ Your gathering potential increases dramatically here",
  "⛩️ Legends speak of commanders who gained divine favor",
  "⛩️ The shrine's magic amplifies your resource yield",
  "⛩️ Sacred ground blessed by forgotten deities",
  "⛩️ Trade items for power beyond mortal means",
  "⛩️ The wise invest in eternal bonuses here"
];

/**
 * Auction House tile messages - Trading hub
 */
const AUCTION_HOUSE_MESSAGES = [
  "🏛️ Auction House - Buy and sell items with other players",
  "🏛️ The marketplace buzzes with commerce and opportunity",
  "🏛️ Fortunes change hands beneath these ancient arches",
  "🏛️ Smart traders know the Auction House is where wealth begins",
  "🏛️ List your surplus, bid on treasures, dominate the economy",
  "🏛️ The wasteland's premier trading destination",
  "🏛️ Every transaction here reshapes the balance of power",
  "🏛️ Legendary items appear on these auction blocks",
  "🏛️ Economic warfare is waged in these hallowed halls",
  "🏛️ What you can't find, you can buy - what you can't use, you can sell"
];

/**
 * Get random tile message for given terrain type
 * 
 * @param terrain - Type of terrain
 * @param bankType - Bank type if terrain is Bank
 * @returns Random flavor text message
 */
export function getRandomTileMessage(
  terrain: TerrainType,
  bankType?: 'metal' | 'energy' | 'exchange'
): string {
  let messages: string[];

  switch (terrain) {
    case TerrainType.Wasteland:
      messages = WASTELAND_MESSAGES;
      break;
    case TerrainType.Metal:
      messages = METAL_MESSAGES;
      break;
    case TerrainType.Energy:
      messages = ENERGY_MESSAGES;
      break;
    case TerrainType.Cave:
      messages = CAVE_MESSAGES;
      break;
    case TerrainType.Forest:
      messages = FOREST_MESSAGES;
      break;
    case TerrainType.Factory:
      messages = FACTORY_MESSAGES;
      break;
    case TerrainType.Bank:
      if (bankType && BANK_MESSAGES[bankType]) {
        messages = BANK_MESSAGES[bankType];
      } else {
        messages = BANK_MESSAGES.metal; // Fallback to metal bank
      }
      break;
    case TerrainType.Shrine:
      messages = SHRINE_MESSAGES;
      break;
    case TerrainType.AuctionHouse:
      messages = AUCTION_HOUSE_MESSAGES;
      break;
    default:
      return 'Unknown terrain';
  }

  // Return random message from array
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

/**
 * Get consistent tile message (same message for same coordinates)
 * Uses coordinate-based seeding for consistency
 * 
 * @param terrain - Type of terrain
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param bankType - Bank type if terrain is Bank
 * @returns Consistent flavor text for these coordinates
 */
export function getConsistentTileMessage(
  terrain: TerrainType,
  x: number,
  y: number,
  bankType?: 'metal' | 'energy' | 'exchange'
): string {
  let messages: string[];

  switch (terrain) {
    case TerrainType.Wasteland:
      messages = WASTELAND_MESSAGES;
      break;
    case TerrainType.Metal:
      messages = METAL_MESSAGES;
      break;
    case TerrainType.Energy:
      messages = ENERGY_MESSAGES;
      break;
    case TerrainType.Cave:
      messages = CAVE_MESSAGES;
      break;
    case TerrainType.Forest:
      messages = FOREST_MESSAGES;
      break;
    case TerrainType.Factory:
      messages = FACTORY_MESSAGES;
      break;
    case TerrainType.Bank:
      if (bankType && BANK_MESSAGES[bankType]) {
        messages = BANK_MESSAGES[bankType];
      } else {
        messages = BANK_MESSAGES.metal; // Fallback
      }
      break;
    case TerrainType.Shrine:
      messages = SHRINE_MESSAGES;
      break;
    case TerrainType.AuctionHouse:
      messages = AUCTION_HOUSE_MESSAGES;
      break;
    default:
      return 'Unknown terrain';
  }

  // Use coordinate-based index for consistency
  // Same tile always shows same message
  const seed = (x * 997 + y * 991) % messages.length;
  return messages[seed];
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - getRandomTileMessage(): Different message each time
// - getConsistentTileMessage(): Same message for same coordinates
// - Each terrain type has 10 flavor messages
// - Bank messages split by type (metal/energy/exchange)
// - Prime number seeds (997, 991) ensure good distribution
// - Easy to expand: just add more messages to arrays
// ============================================================
