/**
 * Activity Log Type Definitions
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Comprehensive type definitions for the DarkFrame activity logging system.
 * Tracks all player actions across 9 categories with 30+ distinct action types.
 * Supports security auditing, analytics, and admin oversight with detailed metadata.
 * 
 * Features:
 * - 30+ action types across Auth, Movement, Resource, Combat, Factory, Unit, Shrine, Admin, System
 * - Security metadata (IP, User-Agent, execution time)
 * - Success/failure tracking with error details
 * - Query filtering by player, action type, date range
 * - Battle-specific logging for combat analytics
 */

// ============================================================================
// ENUMS - Action Categories and Types
// ============================================================================

/**
 * Primary categories for organizing action types
 */
export enum ActionCategory {
  AUTH = 'auth',
  MOVEMENT = 'movement',
  RESOURCE = 'resource',
  COMBAT = 'combat',
  FACTORY = 'factory',
  UNIT = 'unit',
  SHRINE = 'shrine',
  ADMIN = 'admin',
  SYSTEM = 'system',
  CLAN = 'clan',
  DISCOVERY = 'discovery',
  ACHIEVEMENT = 'achievement',
  AUCTION = 'auction',
  BANK = 'bank',
  SPECIALIZATION = 'specialization'
}

/**
 * Comprehensive action types covering all player activities
 * Organized by category for easy filtering and analytics
 */
export enum ActionType {
  // AUTH (5 types)
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  PASSWORD_CHANGE = 'password_change',
  SESSION_REFRESH = 'session_refresh',
  
  // MOVEMENT (2 types)
  MOVE = 'move',
  TELEPORT = 'teleport',
  
  // RESOURCE (4 types)
  HARVEST_METAL = 'harvest_metal',
  HARVEST_ENERGY = 'harvest_energy',
  FORAGE_CAVE = 'forage_cave',
  FORAGE_FOREST = 'forage_forest',
  
  // COMBAT (6 types)
  ATTACK_PLAYER = 'attack_player',
  ATTACK_FACTORY = 'attack_factory',
  DEFEND_ATTACK = 'defend_attack',
  BATTLE_WIN = 'battle_win',
  BATTLE_LOSS = 'battle_loss',
  UNIT_DEATH = 'unit_death',
  
  // FACTORY (5 types)
  FACTORY_CLAIM = 'factory_claim',
  FACTORY_UPGRADE = 'factory_upgrade',
  FACTORY_PRODUCE = 'factory_produce',
  FACTORY_COLLECT = 'factory_collect',
  FACTORY_LOST = 'factory_lost',
  
  // UNIT (3 types)
  UNIT_BUILD = 'unit_build',
  UNIT_DISBAND = 'unit_disband',
  UNIT_UPGRADE = 'unit_upgrade',
  
  // SHRINE (3 types)
  SHRINE_VISIT = 'shrine_visit',
  SHRINE_BOOST = 'shrine_boost',
  SHRINE_COMPLETE = 'shrine_complete',
  
  // DISCOVERY (2 types)
  DISCOVERY_FOUND = 'discovery_found',
  DISCOVERY_VIEW = 'discovery_view',
  
  // ACHIEVEMENT (2 types)
  ACHIEVEMENT_UNLOCK = 'achievement_unlock',
  ACHIEVEMENT_VIEW = 'achievement_view',
  
  // AUCTION (5 types)
  AUCTION_CREATE = 'auction_create',
  AUCTION_BID = 'auction_bid',
  AUCTION_BUYOUT = 'auction_buyout',
  AUCTION_CANCEL = 'auction_cancel',
  AUCTION_COLLECT = 'auction_collect',
  
  // BANK (2 types)
  BANK_DEPOSIT = 'bank_deposit',
  BANK_WITHDRAW = 'bank_withdraw',
  
  // SPECIALIZATION (3 types)
  SPECIALIZATION_SELECT = 'specialization_select',
  SPECIALIZATION_RESPEC = 'specialization_respec',
  MASTERY_GAIN = 'mastery_gain',
  
  // CLAN (10 types)
  CLAN_CREATE = 'clan_create',
  CLAN_JOIN = 'clan_join',
  CLAN_LEAVE = 'clan_leave',
  CLAN_INVITE = 'clan_invite',
  CLAN_KICK = 'clan_kick',
  CLAN_PROMOTE = 'clan_promote',
  CLAN_RESEARCH = 'clan_research',
  CLAN_TERRITORY_CLAIM = 'clan_territory_claim',
  CLAN_WAR_DECLARE = 'clan_war_declare',
  CLAN_MONUMENT_CONTROL = 'clan_monument_control',
  
  // ADMIN (5 types)
  ADMIN_BAN = 'admin_ban',
  ADMIN_UNBAN = 'admin_unban',
  ADMIN_RESOURCE_MODIFY = 'admin_resource_modify',
  ADMIN_VIEW_LOGS = 'admin_view_logs',
  ADMIN_EXPORT_DATA = 'admin_export_data',
  
  // SYSTEM (3 types)
  ERROR = 'error',
  RATE_LIMIT = 'rate_limit',
  SECURITY_ALERT = 'security_alert'
}

/**
 * Battle outcome types for combat logging
 */
export enum BattleOutcome {
  ATTACKER_WIN = 'attacker_win',
  DEFENDER_WIN = 'defender_win',
  DRAW = 'draw'
}

/**
 * Battle types for categorizing combat
 */
export enum BattleType {
  PLAYER_VS_PLAYER = 'pvp',
  PLAYER_VS_FACTORY = 'pve_factory',
  CLAN_WAR = 'clan_war'
}

// ============================================================================
// INTERFACES - Core Data Structures
// ============================================================================

/**
 * Main activity log entry structure
 * Stored in MongoDB ActionLog collection
 */
export interface ActivityLog {
  _id?: string;
  
  // Player identification
  playerId: string;
  username: string;
  
  // Action details
  actionType: ActionType;
  category: ActionCategory;
  timestamp: Date;
  
  // Action-specific data (flexible object for various action types)
  details: Record<string, any>;
  
  // Outcome tracking
  success: boolean;
  errorMessage?: string;
  errorCode?: string;
  
  // Performance metrics
  executionTimeMs: number;
  
  // Security metadata
  ipAddress: string;
  userAgent: string;
  
  // Session tracking
  sessionId?: string;
  
  // Admin tracking (for admin actions)
  adminId?: string;
  adminUsername?: string;
}

/**
 * Battle log entry structure for detailed combat tracking
 * Stored in MongoDB BattleLog collection (enhances existing)
 */
export interface BattleLog {
  _id?: string;
  
  // Battle identification
  battleId: string;
  battleType: BattleType;
  timestamp: Date;
  
  // Participants
  attackerId: string;
  attackerUsername: string;
  defenderId: string;
  defenderUsername: string;
  
  // Location
  tileX: number;
  tileY: number;
  
  // Battle outcome
  outcome: BattleOutcome;
  winner: string;
  loser: string;
  
  // Combat details
  attackerUnits: UnitSnapshot[];
  defenderUnits: UnitSnapshot[];
  attackerSurvivors: UnitSnapshot[];
  defenderSurvivors: UnitSnapshot[];
  
  // Statistics
  attackerDamageDealt: number;
  defenderDamageDealt: number;
  attackerUnitsLost: number;
  defenderUnitsLost: number;
  totalDamage: number;
  battleDurationMs: number;
  
  // Resources
  resourcesLooted?: {
    metal: number;
    energy: number;
  };
  
  // Special conditions
  factoryId?: string; // If factory battle
  clanWarId?: string; // If clan war battle
  territoryId?: string; // If territory battle
  
  // Metadata
  attackerLevel: number;
  defenderLevel: number;
  attackerSpecialization?: string;
  defenderSpecialization?: string;
}

/**
 * Unit snapshot for battle logging
 * Captures unit state at time of battle
 */
export interface UnitSnapshot {
  unitType: string;
  quantity: number;
  strength: number;
  defense: number;
  health: number;
  tier: number;
}

/**
 * Activity log query parameters
 */
export interface ActivityLogQuery {
  playerId?: string;
  username?: string;
  actionType?: ActionType | ActionType[];
  category?: ActionCategory | ActionCategory[];
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'executionTimeMs';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Battle log query parameters
 */
export interface BattleLogQuery {
  playerId?: string; // Matches attacker or defender
  battleType?: BattleType;
  outcome?: BattleOutcome;
  startDate?: Date;
  endDate?: Date;
  tileX?: number;
  tileY?: number;
  limit?: number;
  offset?: number;
}

/**
 * Activity log statistics response
 */
export interface ActivityLogStats {
  totalActions: number;
  actionsByCategory: Record<ActionCategory, number>;
  actionsByType: Record<ActionType, number>;
  successRate: number;
  averageExecutionTimeMs: number;
  uniquePlayers: number;
  dateRange: {
    earliest: Date;
    latest: Date;
  };
  topPlayers: Array<{
    playerId: string;
    username: string;
    actionCount: number;
  }>;
  errorRate: number;
  errorsByType: Record<string, number>;
}

/**
 * Battle log statistics response
 */
export interface BattleLogStats {
  totalBattles: number;
  battlesByType: Record<BattleType, number>;
  winRate: {
    attacker: number;
    defender: number;
    draw: number;
  };
  averageDamage: number;
  totalUnitsLost: number;
  mostActivePlayers: Array<{
    playerId: string;
    username: string;
    battlesParticipated: number;
    wins: number;
    losses: number;
  }>;
  deadliestUnits: Array<{
    unitType: string;
    totalDamageDealt: number;
    battlesUsed: number;
  }>;
}

/**
 * Log retention configuration
 */
export interface LogRetentionPolicy {
  activityLogDays: number; // Default: 90 days
  battleLogDays: number; // Default: 180 days
  adminLogDays: number; // Default: 365 days
  archiveEnabled: boolean;
  archiveLocation?: string;
}

/**
 * Middleware logging context
 */
export interface LoggingContext {
  startTime: number;
  playerId?: string;
  username?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  actionType?: ActionType;
  category?: ActionCategory;
  details?: Record<string, any>;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if action type belongs to combat category
 */
export function isCombatAction(actionType: ActionType): boolean {
  return [
    ActionType.ATTACK_PLAYER,
    ActionType.ATTACK_FACTORY,
    ActionType.DEFEND_ATTACK,
    ActionType.BATTLE_WIN,
    ActionType.BATTLE_LOSS,
    ActionType.UNIT_DEATH
  ].includes(actionType);
}

/**
 * Type guard to check if action type requires admin privileges
 */
export function isAdminAction(actionType: ActionType): boolean {
  return [
    ActionType.ADMIN_BAN,
    ActionType.ADMIN_UNBAN,
    ActionType.ADMIN_RESOURCE_MODIFY,
    ActionType.ADMIN_VIEW_LOGS,
    ActionType.ADMIN_EXPORT_DATA
  ].includes(actionType);
}

/**
 * Get category for action type
 */
export function getActionCategory(actionType: ActionType): ActionCategory {
  if (actionType.startsWith('login') || actionType.startsWith('register') || 
      actionType.startsWith('logout') || actionType.startsWith('password') || 
      actionType.startsWith('session')) {
    return ActionCategory.AUTH;
  }
  if (actionType.startsWith('move') || actionType.startsWith('teleport')) {
    return ActionCategory.MOVEMENT;
  }
  if (actionType.startsWith('harvest') || actionType.startsWith('forage')) {
    return ActionCategory.RESOURCE;
  }
  if (actionType.startsWith('attack') || actionType.startsWith('battle') || 
      actionType.startsWith('defend') || actionType.startsWith('unit_death')) {
    return ActionCategory.COMBAT;
  }
  if (actionType.startsWith('factory')) {
    return ActionCategory.FACTORY;
  }
  if (actionType.startsWith('unit_')) {
    return ActionCategory.UNIT;
  }
  if (actionType.startsWith('shrine')) {
    return ActionCategory.SHRINE;
  }
  if (actionType.startsWith('discovery')) {
    return ActionCategory.DISCOVERY;
  }
  if (actionType.startsWith('achievement')) {
    return ActionCategory.ACHIEVEMENT;
  }
  if (actionType.startsWith('auction')) {
    return ActionCategory.AUCTION;
  }
  if (actionType.startsWith('bank')) {
    return ActionCategory.BANK;
  }
  if (actionType.startsWith('specialization') || actionType.startsWith('mastery')) {
    return ActionCategory.SPECIALIZATION;
  }
  if (actionType.startsWith('clan')) {
    return ActionCategory.CLAN;
  }
  if (actionType.startsWith('admin')) {
    return ActionCategory.ADMIN;
  }
  return ActionCategory.SYSTEM;
}

/**
 * FOOTER:
 * 
 * Implementation Notes:
 * - 30+ action types provide comprehensive coverage of all player activities
 * - Flexible details object supports varying data structures per action type
 * - Security metadata enables audit trails and abuse detection
 * - Battle logs provide detailed combat analytics for balancing
 * - Type guards enable safe runtime type checking
 * 
 * Known Limitations:
 * - Details object is untyped (Record<string, any>) for flexibility
 * - Large volume logging requires careful index management
 * 
 * Future Enhancements:
 * - Add typed details interfaces per action type
 * - Implement log aggregation for analytics dashboard
 * - Add real-time log streaming via WebSocket
 * - Implement anomaly detection for security alerts
 */
