/**
 * autoFarm.types.ts
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * TypeScript type definitions for the Auto-Farm monetization system.
 * Defines configuration options, state management, and statistics tracking
 * for automated map traversal and resource collection.
 */

/**
 * Rank filter options for combat targeting
 */
export enum RankFilter {
  ALL = 'all',           // Attack any player
  LOWER = 'lower',       // Only attack lower-ranked players
  HIGHER = 'higher'      // Only attack higher-ranked players
}

/**
 * Resource target for base attacks
 */
export enum ResourceTarget {
  METAL = 'metal',       // Steal metal from bases
  ENERGY = 'energy',     // Steal energy from bases
  LOWEST = 'lowest'      // Auto-detect and steal lowest resource
}

/**
 * Auto-farm operational status
 */
export enum AutoFarmStatus {
  STOPPED = 'stopped',   // Not running
  ACTIVE = 'active',     // Currently running
  PAUSED = 'paused'      // Temporarily paused, can resume
}

/**
 * Auto-farm configuration settings
 */
export interface AutoFarmConfig {
  // Combat settings
  attackPlayers: boolean;              // Whether to attack player bases
  rankFilter: RankFilter;              // Which ranks to target
  resourceTarget: ResourceTarget;      // Which resource to steal
  
  // Premium settings
  isVIP: boolean;                      // VIP status (determines speed tier)
  
  // Note: Harvest settings are always ALL by default
  // (metal, energy, caves, forests) - no toggles needed
}

/**
 * Current auto-farm state (runtime)
 */
export interface AutoFarmState {
  status: AutoFarmStatus;              // Current operational status
  currentPosition: {                   // Current tile coordinates
    x: number;
    y: number;
  };
  startPosition: {                     // Where auto-farm started
    x: number;
    y: number;
  };
  currentRow: number;                  // Current row (1-150)
  direction: 'forward' | 'backward';   // Current row direction
  tilesCompleted: number;              // Total tiles processed
  startTime: number | null;            // Session start timestamp
  pausedTime: number | null;           // When paused (for elapsed calc)
  lastHarvestTime: number | null;      // Last harvest timestamp (for cooldown tracking)
}

/**
 * Per-session statistics (reset on Stop)
 */
export interface AutoFarmSessionStats {
  timeElapsed: number;                 // Milliseconds elapsed
  metalCollected: number;              // Metal harvested this session
  energyCollected: number;             // Energy harvested this session
  tilesVisited: number;                // Tiles processed
  caveItemsFound: number;              // Cave items discovered
  forestItemsFound: number;            // Forest items discovered
  attacksLaunched: number;             // Base attacks attempted
  attacksWon: number;                  // Successful attacks
  attacksLost: number;                 // Failed attacks
  errorsEncountered: number;           // Tiles skipped due to errors
}

/**
 * All-time cumulative statistics (persisted)
 */
export interface AutoFarmAllTimeStats {
  totalTimeElapsed: number;            // Total milliseconds across all sessions
  totalMetalCollected: number;         // All-time metal
  totalEnergyCollected: number;        // All-time energy
  totalTilesVisited: number;           // All-time tiles
  totalCaveItemsFound: number;         // All-time cave items
  totalForestItemsFound: number;       // All-time forest items
  totalAttacksLaunched: number;        // All-time attacks
  totalAttacksWon: number;             // All-time victories
  totalAttacksLost: number;            // All-time defeats
  totalSessionsCompleted: number;      // Number of complete sessions
  lastUpdated: number;                 // Timestamp of last update
}

/**
 * Combined statistics for display
 */
export interface AutoFarmStats {
  session: AutoFarmSessionStats;
  allTime: AutoFarmAllTimeStats;
}

/**
 * Auto-farm event for logging/callbacks
 */
export interface AutoFarmEvent {
  type: 'move' | 'harvest' | 'combat' | 'error' | 'complete';
  timestamp: number;
  position: { x: number; y: number };
  data?: any;                          // Event-specific data
  message?: string;                    // Human-readable message
}

/**
 * Tile processing result
 */
export interface TileProcessResult {
  success: boolean;
  position: { x: number; y: number };
  action: 'moved' | 'harvested' | 'attacked' | 'skipped';
  resourcesGained?: {
    metal?: number;
    energy?: number;
    items?: number;
  };
  combatResult?: {
    won: boolean;
    resourceStolen?: number;
  };
  error?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_AUTO_FARM_CONFIG: AutoFarmConfig = {
  attackPlayers: false,
  rankFilter: RankFilter.ALL,
  resourceTarget: ResourceTarget.LOWEST,
  isVIP: false // Default to basic tier
};

/**
 * Default session statistics
 */
export const DEFAULT_SESSION_STATS: AutoFarmSessionStats = {
  timeElapsed: 0,
  metalCollected: 0,
  energyCollected: 0,
  tilesVisited: 0,
  caveItemsFound: 0,
  forestItemsFound: 0,
  attacksLaunched: 0,
  attacksWon: 0,
  attacksLost: 0,
  errorsEncountered: 0
};

/**
 * Default all-time statistics
 */
export const DEFAULT_ALL_TIME_STATS: AutoFarmAllTimeStats = {
  totalTimeElapsed: 0,
  totalMetalCollected: 0,
  totalEnergyCollected: 0,
  totalTilesVisited: 0,
  totalCaveItemsFound: 0,
  totalForestItemsFound: 0,
  totalAttacksLaunched: 0,
  totalAttacksWon: 0,
  totalAttacksLost: 0,
  totalSessionsCompleted: 0,
  lastUpdated: Date.now()
};
