/**
 * @file types/wmd/index.ts
 * @created 2025-10-22
 * @overview WMD System Types Export Index
 * 
 * OVERVIEW:
 * Central export point for all WMD-related type definitions including missiles,
 * defense systems, intelligence operations, research progression, and notifications.
 * 
 * Usage:
 * ```typescript
 * import { Missile, WarheadType, DefenseBattery, SpyMission } from '@/types/wmd';
 * ```
 */

// ============================================================================
// MISSILE SYSTEM TYPES
// ============================================================================

export {
  // Enums
  WarheadType,
  MissileStatus,
  MissileComponent,
  
  // Interfaces
  type Missile,
  type ComponentProgress,
  type ComponentStatus,
  type DamageDistribution,
  type LaunchRequest,
  type LaunchResult,
  type MissileInventory,
  type TargetValidation,
  type WarheadConfig,
  type ComponentCost,
  type AssemblyRequest,
  type AssemblyResult,
  type ComponentAcquisitionRequest,
  type ComponentAcquisitionResult,
  
  // Constants
  WARHEAD_CONFIGS,
  COMPONENT_COSTS,
  TARGETING_RULES,
  
  // Type Guards
  isValidWarheadType,
  isValidMissileStatus,
  isValidComponent,
  isMissileReady,
  calculateProgress,
} from './missile.types';

// ============================================================================
// DEFENSE SYSTEM TYPES
// ============================================================================

export {
  // Enums
  BatteryType,
  BatteryStatus,
  InterceptionResult,
  RadarLevel,
  
  // Interfaces
  type DefenseBattery,
  type ClanDefenseGrid,
  type InterceptionAttempt,
  type InterceptionRequest,
  type InterceptionCalculation,
  type RadarInstallation,
  type MissileDetection,
  type BatteryConfig,
  type RadarConfig,
  type BatteryInventory,
  type ClanDefenseSummary,
  type DefenseUpgradeRequest,
  type DefenseUpgradeResult,
  type RepairRequest,
  type RepairResult,
  
  // Constants
  BATTERY_CONFIGS,
  RADAR_CONFIGS,
  DEFENSE_POOLING,
  INTERCEPTION_RULES,
  
  // Type Guards
  isValidBatteryType,
  isValidBatteryStatus,
  isValidRadarLevel,
  isBatteryAvailable,
  calculateCombinedChance,
} from './defense.types';

// ============================================================================
// INTELLIGENCE SYSTEM TYPES
// ============================================================================

export {
  // Enums
  MissionType,
  MissionStatus,
  SpyRank,
  IntelLevel,
  
  // Interfaces
  type SpyMission,
  type MissionResult,
  type IntelligenceReport,
  type SabotageDamage,
  type IntelligenceLeak,
  type SpyAgent,
  type CounterIntelligence,
  type MissionConfig,
  type SpyNetworkSummary,
  type MissionPlanRequest,
  type MissionPlanResult,
  type MissionExecuteRequest,
  type MissionExecuteResult,
  
  // Constants
  MISSION_CONFIGS,
  SPY_RANK_THRESHOLDS,
  INTEL_LEAK_PROBABILITY,
  SABOTAGE_IMPACT,
  
  // Type Guards
  isValidMissionType,
  isValidSpyRank,
  calculateSuccessChance,
} from './intelligence.types';

// ============================================================================
// RESEARCH SYSTEM TYPES
// ============================================================================

export {
  // Enums
  ResearchCategory,
  ResearchStatus,
  
  // Interfaces
  type ResearchTech,
  type PlayerResearch,
  type ResearchUnlockRequest,
  type ResearchUnlockResult,
  type TechTreeSummary,
  type ResearchValidation,
  
  // Constants
  MISSILE_RESEARCH_TRACK,
  DEFENSE_RESEARCH_TRACK,
  INTELLIGENCE_RESEARCH_TRACK,
  ALL_RESEARCH_TECHS,
  RESEARCH_BY_CATEGORY,
  TOTAL_RP_REQUIRED,
  RP_BY_CATEGORY,
  
  // Type Guards
  isValidTechId,
  getTechById,
  getTechsByCategory,
  getPrerequisiteChain,
  hasPrerequisites,
  getAvailableTechs,
} from './research.types';

// ============================================================================
// NOTIFICATION SYSTEM TYPES
// ============================================================================

export {
  // Enums
  WMDEventType,
  NotificationPriority,
  NotificationScope,
  
  // Interfaces
  type WMDNotification,
  type NotificationPreferences,
  type NotificationRequest,
  type NotificationBroadcastResult,
  type WMDWebSocketEvent,
  type MissileLaunchBroadcast,
  type IntelligenceLeakBroadcast,
  type NotificationHistory,
  
  // Constants
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_TEMPLATES,
  NOTIFICATION_EXPIRATION,
  
  // Type Guards
  isValidEventType,
  isValidPriority,
  getNotificationTemplate,
  generateNotificationMessage,
  calculateExpiration,
  shouldReceiveNotification,
} from './notification.types';

// ============================================================================
// AGGREGATE TYPES
// ============================================================================

import type { Missile, MissileInventory } from './missile.types';
import type { DefenseBattery, BatteryInventory, RadarInstallation } from './defense.types';
import type { SpyMission, SpyNetworkSummary, CounterIntelligence } from './intelligence.types';
import type { PlayerResearch, TechTreeSummary } from './research.types';
import type { WMDNotification, NotificationPreferences } from './notification.types';

/**
 * Complete WMD system state
 */
export interface WMDSystemState {
  // Missile state
  missiles: Missile[];
  missileInventory: MissileInventory;
  
  // Defense state
  batteries: DefenseBattery[];
  batteryInventory: BatteryInventory;
  radarInstallations: RadarInstallation[];
  
  // Intelligence state
  spyMissions: SpyMission[];
  spyNetwork: SpyNetworkSummary;
  counterIntel: CounterIntelligence;
  
  // Research state
  research: PlayerResearch;
  techTree: TechTreeSummary;
  
  // Notification state
  notifications: WMDNotification[];
  notificationPrefs: NotificationPreferences;
  unreadCount: number;
}

/**
 * WMD action payload for state updates
 */
export interface WMDAction {
  type: 'missile' | 'defense' | 'intelligence' | 'research' | 'notification';
  action: string;
  payload: any;
  timestamp: Date;
}

/**
 * WMD statistics for analytics
 */
export interface WMDStatistics {
  // Missile stats
  totalMissilesBuilt: number;
  totalMissilesLaunched: number;
  totalMissilesIntercepted: number;
  totalMissilesImpacted: number;
  
  // Defense stats
  totalBatteriesDeployed: number;
  totalInterceptions: number;
  interceptionSuccessRate: number;
  
  // Intelligence stats
  totalMissionsCompleted: number;
  totalSabotages: number;
  totalLeaks: number;
  
  // Research stats
  totalRPSpent: number;
  totalTechsUnlocked: number;
  highestTier: number;
  
  // Economic impact
  totalResourcesSpent: {
    metal: number;
    energy: number;
  };
  totalResourcesDestroyed: {
    metal: number;
    energy: number;
  };
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * 1. Import Strategy:
 *    - Named exports for all types, enums, and functions
 *    - Central import point: `import { X } from '@/types/wmd'`
 *    - Tree-shakable: only import what you use
 * 
 * 2. Type Organization:
 *    - missile.types.ts: Offensive systems (warheads, components, targeting)
 *    - defense.types.ts: Defensive systems (batteries, radar, interception)
 *    - intelligence.types.ts: Spy operations (missions, sabotage, leaks)
 *    - research.types.ts: Tech tree (3 tracks, prerequisites, unlocks)
 *    - notification.types.ts: Event system (broadcasts, preferences)
 * 
 * 3. Usage Examples:
 *    ```typescript
 *    // Import specific types
 *    import { Missile, WarheadType, LaunchRequest } from '@/types/wmd';
 *    
 *    // Import all from category
 *    import * as WMDTypes from '@/types/wmd';
 *    
 *    // Import constants
 *    import { WARHEAD_CONFIGS, BATTERY_CONFIGS } from '@/types/wmd';
 *    
 *    // Import type guards
 *    import { isValidWarheadType, isMissileReady } from '@/types/wmd';
 *    ```
 * 
 * 4. Aggregate Types:
 *    - WMDSystemState: Complete system state for Redux/Context
 *    - WMDAction: Action payload for state updates
 *    - WMDStatistics: Analytics and metrics
 * 
 * 5. Type Safety:
 *    - All enums are strongly typed
 *    - Type guards for runtime validation
 *    - Strict null checks enabled
 *    - No 'any' types except in flexible event data
 * 
 * 6. Documentation:
 *    - All types have JSDoc comments
 *    - Usage examples in type definitions
 *    - Implementation notes in each file
 *    - Cross-references between related types
 */

// ============================================================================
// END OF FILE
// ============================================================================
