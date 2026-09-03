/**
 * @file lib/botService.ts
 * @created 2025-10-18
 * @updated 2025-11-04 - Phase 7: Added Boss Bot System (1% spawn rate, elite rare encounters)
 * @overview Bot ecosystem service with Full Permanence model (UPDATED: 7-Tier System + Level Bonuses)
 * 
 * OVERVIEW:
 * Manages AI-controlled bot players that mimic real player behavior.
 * Full Permanence Model: Bots stay on map permanently, regenerate resources hourly (5-20% by type).
 * Beer Bases despawn when defeated and respawn weekly at random locations.
 * 
 * EXPANDED BOT TIER SYSTEM (7 Tiers):
 * - Tier 1 (Level 1-10): 0.75x resources, 150 base defense
 * - Tier 2 (Level 11-20): 1.0x resources, 300 base defense
 * - Tier 3 (Level 21-30): 1.25x resources, 600 base defense
 * - Tier 4 (Level 31-40): 1.5x resources, 1,200 base defense
 * - Tier 5 (Level 41-50): 2.0x resources, 2,400 base defense
 * - Tier 6 (Level 51-60): 2.5x resources, 4,800 base defense
 * - Tier 7 (Level 61+): 3.0x resources, 9,600 base defense
 * 
 * DYNAMIC RESOURCE SCALING (NEW - Phase 6):
 * - Player level bonuses: +25% per 10-level bracket (capped at Bracket 6 = +150%)
 * - Level 0-9 (Bracket 0): 1.0x multiplier (no bonus)
 * - Level 10-19 (Bracket 1): 1.25x multiplier (+25%)
 * - Level 20-29 (Bracket 2): 1.5x multiplier (+50%)
 * - Level 30-39 (Bracket 3): 1.75x multiplier (+75%)
 * - Level 40-49 (Bracket 4): 2.0x multiplier (+100%)
 * - Level 50-59 (Bracket 5): 2.25x multiplier (+125%)
 * - Level 60+ (Bracket 6): 2.5x multiplier (+150%)
 * - Functions: getPlayerLevelBonus(), applyPlayerLevelBonus(), getBotResourcesForPlayer()
 * - Usage: Apply when displaying bots to players or during combat/loot calculations
 * 
 * BOSS BOT SYSTEM (NEW - Phase 7):
 * - Specialization: BotSpecialization.Boss (1% spawn rate via getRandomSpecialization())
 * - Stats: 4M-6M resources (fixed, no tier scaling), 200K+ defense (20x multiplier)
 * - Behavior: Stationary (doesn't move), 2% regen/hour (50 hours to full)
 * - Tier: Fixed at Tier 7 (Level 65), Legendary reputation, 5M bounty value
 * - Purpose: Elite rare encounters requiring coordinated attacks from high-level players
 * - Function: createBossBot(x, y, zone) for explicit boss spawning
 * 
 * Bot Specializations:
 * - Boss (1%): 4M-6M resources, 20x defense, stationary, 2% regen/hour [NEW: Phase 7]
 * - Hoarder (24.75%): 50k-150k resources, 0.5x defense, stationary, 5% regen/hour
 * - Raider (24.75%): 3x attack frequency, mobile (3-5 tiles/day), 15% regen/hour
 * - Fortress (19.8%): 3x defense, 5k-15k resources, stationary, 10% regen/hour
 * - Ghost (14.85%): 2x resources, teleports every 12 hours, 20% regen/hour
 * - Balanced (14.85%): Standard stats, moderate movement, 10% regen/hour
 * 
 * Features:
 * - 1000+ unique bot names (military/fantasy/sci-fi mix)
 * - Zone-based spawn distribution (9 zones, 50×50 each)
 * - Bot nests (8 permanent locations with 15-20 bots each)
 * - Resource regeneration system (hourly, type-dependent rates)
 * - Reputation system (Unknown → Notorious → Infamous → Legendary)
 * - Beer Bases (5-10% special bots with 3x resources, weekly respawn)
 */

import { BotSpecialization, BotReputation, type Player, type BotConfig, type Position } from '@/types/game.types';
import { getDatabase } from '@/lib/mongodb';

// ============================================================
// BOT NAME GENERATION (1000+ UNIQUE NAMES)
// ============================================================

const BOT_NAME_PREFIXES = [
  // Military (200)
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet',
  'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango',
  'Uniform', 'Victor', 'Whiskey', 'Xray', 'Yankee', 'Zulu', 'Apex', 'Striker', 'Recon', 'Viper',
  'Phantom', 'Shadow', 'Ghost', 'Raven', 'Hawk', 'Eagle', 'Falcon', 'Cobra', 'Wolf', 'Bear',
  'Tiger', 'Dragon', 'Lion', 'Panther', 'Jaguar', 'Scorpion', 'Hornet', 'Wasp', 'Venom', 'Blade',
  'Steel', 'Iron', 'Titan', 'Goliath', 'Atlas', 'Hercules', 'Thor', 'Odin', 'Zeus', 'Ares',
  'Mars', 'Apollo', 'Hades', 'Poseidon', 'Artemis', 'Athena', 'Hera', 'Aphrodite', 'Hermes', 'Hephaestus',
  'Sentinel', 'Guardian', 'Warden', 'Keeper', 'Protector', 'Defender', 'Champion', 'Warrior', 'Soldier', 'Knight',
  'Paladin', 'Crusader', 'Templar', 'Spartan', 'Trojan', 'Viking', 'Samurai', 'Ninja', 'Ronin', 'Shogun',
  'Centurion', 'Legionnaire', 'Gladiator', 'Praetorian', 'Phalanx', 'Hoplite', 'Berserker', 'Marauder', 'Raider', 'Pillager',
  // Fantasy (200)
  'Mystic', 'Arcane', 'Enigma', 'Oracle', 'Sage', 'Seer', 'Prophet', 'Diviner', 'Warlock', 'Sorcerer',
  'Wizard', 'Mage', 'Enchanter', 'Conjurer', 'Summoner', 'Necromancer', 'Pyromancer', 'Cryomancer', 'Geomancer', 'Aeromancer',
  'Druid', 'Shaman', 'Priest', 'Cleric', 'Monk', 'Hermit', 'Ascetic', 'Zealot', 'Fanatic', 'Inquisitor',
  'Wraith', 'Specter', 'Phantom', 'Banshee', 'Ghoul', 'Vampire', 'Lich', 'Demon', 'Devil', 'Imp',
  'Goblin', 'Orc', 'Troll', 'Ogre', 'Giant', 'Cyclops', 'Minotaur', 'Centaur', 'Satyr', 'Faun',
  'Elf', 'Dwarf', 'Gnome', 'Halfling', 'Fairy', 'Pixie', 'Sprite', 'Nymph', 'Dryad', 'Naiad',
  'Frost', 'Flame', 'Storm', 'Thunder', 'Lightning', 'Inferno', 'Blizzard', 'Tempest', 'Cyclone', 'Tornado',
  'Quake', 'Avalanche', 'Volcano', 'Tsunami', 'Hurricane', 'Typhoon', 'Monsoon', 'Eclipse', 'Nova', 'Comet',
  'Meteor', 'Asteroid', 'Nebula', 'Galaxy', 'Cosmos', 'Universe', 'Void', 'Abyss', 'Chaos', 'Entropy',
  'Rune', 'Glyph', 'Sigil', 'Seal', 'Ward', 'Hex', 'Curse', 'Charm', 'Spell', 'Ritual',
  // Sci-Fi (200)
  'Quantum', 'Photon', 'Neutron', 'Proton', 'Electron', 'Quark', 'Boson', 'Hadron', 'Lepton', 'Neutrino',
  'Plasma', 'Fusion', 'Fission', 'Reactor', 'Generator', 'Amplifier', 'Modulator', 'Oscillator', 'Resonator', 'Emitter',
  'Nexus', 'Apex', 'Vertex', 'Matrix', 'Vector', 'Scalar', 'Tensor', 'Algorithm', 'Protocol', 'Cipher',
  'Binary', 'Digital', 'Analog', 'Virtual', 'Cyber', 'Nano', 'Micro', 'Macro', 'Mega', 'Giga',
  'Tera', 'Peta', 'Exa', 'Zetta', 'Yotta', 'Kilo', 'Milli', 'Centi', 'Deci', 'Hecto',
  'Orbit', 'Satellite', 'Station', 'Outpost', 'Colony', 'Habitat', 'Dome', 'Pod', 'Module', 'Sector',
  'Warp', 'Jump', 'Hyper', 'Sub', 'Trans', 'Inter', 'Ultra', 'Super', 'Meta', 'Para',
  'Exo', 'Endo', 'Bio', 'Geo', 'Hydro', 'Aero', 'Pyro', 'Cryo', 'Thermo', 'Electro',
  'Synth', 'Clone', 'Android', 'Cyborg', 'Robot', 'Drone', 'Automaton', 'Mech', 'Golem', 'Construct',
  'Beacon', 'Signal', 'Pulse', 'Wave', 'Frequency', 'Amplitude', 'Wavelength', 'Spectrum', 'Radiation', 'Emission',
  // Additional (200)
  'Crimson', 'Scarlet', 'Ruby', 'Garnet', 'Azure', 'Sapphire', 'Cobalt', 'Navy', 'Emerald', 'Jade',
  'Amber', 'Topaz', 'Citrine', 'Onyx', 'Obsidian', 'Ebony', 'Ivory', 'Pearl', 'Diamond', 'Crystal',
  'Prism', 'Radiant', 'Brilliant', 'Lustrous', 'Shimmer', 'Glimmer', 'Sparkle', 'Glitter', 'Shine', 'Gleam',
  'Dawn', 'Dusk', 'Twilight', 'Midnight', 'Noon', 'Sunrise', 'Sunset', 'Moonrise', 'Moonset', 'Eclipse',
  'Spring', 'Summer', 'Autumn', 'Winter', 'Solstice', 'Equinox', 'Season', 'Harvest', 'Bloom', 'Frost',
  'North', 'South', 'East', 'West', 'Central', 'Prime', 'Core', 'Edge', 'Border', 'Frontier',
  'Vanguard', 'Vortex', 'Vertex', 'Zenith', 'Nadir', 'Apex', 'Peak', 'Summit', 'Crest', 'Ridge',
  'Valley', 'Canyon', 'Gorge', 'Ravine', 'Chasm', 'Abyss', 'Depths', 'Heights', 'Plains', 'Plateau',
  'Bastion', 'Citadel', 'Fortress', 'Stronghold', 'Rampart', 'Bulwark', 'Redoubt', 'Keep', 'Tower', 'Spire',
  'Nexus', 'Hub', 'Node', 'Link', 'Bridge', 'Gate', 'Portal', 'Passage', 'Conduit', 'Channel',
];

const BOT_NAME_SUFFIXES = [
  // Numbers and codes (100)
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa',
  'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon',
  'Phi', 'Chi', 'Psi', 'Omega', 'Prime', 'Zero', 'One', 'Two', 'Three', 'Four',
  'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Hundred', 'Thousand', 'Unit', 'Corps',
  // Descriptors (100)
  'Command', 'Control', 'Core', 'Prime', 'Supreme', 'Ultimate', 'Eternal', 'Immortal', 'Infinite', 'Divine',
  'Sacred', 'Holy', 'Blessed', 'Cursed', 'Damned', 'Fallen', 'Rising', 'Ascendant', 'Dominant', 'Superior',
  'Elite', 'Master', 'Lord', 'King', 'Emperor', 'Kaiser', 'Czar', 'Sultan', 'Pharaoh', 'Khan',
  'Chief', 'Captain', 'Major', 'Colonel', 'General', 'Marshal', 'Admiral', 'Commander', 'Leader', 'Ruler',
  'Guardian', 'Sentinel', 'Watcher', 'Observer', 'Monitor', 'Scout', 'Recon', 'Spy', 'Agent', 'Operative',
  'Hunter', 'Seeker', 'Finder', 'Tracker', 'Stalker', 'Predator', 'Prey', 'Target', 'Mark', 'Victim',
  // Elements (50)
  'Fire', 'Ice', 'Wind', 'Earth', 'Lightning', 'Water', 'Light', 'Dark', 'Shadow', 'Void',
  'Chaos', 'Order', 'Life', 'Death', 'Time', 'Space', 'Matter', 'Energy', 'Force', 'Power',
  'Strength', 'Speed', 'Rage', 'Fury', 'Wrath', 'Vengeance', 'Justice', 'Honor', 'Glory', 'Fame',
  'Pride', 'Greed', 'Envy', 'Sloth', 'Lust', 'Gluttony', 'Hope', 'Faith', 'Love', 'Hate',
  'Fear', 'Courage', 'Wisdom', 'Knowledge', 'Truth', 'Lies', 'Dreams', 'Nightmares', 'Destiny', 'Fate',
];

/**
 * Generate unique bot name from prefixes and suffixes
 * 1000+ combinations possible
 * 
 * @returns Unique bot username (e.g., "Alpha-Command", "Quantum-Prime", "Shadow-Hunter")
 */
export function generateBotName(): string {
  const prefix = BOT_NAME_PREFIXES[Math.floor(Math.random() * BOT_NAME_PREFIXES.length)];
  const suffix = BOT_NAME_SUFFIXES[Math.floor(Math.random() * BOT_NAME_SUFFIXES.length)];
  const variant = Math.random() < 0.3 ? `-${Math.floor(Math.random() * 999) + 1}` : '';
  return `${prefix}-${suffix}${variant}`;
}

// ============================================================
// BOT SPECIALIZATION LOGIC
// ============================================================

/**
 * Get bot specialization with weighted distribution
 * 
 * Distribution:
 * - Boss: 1% (NEW: Phase 7 - Rare elite encounters)
 * - Hoarder: 24.75% (reduced from 25%)
 * - Raider: 24.75% (reduced from 25%)
 * - Fortress: 19.8% (reduced from 20%)
 * - Ghost: 14.85% (reduced from 15%)
 * - Balanced: 14.85% (reduced from 15%)
 * 
 * @returns Random bot specialization based on weighted probabilities
 */
export function getRandomSpecialization(): BotSpecialization {
  const roll = Math.random() * 100;
  
  // 1% chance for Boss (elite rare spawn)
  if (roll < 1) return BotSpecialization.Boss;
  
  // Remaining 99% distributed among standard specializations
  if (roll < 25.75) return BotSpecialization.Hoarder;      // 24.75%
  if (roll < 50.5) return BotSpecialization.Raider;        // 24.75%
  if (roll < 70.3) return BotSpecialization.Fortress;      // 19.8%
  if (roll < 85.15) return BotSpecialization.Ghost;        // 14.85%
  return BotSpecialization.Balanced;                       // 14.85%
}

/**
 * Get resource range based on specialization and tier
 * 
 * @param specialization Bot type
 * @param tier Resource tier (1-7, expanded from original 1-3)
 * @returns Min and max resources for this bot
 */
export function getResourceRange(specialization: BotSpecialization, tier: number): { min: number; max: number } {
  const baseRanges = {
    [BotSpecialization.Hoarder]: { min: 50000, max: 150000 },
    [BotSpecialization.Fortress]: { min: 5000, max: 15000 },
    [BotSpecialization.Raider]: { min: 10000, max: 40000 },
    [BotSpecialization.Ghost]: { min: 20000, max: 80000 },
    [BotSpecialization.Balanced]: { min: 15000, max: 50000 },
    [BotSpecialization.Boss]: { min: 4000000, max: 6000000 } // NEW: Phase 7 - Elite boss (4M-6M resources)
  };

  const range = baseRanges[specialization];
  
  // Boss specialization uses fixed resources (no tier multiplier)
  if (specialization === BotSpecialization.Boss) {
    return range;
  }
  
  // Expanded tier multipliers (7 tiers matching player level brackets)
  // T1 (1-10): 0.75x, T2 (11-20): 1.0x, T3 (21-30): 1.25x, T4 (31-40): 1.5x, T5 (41-50): 2.0x, T6 (51-60): 2.5x, T7 (61+): 3.0x
  const tierMultiplier = 0.5 + (tier * 0.25); // Progressive scaling up to T7 = 3.0x

  return {
    min: Math.floor(range.min * tierMultiplier),
    max: Math.floor(range.max * tierMultiplier)
  };
}

/**
 * Calculate level-bracket bonus for bot resources
 * Awards +25% per 10-level bracket to encourage progression
 * 
 * @param playerLevel - Player's current level
 * @returns Multiplier (1.0 = no bonus, 1.25 = +25%, 2.5 = +150%, etc.)
 * 
 * @example
 * getPlayerLevelBonus(5);   // Returns 1.0 (Bracket 0, no bonus)
 * getPlayerLevelBonus(15);  // Returns 1.25 (Bracket 1, +25%)
 * getPlayerLevelBonus(35);  // Returns 1.75 (Bracket 3, +75%)
 * getPlayerLevelBonus(62);  // Returns 2.5 (Bracket 6, +150%)
 * 
 * NEW: Phase 6 - Dynamic resource scaling based on player level
 */
export function getPlayerLevelBonus(playerLevel: number): number {
  // Level brackets: 0-9 (0), 10-19 (1), 20-29 (2), 30-39 (3), 40-49 (4), 50-59 (5), 60+ (6)
  const bracket = Math.floor(playerLevel / 10);
  
  // +25% bonus per bracket (capped at bracket 6 = +150%)
  const maxBracket = Math.min(bracket, 6);
  const bonusMultiplier = 1.0 + (maxBracket * 0.25);
  
  return bonusMultiplier;
}

/**
 * Apply player level bonus to bot resources
 * Used when displaying bots to players or during combat
 * 
 * @param baseResources - Bot's base metal/energy amounts
 * @param playerLevel - Player's current level
 * @returns Adjusted resources with level-bracket bonus applied
 * 
 * @example
 * applyPlayerLevelBonus({ metal: 100000, energy: 100000 }, 62);
 * // Returns: { metal: 250000, energy: 250000 } (+150% bonus)
 * 
 * NEW: Phase 6 - Rewards high-level players with better bot loot
 */
export function applyPlayerLevelBonus(
  baseResources: { metal: number; energy: number },
  playerLevel: number
): { metal: number; energy: number } {
  const bonus = getPlayerLevelBonus(playerLevel);
  
  return {
    metal: Math.floor(baseResources.metal * bonus),
    energy: Math.floor(baseResources.energy * bonus)
  };
}

/**
 * Get bot resources with player level bonus applied
 * Convenience function combining resource retrieval and bonus application
 * 
 * @param bot - Bot player object
 * @param playerLevel - Player's current level
 * @returns Bot resources with level-bracket bonus
 * 
 * @example
 * const bot = { resources: { metal: 100000, energy: 100000 }, ... };
 * getBotResourcesForPlayer(bot, 62);
 * // Returns: { metal: 250000, energy: 250000 } (+150% for Level 62 player)
 * 
 * NEW: Phase 6 - Single function for getting player-specific bot resources
 */
export function getBotResourcesForPlayer(
  bot: Player,
  playerLevel: number
): { metal: number; energy: number } {
  return applyPlayerLevelBonus(bot.resources, playerLevel);
}

/**
 * Get resource regeneration rate per hour based on specialization
 * Full Permanence: Bots regenerate resources after defeat instead of despawning
 * 
 * @param specialization Bot type
 * @returns Percentage of max resources to regenerate per hour (0.05-0.20)
 */
export function getRegenerationRate(specialization: BotSpecialization): number {
  const rates = {
    [BotSpecialization.Hoarder]: 0.05,    // 5% per hour (20 hours to full)
    [BotSpecialization.Fortress]: 0.10,   // 10% per hour (10 hours to full)
    [BotSpecialization.Raider]: 0.15,     // 15% per hour (6.7 hours to full)
    [BotSpecialization.Ghost]: 0.20,      // 20% per hour (5 hours to full)
    [BotSpecialization.Balanced]: 0.10,   // 10% per hour (10 hours to full)
    [BotSpecialization.Boss]: 0.02        // 2% per hour (50 hours to full) - NEW: Phase 7
  };
  return rates[specialization];
}

/**
 * Calculate defense multiplier based on specialization
 * 
 * @param specialization Bot type
 * @returns Defense multiplier (0.5x - 3.0x)
 */
export function getDefenseMultiplier(specialization: BotSpecialization): number {
  const multipliers = {
    [BotSpecialization.Hoarder]: 0.5,
    [BotSpecialization.Fortress]: 3.0,
    [BotSpecialization.Raider]: 1.0,
    [BotSpecialization.Ghost]: 0.8,
    [BotSpecialization.Balanced]: 1.0,
    [BotSpecialization.Boss]: 20.0       // 20x defense (200K+ total) - NEW: Phase 7
  };
  return multipliers[specialization];
}

/**
 * Get movement pattern for bot type
 * 
 * @param specialization Bot type
 * @returns Movement pattern (stationary/roam/teleport)
 */
export function getMovementPattern(specialization: BotSpecialization): 'stationary' | 'roam' | 'teleport' {
  const patterns: Record<BotSpecialization, 'stationary' | 'roam' | 'teleport'> = {
    [BotSpecialization.Hoarder]: 'stationary',
    [BotSpecialization.Fortress]: 'stationary',
    [BotSpecialization.Raider]: 'roam',
    [BotSpecialization.Ghost]: 'teleport',
    [BotSpecialization.Balanced]: 'roam',
    [BotSpecialization.Boss]: 'stationary'  // Bosses don't move - NEW: Phase 7
  };
  return patterns[specialization];
}

// ============================================================
// BOT REPUTATION SYSTEM
// ============================================================

/**
 * Calculate bot reputation based on times defeated
 * 
 * Tiers:
 * - Unknown: 0-5 defeats
 * - Notorious: 6-15 defeats (+25% loot)
 * - Infamous: 16-30 defeats (+50% loot)
 * - Legendary: 31+ defeats (+100% loot)
 * 
 * @param defeatedCount Number of times bot has been defeated
 * @returns Current reputation tier
 */
export function calculateReputation(defeatedCount: number): BotReputation {
  if (defeatedCount >= 31) return BotReputation.Legendary;
  if (defeatedCount >= 16) return BotReputation.Infamous;
  if (defeatedCount >= 6) return BotReputation.Notorious;
  return BotReputation.Unknown;
}

/**
 * Get loot bonus multiplier based on reputation
 * 
 * @param reputation Bot reputation tier
 * @returns Loot multiplier (1.0 - 2.0)
 */
export function getReputationLootBonus(reputation: BotReputation): number {
  const bonuses = {
    [BotReputation.Unknown]: 1.0,
    [BotReputation.Notorious]: 1.25,
    [BotReputation.Infamous]: 1.5,
    [BotReputation.Legendary]: 2.0
  };
  return bonuses[reputation];
}

// ============================================================
// MAP ZONE SYSTEM (9 zones, 50×50 each)
// ============================================================

/**
 * Calculate which zone a position belongs to
 * Map: 150×150 divided into 9 zones (50×50 each)
 * 
 * Zone Layout:
 * [0] [1] [2]
 * [3] [4] [5]
 * [6] [7] [8]
 * 
 * @param position Map coordinates
 * @returns Zone number (0-8)
 */
export function calculateZone(position: Position): number {
  const zoneX = Math.floor((position.x - 1) / 50);
  const zoneY = Math.floor((position.y - 1) / 50);
  return zoneY * 3 + zoneX;
}

/**
 * Get random position within a specific zone
 * 
 * @param zone Zone number (0-8)
 * @returns Random position in zone
 */
export function getRandomPositionInZone(zone: number): Position {
  const zoneX = zone % 3;
  const zoneY = Math.floor(zone / 3);
  
  const baseX = zoneX * 50 + 1;
  const baseY = zoneY * 50 + 1;
  
  return {
    x: baseX + Math.floor(Math.random() * 50),
    y: baseY + Math.floor(Math.random() * 50)
  };
}

// ============================================================
// BOT CREATION
// ============================================================

/**
 * Create a new bot player with randomized stats
 * Full Permanence: permanentBase always true
 * 
 * @param zone Target zone for bot (0-8, or null for random)
 * @param specialization Override specialization (or null for random)
 * @param isSpecial Create as Beer Base (3x resources)
 * @param tier Override tier (1-7, or null for random within appropriate range)
 * @returns Bot player object ready for database insert
 */
export async function createBotPlayer(
  zone: number | null = null,
  specialization: BotSpecialization | null = null,
  isSpecial: boolean = false,
  tier: number | null = null
): Promise<Partial<Player>> {
  const botSpec = specialization || getRandomSpecialization();
  const targetZone = zone ?? Math.floor(Math.random() * 9);
  
  // Expanded tier system: 1-7 (matching player level brackets)
  // If tier not specified, randomly select from 1-7 with weighted distribution
  const botTier = tier ?? getBotTierForZone(targetZone);
  
  const position = getRandomPositionInZone(targetZone);
  const resourceRange = getResourceRange(botSpec, botTier);
  const baseResources = Math.floor(Math.random() * (resourceRange.max - resourceRange.min + 1)) + resourceRange.min;
  const resources = isSpecial ? baseResources * 3 : baseResources;
  
  const botConfig: BotConfig = {
    specialization: botSpec,
    tier: botTier,
    lastGrowth: new Date(),
    attackCooldown: new Date(),
    isSpecialBase: isSpecial,
    defeatedCount: 0,
    reputation: BotReputation.Unknown,
    movement: getMovementPattern(botSpec),
    zone: targetZone,
    nestAffinity: null,
    bountyValue: 0,
    permanentBase: true, // FULL PERMANENCE
  };
  
  const defenseMultiplier = getDefenseMultiplier(botSpec);
  
  // Expanded defense calculation (7 tiers)
  // Base defense scales significantly with tier for end-game challenge
  const baseDefense = getBotDefenseForTier(botTier);
  
  return {
    username: generateBotName(),
    email: `bot-${Date.now()}-${Math.random()}@darkframe.internal`,
    password: 'BOT_ACCOUNT', // Bots cannot log in
    base: position,
    currentPosition: position,
    resources: {
      metal: resources,
      energy: resources
    },
    bank: {
      metal: 0,
      energy: 0,
      lastDeposit: null
    },
    rank: Math.min(6, Math.ceil(botTier / 2)), // Rank 1-6 based on tier
    inventory: {
      items: [],
      capacity: 0,
      metalDiggerCount: 0,
      energyDiggerCount: 0
    },
    gatheringBonus: { metalBonus: 0, energyBonus: 0 },
    activeBoosts: { gatheringBoost: null, expiresAt: null },
    shrineBoosts: [],
    units: [],
    totalStrength: 0,
    totalDefense: Math.floor(baseDefense * defenseMultiplier),
    xp: 0,
    level: getPlayerLevelForTier(botTier),
    researchPoints: 0,
    unlockedTiers: [],
    isBot: true,
    botConfig,
    createdAt: new Date()
  };
}

/**
 * Get appropriate bot tier for a given zone
 * Zones 0-2: Lower tiers (1-3)
 * Zones 3-5: Mid tiers (3-5)
 * Zones 6-8: High tiers (5-7)
 * 
 * @param zone Map zone (0-8)
 * @returns Bot tier (1-7)
 */
function getBotTierForZone(zone: number): number {
  if (zone <= 2) {
    // Zones 0-2: Beginner areas (T1-T3)
    return Math.floor(Math.random() * 3) + 1; // 1-3
  } else if (zone <= 5) {
    // Zones 3-5: Mid-game areas (T3-T5)
    return Math.floor(Math.random() * 3) + 3; // 3-5
  } else {
    // Zones 6-8: End-game areas (T5-T7)
    return Math.floor(Math.random() * 3) + 5; // 5-7
  }
}

/**
 * Calculate base defense for bot tier
 * Exponential scaling for end-game challenge
 * 
 * @param tier Bot tier (1-7)
 * @returns Base defense value
 */
function getBotDefenseForTier(tier: number): number {
  // Progressive defense scaling
  // T1: 150, T2: 300, T3: 600, T4: 1200, T5: 2400, T6: 4800, T7: 9600
  const baseDefense = 100 + (tier * 50);
  const scalingFactor = Math.pow(2, tier - 1); // Exponential: 1, 2, 4, 8, 16, 32, 64
  return Math.floor(baseDefense * scalingFactor * 0.1); // Scale down by 0.1 to get reasonable values
}

/**
 * Get approximate player level for bot tier
 * Matches tier-to-level bracket mapping
 * 
 * @param tier Bot tier (1-7)
 * @returns Player level
 */
function getPlayerLevelForTier(tier: number): number {
  const levelBrackets = {
    1: 5,   // T1: Level 1-10 → avg 5
    2: 15,  // T2: Level 11-20 → avg 15
    3: 25,  // T3: Level 21-30 → avg 25
    4: 35,  // T4: Level 31-40 → avg 35
    5: 45,  // T5: Level 41-50 → avg 45
    6: 55,  // T6: Level 51-60 → avg 55
    7: 65   // T7: Level 61+ → avg 65
  };
  return levelBrackets[tier as keyof typeof levelBrackets] || tier * 10;
}

/**
 * Create Boss Bot at specific location
 * Elite rare spawn with extreme stats for end-game challenge
 * 
 * @param x - Map X coordinate for boss spawn
 * @param y - Map Y coordinate for boss spawn
 * @param zone - Zone number (optional, defaults to zone based on coordinates)
 * @returns Boss bot player object
 * 
 * @example
 * // Spawn boss at coordinates (75, 75) in Zone 4
 * const boss = await createBossBot(75, 75);
 * // Boss stats: 200K+ defense, 4-6M resources, Tier 7, Legendary reputation
 * 
 * NEW: Phase 7 - Elite boss bot system for coordinated attacks
 */
export async function createBossBot(
  x: number,
  y: number,
  zone: number | null = null
): Promise<Partial<Player>> {
  const targetZone = zone ?? Math.floor((x + y) / 33); // Auto-calculate zone if not provided
  
  const position: Position = { x, y };
  const resourceRange = getResourceRange(BotSpecialization.Boss, 7); // Fixed Tier 7
  const baseResources = Math.floor(Math.random() * (resourceRange.max - resourceRange.min + 1)) + resourceRange.min;
  
  const botConfig: BotConfig = {
    specialization: BotSpecialization.Boss,
    tier: 7, // Always Tier 7 (Level 61+)
    lastGrowth: new Date(),
    attackCooldown: new Date(),
    isSpecialBase: false, // Bosses are NOT beer bases
    defeatedCount: 0,
    reputation: BotReputation.Legendary, // Start at Legendary (high visibility)
    movement: 'stationary', // Bosses don't move
    zone: targetZone,
      lastResourceRegen: new Date(),
      nestAffinity: null, // Bosses don't belong to nests
      bountyValue: 5000000, // 5M bounty (10x normal Legendary bot)
      permanentBase: true // Bosses are permanent high-value targets
  };

  const baseDefense = getBotDefenseForTier(7); // T7: 9,600 base defense
  const defenseMultiplier = getDefenseMultiplier(BotSpecialization.Boss); // 20x multiplier
  const totalDefense = Math.floor(baseDefense * defenseMultiplier); // 192,000 defense

  const bossPlayer: Partial<Player> = {
    username: `BOSS-${generateBotName()}`, // Prefix with BOSS for visibility
    email: `boss-${Date.now()}@darkframe.bot`,
      password: 'BOSS_ACCOUNT', // Bosses cannot log in
    isBot: true,
    level: 65, // Fixed Level 65 (higher than player max)
    xp: 0,
      base: position,
      currentPosition: position,
    resources: {
      metal: baseResources,
      energy: baseResources
    },
    bank: {
      metal: 0,
      energy: 0,
      lastDeposit: null
    },
    rank: 7, // Maximum rank
    inventory: {
      items: [],
      capacity: 0,
      metalDiggerCount: 0,
      energyDiggerCount: 0
    },
    gatheringBonus: { metalBonus: 0, energyBonus: 0 },
    activeBoosts: { gatheringBoost: null, expiresAt: null },
    shrineBoosts: [],
    units: [],
    totalStrength: 0,
    totalDefense: totalDefense,
    botConfig,
    createdAt: new Date()
  };

  console.log(`👑 BOSS SPAWNED at (${x}, ${y}) Zone ${targetZone}: ${bossPlayer.username} | Defense: ${totalDefense.toLocaleString()} | Resources: ${baseResources.toLocaleString()}`);

  return bossPlayer;
}

/**
 * Regenerate bot resources based on time elapsed and specialization
 * Full Permanence: Called hourly to restore resources after defeats
 * 
 * @param bot Bot player to regenerate
 * @returns Updated resource amounts
 */
export async function regenerateBotResources(bot: Player): Promise<{ metal: number; energy: number }> {
  if (!bot.isBot || !bot.botConfig) {
    throw new Error('regenerateBotResources called on non-bot player');
  }

  const now = new Date();
  const lastRegen = bot.botConfig.lastResourceRegen || bot.botConfig.lastGrowth;
  const hoursSinceRegen = (now.getTime() - lastRegen.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceRegen < 1) {
    return bot.resources; // Not enough time passed
  }

  const regenRate = getRegenerationRate(bot.botConfig.specialization);
  const resourceRange = getResourceRange(bot.botConfig.specialization, bot.botConfig.tier);
  const maxResources = bot.botConfig.isSpecialBase ? resourceRange.max * 3 : resourceRange.max;
  
  const hoursToRegen = Math.floor(hoursSinceRegen);
  const regenAmount = Math.floor(maxResources * regenRate * hoursToRegen);
  
  const newMetal = Math.min(bot.resources.metal + regenAmount, maxResources);
  const newEnergy = Math.min(bot.resources.energy + regenAmount, maxResources);
  
  return { metal: newMetal, energy: newEnergy };
}

// ============================================================
// BEER BASE SYSTEM
// ============================================================

/**
 * Check if it's time to respawn Beer Bases (Sunday 4 AM)
 * 
 * @returns True if it's Beer Base respawn time
 */
export function isBeerBaseRespawnTime(): boolean {
  const now = new Date();
  return now.getDay() === 0 && now.getHours() === 4; // Sunday at 4 AM
}

/**
 * Remove all current Beer Bases from database
 * Called during weekly respawn
 */
export async function removeAllBeerBases(): Promise<number> {
  const db = await getDatabase();
  const result = await db.collection('players').deleteMany({
    isBot: true,
    'botConfig.isSpecialBase': true
  });
  return result.deletedCount;
}

/**
 * Spawn new Beer Bases at random locations
 * 
 * @param count Number of Beer Bases to spawn
 * @returns Array of created Beer Base bots
 */
export async function createBeerBaseBots(count: number): Promise<Partial<Player>[]> {
  const beerBases: Partial<Player>[] = [];
  
  for (let i = 0; i < count; i++) {
    const bot = await createBotPlayer(null, null, true);
    beerBases.push(bot);
  }
  
  return beerBases;
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Full Permanence Model: Regular bots never despawn, regenerate resources hourly
// - Beer Bases despawn when defeated, respawn weekly (Sunday 4 AM)
// - All bots have permanentBase=true for static base locations
// - Resource regeneration rates: 5-20% per hour based on specialization
// - Reputation system tracks defeats for bonus loot (up to 2x)
// - Zone system ensures even distribution across 150×150 map
// - Admin panel will control all bot parameters via configuration
// ============================================================
