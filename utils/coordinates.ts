/**
 * @file utils/coordinates.ts
 * @created 2025-10-16
 * @overview Coordinate calculation utilities with wrap-around logic
 * 
 * OVERVIEW:
 * Provides utility functions for coordinate manipulation including wrap-around
 * at map boundaries (moving beyond 150 wraps to 1, moving before 1 wraps to 150).
 */

import { Position, MovementDirection, DirectionDelta, GAME_CONSTANTS } from '@/types';

/**
 * Normalize a single coordinate value with wrap-around
 * 
 * Ensures coordinates stay within 1-150 range with wrapping:
 * - 151 becomes 1
 * - 0 becomes 150
 * - -1 becomes 149
 * 
 * @param value - The coordinate value to normalize
 * @returns Normalized coordinate (1-150)
 * 
 * @example
 * ```typescript
 * normalizeCoordinate(151) // returns 1
 * normalizeCoordinate(0)   // returns 150
 * normalizeCoordinate(75)  // returns 75
 * ```
 */
export function normalizeCoordinate(value: number): number {
  // Handle wrap-around using modulo
  // Subtract 1 to convert to 0-based, apply modulo, add 1 to convert back to 1-based
  const zeroBased = ((value - 1) % GAME_CONSTANTS.MAP_WIDTH + GAME_CONSTANTS.MAP_WIDTH) % GAME_CONSTANTS.MAP_WIDTH;
  return zeroBased + 1;
}

/**
 * Calculate new position after moving in a direction
 * 
 * Applies movement delta and wraps coordinates at boundaries
 * 
 * @param current - Current position
 * @param direction - Direction to move
 * @returns New position with wrap-around applied
 * 
 * @example
 * ```typescript
 * const newPos = calculateNewPosition({ x: 150, y: 75 }, MovementDirection.East);
 * // returns { x: 1, y: 75 } (wrapped from 151 to 1)
 * ```
 */
export function calculateNewPosition(
  current: Position,
  direction: MovementDirection
): Position {
  const delta = DirectionDelta[direction];
  
  return {
    x: normalizeCoordinate(current.x + delta.x),
    y: normalizeCoordinate(current.y + delta.y)
  };
}

/**
 * Validate that coordinates are within valid range (1-150)
 * 
 * @param position - Position to validate
 * @returns True if valid, false otherwise
 * 
 * @example
 * ```typescript
 * isValidPosition({ x: 75, y: 100 })  // true
 * isValidPosition({ x: 0, y: 75 })    // false
 * isValidPosition({ x: 151, y: 75 })  // false
 * ```
 */
export function isValidPosition(position: Position): boolean {
  return (
    position.x >= 1 &&
    position.x <= GAME_CONSTANTS.MAP_WIDTH &&
    position.y >= 1 &&
    position.y <= GAME_CONSTANTS.MAP_HEIGHT
  );
}

/**
 * Calculate Manhattan distance between two positions
 * 
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Manhattan distance
 * 
 * @example
 * ```typescript
 * const distance = manhattanDistance({ x: 1, y: 1 }, { x: 5, y: 5 });
 * // returns 8
 * ```
 */
export function manhattanDistance(pos1: Position, pos2: Position): number {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

/**
 * Check if two positions are equal
 * 
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns True if positions are equal
 * 
 * @example
 * ```typescript
 * positionsEqual({ x: 5, y: 10 }, { x: 5, y: 10 })  // true
 * positionsEqual({ x: 5, y: 10 }, { x: 6, y: 10 })  // false
 * ```
 */
export function positionsEqual(pos1: Position, pos2: Position): boolean {
  return pos1.x === pos2.x && pos1.y === pos2.y;
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Modulo operation handles wrap-around in both directions
// - 1-based coordinate system (1-150, not 0-149)
// - All functions are pure (no side effects)
// - Comprehensive validation utilities
// ============================================================
// END OF FILE
// ============================================================
