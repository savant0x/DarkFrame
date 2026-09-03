/**
 * @file types/wmd/research.types.ts
 * @created 2025-10-22
 * @overview WMD Research System Type Definitions
 * 
 * OVERVIEW:
 * Complete type system for WMD research tech tree including missile tiers,
 * defense tiers, spy tiers, and research progression tracking.
 * 
 * Features:
 * - 10-tier research progression (3 parallel tracks)
 * - RP cost scaling and prerequisites
 * - Tech unlock validation
 * - Research progress tracking
 * - Clan research bonuses
 * 
 * Dependencies:
 * - /lib/xpService.ts for RP spending (REUSE EXISTING)
 * - MongoDB for data persistence
 */

import { ObjectId } from 'mongodb';
import { WarheadType } from './missile.types';
import { BatteryType, RadarLevel } from './defense.types';
import { MissionType, SpyRank } from './intelligence.types';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Research categories
 */
export enum ResearchCategory {
  MISSILE = 'MISSILE',             // Offensive capabilities
  DEFENSE = 'DEFENSE',             // Defensive systems
  INTELLIGENCE = 'INTELLIGENCE',   // Spy operations
}

/**
 * Research status
 */
export enum ResearchStatus {
  LOCKED = 'LOCKED',               // Prerequisites not met
  AVAILABLE = 'AVAILABLE',         // Can be researched
  RESEARCHING = 'RESEARCHING',     // Currently being researched
  COMPLETED = 'COMPLETED',         // Unlocked
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Main research tech document
 */
export interface ResearchTech {
  techId: string;                  // Unique identifier (e.g., 'missile_tier_1')
  name: string;
  description: string;
  category: ResearchCategory;
  tier: number;                    // 1-10
  
  // Prerequisites
  prerequisites: string[];         // Tech IDs that must be completed first
  requiredLevel?: number;          // Player level requirement
  requiredClanLevel?: number;      // Clan level requirement
  
  // Cost
  rpCost: number;                  // Research Points required
  
  // Unlocks
  unlocks: {
    warheadTypes?: WarheadType[];
    batteryTypes?: BatteryType[];
    radarLevels?: RadarLevel[];
    missionTypes?: MissionType[];
    spyRanks?: SpyRank[];
  };
  
  // Metadata
  estimatedTime: string;           // Human-readable (e.g., "2 days")
}

/**
 * Player research progress
 */
export interface PlayerResearch {
  _id?: ObjectId;
  playerId: string;
  playerUsername: string;
  clanId?: string;
  
  // Research tracking
  completedTechs: string[];        // Array of techId
  availableTechs: string[];        // Techs that can be researched now
  lockedTechs: string[];           // Techs with unmet prerequisites
  
  // Current research
  currentResearch?: {
    techId: string;
    startedAt: Date;
    rpSpent: number;
    rpRequired: number;
    progress: number;              // Percentage (0-100)
  };
  
  // Stats by category
  missileTier: number;             // Highest missile tier unlocked (0-10)
  defenseTier: number;             // Highest defense tier unlocked (0-10)
  intelligenceTier: number;        // Highest spy tier unlocked (0-10)
  
  // Total investment
  totalRPSpent: number;
  totalTechsUnlocked: number;
  
  // Bonuses
  clanResearchBonus: number;       // Percentage bonus from clan
  
  updatedAt: Date;
}

/**
 * Research unlock request
 */
export interface ResearchUnlockRequest {
  playerId: string;
  techId: string;
}

/**
 * Research unlock result
 */
export interface ResearchUnlockResult {
  success: boolean;
  techId: string;
  techName: string;
  rpSpent: number;
  unlocked: {
    warheadTypes?: WarheadType[];
    batteryTypes?: BatteryType[];
    radarLevels?: RadarLevel[];
    missionTypes?: MissionType[];
    spyRanks?: SpyRank[];
  };
  newAvailableTechs: string[];
  message: string;
}

/**
 * Tech tree summary
 */
export interface TechTreeSummary {
  playerId: string;
  
  // Missile track (10 tiers)
  missileProgress: {
    tier: number;
    nextTier?: ResearchTech;
    unlocked: WarheadType[];
    locked: WarheadType[];
  };
  
  // Defense track (10 tiers)
  defenseProgress: {
    tier: number;
    nextTier?: ResearchTech;
    unlocked: BatteryType[];
    locked: BatteryType[];
  };
  
  // Intelligence track (10 tiers)
  intelligenceProgress: {
    tier: number;
    nextTier?: ResearchTech;
    unlocked: MissionType[];
    locked: MissionType[];
  };
  
  // Overall
  totalTechs: number;
  completedTechs: number;
  availableTechs: number;
  totalRPSpent: number;
  totalRPNeeded: number;           // To unlock everything
}

/**
 * Research validation result
 */
export interface ResearchValidation {
  canResearch: boolean;
  techId: string;
  techName: string;
  
  // Validation checks
  hasPrerequisites: boolean;
  meetsLevelRequirement: boolean;
  hasEnoughRP: boolean;
  
  // Details
  missingPrerequisites: string[];
  currentLevel: number;
  requiredLevel: number;
  currentRP: number;
  requiredRP: number;
  
  message: string;
}

// ============================================================================
// CONSTANTS - MISSILE RESEARCH TRACK (10 TIERS)
// ============================================================================

export const MISSILE_RESEARCH_TRACK: ResearchTech[] = [
  {
    techId: 'missile_tier_1',
    name: 'Tactical Missile Technology',
    description: 'Unlock Tactical Warheads (25% damage, single target)',
    category: ResearchCategory.MISSILE,
    tier: 1,
    prerequisites: [],
    requiredLevel: 40,
    rpCost: 10000,
    unlocks: {
      warheadTypes: [WarheadType.TACTICAL],
    },
    estimatedTime: '1 day',
  },
  {
    techId: 'missile_tier_2',
    name: 'Improved Propulsion',
    description: 'Reduce missile flight time by 15%',
    category: ResearchCategory.MISSILE,
    tier: 2,
    prerequisites: ['missile_tier_1'],
    rpCost: 15000,
    unlocks: {},
    estimatedTime: '1.5 days',
  },
  {
    techId: 'missile_tier_3',
    name: 'Advanced Guidance Systems',
    description: 'Increase targeting accuracy by 20%',
    category: ResearchCategory.MISSILE,
    tier: 3,
    prerequisites: ['missile_tier_2'],
    rpCost: 20000,
    unlocks: {},
    estimatedTime: '2 days',
  },
  {
    techId: 'missile_tier_4',
    name: 'Hardened Warheads',
    description: 'Missiles gain +10% intercept resistance',
    category: ResearchCategory.MISSILE,
    tier: 4,
    prerequisites: ['missile_tier_3'],
    rpCost: 30000,
    unlocks: {},
    estimatedTime: '3 days',
  },
  {
    techId: 'missile_tier_5',
    name: 'Strategic Missile Technology',
    description: 'Unlock Strategic Warheads (50% damage, single target)',
    category: ResearchCategory.MISSILE,
    tier: 5,
    prerequisites: ['missile_tier_4'],
    rpCost: 50000,
    unlocks: {
      warheadTypes: [WarheadType.STRATEGIC],
    },
    estimatedTime: '5 days',
  },
  {
    techId: 'missile_tier_6',
    name: 'Miniaturization Technology',
    description: 'Reduce component costs by 15%',
    category: ResearchCategory.MISSILE,
    tier: 6,
    prerequisites: ['missile_tier_5'],
    rpCost: 75000,
    unlocks: {},
    estimatedTime: '7 days',
  },
  {
    techId: 'missile_tier_7',
    name: 'Neutron Bomb Technology',
    description: 'Unlock Neutron Warheads (60% damage, preserves resources)',
    category: ResearchCategory.MISSILE,
    tier: 7,
    prerequisites: ['missile_tier_6'],
    rpCost: 100000,
    unlocks: {
      warheadTypes: [WarheadType.NEUTRON],
    },
    estimatedTime: '10 days',
  },
  {
    techId: 'missile_tier_8',
    name: 'MIRV Technology',
    description: 'Unlock Cluster Warheads (40%+20% damage, 5 targets)',
    category: ResearchCategory.MISSILE,
    tier: 8,
    prerequisites: ['missile_tier_7'],
    rpCost: 150000,
    unlocks: {
      warheadTypes: [WarheadType.CLUSTER],
    },
    estimatedTime: '15 days',
  },
  {
    techId: 'missile_tier_9',
    name: 'Advanced MIRV Systems',
    description: 'Cluster warheads can hit 10 targets (was 5)',
    category: ResearchCategory.MISSILE,
    tier: 9,
    prerequisites: ['missile_tier_8'],
    rpCost: 200000,
    unlocks: {},
    estimatedTime: '20 days',
  },
  {
    techId: 'missile_tier_10',
    name: 'Clan Buster Technology',
    description: 'Unlock Clan Buster Warheads (50%+30%+20% damage, entire clan)',
    category: ResearchCategory.MISSILE,
    tier: 10,
    prerequisites: ['missile_tier_9'],
    requiredClanLevel: 5,
    rpCost: 300000,
    unlocks: {
      warheadTypes: [WarheadType.CLAN_BUSTER],
    },
    estimatedTime: '30 days',
  },
];

// ============================================================================
// CONSTANTS - DEFENSE RESEARCH TRACK (10 TIERS)
// ============================================================================

export const DEFENSE_RESEARCH_TRACK: ResearchTech[] = [
  {
    techId: 'defense_tier_1',
    name: 'Basic Defense Systems',
    description: 'Unlock Basic Batteries (10% intercept chance)',
    category: ResearchCategory.DEFENSE,
    tier: 1,
    prerequisites: [],
    requiredLevel: 40,
    rpCost: 10000,
    unlocks: {
      batteryTypes: [BatteryType.BASIC],
    },
    estimatedTime: '1 day',
  },
  {
    techId: 'defense_tier_2',
    name: 'Local Radar Systems',
    description: 'Unlock Local Radar (30s warning, 50 tile range)',
    category: ResearchCategory.DEFENSE,
    tier: 2,
    prerequisites: ['defense_tier_1'],
    rpCost: 15000,
    unlocks: {
      radarLevels: [RadarLevel.LOCAL],
    },
    estimatedTime: '1.5 days',
  },
  {
    techId: 'defense_tier_3',
    name: 'Advanced Defense Systems',
    description: 'Unlock Advanced Batteries (25% intercept chance)',
    category: ResearchCategory.DEFENSE,
    tier: 3,
    prerequisites: ['defense_tier_2'],
    rpCost: 20000,
    unlocks: {
      batteryTypes: [BatteryType.ADVANCED],
    },
    estimatedTime: '2 days',
  },
  {
    techId: 'defense_tier_4',
    name: 'Battery Automation',
    description: 'Reduce battery cooldown by 20%',
    category: ResearchCategory.DEFENSE,
    tier: 4,
    prerequisites: ['defense_tier_3'],
    rpCost: 30000,
    unlocks: {},
    estimatedTime: '3 days',
  },
  {
    techId: 'defense_tier_5',
    name: 'Elite Defense Systems',
    description: 'Unlock Elite Batteries (40% intercept chance) + Regional Radar',
    category: ResearchCategory.DEFENSE,
    tier: 5,
    prerequisites: ['defense_tier_4'],
    rpCost: 50000,
    unlocks: {
      batteryTypes: [BatteryType.ELITE],
      radarLevels: [RadarLevel.REGIONAL],
    },
    estimatedTime: '5 days',
  },
  {
    techId: 'defense_tier_6',
    name: 'Hardened Installations',
    description: 'Batteries resist sabotage (50% damage reduction)',
    category: ResearchCategory.DEFENSE,
    tier: 6,
    prerequisites: ['defense_tier_5'],
    rpCost: 75000,
    unlocks: {},
    estimatedTime: '7 days',
  },
  {
    techId: 'defense_tier_7',
    name: 'Fortress Defense Systems',
    description: 'Unlock Fortress Batteries (60% intercept chance)',
    category: ResearchCategory.DEFENSE,
    tier: 7,
    prerequisites: ['defense_tier_6'],
    rpCost: 100000,
    unlocks: {
      batteryTypes: [BatteryType.FORTRESS],
    },
    estimatedTime: '10 days',
  },
  {
    techId: 'defense_tier_8',
    name: 'Global Surveillance Network',
    description: 'Unlock Global Radar (90s warning, unlimited range, sees stealth)',
    category: ResearchCategory.DEFENSE,
    tier: 8,
    prerequisites: ['defense_tier_7'],
    rpCost: 150000,
    unlocks: {
      radarLevels: [RadarLevel.GLOBAL],
    },
    estimatedTime: '15 days',
  },
  {
    techId: 'defense_tier_9',
    name: 'Directed Energy Weapons',
    description: 'Batteries gain +15% intercept chance',
    category: ResearchCategory.DEFENSE,
    tier: 9,
    prerequisites: ['defense_tier_8'],
    rpCost: 200000,
    unlocks: {},
    estimatedTime: '20 days',
  },
  {
    techId: 'defense_tier_10',
    name: 'AEGIS Defense System',
    description: 'Unlock AEGIS Batteries (80% intercept, partial damage reduction)',
    category: ResearchCategory.DEFENSE,
    tier: 10,
    prerequisites: ['defense_tier_9'],
    requiredClanLevel: 5,
    rpCost: 300000,
    unlocks: {
      batteryTypes: [BatteryType.AEGIS],
    },
    estimatedTime: '30 days',
  },
];

// ============================================================================
// CONSTANTS - INTELLIGENCE RESEARCH TRACK (10 TIERS)
// ============================================================================

export const INTELLIGENCE_RESEARCH_TRACK: ResearchTech[] = [
  {
    techId: 'spy_tier_1',
    name: 'Basic Espionage',
    description: 'Unlock Reconnaissance missions',
    category: ResearchCategory.INTELLIGENCE,
    tier: 1,
    prerequisites: [],
    requiredLevel: 40,
    rpCost: 10000,
    unlocks: {
      missionTypes: [MissionType.RECONNAISSANCE],
    },
    estimatedTime: '1 day',
  },
  {
    techId: 'spy_tier_2',
    name: 'Surveillance Techniques',
    description: 'Unlock Surveillance missions',
    category: ResearchCategory.INTELLIGENCE,
    tier: 2,
    prerequisites: ['spy_tier_1'],
    rpCost: 15000,
    unlocks: {
      missionTypes: [MissionType.SURVEILLANCE],
    },
    estimatedTime: '1.5 days',
  },
  {
    techId: 'spy_tier_3',
    name: 'Counter-Intelligence Operations',
    description: 'Unlock Counter-Intelligence missions',
    category: ResearchCategory.INTELLIGENCE,
    tier: 3,
    prerequisites: ['spy_tier_2'],
    rpCost: 20000,
    unlocks: {
      missionTypes: [MissionType.COUNTER_INTELLIGENCE],
      spyRanks: [SpyRank.OPERATIVE],
    },
    estimatedTime: '2 days',
  },
  {
    techId: 'spy_tier_4',
    name: 'Infiltration Training',
    description: 'Unlock Infiltration missions',
    category: ResearchCategory.INTELLIGENCE,
    tier: 4,
    prerequisites: ['spy_tier_3'],
    rpCost: 30000,
    unlocks: {
      missionTypes: [MissionType.INFILTRATION],
    },
    estimatedTime: '3 days',
  },
  {
    techId: 'spy_tier_5',
    name: 'Sabotage Techniques',
    description: 'Unlock Light Sabotage missions',
    category: ResearchCategory.INTELLIGENCE,
    tier: 5,
    prerequisites: ['spy_tier_4'],
    rpCost: 50000,
    unlocks: {
      missionTypes: [MissionType.SABOTAGE_LIGHT],
      spyRanks: [SpyRank.AGENT],
    },
    estimatedTime: '5 days',
  },
  {
    techId: 'spy_tier_6',
    name: 'Information Warfare',
    description: 'Unlock Intelligence Leak missions',
    category: ResearchCategory.INTELLIGENCE,
    tier: 6,
    prerequisites: ['spy_tier_5'],
    rpCost: 75000,
    unlocks: {
      missionTypes: [MissionType.INTELLIGENCE_LEAK],
    },
    estimatedTime: '7 days',
  },
  {
    techId: 'spy_tier_7',
    name: 'Advanced Sabotage',
    description: 'Unlock Heavy Sabotage missions',
    category: ResearchCategory.INTELLIGENCE,
    tier: 7,
    prerequisites: ['spy_tier_6'],
    rpCost: 100000,
    unlocks: {
      missionTypes: [MissionType.SABOTAGE_HEAVY],
    },
    estimatedTime: '10 days',
  },
  {
    techId: 'spy_tier_8',
    name: 'Corporate Espionage',
    description: 'Unlock Research Theft missions',
    category: ResearchCategory.INTELLIGENCE,
    tier: 8,
    prerequisites: ['spy_tier_7'],
    rpCost: 150000,
    unlocks: {
      missionTypes: [MissionType.THEFT],
      spyRanks: [SpyRank.VETERAN],
    },
    estimatedTime: '15 days',
  },
  {
    techId: 'spy_tier_9',
    name: 'Wetwork Operations',
    description: 'Unlock Assassination missions',
    category: ResearchCategory.INTELLIGENCE,
    tier: 9,
    prerequisites: ['spy_tier_8'],
    rpCost: 200000,
    unlocks: {
      missionTypes: [MissionType.ASSASSINATION],
    },
    estimatedTime: '20 days',
  },
  {
    techId: 'spy_tier_10',
    name: 'Total Warfare',
    description: 'Unlock Nuclear Sabotage missions (destroy ALL components)',
    category: ResearchCategory.INTELLIGENCE,
    tier: 10,
    prerequisites: ['spy_tier_9'],
    requiredClanLevel: 5,
    rpCost: 300000,
    unlocks: {
      missionTypes: [MissionType.SABOTAGE_NUCLEAR],
      spyRanks: [SpyRank.ELITE],
    },
    estimatedTime: '30 days',
  },
];

// ============================================================================
// AGGREGATED CONSTANTS
// ============================================================================

/**
 * All research techs combined
 */
export const ALL_RESEARCH_TECHS: ResearchTech[] = [
  ...MISSILE_RESEARCH_TRACK,
  ...DEFENSE_RESEARCH_TRACK,
  ...INTELLIGENCE_RESEARCH_TRACK,
];

/**
 * Research techs by category
 */
export const RESEARCH_BY_CATEGORY: Record<ResearchCategory, ResearchTech[]> = {
  [ResearchCategory.MISSILE]: MISSILE_RESEARCH_TRACK,
  [ResearchCategory.DEFENSE]: DEFENSE_RESEARCH_TRACK,
  [ResearchCategory.INTELLIGENCE]: INTELLIGENCE_RESEARCH_TRACK,
};

/**
 * Total RP required to unlock everything
 */
export const TOTAL_RP_REQUIRED = ALL_RESEARCH_TECHS.reduce(
  (sum, tech) => sum + tech.rpCost,
  0
); // 2,700,000 RP total (900k per track)

/**
 * RP required per category
 */
export const RP_BY_CATEGORY = {
  [ResearchCategory.MISSILE]: 900000,
  [ResearchCategory.DEFENSE]: 900000,
  [ResearchCategory.INTELLIGENCE]: 900000,
} as const;

// ============================================================================
// TYPE GUARDS & UTILITIES
// ============================================================================

/**
 * Check if tech ID is valid
 */
export function isValidTechId(techId: string): boolean {
  return ALL_RESEARCH_TECHS.some(tech => tech.techId === techId);
}

/**
 * Get tech by ID
 */
export function getTechById(techId: string): ResearchTech | undefined {
  return ALL_RESEARCH_TECHS.find(tech => tech.techId === techId);
}

/**
 * Get techs by category
 */
export function getTechsByCategory(category: ResearchCategory): ResearchTech[] {
  return RESEARCH_BY_CATEGORY[category];
}

/**
 * Get prerequisite chain for a tech
 */
export function getPrerequisiteChain(techId: string): string[] {
  const tech = getTechById(techId);
  if (!tech || tech.prerequisites.length === 0) return [];
  
  const chain: string[] = [];
  for (const prereq of tech.prerequisites) {
    chain.push(prereq);
    chain.push(...getPrerequisiteChain(prereq));
  }
  
  return Array.from(new Set(chain)); // Remove duplicates
}

/**
 * Check if player has prerequisites for a tech
 */
export function hasPrerequisites(
  techId: string,
  completedTechs: string[]
): boolean {
  const tech = getTechById(techId);
  if (!tech) return false;
  
  return tech.prerequisites.every(prereq => completedTechs.includes(prereq));
}

/**
 * Get next available techs for a player
 */
export function getAvailableTechs(completedTechs: string[]): ResearchTech[] {
  return ALL_RESEARCH_TECHS.filter(tech => {
    // Skip already completed
    if (completedTechs.includes(tech.techId)) return false;
    
    // Check prerequisites
    return hasPrerequisites(tech.techId, completedTechs);
  });
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * 1. Research Tracks:
 *    - MISSILE: 10 tiers, 900k RP total
 *    - DEFENSE: 10 tiers, 900k RP total
 *    - INTELLIGENCE: 10 tiers, 900k RP total
 *    - TOTAL: 2.7M RP to unlock everything
 * 
 * 2. Tier 10 Requirements:
 *    - Clan Buster: 300k RP + Clan Level 5
 *    - AEGIS: 300k RP + Clan Level 5
 *    - Nuclear Sabotage: 300k RP + Clan Level 5
 *    (High-end content requires clan membership)
 * 
 * 3. RP Cost Progression:
 *    - Tier 1: 10k RP (1 day with full auto-farm)
 *    - Tier 5: 50k RP (5 days)
 *    - Tier 10: 300k RP (30 days)
 *    - Total: 2.7M RP (270 days to unlock everything)
 * 
 * 4. Integration with Existing System:
 *    - Reuses /lib/xpService.ts spendResearchPoints() function
 *    - Pattern: await spendResearchPoints(userId, tech.rpCost, 'WMD Research: ${tech.name}')
 *    - No changes to existing RP system needed
 * 
 * 5. Parallel Progression:
 *    - Players can research all 3 tracks simultaneously
 *    - No cross-track dependencies (missile ≠ defense ≠ intel)
 *    - Encourages specialization or balanced approach
 * 
 * 6. Clan Research Bonuses:
 *    - Clan perks can reduce RP costs by 10-20%
 *    - Clan research can unlock shared techs
 *    - High-tier techs require clan membership
 */

// ============================================================================
// END OF FILE
// ============================================================================

