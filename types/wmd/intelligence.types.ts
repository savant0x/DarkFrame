/**
 * @file types/wmd/intelligence.types.ts
 * @created 2025-10-22
 * @overview WMD Intelligence Operations Type Definitions
 * 
 * OVERVIEW:
 * Complete type system for spy operations including mission types, sabotage
 * mechanics, intelligence gathering, and counter-intelligence measures.
 * 
 * Features:
 * - 10 mission types (reconnaissance to assassination)
 * - Sabotage engine with component destruction
 * - Intelligence leak probability system
 * - Counter-intelligence operations
 * - Spy network management
 * 
 * Dependencies:
 * - missile.types.ts for target references
 * - MongoDB for data persistence
 */

type ObjectId = string;
import { MissileComponent, WarheadType } from './missile.types';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Spy mission types
 */
export enum MissionType {
  RECONNAISSANCE = 'RECONNAISSANCE',           // Gather basic target info
  SURVEILLANCE = 'SURVEILLANCE',               // Monitor target activity
  INFILTRATION = 'INFILTRATION',               // Gain access to target systems
  SABOTAGE_LIGHT = 'SABOTAGE_LIGHT',           // Delay 1 component
  SABOTAGE_HEAVY = 'SABOTAGE_HEAVY',           // Destroy 1 component
  SABOTAGE_NUCLEAR = 'SABOTAGE_NUCLEAR',       // Destroy all components
  INTELLIGENCE_LEAK = 'INTELLIGENCE_LEAK',     // Reveal missile details to public
  COUNTER_INTELLIGENCE = 'COUNTER_INTELLIGENCE', // Protect against spies
  ASSASSINATION = 'ASSASSINATION',             // Kill enemy spy
  THEFT = 'THEFT',                             // Steal research data
}

/**
 * Mission status lifecycle
 */
export enum MissionStatus {
  PLANNING = 'PLANNING',           // Being prepared
  ACTIVE = 'ACTIVE',               // In progress
  COMPLETED = 'COMPLETED',         // Successfully finished
  FAILED = 'FAILED',               // Mission failed
  COMPROMISED = 'COMPROMISED',     // Discovered and stopped
  CANCELLED = 'CANCELLED',         // Manually aborted
}

/**
 * Spy agent ranks
 */
export enum SpyRank {
  ROOKIE = 'ROOKIE',               // 30% success rate
  OPERATIVE = 'OPERATIVE',         // 50% success rate
  AGENT = 'AGENT',                 // 70% success rate
  VETERAN = 'VETERAN',             // 85% success rate
  ELITE = 'ELITE',                 // 95% success rate
}

/**
 * Intelligence classification levels
 */
export enum IntelLevel {
  UNCLASSIFIED = 'UNCLASSIFIED',   // Public information
  CONFIDENTIAL = 'CONFIDENTIAL',   // Restricted access
  SECRET = 'SECRET',               // Highly restricted
  TOP_SECRET = 'TOP_SECRET',       // Maximum security
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Main spy mission document
 */
export interface SpyMission {
  _id?: ObjectId;
  missionId: string;               // Unique identifier
  ownerId: string;                 // Player who ordered mission
  ownerClanId: string;             // Owner's clan ID
  
  // Mission details
  missionType: MissionType;
  status: MissionStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  // Target information
  targetId: string;                // Player or clan being spied on
  targetType: 'player' | 'clan';
  targetName: string;
  
  // Spy agent
  spyId: string;
  spyName: string;
  spyRank: SpyRank;
  
  // Mission execution
  startTime: Date;
  estimatedCompletion: Date;
  actualCompletion?: Date;
  duration: number;                // Milliseconds
  
  // Success calculation
  baseSuccessChance: number;       // From spy rank
  modifiers: {
    targetSecurity: number;        // Target's counter-intel strength
    clanBonus: number;             // Clan intel support
    equipmentBonus: number;        // Spy equipment quality
  };
  finalSuccessChance: number;
  roll?: number;                   // Random roll (0-1)
  successful?: boolean;
  
  // Mission outcome
  result?: MissionResult;
  intelligenceGathered?: IntelligenceReport;
  sabotageDamage?: SabotageDamage;
  
  // Detection risk
  detectionRisk: number;           // Probability (0-1)
  detected: boolean;
  detectedBy?: string;
  detectedAt?: Date;
  
  // Cost
  cost: {
    metal: number;
    energy: number;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mission result summary
 */
export interface MissionResult {
  success: boolean;
  missionType: MissionType;
  outcome: string;                 // Human-readable description
  
  // Specific results based on mission type
  reconnaissance?: {
    targetLevel: number;
    targetPower: number;
    missileCount: number;
    defenseStrength: number;
  };
  
  surveillance?: {
    recentActivity: string[];
    missileProgress: number;       // Percentage
    vulnerabilities: string[];
  };
  
  sabotage?: {
    componentsDestroyed: MissileComponent[];
    missileDelayed: boolean;
    delayDuration?: number;        // Milliseconds
  };
  
  intelligenceLeak?: {
    missileId: string;
    warheadType: WarheadType;
    publicNotificationId: string;
    leakedData: string[];
  };
  
  counterIntel?: {
    enemySpiesDetected: number;
    enemyMissionsThwarted: number;
    securityStrength: number;
  };
  
  theft?: {
    researchStolen: number;        // RP stolen
    techsRevealed: string[];
  };
  
  assassination?: {
    spyKilled: string;
    spyRank: SpyRank;
    retaliation: boolean;
  };
}

/**
 * Intelligence report from reconnaissance
 */
export interface IntelligenceReport {
  _id?: ObjectId;
  reportId: string;
  classification: IntelLevel;
  
  // Source
  gatheredBy: string;              // Spy who gathered intel
  gatheredFrom: string;            // Target
  gatheredAt: Date;
  missionId: string;
  
  // Target intelligence
  target: {
    id: string;
    username: string;
    level: number;
    power: number;
    clanId?: string;
    clanName?: string;
  };
  
  // WMD intelligence
  wmdCapabilities: {
    missiles: Array<{
      missileId: string;
      warheadType: WarheadType;
      progress: number;            // Percentage
      estimatedCompletion?: Date;
    }>;
    defenseBatteries: number;
    radarLevel: string;
    combinedDefenseStrength: number;
  };
  
  // Strategic intelligence
  vulnerabilities: string[];
  threats: string[];
  recommendations: string[];
  
  // Expiration
  expiresAt: Date;                 // Intel goes stale
  
  createdAt: Date;
}

/**
 * Sabotage damage record
 */
export interface SabotageDamage {
  _id?: ObjectId;
  sabotageId: string;
  missionId: string;
  saboteurId: string;              // Spy who executed
  saboteurName: string;
  
  // Target
  targetId: string;
  targetUsername: string;
  missileId: string;
  
  // Damage dealt
  componentsDestroyed: MissileComponent[];
  componentsDelayed: MissileComponent[];
  delayDuration: number;           // Milliseconds
  
  // Impact
  progressLost: number;            // Percentage
  resourcesWasted: {
    metal: number;
    energy: number;
  };
  
  // Detection
  detected: boolean;
  detectedAt?: Date;
  detectedBy?: string;
  
  executedAt: Date;
}

/**
 * Intelligence leak notification
 */
export interface IntelligenceLeak {
  _id?: ObjectId;
  leakId: string;
  leakedBy: string;                // Spy who leaked
  leakedFrom: string;              // Target whose intel leaked
  
  // Leaked information
  missileId: string;
  warheadType: WarheadType;
  progress: number;
  estimatedCompletion?: Date;
  targetId?: string;               // Missile's intended target
  
  // Public exposure
  globalNotificationSent: boolean;
  notificationId?: string;
  
  // Consequences
  publicPressure: number;          // 0-100 (higher = more pressure)
  diplomaticIncident: boolean;
  
  leakedAt: Date;
}

/**
 * Spy agent profile
 */
export interface SpyAgent {
  _id?: ObjectId;
  spyId: string;
  spyName: string;                 // Code name
  ownerId: string;                 // Player who owns spy
  ownerClanId: string;
  
  // Rank and experience
  rank: SpyRank;
  experience: number;              // XP for promotions
  nextRankAt: number;              // XP needed for next rank
  
  // Success stats
  missionsCompleted: number;
  missionsSuccessful: number;
  missionsFailed: number;
  successRate: number;             // Percentage
  
  // Specialization
  specialty?: MissionType;         // +20% success for this mission type
  
  // Status
  available: boolean;
  currentMission?: string;         // Mission ID if on assignment
  cooldownUntil?: Date;
  
  // Equipment
  equipment: {
    disguise: number;              // 0-10 (reduces detection)
    tools: number;                 // 0-10 (increases success)
    communication: number;         // 0-10 (faster missions)
  };
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Counter-intelligence installation
 */
export interface CounterIntelligence {
  _id?: ObjectId;
  ownerId: string;
  ownerClanId: string;
  
  // Security level
  securityRating: number;          // 0-100
  tier: number;                    // 1-10
  
  // Detection capabilities
  detectionChance: number;         // Probability (0-1)
  surveillanceRange: number;       // Tiles
  
  // Active measures
  activeScans: number;             // Counter-intel operations running
  enemySpiesDetected: number;
  enemyMissionsPrevented: number;
  
  // Recent activity
  lastDetection?: Date;
  detectionsToday: number;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mission configuration
 */
export interface MissionConfig {
  type: MissionType;
  name: string;
  description: string;
  tier: number;                    // Minimum tier required
  
  // Success rates by rank
  successRates: Record<SpyRank, number>;
  
  // Execution
  duration: number;                // Milliseconds
  detectionRisk: number;           // Base probability (0-1)
  
  // Cost
  cost: {
    metal: number;
    energy: number;
  };
  
  // Requirements
  requiredTech: string;
  minimumSpyRank: SpyRank;
}

/**
 * Spy network summary
 */
export interface SpyNetworkSummary {
  ownerId: string;
  
  // Agents
  totalSpies: number;
  availableSpies: number;
  onMission: number;
  spyRanks: Record<SpyRank, number>;
  
  // Mission stats
  activeMissions: number;
  completedMissions: number;
  successRate: number;
  
  // Counter-intelligence
  securityRating: number;
  enemySpiesDetected: number;
  
  updatedAt: Date;
}

/**
 * Mission planning request
 */
export interface MissionPlanRequest {
  ownerId: string;
  missionType: MissionType;
  targetId: string;
  spyId: string;
}

/**
 * Mission planning result
 */
export interface MissionPlanResult {
  success: boolean;
  missionId: string;
  missionType: MissionType;
  estimatedDuration: number;
  successChance: number;
  detectionRisk: number;
  cost: {
    metal: number;
    energy: number;
  };
  message: string;
}

/**
 * Mission execution request
 */
export interface MissionExecuteRequest {
  missionId: string;
  ownerId: string;
}

/**
 * Mission execution result
 */
export interface MissionExecuteResult {
  success: boolean;
  missionId: string;
  completed: boolean;
  result?: MissionResult;
  detected: boolean;
  message: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Mission configurations
 */
export const MISSION_CONFIGS: Record<MissionType, MissionConfig> = {
  [MissionType.RECONNAISSANCE]: {
    type: MissionType.RECONNAISSANCE,
    name: 'Reconnaissance',
    description: 'Gather basic intelligence on target',
    tier: 1,
    successRates: {
      [SpyRank.ROOKIE]: 0.30,
      [SpyRank.OPERATIVE]: 0.50,
      [SpyRank.AGENT]: 0.70,
      [SpyRank.VETERAN]: 0.85,
      [SpyRank.ELITE]: 0.95,
    },
    duration: 1800000,             // 30 minutes
    detectionRisk: 0.10,
    cost: {
      metal: 50000,
      energy: 100000,
    },
    requiredTech: 'spy_tier_1',
    minimumSpyRank: SpyRank.ROOKIE,
  },
  
  [MissionType.SURVEILLANCE]: {
    type: MissionType.SURVEILLANCE,
    name: 'Surveillance',
    description: 'Monitor target activity over time',
    tier: 2,
    successRates: {
      [SpyRank.ROOKIE]: 0.25,
      [SpyRank.OPERATIVE]: 0.45,
      [SpyRank.AGENT]: 0.65,
      [SpyRank.VETERAN]: 0.80,
      [SpyRank.ELITE]: 0.90,
    },
    duration: 3600000,             // 1 hour
    detectionRisk: 0.15,
    cost: {
      metal: 100000,
      energy: 200000,
    },
    requiredTech: 'spy_tier_2',
    minimumSpyRank: SpyRank.ROOKIE,
  },
  
  [MissionType.INFILTRATION]: {
    type: MissionType.INFILTRATION,
    name: 'Infiltration',
    description: 'Gain deep access to target systems',
    tier: 4,
    successRates: {
      [SpyRank.ROOKIE]: 0.15,
      [SpyRank.OPERATIVE]: 0.35,
      [SpyRank.AGENT]: 0.55,
      [SpyRank.VETERAN]: 0.70,
      [SpyRank.ELITE]: 0.85,
    },
    duration: 5400000,             // 1.5 hours
    detectionRisk: 0.25,
    cost: {
      metal: 200000,
      energy: 400000,
    },
    requiredTech: 'spy_tier_4',
    minimumSpyRank: SpyRank.OPERATIVE,
  },
  
  [MissionType.SABOTAGE_LIGHT]: {
    type: MissionType.SABOTAGE_LIGHT,
    name: 'Light Sabotage',
    description: 'Delay one missile component',
    tier: 5,
    successRates: {
      [SpyRank.ROOKIE]: 0.20,
      [SpyRank.OPERATIVE]: 0.40,
      [SpyRank.AGENT]: 0.60,
      [SpyRank.VETERAN]: 0.75,
      [SpyRank.ELITE]: 0.90,
    },
    duration: 7200000,             // 2 hours
    detectionRisk: 0.30,
    cost: {
      metal: 300000,
      energy: 600000,
    },
    requiredTech: 'spy_tier_5',
    minimumSpyRank: SpyRank.OPERATIVE,
  },
  
  [MissionType.SABOTAGE_HEAVY]: {
    type: MissionType.SABOTAGE_HEAVY,
    name: 'Heavy Sabotage',
    description: 'Destroy one missile component',
    tier: 7,
    successRates: {
      [SpyRank.ROOKIE]: 0.10,
      [SpyRank.OPERATIVE]: 0.30,
      [SpyRank.AGENT]: 0.50,
      [SpyRank.VETERAN]: 0.65,
      [SpyRank.ELITE]: 0.80,
    },
    duration: 10800000,            // 3 hours
    detectionRisk: 0.40,
    cost: {
      metal: 500000,
      energy: 1000000,
    },
    requiredTech: 'spy_tier_7',
    minimumSpyRank: SpyRank.AGENT,
  },
  
  [MissionType.SABOTAGE_NUCLEAR]: {
    type: MissionType.SABOTAGE_NUCLEAR,
    name: 'Nuclear Sabotage',
    description: 'Destroy ALL missile components',
    tier: 10,
    successRates: {
      [SpyRank.ROOKIE]: 0.05,
      [SpyRank.OPERATIVE]: 0.15,
      [SpyRank.AGENT]: 0.30,
      [SpyRank.VETERAN]: 0.50,
      [SpyRank.ELITE]: 0.70,
    },
    duration: 14400000,            // 4 hours
    detectionRisk: 0.60,
    cost: {
      metal: 1000000,
      energy: 2000000,
    },
    requiredTech: 'spy_tier_10',
    minimumSpyRank: SpyRank.VETERAN,
  },
  
  [MissionType.INTELLIGENCE_LEAK]: {
    type: MissionType.INTELLIGENCE_LEAK,
    name: 'Intelligence Leak',
    description: 'Expose missile details to public',
    tier: 6,
    successRates: {
      [SpyRank.ROOKIE]: 0.25,
      [SpyRank.OPERATIVE]: 0.45,
      [SpyRank.AGENT]: 0.65,
      [SpyRank.VETERAN]: 0.80,
      [SpyRank.ELITE]: 0.95,
    },
    duration: 3600000,             // 1 hour
    detectionRisk: 0.20,
    cost: {
      metal: 150000,
      energy: 300000,
    },
    requiredTech: 'spy_tier_6',
    minimumSpyRank: SpyRank.AGENT,
  },
  
  [MissionType.COUNTER_INTELLIGENCE]: {
    type: MissionType.COUNTER_INTELLIGENCE,
    name: 'Counter-Intelligence',
    description: 'Protect against enemy spies',
    tier: 3,
    successRates: {
      [SpyRank.ROOKIE]: 0.30,
      [SpyRank.OPERATIVE]: 0.50,
      [SpyRank.AGENT]: 0.70,
      [SpyRank.VETERAN]: 0.85,
      [SpyRank.ELITE]: 0.95,
    },
    duration: 7200000,             // 2 hours
    detectionRisk: 0.05,
    cost: {
      metal: 100000,
      energy: 200000,
    },
    requiredTech: 'spy_tier_3',
    minimumSpyRank: SpyRank.OPERATIVE,
  },
  
  [MissionType.ASSASSINATION]: {
    type: MissionType.ASSASSINATION,
    name: 'Assassination',
    description: 'Eliminate enemy spy',
    tier: 9,
    successRates: {
      [SpyRank.ROOKIE]: 0.05,
      [SpyRank.OPERATIVE]: 0.20,
      [SpyRank.AGENT]: 0.40,
      [SpyRank.VETERAN]: 0.60,
      [SpyRank.ELITE]: 0.80,
    },
    duration: 10800000,            // 3 hours
    detectionRisk: 0.50,
    cost: {
      metal: 750000,
      energy: 1500000,
    },
    requiredTech: 'spy_tier_9',
    minimumSpyRank: SpyRank.VETERAN,
  },
  
  [MissionType.THEFT]: {
    type: MissionType.THEFT,
    name: 'Research Theft',
    description: 'Steal research data',
    tier: 8,
    successRates: {
      [SpyRank.ROOKIE]: 0.10,
      [SpyRank.OPERATIVE]: 0.25,
      [SpyRank.AGENT]: 0.45,
      [SpyRank.VETERAN]: 0.65,
      [SpyRank.ELITE]: 0.85,
    },
    duration: 7200000,             // 2 hours
    detectionRisk: 0.35,
    cost: {
      metal: 400000,
      energy: 800000,
    },
    requiredTech: 'spy_tier_8',
    minimumSpyRank: SpyRank.AGENT,
  },
};

/**
 * Spy rank experience thresholds
 */
export const SPY_RANK_THRESHOLDS = {
  [SpyRank.ROOKIE]: 0,
  [SpyRank.OPERATIVE]: 10,         // 10 successful missions
  [SpyRank.AGENT]: 30,             // 30 successful missions
  [SpyRank.VETERAN]: 60,           // 60 successful missions
  [SpyRank.ELITE]: 100,            // 100 successful missions
} as const;

/**
 * Intelligence leak probability
 */
export const INTEL_LEAK_PROBABILITY = {
  baseChance: 0.05,                // 5% base chance on any mission
  perMissionIncrease: 0.02,        // +2% per additional mission
  maxChance: 0.30,                 // Cap at 30%
  leakCooldown: 86400000,          // 24h cooldown after leak
} as const;

/**
 * Sabotage impact
 */
export const SABOTAGE_IMPACT = {
  lightDelay: 7200000,             // 2 hour delay
  heavyDelay: 14400000,            // 4 hour delay
  nuclearDestruction: true,        // Destroys all components
  resourceRefund: 0.25,            // 25% refund on destroyed components
} as const;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if mission type is valid
 */
export function isValidMissionType(type: string): type is MissionType {
  return Object.values(MissionType).includes(type as MissionType);
}

/**
 * Check if spy rank is valid
 */
export function isValidSpyRank(rank: string): rank is SpyRank {
  return Object.values(SpyRank).includes(rank as SpyRank);
}

/**
 * Calculate mission success chance
 */
export function calculateSuccessChance(
  spyRank: SpyRank,
  missionType: MissionType,
  targetSecurity: number,
  clanBonus: number,
  equipmentBonus: number
): number {
  const baseChance = MISSION_CONFIGS[missionType].successRates[spyRank];
  const securityPenalty = targetSecurity * 0.5; // Security reduces success
  const totalBonus = clanBonus + equipmentBonus;
  
  const finalChance = baseChance - securityPenalty + totalBonus;
  
  // Clamp between 5% and 95%
  return Math.max(0.05, Math.min(0.95, finalChance));
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * 1. Mission Types:
 *    - RECONNAISSANCE: Basic intel gathering (30-95% success)
 *    - SURVEILLANCE: Activity monitoring (25-90% success)
 *    - INFILTRATION: Deep system access (15-85% success)
 *    - SABOTAGE_LIGHT: 2h delay (20-90% success)
 *    - SABOTAGE_HEAVY: Destroy 1 component (10-80% success)
 *    - SABOTAGE_NUCLEAR: Destroy ALL components (5-70% success)
 *    - INTELLIGENCE_LEAK: Public exposure (25-95% success)
 *    - COUNTER_INTELLIGENCE: Protection (30-95% success)
 *    - ASSASSINATION: Kill enemy spy (5-80% success)
 *    - THEFT: Steal RP (10-85% success)
 * 
 * 2. Spy Ranks:
 *    - ROOKIE: 30% success (0 missions)
 *    - OPERATIVE: 50% success (10 missions)
 *    - AGENT: 70% success (30 missions)
 *    - VETERAN: 85% success (60 missions)
 *    - ELITE: 95% success (100 missions)
 * 
 * 3. Nuclear Sabotage (Game-Changer):
 *    - Destroys ALL 5 components instantly
 *    - 4-hour mission duration
 *    - 60% detection risk (very risky)
 *    - Costs 1M Metal + 2M Energy
 *    - Requires Tier 10 + Veteran spy minimum
 *    - Only 70% max success rate (even for Elite)
 * 
 * 4. Intelligence Leaks:
 *    - 5% base chance on any mission
 *    - +2% per additional mission on same target
 *    - Max 30% leak chance
 *    - Global broadcast reveals missile details
 *    - Creates diplomatic pressure
 *    - 24h cooldown after leak
 * 
 * 5. Counter-Intelligence:
 *    - Security rating 0-100
 *    - Reduces enemy spy success rates
 *    - Can detect and prevent missions
 *    - Assassination available for caught spies
 * 
 * 6. Cost Balance:
 *    - Reconnaissance: 50k Metal + 100k Energy
 *    - Nuclear Sabotage: 1M Metal + 2M Energy
 *    - Assassination: 750k Metal + 1.5M Energy
 *    - Spying cheaper than building (defensive meta)
 */

// ============================================================================
// END OF FILE
// ============================================================================
