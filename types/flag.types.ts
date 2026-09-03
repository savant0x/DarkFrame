/**
 * @file types/flag.types.ts
 * @created 2025-10-20
 * @overview Flag Bearer tracking system types and interfaces
 * 
 * OVERVIEW:
 * Type definitions for the Flag Bearer tracking mechanic where one player
 * carries the flag and other players hunt them down. Includes position tracking,
 * distance calculations, compass directions, and attack range validation.
 * 
 * Key Concepts:
 * - Flag Bearer: The player currently holding the flag
 * - Tracker: Any player viewing the Flag Tracker Panel
 * - Attack Range: Distance within which a player can attack the bearer
 * - Compass Direction: Cardinal/intercardinal directions (N, NE, E, etc.)
 */

/**
 * Compass direction from tracker to Flag Bearer
 * Uses 8-directional compass rose (cardinal + intercardinal)
 */
export enum CompassDirection {
  North = 'N',
  NorthEast = 'NE',
  East = 'E',
  SouthEast = 'SE',
  South = 'S',
  SouthWest = 'SW',
  West = 'W',
  NorthWest = 'NW'
}

/**
 * Flag Bearer player information
 */
export interface FlagBearer {
  /** Player ID of current flag bearer */
  playerId: string;
  
  /** Player username */
  username: string;
  
  /** Player level */
  level: number;
  
  /** Current position on 150x150 grid (1-indexed) */
  position: {
    x: number;
    y: number;
  };
  
  /** Timestamp when this player claimed the flag */
  claimedAt: Date;
  
  /** How long they've held the flag (in seconds) */
  holdDuration: number;
  
  /** Player's current HP (for attack calculations) */
  currentHP?: number;
  
  /** Player's max HP */
  maxHP?: number;
  
  /** Particle trail tiles (8-minute lingering effect) */
  trail?: Array<{
    x: number;
    y: number;
    timestamp: Date;
    expiresAt: Date;
  }>;
}

/**
 * Tracker data - calculated relationship between viewer and Flag Bearer
 */
export interface FlagTrackerData {
  /** Current Flag Bearer (null if no one has flag) */
  bearer: FlagBearer | null;
  
  /** Distance in tiles from tracker to bearer */
  distance: number;
  
  /** Compass direction from tracker to bearer */
  direction: CompassDirection;
  
  /** Whether bearer is within attack range */
  inAttackRange: boolean;
  
  /** Tracker's current position (for calculations) */
  trackerPosition: {
    x: number;
    y: number;
  };
}

/**
 * Flag attack request
 */
export interface FlagAttackRequest {
  /** Target player ID (Flag Bearer) */
  targetPlayerId: string;
  
  /** Attacker's current position (for range validation) */
  attackerPosition: {
    x: number;
    y: number;
  };
}

/**
 * Flag attack response
 */
export interface FlagAttackResponse {
  /** Whether attack was successful */
  success: boolean;
  
  /** Error message if attack failed */
  error?: string;
  
  /** Damage dealt (if successful) */
  damage?: number;
  
  /** Whether Flag Bearer was defeated */
  bearerDefeated?: boolean;
  
  /** New Flag Bearer ID (if previous bearer defeated and flag claimed) */
  newBearerId?: string;
}

/**
 * WebSocket event for flag position updates
 */
export interface FlagPositionUpdateEvent {
  /** Event type identifier */
  type: 'flag:position';
  
  /** Updated Flag Bearer data */
  bearer: FlagBearer;
  
  /** Timestamp of update */
  timestamp: Date;
}

/**
 * WebSocket event for flag ownership changes
 */
export interface FlagOwnershipChangeEvent {
  /** Event type identifier */
  type: 'flag:ownership';
  
  /** Previous bearer ID (null if flag was unclaimed) */
  previousBearerId: string | null;
  
  /** New bearer ID (null if flag dropped/lost) */
  newBearerId: string | null;
  
  /** New bearer data */
  newBearer: FlagBearer | null;
  
  /** Reason for ownership change */
  reason: 'claimed' | 'defeated' | 'dropped' | 'expired';
  
  /** Timestamp of change */
  timestamp: Date;
}

/**
 * Flag configuration constants
 */
export const FLAG_CONFIG = {
  /** Attack range in tiles (can attack if within this distance) */
  ATTACK_RANGE: 5,
  
  /** Maximum hold duration before flag auto-drops (seconds) */
  MAX_HOLD_DURATION: 3600, // 1 hour
  
  /** Cooldown between attacks (seconds) */
  ATTACK_COOLDOWN: 60,
  
  /** Base damage for flag attacks */
  BASE_ATTACK_DAMAGE: 100,
  
  /** Flag position update interval (ms) */
  POSITION_UPDATE_INTERVAL: 5000, // 5 seconds
} as const;

/**
 * Helper type for flag-related API responses
 */
export interface FlagAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. **Flag Bearer System:**
 *    - Only one player can hold flag at a time
 *    - Bearer position updates every 5 seconds via WebSocket
 *    - Flag auto-drops after 1 hour of holding
 *    - Bearer can be attacked within 5-tile range
 * 
 * 2. **Distance Calculation:**
 *    - Uses Euclidean distance: sqrt((x2-x1)^2 + (y2-y1)^2)
 *    - Rounded to nearest integer tile
 *    - Attack range is circular (not square grid)
 * 
 * 3. **Compass Direction:**
 *    - 8 directions (N, NE, E, SE, S, SW, W, NW)
 *    - Calculated from angle between tracker and bearer
 *    - Visual compass rose in UI
 * 
 * 4. **WebSocket Events:**
 *    - flag:position - Bearer moved (every 5s or on significant move)
 *    - flag:ownership - Bearer changed (claimed, defeated, dropped)
 *    - Real-time updates to all connected players
 * 
 * 5. **Attack Mechanics:**
 *    - Must be within 5 tiles to attack
 *    - 60 second cooldown between attacks
 *    - Defeating bearer allows claiming the flag
 *    - Base damage: 100 HP
 */
