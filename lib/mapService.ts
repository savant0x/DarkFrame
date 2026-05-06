/**
 * @file lib/mapService.ts
 * @created 2025-10-20
 * @overview Core utility functions for map operations and calculations
 * 
 * OVERVIEW:
 * Provides essential helper functions for the PixiJS map system including distance
 * calculations, coordinate validation, tile type lookups, and viewport culling logic.
 * These utilities support the Flag feature map visualization and future territorial
 * gameplay mechanics.
 * 
 * Key Responsibilities:
 * - Distance calculations for challenge range validation
 * - Coordinate validation and bounds checking
 * - Tile type lookup and terrain queries
 * - Viewport culling for performance optimization
 * - World/tile coordinate conversions
 * 
 * Used By:
 * - /components/map/* (all map visualization components)
 * - /app/api/flag/* (Flag challenge range validation)
 * - /lib/flagService.ts (future: Flag mechanics validation)
 */

import {
  type Position,
  type TerrainType,
  type MapTile,
  type MapViewport,
  MAP_CONFIG,
  isValidMapCoordinate,
  calculateDistance,
  tileToWorld,
  worldToTile
} from '@/types';

/**
 * Get terrain type for a specific tile coordinate
 * 
 * Queries the game state to determine what terrain exists at given coordinates.
 * Returns Wasteland if coordinates are invalid or tile doesn't exist.
 * 
 * @param x - Tile X coordinate (1-150)
 * @param y - Tile Y coordinate (1-150)
 * @param mapData - Optional map data array (150x150 tiles)
 * @returns Terrain type at the specified coordinates
 * 
 * @example
 * ```ts
 * const terrain = getTileType(47, 89, gameMap);
 * if (terrain === 'Metal') {
 *   // Tile is a Metal resource tile
 * }
 * ```
 */
export function getTileType(
  x: number,
  y: number,
  mapData?: MapTile[][]
): TerrainType {
  // Validate coordinates
  if (!isValidMapCoordinate(x, y)) {
    return 'Wasteland' as TerrainType;
  }

  // Return terrain from provided map data
  if (mapData && mapData[y] && mapData[y][x]) {
    return mapData[y][x].terrain;
  }

  // Default to Wasteland if no data available
  return 'Wasteland' as TerrainType;
}

/**
 * Validate if coordinates are within map boundaries
 * 
 * Re-export of isValidMapCoordinate for convenience.
 * Map coordinates must be within 1-150 range (inclusive).
 * 
 * @param x - X coordinate to validate
 * @param y - Y coordinate to validate
 * @returns True if coordinates are valid
 * 
 * @example
 * ```ts
 * if (validateCoordinates(47, 89)) {
 *   // Safe to use coordinates
 * } else {
 *   // Handle invalid coordinates
 * }
 * ```
 */
export function validateCoordinates(x: number, y: number): boolean {
  return isValidMapCoordinate(x, y);
}

/**
 * Calculate distance between two positions (Euclidean distance)
 * 
 * Re-export of calculateDistance for convenience.
 * Used for Flag challenge range validation (15 tiles), distance displays,
 * and pathfinding calculations.
 * 
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Distance in tiles (float)
 * 
 * @example
 * ```ts
 * const playerPos = { x: 10, y: 10 };
 * const flagPos = { x: 20, y: 20 };
 * const dist = getDistance(playerPos, flagPos);
 * 
 * if (dist <= 15) {
 *   // Player is within challenge range!
 * }
 * ```
 */
export function getDistance(pos1: Position, pos2: Position): number {
  return calculateDistance(pos1, pos2);
}

/**
 * Calculate Manhattan distance between two positions
 * 
 * Alternative distance metric that only allows horizontal and vertical movement
 * (no diagonals). Useful for grid-based pathfinding.
 * 
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Manhattan distance in tiles
 * 
 * @example
 * ```ts
 * const dist = getManhattanDistance(
 *   { x: 10, y: 10 },
 *   { x: 15, y: 18 }
 * ); // Returns 13 (5 + 8)
 * ```
 */
export function getManhattanDistance(pos1: Position, pos2: Position): number {
  return Math.abs(pos2.x - pos1.x) + Math.abs(pos2.y - pos1.y);
}

/**
 * Check if a position is within range of another position
 * 
 * Useful for validating challenge ranges, ability ranges, etc.
 * Uses Euclidean distance by default.
 * 
 * @param origin - Center position
 * @param target - Position to check
 * @param range - Maximum distance (in tiles)
 * @param useManhattan - Use Manhattan distance instead of Euclidean (default: false)
 * @returns True if target is within range
 * 
 * @example
 * ```ts
 * // Check if player can challenge Flag Bearer (15 tile range)
 * if (isWithinRange(playerPos, flagPos, 15)) {
 *   // Enable "Challenge for Flag" button
 * }
 * ```
 */
export function isWithinRange(
  origin: Position,
  target: Position,
  range: number,
  useManhattan = false
): boolean {
  const distance = useManhattan
    ? getManhattanDistance(origin, target)
    : getDistance(origin, target);
  
  return distance <= range;
}

/**
 * Determine which tiles are visible in the current viewport
 * 
 * Calculates viewport bounds and returns tiles that should be rendered.
 * Critical for performance optimization (viewport culling).
 * 
 * @param viewport - Current viewport configuration
 * @param allTiles - All map tiles (150x150 array)
 * @returns Array of tiles within viewport bounds
 * 
 * @example
 * ```ts
 * const visibleTiles = getVisibleTiles(viewport, mapTiles);
 * // Only render these tiles (e.g., 900 instead of 22,500)
 * ```
 */
export function getVisibleTiles(
  viewport: MapViewport,
  allTiles: MapTile[][]
): MapTile[] {
  const visible: MapTile[] = [];

  // Calculate visible tile bounds based on viewport
  const tileViewportWidth = Math.ceil(viewport.width / (MAP_CONFIG.TILE_SIZE * viewport.scale));
  const tileViewportHeight = Math.ceil(viewport.height / (MAP_CONFIG.TILE_SIZE * viewport.scale));

  const cameraTilePos = worldToTile(viewport.x, viewport.y);
  
  const minX = Math.max(MAP_CONFIG.MIN_COORDINATE, cameraTilePos.x);
  const maxX = Math.min(MAP_CONFIG.MAX_COORDINATE, cameraTilePos.x + tileViewportWidth);
  const minY = Math.max(MAP_CONFIG.MIN_COORDINATE, cameraTilePos.y);
  const maxY = Math.min(MAP_CONFIG.MAX_COORDINATE, cameraTilePos.y + tileViewportHeight);

  // Iterate only visible tiles (not all 22,500!)
  // Note: allTiles array is 0-indexed, but tile coordinates are 1-indexed
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const row = allTiles[y - 1]; // Convert to 0-indexed
      if (row && row[x - 1]) { // Convert to 0-indexed
        visible.push({
          ...row[x - 1],
          isVisible: true
        });
      }
    }
  }

  return visible;
}

/**
 * Center viewport on a specific position
 * 
 * Calculates new viewport coordinates to center the camera on the given position.
 * Used for auto-centering on player, Flag Bearer, or clicked tiles.
 * Accounts for zoom scale - higher scale means smaller effective viewport.
 * 
 * @param position - Position to center on (tile coordinates)
 * @param viewport - Current viewport configuration
 * @returns Updated viewport configuration
 * 
 * @example
 * ```ts
 * // Center map on player position when route loads
 * const newViewport = centerViewportOn(playerPos, currentViewport);
 * setViewport(newViewport);
 * ```
 */
export function centerViewportOn(
  position: Position,
  viewport: MapViewport
): MapViewport {
  const worldPos = tileToWorld(position.x, position.y);

  // CRITICAL: Divide viewport dimensions by scale for correct centering
  // At scale 4, viewport shows 1/4 of the pixel area
  const effectiveWidth = viewport.width / viewport.scale;
  const effectiveHeight = viewport.height / viewport.scale;

  const centeredViewport = {
    ...viewport,
    x: worldPos.x - (effectiveWidth / 2),
    y: worldPos.y - (effectiveHeight / 2),
    centerOn: position
  };
  
  // Clamp to map bounds (prevents negative coordinates or out-of-bounds)
  return clampViewport(centeredViewport);
}

/**
 * Clamp viewport position to map boundaries
 * 
 * Prevents camera from panning outside the map bounds (1-150 tiles).
 * Ensures users can't pan into empty space.
 * 
 * @param viewport - Viewport to clamp
 * @returns Clamped viewport within map boundaries
 * 
 * @example
 * ```ts
 * // After user pans, ensure viewport stays within map
 * const clampedViewport = clampViewport(newViewport);
 * ```
 */
export function clampViewport(viewport: MapViewport): MapViewport {
  const maxX = (MAP_CONFIG.MAX_COORDINATE * MAP_CONFIG.TILE_SIZE) - viewport.width;
  const maxY = (MAP_CONFIG.MAX_COORDINATE * MAP_CONFIG.TILE_SIZE) - viewport.height;

  return {
    ...viewport,
    x: Math.max(0, Math.min(viewport.x, maxX)),
    y: Math.max(0, Math.min(viewport.y, maxY))
  };
}

/**
 * Get tiles within a circular radius
 * 
 * Returns all tiles within a specified radius of a center position.
 * Useful for area effects, fog of war, tracking ranges, etc.
 * 
 * @param center - Center position
 * @param radius - Radius in tiles
 * @param allTiles - All map tiles
 * @returns Array of tiles within radius
 * 
 * @example
 * ```ts
 * // Get all tiles within 10-tile radius of Flag Bearer
 * const nearbyTiles = getTilesInRadius(flagPos, 10, mapTiles);
 * ```
 */
export function getTilesInRadius(
  center: Position,
  radius: number,
  allTiles: MapTile[][]
): MapTile[] {
  const tiles: MapTile[] = [];

  const minX = Math.max(MAP_CONFIG.MIN_COORDINATE, Math.floor(center.x - radius));
  const maxX = Math.min(MAP_CONFIG.MAX_COORDINATE, Math.ceil(center.x + radius));
  const minY = Math.max(MAP_CONFIG.MIN_COORDINATE, Math.floor(center.y - radius));
  const maxY = Math.min(MAP_CONFIG.MAX_COORDINATE, Math.ceil(center.y + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const tile = allTiles[y]?.[x];
      if (tile && getDistance(center, { x, y }) <= radius) {
        tiles.push(tile);
      }
    }
  }

  return tiles;
}

/**
 * Format distance for display in UI
 * 
 * Converts numeric distance to user-friendly string with appropriate precision.
 * 
 * @param distance - Distance in tiles
 * @returns Formatted distance string
 * 
 * @example
 * ```ts
 * formatDistance(14.142) // "14 tiles away"
 * formatDistance(0.5)    // "< 1 tile away"
 * formatDistance(100)    // "100 tiles away"
 * ```
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return '< 1 tile away';
  }
  
  const rounded = Math.floor(distance);
  return `${rounded} tile${rounded === 1 ? '' : 's'} away`;
}

/**
 * Get direction from one position to another
 * 
 * Returns compass direction (N, NE, E, SE, S, SW, W, NW) from origin to target.
 * Useful for directional indicators in UI.
 * 
 * @param origin - Starting position
 * @param target - Target position
 * @returns Direction string (8 compass points)
 * 
 * @example
 * ```ts
 * const direction = getDirection(playerPos, flagPos);
 * // "Flag Bearer is 45 tiles NORTHEAST"
 * ```
 */
export function getDirection(origin: Position, target: Position): string {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;

  // Calculate angle in degrees (0 = North, 90 = East, etc.)
  const angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  const normalizedAngle = (angle + 360) % 360;

  // Map angle to 8 compass directions
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'NORTH';
  if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'NORTHEAST';
  if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'EAST';
  if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'SOUTHEAST';
  if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'SOUTH';
  if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'SOUTHWEST';
  if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'WEST';
  return 'NORTHWEST';
}

/**
 * Generate a simple directional arrow emoji based on direction
 * 
 * @param direction - Compass direction string
 * @returns Arrow emoji
 * 
 * @example
 * ```ts
 * getDirectionArrow('NORTHEAST') // "↗️"
 * ```
 */
export function getDirectionArrow(direction: string): string {
  const arrows: Record<string, string> = {
    NORTH: '⬆️',
    NORTHEAST: '↗️',
    EAST: '➡️',
    SOUTHEAST: '↘️',
    SOUTH: '⬇️',
    SOUTHWEST: '↙️',
    WEST: '⬅️',
    NORTHWEST: '↖️'
  };

  return arrows[direction] || '⬆️';
}

/**
 * Check if two positions are the same
 * 
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns True if positions have same coordinates
 * 
 * @example
 * ```ts
 * if (isSamePosition(playerPos, flagPos)) {
 *   // Player is on same tile as Flag!
 * }
 * ```
 */
export function isSamePosition(pos1: Position, pos2: Position): boolean {
  return pos1.x === pos2.x && pos1.y === pos2.y;
}
