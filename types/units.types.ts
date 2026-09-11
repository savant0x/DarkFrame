/**
 * @file types/units.types.ts
 * @created 2025-10-17
 * @overview Unit type definitions for the unit factory system
 */

/**
 * Unit rarity/tier levels
 */
export enum UnitRarity {
  Common = 1,      // ⭐
  Uncommon = 2,    // ⭐⭐
  Rare = 3,        // ⭐⭐⭐
  Epic = 4,        // ⭐⭐⭐⭐
  Legendary = 5    // ⭐⭐⭐⭐⭐
}

/**
 * Unit category (offense vs defense)
 */
export enum UnitCategory {
  Strength = 'strength',  // Offensive units
  Defense = 'defense'     // Defensive units
}

/**
 * Unit blueprint definition
 */
export interface UnitBlueprint {
  id: string;
  name: string;
  category: UnitCategory;
  rarity: UnitRarity;
  strength: number;      // STR value (0 if defensive unit)
  defense: number;       // DEF value (0 if offensive unit)
  metalCost: number;
  energyCost: number;
  description: string;
  unlockRequirement?: {
    researchPoints: number;
    level?: number;
  };
}

/**
 * Tech tree node
 */
export interface TechNode {
  id: string;
  name: string;
  description: string;
  cost: number;          // Research points required
  unlocks: string[];     // Unit IDs this unlocks
  prerequisites: string[]; // Tech node IDs required first
  isUnlocked: boolean;
}

/**
 * All available unit blueprints
 */
export const UNIT_BLUEPRINTS: Record<string, UnitBlueprint> = {
  // ========================================
  // STRENGTH UNITS (Offensive)
  // ========================================
  
  // Common STR Units (Tier 1) - 4 units
  'infantry': {
    id: 'infantry',
    name: 'Infantry',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Common,
    strength: 100,
    defense: 0,
    metalCost: 200,
    energyCost: 200,
    description: 'Basic ground troops. Reliable and affordable.',
  },
  
  'scout': {
    id: 'scout',
    name: 'Scout',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Common,
    strength: 80,
    defense: 0,
    metalCost: 150,
    energyCost: 250,
    description: 'Fast and agile reconnaissance unit.',
  },
  
  'militia': {
    id: 'militia',
    name: 'Militia',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Common,
    strength: 90,
    defense: 0,
    metalCost: 180,
    energyCost: 180,
    description: 'Volunteer fighters. Cost-effective basic troops.',
  },
  
  'rifleman': {
    id: 'rifleman',
    name: 'Rifleman',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Common,
    strength: 95,
    defense: 0,
    metalCost: 190,
    energyCost: 210,
    description: 'Standard infantry with rifles. Balanced firepower.',
  },
  
  // Uncommon STR Units (Tier 2) - 4 units
  'marksman': {
    id: 'marksman',
    name: 'Marksman',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Uncommon,
    strength: 250,
    defense: 0,
    metalCost: 510,
    energyCost: 400,
    description: 'Precision ranged attacker with high damage output.',
    unlockRequirement: { researchPoints: 50 }
  },
  
  'cavalry': {
    id: 'cavalry',
    name: 'Cavalry',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Uncommon,
    strength: 280,
    defense: 0,
    metalCost: 560,
    energyCost: 460,
    description: 'Mobile strike force. Fast and deadly.',
    unlockRequirement: { researchPoints: 50 }
  },
  
  'grenadier': {
    id: 'grenadier',
    name: 'Grenadier',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Uncommon,
    strength: 300,
    defense: 0,
    metalCost: 545,
    energyCost: 545,
    description: 'Explosive specialist. High area damage.',
    unlockRequirement: { researchPoints: 75 }
  },
  
  'saboteur': {
    id: 'saboteur',
    name: 'Saboteur',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Uncommon,
    strength: 260,
    defense: 0,
    metalCost: 460,
    energyCost: 490,
    description: 'Covert operative. Disrupts enemy infrastructure.',
    unlockRequirement: { researchPoints: 60 }
  },
  
  // Rare STR Units (Tier 3) - 4 units
  'sniper': {
    id: 'sniper',
    name: 'Sniper',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Rare,
    strength: 600,
    defense: 0,
    metalCost: 1070,
    energyCost: 900,
    description: 'Elite long-range assassin. One-shot elimination.',
    unlockRequirement: { researchPoints: 150, level: 3 }
  },
  
  'commando': {
    id: 'commando',
    name: 'Commando',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Rare,
    strength: 700,
    defense: 0,
    metalCost: 1280,
    energyCost: 1020,
    description: 'Special operations unit. Versatile and lethal.',
    unlockRequirement: { researchPoints: 200, level: 4 }
  },
  
  'artillery': {
    id: 'artillery',
    name: 'Artillery',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Rare,
    strength: 800,
    defense: 0,
    metalCost: 1430,
    energyCost: 1190,
    description: 'Heavy siege weapon. Devastating firepower.',
    unlockRequirement: { researchPoints: 250, level: 5 }
  },
  
  'bombardier': {
    id: 'bombardier',
    name: 'Bombardier',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Rare,
    strength: 650,
    defense: 0,
    metalCost: 1030,
    energyCost: 1100,
    description: 'Aerial bomber. Rains destruction from above.',
    unlockRequirement: { researchPoints: 180, level: 4 }
  },
  
  // Epic STR Units (Tier 4) - 4 units
  'tank': {
    id: 'tank',
    name: 'Battle Tank',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Epic,
    strength: 1500,
    defense: 0,
    metalCost: 2370,
    energyCost: 2040,
    description: 'Armored behemoth. Unstoppable offensive power.',
    unlockRequirement: { researchPoints: 500, level: 7 }
  },
  
  'bomber': {
    id: 'bomber',
    name: 'Bomber',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Epic,
    strength: 1800,
    defense: 0,
    metalCost: 2820,
    energyCost: 2470,
    description: 'Aerial devastation. Carpet bombing specialist.',
    unlockRequirement: { researchPoints: 600, level: 8 }
  },
  
  'juggernaut': {
    id: 'juggernaut',
    name: 'Juggernaut',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Epic,
    strength: 1600,
    defense: 0,
    metalCost: 2530,
    energyCost: 2180,
    description: 'Unstoppable heavy infantry. Crushes all opposition.',
    unlockRequirement: { researchPoints: 550, level: 7 }
  },
  
  'gunship': {
    id: 'gunship',
    name: 'Gunship',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Epic,
    strength: 1700,
    defense: 0,
    metalCost: 2710,
    energyCost: 2290,
    description: 'Attack helicopter. Mobile firepower platform.',
    unlockRequirement: { researchPoints: 580, level: 8 }
  },
  
  // Legendary STR Units (Tier 5) - 4 units
  'titan': {
    id: 'titan',
    name: 'Titan Mech',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Legendary,
    strength: 5000,
    defense: 0,
    metalCost: 7410,
    energyCost: 5920,
    description: 'Experimental war machine. Ultimate destruction.',
    unlockRequirement: { researchPoints: 1500, level: 10 }
  },
  
  'warlord': {
    id: 'warlord',
    name: 'Warlord',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Legendary,
    strength: 4500,
    defense: 0,
    metalCost: 6710,
    energyCost: 5290,
    description: 'Supreme commander unit. Inspires devastating attacks.',
    unlockRequirement: { researchPoints: 1400, level: 10 }
  },
  
  'dreadnought': {
    id: 'dreadnought',
    name: 'Dreadnought',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Legendary,
    strength: 5500,
    defense: 0,
    metalCost: 8070,
    energyCost: 6600,
    description: 'Legendary warship. Unmatched firepower.',
    unlockRequirement: { researchPoints: 1600, level: 11 }
  },
  
  'annihilator': {
    id: 'annihilator',
    name: 'Annihilator',
    category: UnitCategory.Strength,
    rarity: UnitRarity.Legendary,
    strength: 4800,
    defense: 0,
    metalCost: 7130,
    energyCost: 5670,
    description: 'Total warfare specialist. Leaves nothing behind.',
    unlockRequirement: { researchPoints: 1450, level: 10 }
  },
  
  // ========================================
  // DEFENSE UNITS (Defensive)
  // ========================================
  
  // Common DEF Units (Tier 1) - 4 units
  'barricade': {
    id: 'barricade',
    name: 'Barricade',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Common,
    strength: 0,
    defense: 100,
    metalCost: 200,
    energyCost: 200,
    description: 'Basic defensive structure. Simple but effective.',
  },
  
  'watchman': {
    id: 'watchman',
    name: 'Watchman',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Common,
    strength: 0,
    defense: 90,
    metalCost: 180,
    energyCost: 220,
    description: 'Alert sentry. Early warning system.',
  },
  
  'palisade': {
    id: 'palisade',
    name: 'Palisade',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Common,
    strength: 0,
    defense: 110,
    metalCost: 220,
    energyCost: 180,
    description: 'Wooden fortification. Sturdy barrier.',
  },
  
  'trench': {
    id: 'trench',
    name: 'Trench',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Common,
    strength: 0,
    defense: 95,
    metalCost: 190,
    energyCost: 210,
    description: 'Dug-in position. Protects from incoming fire.',
  },
  
  // Uncommon DEF Units (Tier 2) - 4 units
  'wall': {
    id: 'wall',
    name: 'Stone Wall',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Uncommon,
    strength: 0,
    defense: 250,
    metalCost: 510,
    energyCost: 400,
    description: 'Reinforced stone barrier. Solid protection.',
    unlockRequirement: { researchPoints: 50 }
  },
  
  'guardian': {
    id: 'guardian',
    name: 'Guardian',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Uncommon,
    strength: 0,
    defense: 280,
    metalCost: 530,
    energyCost: 490,
    description: 'Elite defensive unit. Protects key positions.',
    unlockRequirement: { researchPoints: 75 }
  },
  
  'turret': {
    id: 'turret',
    name: 'Auto-Turret',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Uncommon,
    strength: 0,
    defense: 300,
    metalCost: 570,
    energyCost: 520,
    description: 'Automated defense system. Constant vigilance.',
    unlockRequirement: { researchPoints: 100 }
  },
  
  'rampart': {
    id: 'rampart',
    name: 'Rampart',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Uncommon,
    strength: 0,
    defense: 260,
    metalCost: 460,
    energyCost: 490,
    description: 'Elevated defensive wall. Superior coverage.',
    unlockRequirement: { researchPoints: 60 }
  },
  
  // Rare DEF Units (Tier 3) - 4 units
  'bunker': {
    id: 'bunker',
    name: 'Bunker',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Rare,
    strength: 0,
    defense: 700,
    metalCost: 1280,
    energyCost: 1020,
    description: 'Reinforced concrete shelter. Near impenetrable.',
    unlockRequirement: { researchPoints: 200, level: 4 }
  },
  
  'fortress': {
    id: 'fortress',
    name: 'Fortress',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Rare,
    strength: 0,
    defense: 800,
    metalCost: 1430,
    energyCost: 1190,
    description: 'Massive defensive complex. Layers of protection.',
    unlockRequirement: { researchPoints: 250, level: 5 }
  },
  
  'sentinel': {
    id: 'sentinel',
    name: 'Sentinel Drone',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Rare,
    strength: 0,
    defense: 650,
    metalCost: 1030,
    energyCost: 1100,
    description: 'Advanced AI defender. Adaptive countermeasures.',
    unlockRequirement: { researchPoints: 220, level: 4 }
  },
  
  'pillbox': {
    id: 'pillbox',
    name: 'Pillbox',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Rare,
    strength: 0,
    defense: 600,
    metalCost: 1070,
    energyCost: 900,
    description: 'Fortified firing position. Concentrated defensive fire.',
    unlockRequirement: { researchPoints: 180, level: 3 }
  },
  
  // Epic DEF Units (Tier 4) - 4 units
  'citadel': {
    id: 'citadel',
    name: 'Citadel',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Epic,
    strength: 0,
    defense: 1800,
    metalCost: 2820,
    energyCost: 2470,
    description: 'Towering stronghold. Ultimate defensive position.',
    unlockRequirement: { researchPoints: 600, level: 8 }
  },
  
  'aegis': {
    id: 'aegis',
    name: 'Aegis Shield',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Epic,
    strength: 0,
    defense: 1600,
    metalCost: 2560,
    energyCost: 2150,
    description: 'Energy shield generator. Absorbs massive damage.',
    unlockRequirement: { researchPoints: 550, level: 7 }
  },
  
  'stronghold': {
    id: 'stronghold',
    name: 'Stronghold',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Epic,
    strength: 0,
    defense: 1700,
    metalCost: 2710,
    energyCost: 2290,
    description: 'Impregnable fortress. Withstands prolonged siege.',
    unlockRequirement: { researchPoints: 580, level: 8 }
  },
  
  'guardian_array': {
    id: 'guardian_array',
    name: 'Guardian Array',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Epic,
    strength: 0,
    defense: 1500,
    metalCost: 2370,
    energyCost: 2040,
    description: 'Networked defense system. Coordinated protection.',
    unlockRequirement: { researchPoints: 500, level: 7 }
  },
  
  // Legendary DEF Units (Tier 5) - 4 units
  'bastion': {
    id: 'bastion',
    name: 'Bastion Core',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Legendary,
    strength: 0,
    defense: 5000,
    metalCost: 7410,
    energyCost: 5920,
    description: 'Impenetrable fortress core. The last line of defense.',
    unlockRequirement: { researchPoints: 1500, level: 10 }
  },
  
  'colossus': {
    id: 'colossus',
    name: 'Colossus Wall',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Legendary,
    strength: 0,
    defense: 4500,
    metalCost: 6710,
    energyCost: 5290,
    description: 'Legendary defensive structure. Unbreakable barrier.',
    unlockRequirement: { researchPoints: 1400, level: 10 }
  },
  
  'sentinel_prime': {
    id: 'sentinel_prime',
    name: 'Sentinel Prime',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Legendary,
    strength: 0,
    defense: 5500,
    metalCost: 8070,
    energyCost: 6600,
    description: 'Ultimate AI defense. Perfect threat neutralization.',
    unlockRequirement: { researchPoints: 1600, level: 11 }
  },
  
  'invincible': {
    id: 'invincible',
    name: 'Invincible Fortress',
    category: UnitCategory.Defense,
    rarity: UnitRarity.Legendary,
    strength: 0,
    defense: 4800,
    metalCost: 7130,
    energyCost: 5670,
    description: 'Legendary stronghold. Absolute protection.',
    unlockRequirement: { researchPoints: 1450, level: 10 }
  },
};

/**
 * Canonical roster index (FID-20260909-033): the single tier order for the 40
 * combat units. game.types derives UNIT_CONFIGS from this — the enum key for
 * each id lives in UNIT_ID_TO_UNIT_TYPE below. Tech nodes are NOT units.
 */
export const UNIT_TIER_ORDER: Record<string, number> = {
  infantry: 1, scout: 1, militia: 1, rifleman: 1,
  marksman: 2, cavalry: 2, grenadier: 2, saboteur: 2,
  sniper: 3, commando: 3, artillery: 3, bombardier: 3,
  tank: 4, bomber: 4, juggernaut: 4, gunship: 4,
  titan: 5, warlord: 5, dreadnought: 5, annihilator: 5,
  barricade: 1, watchman: 1, palisade: 1, trench: 1,
  wall: 2, guardian: 2, turret: 2, rampart: 2,
  bunker: 3, fortress: 3, sentinel: 3, pillbox: 3,
  citadel: 4, aegis: 4, stronghold: 4, guardian_array: 4,
  bastion: 5, colossus: 5, sentinel_prime: 5, invincible: 5,
};

/**
 * Blueprint id → UnitType enum key (FID-20260909-033). UNIT_CONFIGS is DERIVED
 * from UNIT_BLUEPRINTS through this map: one roster, one set of stats. The enum
 * keys stay the integration vocabulary (combat modal, saves, bot pools).
 */
export const UNIT_ID_TO_UNIT_TYPE: Record<string, string> = {
  infantry: 'T1_Infantry',
  scout: 'T1_Scout',
  militia: 'T1_Militia',
  rifleman: 'T1_Rifleman',
  marksman: 'T2_Marksman',
  cavalry: 'T2_Cavalry',
  grenadier: 'T2_Grenadier',
  saboteur: 'T2_Saboteur',
  sniper: 'T3_Sniper',
  commando: 'T3_Commando',
  artillery: 'T3_Artillery',
  bombardier: 'T3_Bombardier',
  tank: 'T4_Tank',
  bomber: 'T4_Bomber',
  juggernaut: 'T4_Juggernaut',
  gunship: 'T4_Gunship',
  titan: 'T5_Titan',
  warlord: 'T5_Warlord',
  dreadnought: 'T5_Dreadnought',
  annihilator: 'T5_Annihilator',
  barricade: 'T1_Barricade',
  watchman: 'T1_Watchman',
  palisade: 'T1_Palisade',
  trench: 'T1_Trench',
  wall: 'T2_Wall',
  guardian: 'T2_Guardian',
  turret: 'T2_Turret',
  rampart: 'T2_Rampart',
  bunker: 'T3_Bunker',
  fortress: 'T3_Fortress',
  sentinel: 'T3_Sentinel',
  pillbox: 'T3_Pillbox',
  citadel: 'T4_Citadel',
  aegis: 'T4_Aegis',
  stronghold: 'T4_Stronghold',
  guardian_array: 'T4_GuardianArray',
  bastion: 'T5_Bastion',
  colossus: 'T5_Colossus',
  sentinel_prime: 'T5_SentinelPrime',
  invincible: 'T5_Invincible',
};


/**
 * Tech tree definition
 */
export const TECH_TREE: Record<string, TechNode> = {
  'basic_training': {
    id: 'basic_training',
    name: 'Basic Training',
    description: 'Unlock Tier 2 offensive units',
    cost: 50,
    unlocks: ['marksman', 'cavalry'],
    prerequisites: [],
    isUnlocked: false
  },
  
  'advanced_weapons': {
    id: 'advanced_weapons',
    name: 'Advanced Weapons',
    description: 'Unlock explosive specialists',
    cost: 75,
    unlocks: ['grenadier'],
    prerequisites: ['basic_training'],
    isUnlocked: false
  },
  
  'elite_forces': {
    id: 'elite_forces',
    name: 'Elite Forces',
    description: 'Unlock Tier 3 special operations',
    cost: 150,
    unlocks: ['sniper', 'commando'],
    prerequisites: ['advanced_weapons'],
    isUnlocked: false
  },
  
  'heavy_artillery': {
    id: 'heavy_artillery',
    name: 'Heavy Artillery',
    description: 'Unlock siege weapons',
    cost: 250,
    unlocks: ['artillery'],
    prerequisites: ['elite_forces'],
    isUnlocked: false
  },
  
  'mechanized_warfare': {
    id: 'mechanized_warfare',
    name: 'Mechanized Warfare',
    description: 'Unlock Tier 4 vehicles',
    cost: 500,
    unlocks: ['tank', 'bomber'],
    prerequisites: ['heavy_artillery'],
    isUnlocked: false
  },
  
  'titan_project': {
    id: 'titan_project',
    name: 'Project Titan',
    description: 'Unlock ultimate weapon',
    cost: 1500,
    unlocks: ['titan'],
    prerequisites: ['mechanized_warfare'],
    isUnlocked: false
  },
  
  // Defense Tech Tree
  'fortification': {
    id: 'fortification',
    name: 'Fortification',
    description: 'Unlock Tier 2 defensive structures',
    cost: 50,
    unlocks: ['wall'],
    prerequisites: [],
    isUnlocked: false
  },
  
  'defensive_positions': {
    id: 'defensive_positions',
    name: 'Defensive Positions',
    description: 'Unlock advanced defenses',
    cost: 75,
    unlocks: ['guardian'],
    prerequisites: ['fortification'],
    isUnlocked: false
  },
  
  'automated_defense': {
    id: 'automated_defense',
    name: 'Automated Defense',
    description: 'Unlock AI-controlled turrets',
    cost: 100,
    unlocks: ['turret'],
    prerequisites: ['defensive_positions'],
    isUnlocked: false
  },
  
  'hardened_structures': {
    id: 'hardened_structures',
    name: 'Hardened Structures',
    description: 'Unlock Tier 3 fortifications',
    cost: 200,
    unlocks: ['bunker', 'sentinel'],
    prerequisites: ['automated_defense'],
    isUnlocked: false
  },
  
  'fortress_engineering': {
    id: 'fortress_engineering',
    name: 'Fortress Engineering',
    description: 'Unlock massive defensive complexes',
    cost: 250,
    unlocks: ['fortress'],
    prerequisites: ['hardened_structures'],
    isUnlocked: false
  },
  
  'advanced_defense': {
    id: 'advanced_defense',
    name: 'Advanced Defense Systems',
    description: 'Unlock Tier 4 defensive technology',
    cost: 550,
    unlocks: ['aegis', 'citadel'],
    prerequisites: ['fortress_engineering'],
    isUnlocked: false
  },
  
  'bastion_protocol': {
    id: 'bastion_protocol',
    name: 'Bastion Protocol',
    description: 'Unlock ultimate defense',
    cost: 1500,
    unlocks: ['bastion'],
    prerequisites: ['advanced_defense'],
    isUnlocked: false
  },
};
