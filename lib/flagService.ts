/**
 * @file lib/flagService.ts
 * @created 2025-10-20
 * @overview Flag Bearer tracking utility functions
 * 
 * OVERVIEW:
 * Provides calculation and utility functions for the Flag Bearer tracking system.
 * Handles distance calculations, compass direction determination, attack range
 * validation, and data transformation for the Flag Tracker Panel.
 * 
 * Key Functions:
 * - calculateDistance: Euclidean distance between two positions
 * - getCompassDirection: Cardinal/intercardinal direction from A to B
 * - isInAttackRange: Check if bearer is attackable
 * - buildTrackerData: Combine all calculations into FlagTrackerData
 */

import { 
  type FlagBearer, 
  type FlagTrackerData, 
  CompassDirection,
  FLAG_CONFIG 
} from '@/types/flag.types';

/**
 * Calculate Euclidean distance between two positions
 * 
 * Uses standard distance formula: sqrt((x2-x1)^2 + (y2-y1)^2)
 * Returns integer tiles (rounded to nearest whole number)
 * 
 * @param from - Starting position
 * @param to - Target position
 * @returns Distance in tiles (rounded)
 * 
 * @example
 * ```ts
 * const distance = calculateDistance(
 *   { x: 10, y: 20 },
 *   { x: 15, y: 25 }
 * );
 * // Returns: 7 tiles
 * ```
 */
export function calculateDistance(
  from: { x: number; y: number },
  to: { x: number; y: number }
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.round(distance);
}

/**
 * Get compass direction from one position to another
 * 
 * Calculates angle between positions and converts to 8-directional compass.
 * Uses atan2 for angle calculation, then maps to nearest compass direction.
 * 
 * Angle ranges (degrees from North, clockwise):
 * - N:  337.5 - 22.5
 * - NE: 22.5 - 67.5
 * - E:  67.5 - 112.5
 * - SE: 112.5 - 157.5
 * - S:  157.5 - 202.5
 * - SW: 202.5 - 247.5
 * - W:  247.5 - 292.5
 * - NW: 292.5 - 337.5
 * 
 * @param from - Starting position (tracker)
 * @param to - Target position (Flag Bearer)
 * @returns Compass direction enum
 * 
 * @example
 * ```ts
 * const direction = getCompassDirection(
 *   { x: 50, y: 50 },
 *   { x: 60, y: 40 }
 * );
 * // Returns: CompassDirection.NorthEast
 * ```
 */
export function getCompassDirection(
  from: { x: number; y: number },
  to: { x: number; y: number }
): CompassDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  // Handle same position
  if (dx === 0 && dy === 0) {
    return CompassDirection.North; // Default to North if same position
  }
  
  // Calculate angle in radians (atan2 returns -PI to PI)
  // Note: In screen coordinates, Y increases downward, so we negate dy
  const angleRad = Math.atan2(dx, -dy);
  
  // Convert to degrees (0-360, where 0 is North)
  const angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
  
  // Map angle to compass direction (8 directions, 45° each)
  if (angleDeg >= 337.5 || angleDeg < 22.5) return CompassDirection.North;
  if (angleDeg >= 22.5 && angleDeg < 67.5) return CompassDirection.NorthEast;
  if (angleDeg >= 67.5 && angleDeg < 112.5) return CompassDirection.East;
  if (angleDeg >= 112.5 && angleDeg < 157.5) return CompassDirection.SouthEast;
  if (angleDeg >= 157.5 && angleDeg < 202.5) return CompassDirection.South;
  if (angleDeg >= 202.5 && angleDeg < 247.5) return CompassDirection.SouthWest;
  if (angleDeg >= 247.5 && angleDeg < 292.5) return CompassDirection.West;
  return CompassDirection.NorthWest;
}

/**
 * Check if Flag Bearer is within attack range
 * 
 * Uses circular attack range (Euclidean distance).
 * Attack range is defined in FLAG_CONFIG.ATTACK_RANGE (default: 5 tiles).
 * 
 * @param trackerPosition - Attacker's position
 * @param bearerPosition - Flag Bearer's position
 * @returns True if bearer is within attack range
 * 
 * @example
 * ```ts
 * const canAttack = isInAttackRange(
 *   { x: 50, y: 50 },
 *   { x: 54, y: 52 }
 * );
 * // Returns: true (distance ~4.5 tiles, within 5-tile range)
 * ```
 */
export function isInAttackRange(
  trackerPosition: { x: number; y: number },
  bearerPosition: { x: number; y: number }
): boolean {
  const distance = calculateDistance(trackerPosition, bearerPosition);
  return distance <= FLAG_CONFIG.ATTACK_RANGE;
}

/**
 * Build complete tracker data from Flag Bearer and tracker position
 * 
 * Combines all calculations (distance, direction, range check) into
 * a single FlagTrackerData object for the UI component.
 * 
 * @param bearer - Current Flag Bearer (null if no one has flag)
 * @param trackerPosition - Tracker's current position
 * @returns Complete FlagTrackerData object
 * 
 * @example
 * ```ts
 * const trackerData = buildTrackerData(
 *   flagBearer,
 *   { x: 75, y: 75 }
 * );
 * 
 * console.log(trackerData.distance); // 23 tiles
 * console.log(trackerData.direction); // CompassDirection.North
 * console.log(trackerData.inAttackRange); // false
 * ```
 */
export function buildTrackerData(
  bearer: FlagBearer | null,
  trackerPosition: { x: number; y: number }
): FlagTrackerData {
  // No bearer - return default data
  if (!bearer) {
    return {
      bearer: null,
      distance: 0,
      direction: CompassDirection.North,
      inAttackRange: false,
      trackerPosition
    };
  }
  
  // Calculate all tracking data
  const distance = calculateDistance(trackerPosition, bearer.position);
  const direction = getCompassDirection(trackerPosition, bearer.position);
  const inAttackRange = isInAttackRange(trackerPosition, bearer.position);
  
  return {
    bearer,
    distance,
    direction,
    inAttackRange,
    trackerPosition
  };
}

/**
 * Format distance for display with appropriate units
 * 
 * @param distance - Distance in tiles
 * @returns Formatted string with units
 * 
 * @example
 * ```ts
 * formatDistance(1);   // "1 tile"
 * formatDistance(23);  // "23 tiles"
 * formatDistance(150); // "150 tiles"
 * ```
 */
export function formatDistance(distance: number): string {
  return distance === 1 ? '1 tile' : `${distance} tiles`;
}

/**
 * Get visual compass arrow for direction
 * 
 * Returns Unicode arrow character for visual compass display
 * 
 * @param direction - Compass direction enum
 * @returns Unicode arrow character
 * 
 * @example
 * ```ts
 * getCompassArrow(CompassDirection.North);     // "↑"
 * getCompassArrow(CompassDirection.NorthEast); // "↗"
 * getCompassArrow(CompassDirection.East);      // "→"
 * ```
 */
export function getCompassArrow(direction: CompassDirection): string {
  const arrows: Record<CompassDirection, string> = {
    [CompassDirection.North]: '↑',
    [CompassDirection.NorthEast]: '↗',
    [CompassDirection.East]: '→',
    [CompassDirection.SouthEast]: '↘',
    [CompassDirection.South]: '↓',
    [CompassDirection.SouthWest]: '↙',
    [CompassDirection.West]: '←',
    [CompassDirection.NorthWest]: '↖'
  };
  
  return arrows[direction];
}

/**
 * Format hold duration as human-readable time
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted time string
 * 
 * @example
 * ```ts
 * formatHoldDuration(45);    // "45s"
 * formatHoldDuration(120);   // "2m 0s"
 * formatHoldDuration(3725);  // "1h 2m 5s"
 * ```
 */
export function formatHoldDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Calculate time remaining until flag auto-drops
 * 
 * @param holdDuration - Current hold duration in seconds
 * @returns Remaining time in seconds
 * 
 * @example
 * ```ts
 * const remaining = getTimeRemaining(3400); // 200 seconds left
 * ```
 */
export function getTimeRemaining(holdDuration: number): number {
  return Math.max(0, FLAG_CONFIG.MAX_HOLD_DURATION - holdDuration);
}

/**
 * Check if flag is about to expire (within warning threshold)
 * 
 * @param holdDuration - Current hold duration in seconds
 * @param warningThreshold - Warning threshold in seconds (default: 300 = 5 minutes)
 * @returns True if within warning threshold
 * 
 * @example
 * ```ts
 * const isExpiringSoon = isFlagExpiringSoon(3500); // true (100s left)
 * ```
 */
export function isFlagExpiringSoon(
  holdDuration: number, 
  warningThreshold: number = 300
): boolean {
  const remaining = getTimeRemaining(holdDuration);
  return remaining > 0 && remaining <= warningThreshold;
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. **Distance Calculation:**
 *    - Euclidean distance for circular attack range
 *    - More intuitive than Manhattan distance for combat
 *    - Rounded to integer tiles for display
 * 
 * 2. **Compass Direction:**
 *    - 8 directions provide good granularity without complexity
 *    - Uses atan2 for accurate angle calculation
 *    - Handles edge cases (same position, exact angles)
 * 
 * 3. **Attack Range:**
 *    - Circular range (5 tiles radius)
 *    - Prevents diagonal advantage vs square range
 *    - Consistent with distance calculation
 * 
 * 4. **Performance:**
 *    - All calculations are O(1) constant time
 *    - No loops or recursive operations
 *    - Safe for real-time updates (every 5 seconds)
 * 
 * 5. **Edge Cases:**
 *    - Same position: Returns North, 0 tiles, in range
 *    - No bearer: Returns safe default values
 *    - Max distance (diagonal 150x150): ~212 tiles
 */
