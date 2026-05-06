/**
 * @file lib/botService.ts
 * @created 2025-10-18
 * @updated 2025-11-04 - Phase 7: Added Boss Bot System
 * @overview Bot ecosystem service with Full Permanence model (UPDATED: 7-Tier System + Level Bonuses)
 */

import { BotSpecialization, BotReputation, type Player, type BotConfig, type Position } from '@/types/game.types';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// BOT NAME GENERATION (1000+ UNIQUE NAMES)
// ============================================================

const BOT_NAME_PREFIXES = [
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
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa',
  'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon',
  'Phi', 'Chi', 'Psi', 'Omega', 'Prime', 'Zero', 'One', 'Two', 'Three', 'Four',
  'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Hundred', 'Thousand', 'Unit', 'Corps',
  'Command', 'Control', 'Core', 'Prime', 'Supreme', 'Ultimate', 'Eternal', 'Immortal', 'Infinite', 'Divine',
  'Sacred', 'Holy', 'Blessed', 'Cursed', 'Damned', 'Fallen', 'Rising', 'Ascendant', 'Dominant', 'Superior',
  'Elite', 'Master', 'Lord', 'King', 'Emperor', 'Kaiser', 'Czar', 'Sultan', 'Pharaoh', 'Khan',
  'Chief', 'Captain', 'Major', 'Colonel', 'General', 'Marshal', 'Admiral', 'Commander', 'Leader', 'Ruler',
  'Guardian', 'Sentinel', 'Watcher', 'Observer', 'Monitor', 'Scout', 'Recon', 'Spy', 'Agent', 'Operative',
  'Hunter', 'Seeker', 'Finder', 'Tracker', 'Stalker', 'Predator', 'Prey', 'Target', 'Mark', 'Victim',
  'Fire', 'Ice', 'Wind', 'Earth', 'Lightning', 'Water', 'Light', 'Dark', 'Shadow', 'Void',
  'Chaos', 'Order', 'Life', 'Death', 'Time', 'Space', 'Matter', 'Energy', 'Force', 'Power',
  'Strength', 'Speed', 'Rage', 'Fury', 'Wrath', 'Vengeance', 'Justice', 'Honor', 'Glory', 'Fame',
  'Pride', 'Greed', 'Envy', 'Sloth', 'Lust', 'Gluttony', 'Hope', 'Faith', 'Love', 'Hate',
  'Fear', 'Courage', 'Wisdom', 'Knowledge', 'Truth', 'Lies', 'Dreams', 'Nightmares', 'Destiny', 'Fate',
];

export function generateBotName(): string {
  const prefix = BOT_NAME_PREFIXES[Math.floor(Math.random() * BOT_NAME_PREFIXES.length)];
  const suffix = BOT_NAME_SUFFIXES[Math.floor(Math.random() * BOT_NAME_SUFFIXES.length)];
  const variant = Math.random() < 0.3 ? `-${Math.floor(Math.random() * 999) + 1}` : '';
  return `${prefix}-${suffix}${variant}`;
}

export function getRandomSpecialization(): BotSpecialization {
  const roll = Math.random() * 100;
  if (roll < 1) return BotSpecialization.Boss;
  if (roll < 25.75) return BotSpecialization.Hoarder;
  if (roll < 50.5) return BotSpecialization.Raider;
  if (roll < 70.3) return BotSpecialization.Fortress;
  if (roll < 85.15) return BotSpecialization.Ghost;
  return BotSpecialization.Balanced;
}

export function getResourceRange(specialization: BotSpecialization, tier: number): { min: number; max: number } {
  const baseRanges: Record<string, { min: number; max: number }> = {
    [BotSpecialization.Hoarder]: { min: 50000, max: 150000 },
    [BotSpecialization.Fortress]: { min: 5000, max: 15000 },
    [BotSpecialization.Raider]: { min: 10000, max: 40000 },
    [BotSpecialization.Ghost]: { min: 20000, max: 80000 },
    [BotSpecialization.Balanced]: { min: 15000, max: 50000 },
    [BotSpecialization.Boss]: { min: 4000000, max: 6000000 },
  };
  const range = baseRanges[specialization];
  if (specialization === BotSpecialization.Boss) return range;
  const tierMultiplier = 0.5 + (tier * 0.25);
  return { min: Math.floor(range.min * tierMultiplier), max: Math.floor(range.max * tierMultiplier) };
}

export function getPlayerLevelBonus(playerLevel: number): number {
  const bracket = Math.floor(playerLevel / 10);
  const maxBracket = Math.min(bracket, 6);
  return 1.0 + (maxBracket * 0.25);
}

export function applyPlayerLevelBonus(
  baseResources: { metal: number; energy: number },
  playerLevel: number
): { metal: number; energy: number } {
  const bonus = getPlayerLevelBonus(playerLevel);
  return { metal: Math.floor(baseResources.metal * bonus), energy: Math.floor(baseResources.energy * bonus) };
}

export function getBotResourcesForPlayer(bot: Player, playerLevel: number): { metal: number; energy: number } {
  return applyPlayerLevelBonus(bot.resources, playerLevel);
}

export function getRegenerationRate(specialization: BotSpecialization): number {
  const rates: Record<string, number> = {
    [BotSpecialization.Hoarder]: 0.05,
    [BotSpecialization.Fortress]: 0.10,
    [BotSpecialization.Raider]: 0.15,
    [BotSpecialization.Ghost]: 0.20,
    [BotSpecialization.Balanced]: 0.10,
    [BotSpecialization.Boss]: 0.02,
  };
  return rates[specialization];
}

export function getDefenseMultiplier(specialization: BotSpecialization): number {
  const multipliers: Record<string, number> = {
    [BotSpecialization.Hoarder]: 0.5,
    [BotSpecialization.Fortress]: 3.0,
    [BotSpecialization.Raider]: 1.0,
    [BotSpecialization.Ghost]: 0.8,
    [BotSpecialization.Balanced]: 1.0,
    [BotSpecialization.Boss]: 20.0,
  };
  return multipliers[specialization];
}

export function getMovementPattern(specialization: BotSpecialization): 'stationary' | 'roam' | 'teleport' {
  const patterns: Record<string, 'stationary' | 'roam' | 'teleport'> = {
    [BotSpecialization.Hoarder]: 'stationary',
    [BotSpecialization.Fortress]: 'stationary',
    [BotSpecialization.Raider]: 'roam',
    [BotSpecialization.Ghost]: 'teleport',
    [BotSpecialization.Balanced]: 'roam',
    [BotSpecialization.Boss]: 'stationary',
  };
  return patterns[specialization];
}

export function calculateReputation(defeatedCount: number): BotReputation {
  if (defeatedCount >= 31) return BotReputation.Legendary;
  if (defeatedCount >= 16) return BotReputation.Infamous;
  if (defeatedCount >= 6) return BotReputation.Notorious;
  return BotReputation.Unknown;
}

export function getReputationLootBonus(reputation: BotReputation): number {
  const bonuses: Record<string, number> = {
    [BotReputation.Unknown]: 1.0,
    [BotReputation.Notorious]: 1.25,
    [BotReputation.Infamous]: 1.5,
    [BotReputation.Legendary]: 2.0,
  };
  return bonuses[reputation];
}

export function calculateZone(position: Position): number {
  const zoneX = Math.floor((position.x - 1) / 50);
  const zoneY = Math.floor((position.y - 1) / 50);
  return zoneY * 3 + zoneX;
}

export function getRandomPositionInZone(zone: number): Position {
  const zoneX = zone % 3;
  const zoneY = Math.floor(zone / 3);
  const baseX = zoneX * 50 + 1;
  const baseY = zoneY * 50 + 1;
  return { x: baseX + Math.floor(Math.random() * 50), y: baseY + Math.floor(Math.random() * 50) };
}

function getBotTierForZone(zone: number): number {
  if (zone <= 2) return Math.floor(Math.random() * 3) + 1;
  if (zone <= 5) return Math.floor(Math.random() * 3) + 3;
  return Math.floor(Math.random() * 3) + 5;
}

function getBotDefenseForTier(tier: number): number {
  const baseDefense = 100 + (tier * 50);
  const scalingFactor = Math.pow(2, tier - 1);
  return Math.floor(baseDefense * scalingFactor * 0.1);
}

function getPlayerLevelForTier(tier: number): number {
  const levelBrackets: Record<number, number> = { 1: 5, 2: 15, 3: 25, 4: 35, 5: 45, 6: 55, 7: 65 };
  return levelBrackets[tier] || tier * 10;
}

export async function createBotPlayer(
  zone: number | null = null,
  specialization: BotSpecialization | null = null,
  isSpecial: boolean = false,
  tier: number | null = null
): Promise<Partial<Player>> {
  const botSpec = specialization || getRandomSpecialization();
  const targetZone = zone ?? Math.floor(Math.random() * 9);
  const botTier = tier ?? getBotTierForZone(targetZone);
  const position = getRandomPositionInZone(targetZone);
  const resourceRange = getResourceRange(botSpec, botTier);
  const baseResources = Math.floor(Math.random() * (resourceRange.max - resourceRange.min + 1)) + resourceRange.min;
  const resources = isSpecial ? baseResources * 3 : baseResources;

  const defenseMultiplier = getDefenseMultiplier(botSpec);
  const baseDefense = getBotDefenseForTier(botTier);

  return {
    username: generateBotName(),
    email: `bot-${Date.now()}-${Math.random()}@darkframe.internal`,
    password: 'BOT_ACCOUNT',
    base: position,
    currentPosition: position,
    resources: { metal: resources, energy: resources },
    bank: { metal: 0, energy: 0, lastDeposit: null },
    rank: Math.min(6, Math.ceil(botTier / 2)),
    inventory: { items: [], capacity: 0, metalDiggerCount: 0, energyDiggerCount: 0 },
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
    botConfig: {
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
      permanentBase: true,
    },
    createdAt: new Date(),
  };
}

export async function createBossBot(x: number, y: number, zone: number | null = null): Promise<Partial<Player>> {
  const targetZone = zone ?? Math.floor((x + y) / 33);
  const position: Position = { x, y };
  const resourceRange = getResourceRange(BotSpecialization.Boss, 7);
  const baseResources = Math.floor(Math.random() * (resourceRange.max - resourceRange.min + 1)) + resourceRange.min;
  const baseDefense = getBotDefenseForTier(7);
  const defenseMultiplier = getDefenseMultiplier(BotSpecialization.Boss);

  return {
    username: `BOSS-${generateBotName()}`,
    email: `boss-${Date.now()}@darkframe.bot`,
    password: 'BOSS_ACCOUNT',
    isBot: true,
    level: 65,
    xp: 0,
    base: position,
    currentPosition: position,
    resources: { metal: baseResources, energy: baseResources },
    bank: { metal: 0, energy: 0, lastDeposit: null },
    rank: 7,
    inventory: { items: [], capacity: 0, metalDiggerCount: 0, energyDiggerCount: 0 },
    gatheringBonus: { metalBonus: 0, energyBonus: 0 },
    activeBoosts: { gatheringBoost: null, expiresAt: null },
    shrineBoosts: [],
    units: [],
    totalStrength: 0,
    totalDefense: Math.floor(baseDefense * defenseMultiplier),
    botConfig: {
      specialization: BotSpecialization.Boss,
      tier: 7,
      lastGrowth: new Date(),
      attackCooldown: new Date(),
      isSpecialBase: false,
      defeatedCount: 0,
      reputation: BotReputation.Legendary,
      movement: 'stationary',
      zone: targetZone,
      lastResourceRegen: new Date(),
      nestAffinity: null,
      bountyValue: 5000000,
      permanentBase: true,
    },
    createdAt: new Date(),
  };
}

export async function regenerateBotResources(bot: Player): Promise<{ metal: number; energy: number }> {
  if (!bot.isBot || !bot.botConfig) {
    throw new Error('regenerateBotResources called on non-bot player');
  }
  const now = new Date();
  const lastRegen = bot.botConfig.lastResourceRegen || bot.botConfig.lastGrowth;
  const hoursSinceRegen = (now.getTime() - lastRegen.getTime()) / (1000 * 60 * 60);
  if (hoursSinceRegen < 1) return bot.resources;
  const regenRate = getRegenerationRate(bot.botConfig.specialization);
  const resourceRange = getResourceRange(bot.botConfig.specialization, bot.botConfig.tier);
  const maxResources = bot.botConfig.isSpecialBase ? resourceRange.max * 3 : resourceRange.max;
  const hoursToRegen = Math.floor(hoursSinceRegen);
  const regenAmount = Math.floor(maxResources * regenRate * hoursToRegen);
  const newMetal = Math.min(bot.resources.metal + regenAmount, maxResources);
  const newEnergy = Math.min(bot.resources.energy + regenAmount, maxResources);
  return { metal: newMetal, energy: newEnergy };
}

export function isBeerBaseRespawnTime(): boolean {
  const now = new Date();
  return now.getDay() === 0 && now.getHours() === 4;
}

export async function removeAllBeerBases(): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from('players')
    .delete({ count: 'exact' })
    .eq('is_bot', true)
    .eq('is_special_base', true);
  return count || 0;
}

export async function createBeerBaseBots(count: number): Promise<Partial<Player>[]> {
  const beerBases: Partial<Player>[] = [];
  for (let i = 0; i < count; i++) {
    const bot = await createBotPlayer(null, null, true);
    beerBases.push(bot);
  }
  return beerBases;
}
