/**
 * @file types/wmd/missile.types.ts
 * @created 2025-10-22
 * @overview WMD Missile System Type Definitions
 * 
 * OVERVIEW:
 * Complete type system for strategic missile program including warhead types,
 * missile assembly, component tracking, targeting, and damage distribution.
 * 
 * Features:
 * - 5 warhead types (Tactical → Clan Buster)
 * - 5-component assembly system
 * - Multi-target damage distribution
 * - Launch authorization workflow
 * - Interception tracking
 * 
 * Dependencies:
 * - MongoDB for data persistence
 * - Clan system for authorization
 */

type ObjectId = string;

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Warhead types with increasing destructive capability
 */
export enum WarheadType {
  TACTICAL = 'TACTICAL',           // Single target, moderate damage
  STRATEGIC = 'STRATEGIC',         // Single target, heavy damage
  NEUTRON = 'NEUTRON',             // Anti-personnel, preserves resources
  CLUSTER = 'CLUSTER',             // Multiple targets, distributed damage
  CLAN_BUSTER = 'CLAN_BUSTER',     // Entire clan damage (T10 only)
}

/**
 * Missile lifecycle states
 */
export enum MissileStatus {
  ASSEMBLING = 'ASSEMBLING',       // Components being gathered
  READY = 'READY',                 // All 5 components complete
  LAUNCHED = 'LAUNCHED',           // In flight
  INTERCEPTED = 'INTERCEPTED',     // Destroyed by defense
  DETONATED = 'DETONATED',         // Successfully impacted
  DISMANTLED = 'DISMANTLED',       // Manually destroyed
}

/**
 * Missile components required for assembly
 */
export enum MissileComponent {
  WARHEAD = 'WARHEAD',             // Explosive payload
  PROPULSION = 'PROPULSION',       // Rocket engines
  GUIDANCE = 'GUIDANCE',           // Targeting system
  PAYLOAD = 'PAYLOAD',             // Delivery mechanism
  STEALTH = 'STEALTH',             // Counter-detection tech
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Main missile document
 */
export interface Missile {
  _id?: ObjectId;
  ownerId: string;                 // Player username
  ownerClanId: string;             // Owner's clan ID
  warheadType: WarheadType;
  status: MissileStatus;
  
  // Component assembly tracking
  components: {
    warhead: boolean;
    propulsion: boolean;
    guidance: boolean;
    payload: boolean;
    stealth: boolean;
  };
  
  // Targeting data
  targetId?: string;               // Primary target player/clan
  targetType?: 'player' | 'clan'; // Target entity type
  secondaryTargets?: string[];     // Additional targets (CLUSTER/CLAN_BUSTER)
  
  // Launch metadata
  launchedAt?: Date;
  launchedBy?: string;             // Player who authorized launch
  impactAt?: Date;                 // Calculated impact time
  flightTime?: number;             // Milliseconds in flight
  
  // Interception tracking
  interceptAttempts?: number;      // How many intercept attempts
  interceptedBy?: string;          // Player/clan who intercepted
  interceptedAt?: Date;
  
  // Damage tracking
  damageDealt?: DamageDistribution;
  
  // Timestamps
  createdAt: Date;
  completedAt?: Date;              // When all components assembled
  updatedAt: Date;
}

/**
 * Component assembly progress
 */
export interface ComponentProgress {
  missileId: string;
  ownerId: string;
  warhead: ComponentStatus;
  propulsion: ComponentStatus;
  guidance: ComponentStatus;
  payload: ComponentStatus;
  stealth: ComponentStatus;
  overallProgress: number;         // Percentage (0-100)
  estimatedCompletion?: Date;
}

/**
 * Individual component status
 */
export interface ComponentStatus {
  acquired: boolean;
  acquiredAt?: Date;
  cost: {
    metal: number;
    energy: number;
  };
  source?: string;                 // 'purchased' | 'captured' | 'gifted'
}

/**
 * Damage distribution for multi-target warheads
 */
export interface DamageDistribution {
  primaryTarget: {
    targetId: string;
    targetUsername: string;
    damagePercent: number;
    unitsDestroyed: number;
    resourcesLost: {
      metal: number;
      energy: number;
    };
  };
  secondaryTargets?: Array<{
    targetId: string;
    targetUsername: string;
    damagePercent: number;
    unitsDestroyed: number;
    resourcesLost: {
      metal: number;
      energy: number;
    };
  }>;
  totalUnitsDestroyed: number;
  totalResourcesDestroyed: {
    metal: number;
    energy: number;
  };
  calculatedAt: Date;
}

/**
 * Launch authorization request
 */
export interface LaunchRequest {
  missileId: string;
  requestedBy: string;
  targetId: string;
  targetType: 'player' | 'clan';
  authorization: {
    clanApproved: boolean;
    approvedBy?: string[];         // List of approving members
    voteId?: string;               // Reference to clan vote
  };
  launchTime: Date;
}

/**
 * Launch authorization result
 */
export interface LaunchResult {
  success: boolean;
  missileId: string;
  launchedAt: Date;
  impactAt: Date;
  flightTime: number;
  targetId: string;
  targetUsername: string;
  message: string;
  globalNotificationId?: string;   // Reference to broadcast
}

/**
 * Missile inventory summary
 */
export interface MissileInventory {
  ownerId: string;
  missiles: Array<{
    missileId: string;
    warheadType: WarheadType;
    status: MissileStatus;
    progress: number;              // 0-100%
    readyToLaunch: boolean;
  }>;
  totalMissiles: number;
  readyMissiles: number;
  assemblingMissiles: number;
  launchedMissiles: number;
}

/**
 * Targeting validation result
 */
export interface TargetValidation {
  valid: boolean;
  targetId: string;
  targetUsername: string;
  targetLevel: number;
  targetClanId?: string;
  targetClanName?: string;
  canTarget: boolean;
  reason?: string;                 // Rejection reason
  missChance?: number;             // Probability of missing
}

/**
 * Warhead configuration
 */
export interface WarheadConfig {
  type: WarheadType;
  tier: number;                    // 1-10 research tier
  name: string;
  description: string;
  damage: {
    primaryPercent: number;        // % of target's units destroyed
    secondaryPercent?: number;     // For multi-target
    tertiaryPercent?: number;      // For clan-wide
  };
  maxTargets: number;              // 1 for single, 5+ for cluster
  requiredTech: string;            // Tech tree prerequisite
  cost: {
    metal: number;
    energy: number;
  };
  flightTime: number;              // Milliseconds to impact
  interceptDifficulty: number;     // 0-1 (higher = harder to intercept)
}

/**
 * Component cost configuration
 */
export interface ComponentCost {
  component: MissileComponent;
  baseCost: {
    metal: number;
    energy: number;
  };
  tierMultiplier: number;          // Scales with warhead tier
  productionTime: number;          // Milliseconds to acquire
}

/**
 * Missile assembly request
 */
export interface AssemblyRequest {
  ownerId: string;
  warheadType: WarheadType;
  tier: number;
}

/**
 * Missile assembly result
 */
export interface AssemblyResult {
  success: boolean;
  missileId: string;
  warheadType: WarheadType;
  components: {
    warhead: boolean;
    propulsion: boolean;
    guidance: boolean;
    payload: boolean;
    stealth: boolean;
  };
  totalCost: {
    metal: number;
    energy: number;
  };
  message: string;
}

/**
 * Component acquisition request
 */
export interface ComponentAcquisitionRequest {
  missileId: string;
  component: MissileComponent;
  ownerId: string;
}

/**
 * Component acquisition result
 */
export interface ComponentAcquisitionResult {
  success: boolean;
  component: MissileComponent;
  acquired: boolean;
  costPaid: {
    metal: number;
    energy: number;
  };
  progress: number;                // Overall missile progress %
  allComponentsAcquired: boolean;
  message: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Warhead configurations by type
 */
export const WARHEAD_CONFIGS: Record<WarheadType, WarheadConfig> = {
  [WarheadType.TACTICAL]: {
    type: WarheadType.TACTICAL,
    tier: 1,
    name: 'Tactical Warhead',
    description: 'Single target, moderate damage',
    damage: {
      primaryPercent: 25,
    },
    maxTargets: 1,
    requiredTech: 'missile_tier_1',
    cost: {
      metal: 500000,
      energy: 1000000,
    },
    flightTime: 300000,              // 5 minutes
    interceptDifficulty: 0.2,
  },
  [WarheadType.STRATEGIC]: {
    type: WarheadType.STRATEGIC,
    tier: 5,
    name: 'Strategic Warhead',
    description: 'Single target, heavy damage',
    damage: {
      primaryPercent: 50,
    },
    maxTargets: 1,
    requiredTech: 'missile_tier_5',
    cost: {
      metal: 500000,
      energy: 1000000,
    },
    flightTime: 240000,              // 4 minutes
    interceptDifficulty: 0.4,
  },
  [WarheadType.NEUTRON]: {
    type: WarheadType.NEUTRON,
    tier: 7,
    name: 'Neutron Warhead',
    description: 'Anti-personnel, preserves resources',
    damage: {
      primaryPercent: 60,
    },
    maxTargets: 1,
    requiredTech: 'missile_tier_7',
    cost: {
      metal: 500000,
      energy: 1000000,
    },
    flightTime: 180000,              // 3 minutes
    interceptDifficulty: 0.5,
  },
  [WarheadType.CLUSTER]: {
    type: WarheadType.CLUSTER,
    tier: 8,
    name: 'Cluster Warhead',
    description: 'Multiple targets, distributed damage',
    damage: {
      primaryPercent: 40,
      secondaryPercent: 20,
    },
    maxTargets: 5,
    requiredTech: 'missile_tier_8',
    cost: {
      metal: 500000,
      energy: 1000000,
    },
    flightTime: 300000,              // 5 minutes
    interceptDifficulty: 0.6,
  },
  [WarheadType.CLAN_BUSTER]: {
    type: WarheadType.CLAN_BUSTER,
    tier: 10,
    name: 'Clan Buster Warhead',
    description: 'Entire clan damage (ultimate weapon)',
    damage: {
      primaryPercent: 50,
      secondaryPercent: 30,
      tertiaryPercent: 20,
    },
    maxTargets: 100,                 // Entire clan
    requiredTech: 'missile_tier_10',
    cost: {
      metal: 500000,
      energy: 1000000,
    },
    flightTime: 600000,              // 10 minutes (advance warning)
    interceptDifficulty: 0.8,
  },
};

/**
 * Component costs by type
 */
export const COMPONENT_COSTS: Record<MissileComponent, ComponentCost> = {
  [MissileComponent.WARHEAD]: {
    component: MissileComponent.WARHEAD,
    baseCost: {
      metal: 500000,
      energy: 1000000,
    },
    tierMultiplier: 1.2,
    productionTime: 3600000,         // 1 hour
  },
  [MissileComponent.PROPULSION]: {
    component: MissileComponent.PROPULSION,
    baseCost: {
      metal: 750000,
      energy: 500000,
    },
    tierMultiplier: 1.15,
    productionTime: 2700000,         // 45 minutes
  },
  [MissileComponent.GUIDANCE]: {
    component: MissileComponent.GUIDANCE,
    baseCost: {
      metal: 250000,
      energy: 750000,
    },
    tierMultiplier: 1.25,
    productionTime: 1800000,         // 30 minutes
  },
  [MissileComponent.PAYLOAD]: {
    component: MissileComponent.PAYLOAD,
    baseCost: {
      metal: 1000000,
      energy: 500000,
    },
    tierMultiplier: 1.1,
    productionTime: 3600000,         // 1 hour
  },
  [MissileComponent.STEALTH]: {
    component: MissileComponent.STEALTH,
    baseCost: {
      metal: 500000,
      energy: 1000000,
    },
    tierMultiplier: 1.3,
    productionTime: 5400000,         // 1.5 hours
  },
};

/**
 * Targeting validation rules
 */
export const TARGETING_RULES = {
  minTargetLevel: 40,                // Can only target Level 40+ players
  minTargetPower: 10000,             // Or players with 10k+ power
  clanProtectionDays: 3,             // New clan members protected for 3 days
  recentAttackCooldown: 86400000,   // 24h cooldown after being hit
  maxMissChance: 0.85,               // 85% max miss rate vs weak targets
  baseHitChance: 0.15,               // 15% min hit chance vs anyone
} as const;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if warhead type is valid
 */
export function isValidWarheadType(type: string): type is WarheadType {
  return Object.values(WarheadType).includes(type as WarheadType);
}

/**
 * Check if missile status is valid
 */
export function isValidMissileStatus(status: string): status is MissileStatus {
  return Object.values(MissileStatus).includes(status as MissileStatus);
}

/**
 * Check if component type is valid
 */
export function isValidComponent(component: string): component is MissileComponent {
  return Object.values(MissileComponent).includes(component as MissileComponent);
}

/**
 * Check if missile is ready to launch
 */
export function isMissileReady(missile: Missile): boolean {
  return (
    missile.status === MissileStatus.READY &&
    missile.components.warhead &&
    missile.components.propulsion &&
    missile.components.guidance &&
    missile.components.payload &&
    missile.components.stealth
  );
}

/**
 * Calculate missile assembly progress
 */
export function calculateProgress(missile: Missile): number {
  const components = Object.values(missile.components);
  const completed = components.filter(c => c === true).length;
  return Math.round((completed / components.length) * 100);
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * 1. Warhead Types:
 *    - TACTICAL: Tier 1, 25% damage, single target
 *    - STRATEGIC: Tier 5, 50% damage, single target
 *    - NEUTRON: Tier 7, 60% damage, preserves resources
 *    - CLUSTER: Tier 8, 40%+20% damage, 5 targets
 *    - CLAN_BUSTER: Tier 10, 50%+30%+20% damage, entire clan
 * 
 * 2. Component System:
 *    - All 5 components required for launch
 *    - Each component has unique cost and production time
 *    - Costs scale with warhead tier (tierMultiplier)
 *    - Total missile cost: 3M Metal + 3.75M Energy
 * 
 * 3. Launch Authorization:
 *    - Clan vote required for launch (60% approval)
 *    - Leader/Co-Leader can authorize without vote
 *    - Global notification on launch
 *    - Flight time provides advance warning (3-10 min)
 * 
 * 4. Targeting Rules:
 *    - Can only target Level 40+ or 10k+ power players
 *    - New clan members protected for 3 days
 *    - 24h cooldown after being hit
 *    - Miss chance scales with power difference (85% max)
 * 
 * 5. Clan Buster Mechanics:
 *    - 50% damage to primary target
 *    - 30% damage to top 3 players
 *    - 20% damage to 5 random members
 *    - Requires Tier 10 research (300k RP)
 *    - 10-minute flight time (maximum warning)
 * 
 * 6. Interception:
 *    - Defense batteries can intercept (see defense.types.ts)
 *    - Intercept difficulty scales with warhead tier
 *    - Clan Buster: 80% difficulty (hardest to stop)
 *    - Failed intercepts waste defense resources
 */

// ============================================================================
// END OF FILE
// ============================================================================
