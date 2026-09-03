/**
 * @file types/wmd/defense.types.ts
 * @created 2025-10-22
 * @overview WMD Defense System Type Definitions
 * 
 * OVERVIEW:
 * Complete type system for missile defense networks including battery types,
 * interception mechanics, clan defense pooling, and radar surveillance.
 * 
 * Features:
 * - 5 defense battery tiers
 * - Interception probability calculations
 * - Clan-wide defense grid pooling
 * - Radar surveillance system
 * - Defense resource management
 * 
 * Dependencies:
 * - missile.types.ts for warhead type references
 * - MongoDB for data persistence
 */

import { ObjectId } from 'mongodb';
import { WarheadType } from './missile.types';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Defense battery types
 */
export enum BatteryType {
  BASIC = 'BASIC',                 // Tier 1, 10% intercept chance
  ADVANCED = 'ADVANCED',           // Tier 3, 25% intercept chance
  ELITE = 'ELITE',                 // Tier 5, 40% intercept chance
  FORTRESS = 'FORTRESS',           // Tier 7, 60% intercept chance
  AEGIS = 'AEGIS',                 // Tier 10, 80% intercept chance
}

/**
 * Battery operational status
 */
export enum BatteryStatus {
  IDLE = 'IDLE',                   // Ready to intercept
  ACTIVE = 'ACTIVE',               // Currently tracking threat
  COOLDOWN = 'COOLDOWN',           // Recharging after intercept attempt
  DAMAGED = 'DAMAGED',             // Sabotaged or destroyed
  UPGRADING = 'UPGRADING',         // Being upgraded to next tier
}

/**
 * Interception attempt results
 */
export enum InterceptionResult {
  SUCCESS = 'SUCCESS',             // Missile destroyed
  FAILURE = 'FAILURE',             // Missile continues
  PARTIAL = 'PARTIAL',             // Damage reduced (AEGIS only)
  MALFUNCTION = 'MALFUNCTION',     // Battery failure
}

/**
 * Radar coverage levels
 */
export enum RadarLevel {
  NONE = 'NONE',                   // No early warning
  LOCAL = 'LOCAL',                 // Detects incoming to you (30s warning)
  REGIONAL = 'REGIONAL',           // Detects nearby launches (60s warning)
  GLOBAL = 'GLOBAL',               // Detects all launches (90s warning)
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Main defense battery document
 */
export interface DefenseBattery {
  _id?: ObjectId;
  ownerId: string;                 // Player username
  ownerClanId: string;             // Owner's clan ID
  batteryType: BatteryType;
  tier: number;                    // 1-10
  status: BatteryStatus;
  
  // Interception stats
  interceptChance: number;         // Base probability (0-1)
  successfulIntercepts: number;
  failedIntercepts: number;
  totalAttempts: number;
  
  // Cooldown tracking
  lastFired?: Date;
  cooldownUntil?: Date;
  cooldownDuration: number;        // Milliseconds
  
  // Damage tracking
  health: number;                  // 0-100%
  repairing: boolean;
  repairCompletesAt?: Date;
  
  // Upgrade tracking
  upgrading: boolean;
  upgradeCompletesAt?: Date;
  upgradeToTier?: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Clan defense grid (pooled batteries)
 */
export interface ClanDefenseGrid {
  clanId: string;
  clanName: string;
  
  // Pooled batteries from all members
  batteries: Array<{
    batteryId: string;
    ownerId: string;
    ownerUsername: string;
    batteryType: BatteryType;
    interceptChance: number;
    status: BatteryStatus;
    available: boolean;            // Can participate in intercepts
  }>;
  
  // Grid stats
  totalBatteries: number;
  availableBatteries: number;
  combinedInterceptChance: number; // Pooled probability
  
  // Recent activity
  recentIntercepts: InterceptionAttempt[];
  
  updatedAt: Date;
}

/**
 * Interception attempt record
 */
export interface InterceptionAttempt {
  _id?: ObjectId;
  missileId: string;
  targetId: string;                // Player/clan being defended
  defenderIds: string[];           // Players who contributed batteries
  
  // Battery usage
  batteriesUsed: Array<{
    batteryId: string;
    ownerId: string;
    batteryType: BatteryType;
    interceptChance: number;
  }>;
  
  // Calculation
  combinedChance: number;          // Total intercept probability
  roll: number;                    // Random roll (0-1)
  result: InterceptionResult;
  
  // Outcome
  missileDestroyed: boolean;
  damageReduced?: number;          // Percentage (PARTIAL only)
  batteryFailures: number;         // How many malfunctioned
  
  // Timestamps
  attemptedAt: Date;
}

/**
 * Interception request
 */
export interface InterceptionRequest {
  missileId: string;
  targetId: string;
  defenderIds: string[];           // Players pooling defense
  warheadType: WarheadType;
  launchedAt: Date;
}

/**
 * Interception calculation result
 */
export interface InterceptionCalculation {
  success: boolean;
  missileDestroyed: boolean;
  result: InterceptionResult;
  
  // Probability breakdown
  baseChance: number;
  bonusChance: number;
  finalChance: number;
  roll: number;
  
  // Battery details
  batteriesUsed: number;
  batteryTypes: BatteryType[];
  
  // Damage mitigation
  damageReduced?: number;
  
  message: string;
}

/**
 * Radar installation
 */
export interface RadarInstallation {
  _id?: ObjectId;
  ownerId: string;
  ownerClanId: string;
  level: RadarLevel;
  tier: number;                    // 1-10
  
  // Coverage area
  range: number;                   // Tiles radius
  coverageRadius: number;          // Calculated coverage
  
  // Detection capabilities
  warningTime: number;             // Milliseconds advance warning
  canDetectStealth: boolean;       // Can see stealth missiles
  accuracy: number;                // Detection accuracy (0-1)
  
  // Recent detections
  detectionsToday: number;
  lastDetection?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Missile detection alert
 */
export interface MissileDetection {
  _id?: ObjectId;
  radarId: string;
  detectorId: string;              // Player who owns radar
  missileId: string;
  launcherId: string;              // Who launched
  
  // Detection details
  detectedAt: Date;
  estimatedImpact: Date;
  warningTime: number;             // Milliseconds until impact
  
  // Target information
  targetId: string;
  targetUsername: string;
  targetLocation?: {
    x: number;
    y: number;
  };
  
  // Intelligence
  warheadType?: WarheadType;       // May be unknown
  confidence: number;              // Detection accuracy (0-1)
  
  // Notification
  alertSent: boolean;
  alertSentAt?: Date;
}

/**
 * Defense battery configuration
 */
export interface BatteryConfig {
  type: BatteryType;
  tier: number;
  name: string;
  description: string;
  interceptChance: number;         // Base probability (0-1)
  cooldownDuration: number;        // Milliseconds
  cost: {
    metal: number;
    energy: number;
  };
  maintenanceCost: {
    metal: number;
    energy: number;
  };
  requiredTech: string;            // Tech tree prerequisite
}

/**
 * Radar configuration
 */
export interface RadarConfig {
  level: RadarLevel;
  tier: number;
  name: string;
  description: string;
  range: number;                   // Tiles
  warningTime: number;             // Milliseconds
  canDetectStealth: boolean;
  accuracy: number;                // 0-1
  cost: {
    metal: number;
    energy: number;
  };
  requiredTech: string;
}

/**
 * Battery inventory summary
 */
export interface BatteryInventory {
  ownerId: string;
  batteries: Array<{
    batteryId: string;
    batteryType: BatteryType;
    tier: number;
    status: BatteryStatus;
    interceptChance: number;
    available: boolean;
  }>;
  totalBatteries: number;
  availableBatteries: number;
  combinedInterceptChance: number;
  onCooldown: number;
  damaged: number;
}

/**
 * Clan defense summary
 */
export interface ClanDefenseSummary {
  clanId: string;
  clanName: string;
  memberCount: number;
  
  // Defense capabilities
  totalBatteries: number;
  availableBatteries: number;
  gridInterceptChance: number;
  
  // Radar coverage
  radarInstallations: number;
  bestRadarLevel: RadarLevel;
  globalCoverage: boolean;
  
  // Performance
  successfulIntercepts: number;
  failedIntercepts: number;
  successRate: number;             // Percentage
  
  // Recent activity
  lastInterception?: Date;
  interceptionsToday: number;
}

/**
 * Defense upgrade request
 */
export interface DefenseUpgradeRequest {
  batteryId: string;
  ownerId: string;
  currentTier: number;
  targetTier: number;
}

/**
 * Defense upgrade result
 */
export interface DefenseUpgradeResult {
  success: boolean;
  batteryId: string;
  upgradedTo: BatteryType;
  newTier: number;
  costPaid: {
    metal: number;
    energy: number;
  };
  completesAt: Date;
  message: string;
}

/**
 * Battery repair request
 */
export interface RepairRequest {
  batteryId: string;
  ownerId: string;
  currentHealth: number;
}

/**
 * Battery repair result
 */
export interface RepairResult {
  success: boolean;
  batteryId: string;
  repairedFrom: number;
  repairedTo: number;
  costPaid: {
    metal: number;
    energy: number;
  };
  completesAt: Date;
  message: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Battery configurations by type
 */
export const BATTERY_CONFIGS: Record<BatteryType, BatteryConfig> = {
  [BatteryType.BASIC]: {
    type: BatteryType.BASIC,
    tier: 1,
    name: 'Basic Defense Battery',
    description: 'Entry-level missile defense',
    interceptChance: 0.10,
    cooldownDuration: 3600000,       // 1 hour
    cost: {
      metal: 250000,
      energy: 500000,
    },
    maintenanceCost: {
      metal: 10000,
      energy: 20000,
    },
    requiredTech: 'defense_tier_1',
  },
  [BatteryType.ADVANCED]: {
    type: BatteryType.ADVANCED,
    tier: 3,
    name: 'Advanced Defense Battery',
    description: 'Improved interception capability',
    interceptChance: 0.25,
    cooldownDuration: 2700000,       // 45 minutes
    cost: {
      metal: 500000,
      energy: 1000000,
    },
    maintenanceCost: {
      metal: 25000,
      energy: 50000,
    },
    requiredTech: 'defense_tier_3',
  },
  [BatteryType.ELITE]: {
    type: BatteryType.ELITE,
    tier: 5,
    name: 'Elite Defense Battery',
    description: 'High-accuracy interception system',
    interceptChance: 0.40,
    cooldownDuration: 1800000,       // 30 minutes
    cost: {
      metal: 1000000,
      energy: 2000000,
    },
    maintenanceCost: {
      metal: 50000,
      energy: 100000,
    },
    requiredTech: 'defense_tier_5',
  },
  [BatteryType.FORTRESS]: {
    type: BatteryType.FORTRESS,
    tier: 7,
    name: 'Fortress Defense Battery',
    description: 'Near-total protection',
    interceptChance: 0.60,
    cooldownDuration: 900000,        // 15 minutes
    cost: {
      metal: 2000000,
      energy: 4000000,
    },
    maintenanceCost: {
      metal: 100000,
      energy: 200000,
    },
    requiredTech: 'defense_tier_7',
  },
  [BatteryType.AEGIS]: {
    type: BatteryType.AEGIS,
    tier: 10,
    name: 'AEGIS Defense System',
    description: 'Ultimate defensive capability',
    interceptChance: 0.80,
    cooldownDuration: 600000,        // 10 minutes
    cost: {
      metal: 5000000,
      energy: 10000000,
    },
    maintenanceCost: {
      metal: 250000,
      energy: 500000,
    },
    requiredTech: 'defense_tier_10',
  },
};

/**
 * Radar configurations by level
 */
export const RADAR_CONFIGS: Record<RadarLevel, RadarConfig> = {
  [RadarLevel.NONE]: {
    level: RadarLevel.NONE,
    tier: 0,
    name: 'No Radar',
    description: 'No early warning system',
    range: 0,
    warningTime: 0,
    canDetectStealth: false,
    accuracy: 0,
    cost: {
      metal: 0,
      energy: 0,
    },
    requiredTech: '',
  },
  [RadarLevel.LOCAL]: {
    level: RadarLevel.LOCAL,
    tier: 2,
    name: 'Local Radar',
    description: 'Detects incoming missiles targeting you',
    range: 50,
    warningTime: 30000,              // 30 seconds
    canDetectStealth: false,
    accuracy: 0.7,
    cost: {
      metal: 100000,
      energy: 200000,
    },
    requiredTech: 'radar_tier_2',
  },
  [RadarLevel.REGIONAL]: {
    level: RadarLevel.REGIONAL,
    tier: 5,
    name: 'Regional Radar',
    description: 'Detects nearby missile launches',
    range: 200,
    warningTime: 60000,              // 60 seconds
    canDetectStealth: false,
    accuracy: 0.85,
    cost: {
      metal: 500000,
      energy: 1000000,
    },
    requiredTech: 'radar_tier_5',
  },
  [RadarLevel.GLOBAL]: {
    level: RadarLevel.GLOBAL,
    tier: 8,
    name: 'Global Radar Network',
    description: 'Detects all missile launches worldwide',
    range: 9999,
    warningTime: 90000,              // 90 seconds
    canDetectStealth: true,
    accuracy: 0.95,
    cost: {
      metal: 2000000,
      energy: 5000000,
    },
    requiredTech: 'radar_tier_8',
  },
};

/**
 * Defense pooling mechanics
 */
export const DEFENSE_POOLING = {
  maxBatteriesPerIntercept: 10,    // Max batteries in one intercept
  pooledBonusPerBattery: 0.05,     // +5% per additional battery
  maxPooledBonus: 0.5,             // Cap at +50%
  clanGridEnabled: true,           // Allow clan defense pooling
  autoDefendClanmates: true,       // Automatic defense for clan
} as const;

/**
 * Interception rules
 */
export const INTERCEPTION_RULES = {
  warheadDifficultyModifier: {     // Harder to intercept higher tiers
    TACTICAL: 1.0,                 // No modifier
    STRATEGIC: 0.9,                // -10% intercept chance
    NEUTRON: 0.85,                 // -15%
    CLUSTER: 0.8,                  // -20%
    CLAN_BUSTER: 0.7,              // -30%
  },
  partialSuccessThreshold: 0.5,    // Within 50% of target = partial
  malfunctionChance: 0.05,         // 5% chance battery malfunctions
  damageReductionPartial: 0.5,     // 50% damage reduction on partial
} as const;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if battery type is valid
 */
export function isValidBatteryType(type: string): type is BatteryType {
  return Object.values(BatteryType).includes(type as BatteryType);
}

/**
 * Check if battery status is valid
 */
export function isValidBatteryStatus(status: string): status is BatteryStatus {
  return Object.values(BatteryStatus).includes(status as BatteryStatus);
}

/**
 * Check if radar level is valid
 */
export function isValidRadarLevel(level: string): level is RadarLevel {
  return Object.values(RadarLevel).includes(level as RadarLevel);
}

/**
 * Check if battery is available for interception
 */
export function isBatteryAvailable(battery: DefenseBattery): boolean {
  return (
    battery.status === BatteryStatus.IDLE &&
    battery.health > 50 &&
    (!battery.cooldownUntil || battery.cooldownUntil < new Date())
  );
}

/**
 * Calculate combined intercept chance
 */
export function calculateCombinedChance(
  batteries: Array<{ interceptChance: number }>,
  warheadType: WarheadType
): number {
  if (batteries.length === 0) return 0;
  
  // Get warhead difficulty modifier
  const difficulty = INTERCEPTION_RULES.warheadDifficultyModifier[warheadType];
  
  // Start with first battery's chance
  let combined = batteries[0].interceptChance * difficulty;
  
  // Add bonus for additional batteries (diminishing returns)
  const bonusBatteries = batteries.length - 1;
  const bonus = Math.min(
    bonusBatteries * DEFENSE_POOLING.pooledBonusPerBattery,
    DEFENSE_POOLING.maxPooledBonus
  );
  
  combined += bonus;
  
  // Cap at 95% max intercept chance
  return Math.min(combined, 0.95);
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * 1. Battery Types:
 *    - BASIC: 10% intercept, 1h cooldown, Tier 1
 *    - ADVANCED: 25% intercept, 45min cooldown, Tier 3
 *    - ELITE: 40% intercept, 30min cooldown, Tier 5
 *    - FORTRESS: 60% intercept, 15min cooldown, Tier 7
 *    - AEGIS: 80% intercept, 10min cooldown, Tier 10
 * 
 * 2. Clan Defense Grid:
 *    - Pools all available batteries from clan members
 *    - +5% intercept chance per additional battery
 *    - Max +50% bonus (10 batteries total)
 *    - Automatic defense for clan members
 * 
 * 3. Radar System:
 *    - LOCAL: 30s warning, 50 tile range
 *    - REGIONAL: 60s warning, 200 tile range
 *    - GLOBAL: 90s warning, unlimited range, detects stealth
 * 
 * 4. Interception Mechanics:
 *    - Roll vs combined intercept chance
 *    - Warhead difficulty reduces chance (Clan Buster -30%)
 *    - Partial success reduces damage by 50%
 *    - 5% chance battery malfunctions
 * 
 * 5. Cost Balance:
 *    - BASIC Battery: 250k Metal + 500k Energy
 *    - AEGIS Battery: 5M Metal + 10M Energy
 *    - Global Radar: 2M Metal + 5M Energy
 *    - Maintenance costs scale with tier
 * 
 * 6. Strategic Considerations:
 *    - Defense is cheaper than offense (battery < missile)
 *    - Clan coordination multiplies effectiveness
 *    - Radar provides advance warning for defense preparation
 *    - Higher tier warheads harder to intercept
 */

// ============================================================================
// END OF FILE
// ============================================================================
