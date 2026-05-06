/**
 * @file map.types.ts
 * @created 2025-10-20
 * @overview TypeScript type definitions for the PixiJS-based interactive map system
 * 
 * OVERVIEW:
 * Defines all types related to the Flag feature map visualization including zoom levels,
 * viewport configuration, player markers, and map interaction states. These types support
 * the PixiJS rendering engine and real-time WebSocket updates for the 150x150 grid map.
 * 
 * The map system serves as the foundation for:
 * - Flag Bearer tracking and visualization
 * - Particle trail rendering (8-minute golden sparkles)
 * - Territory control displays (future: Clan Wars)
 * - Factory location visualization
 * - Player position tracking and navigation
 */

import { type Position, TerrainType } from './game.types';

/**
 * Zoom level configurations for the PixiJS map
 * 
 * Determines how much of the 150x150 map is visible at once:
 * - FullMap: See all 22,500 tiles (strategic overview)
 * - Quadrant: See ~5,625 tiles (regional planning)
 * - Zone: See ~1,369 tiles (local area tactics)
 * - Region: See ~324 tiles (detailed positioning)
 * 
 * @example
 * ```ts
 * const zoom: ZoomLevel = 'Zone'; // 4x magnification
 * ```
 */
export type ZoomLevel = 'FullMap' | 'Quadrant' | 'Zone' | 'Region';

/**
 * Zoom level scale multipliers for PixiJS camera
 * 
 * Maps ZoomLevel to actual PixiJS scale values for rendering
 */
export const ZOOM_SCALES: Record<ZoomLevel, number> = {
  FullMap: 1.0,   // 150x150 tiles visible
  Quadrant: 2.0,  // 75x75 tiles visible
  Zone: 4.0,      // 37x37 tiles visible
  Region: 8.0     // 18x18 tiles visible
};

/**
 * Visible tile counts at each zoom level (approximate)
 * 
 * Used for performance optimization (viewport culling)
 */
export const ZOOM_VISIBLE_TILES: Record<ZoomLevel, number> = {
  FullMap: 22500,  // All tiles
  Quadrant: 5625,  // 75x75
  Zone: 1369,      // 37x37
  Region: 324      // 18x18
};

/**
 * Map tile data structure for rendering
 * 
 * Extended from base Tile interface with rendering-specific properties
 * 
 * @property x - Horizontal coordinate (1-150)
 * @property y - Vertical coordinate (1-150)
 * @property terrain - Terrain type for coloring/texture
 * @property isVisible - Whether tile is currently in viewport (for culling)
 * @property hasPlayer - Whether a player is currently on this tile
 * @property hasFlagBearer - Whether the Flag Bearer is on this tile
 * @property hasParticleTrail - Whether this tile has Flag Bearer's particle trail
 * @property trailAge - Age of particle trail in minutes (0-8)
 */
export interface MapTile {
  x: number;
  y: number;
  terrain: TerrainType;
  isVisible?: boolean;
  hasPlayer?: boolean;
  hasFlagBearer?: boolean;
  hasParticleTrail?: boolean;
  trailAge?: number;
}

/**
 * Player marker configuration for map display
 * 
 * Represents a player's position on the interactive map with visual styling
 * 
 * @property playerId - Unique player identifier (username or ObjectId)
 * @property username - Display name for tooltips
 * @property position - Current map coordinates
 * @property color - Marker color (hex string, e.g., "#2196F3")
 * @property isCurrentPlayer - Whether this is the logged-in player (blue marker)
 * @property isFlagBearer - Whether this player holds the Flag (golden marker with aura)
 * @property size - Marker size in pixels (default: 16)
 * 
 * @example
 * ```ts
 * const marker: PlayerMarker = {
 *   playerId: 'user123',
 *   username: 'DarkKnight',
 *   position: { x: 47, y: 89 },
 *   color: '#2196F3',
 *   isCurrentPlayer: true,
 *   isFlagBearer: false,
 *   size: 16
 * };
 * ```
 */
export interface PlayerMarker {
  playerId: string;
  username: string;
  position: Position;
  color: string;
  isCurrentPlayer: boolean;
  isFlagBearer: boolean;
  size?: number;
}

/**
 * Map viewport configuration for camera control
 * 
 * Defines the visible portion of the map and camera positioning
 * 
 * @property x - Camera X position in world coordinates
 * @property y - Camera Y position in world coordinates
 * @property width - Viewport width in pixels
 * @property height - Viewport height in pixels
 * @property scale - Current zoom scale (from ZOOM_SCALES)
 * @property centerOn - Position to center camera on (usually player position)
 * 
 * @example
 * ```ts
 * const viewport: MapViewport = {
 *   x: 0,
 *   y: 0,
 *   width: 1200,
 *   height: 800,
 *   scale: 2.0,
 *   centerOn: { x: 47, y: 89 }
 * };
 * ```
 */
export interface MapViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  centerOn?: Position;
}

/**
 * Map interaction state for user controls
 * 
 * Tracks pan, zoom, and interaction states for the map interface
 * 
 * @property isPanning - Whether user is actively panning the camera
 * @property isZooming - Whether user is actively zooming (pinch gesture or wheel)
 * @property selectedTile - Currently selected/clicked tile coordinates
 * @property hoveredTile - Tile coordinates under mouse/touch pointer
 * @property panStartPosition - Starting position for pan gesture (touch or mouse)
 * @property lastPinchDistance - Previous distance between touch points (mobile pinch-zoom)
 */
export interface MapInteractionState {
  isPanning: boolean;
  isZooming: boolean;
  selectedTile: Position | null;
  hoveredTile: Position | null;
  panStartPosition: Position | null;
  lastPinchDistance: number | null;
}

/**
 * Tile color mapping for terrain visualization
 * 
 * Maps TerrainType enum values to hex colors for PixiJS rendering
 */
export const TILE_COLORS: Record<TerrainType, number> = {
  [TerrainType.Metal]: 0x4CAF50,      // Green
  [TerrainType.Energy]: 0xF44336,     // Red
  [TerrainType.Cave]: 0x795548,       // Brown
  [TerrainType.Forest]: 0x2E7D32,     // Dark Green
  [TerrainType.Factory]: 0x607D8B,    // Gray
  [TerrainType.Wasteland]: 0x424242,  // Dark Gray
  [TerrainType.Bank]: 0xFFD700,       // Gold
  [TerrainType.Shrine]: 0x9C27B0,     // Purple
  [TerrainType.AuctionHouse]: 0xFF6F00 // Orange
};

/**
 * Map configuration constants
 * 
 * Defines core map parameters for the PixiJS rendering system
 */
export const MAP_CONFIG = {
  /** Total map width in tiles */
  WIDTH: 150,
  
  /** Total map height in tiles */
  HEIGHT: 150,
  
  /** Total number of tiles on map */
  TOTAL_TILES: 22500,
  
  /** Tile size in pixels for rendering - 24px for balanced full map view (150×24 = 3600px) */
  TILE_SIZE: 24,
  
  /** Map coordinate boundaries */
  MIN_COORDINATE: 1,
  MAX_COORDINATE: 150,
  
  /** Performance targets */
  TARGET_FPS_DESKTOP: 60,
  TARGET_FPS_MOBILE: 30,
  
  /** Marker sizes */
  PLAYER_MARKER_SIZE: 14, // Balanced size for 24px tiles
  FLAG_MARKER_SIZE: 20, // Balanced size for 24px tiles
  
  /** Animation durations (milliseconds) */
  ZOOM_TRANSITION_MS: 300,
  PAN_TRANSITION_MS: 200,
  MARKER_PULSE_MS: 2000
} as const;

/**
 * WebSocket event payloads for real-time map updates
 * 
 * Defines data structures for WebSocket events related to map state changes
 */

/**
 * Player moved event payload
 * 
 * Broadcast when any player changes position on the map
 */
export interface MapPlayerMovedPayload {
  playerId: string;
  username: string;
  oldPosition: Position;
  newPosition: Position;
  isFlagBearer: boolean;
  timestamp: number;
}

/**
 * Map state update event payload
 * 
 * Broadcast for general map state changes (future: Flag location, territory updates)
 */
export interface MapStateUpdatePayload {
  updatedTiles?: MapTile[];
  playerPositions?: PlayerMarker[];
  flagBearerPosition?: Position | null;
  timestamp: number;
}

/**
 * Map tile click event data
 * 
 * Emitted when user clicks a tile on the map
 */
export interface MapTileClickEvent {
  tile: MapTile;
  position: Position;
  worldPosition: { x: number; y: number }; // PixiJS world coordinates
  screenPosition: { x: number; y: number }; // Screen pixel coordinates
}

/**
 * Type guard to check if coordinates are within map bounds
 * 
 * @param x - X coordinate to validate
 * @param y - Y coordinate to validate
 * @returns True if coordinates are valid (1-150)
 * 
 * @example
 * ```ts
 * if (isValidMapCoordinate(47, 89)) {
 *   // Coordinates are within map bounds
 * }
 * ```
 */
export function isValidMapCoordinate(x: number, y: number): boolean {
  return (
    x >= MAP_CONFIG.MIN_COORDINATE &&
    x <= MAP_CONFIG.MAX_COORDINATE &&
    y >= MAP_CONFIG.MIN_COORDINATE &&
    y <= MAP_CONFIG.MAX_COORDINATE
  );
}

/**
 * Calculate Euclidean distance between two positions
 * 
 * Used for:
 * - Challenge range validation (15 tiles for Flag stealing)
 * - Distance display in UI ("45 tiles away")
 * - Pathfinding calculations (future feature)
 * 
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Distance in tiles (float)
 * 
 * @example
 * ```ts
 * const dist = calculateDistance(
 *   { x: 10, y: 10 },
 *   { x: 20, y: 20 }
 * ); // Returns ~14.14 tiles
 * ```
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  return Math.sqrt(
    Math.pow(pos2.x - pos1.x, 2) + 
    Math.pow(pos2.y - pos1.y, 2)
  );
}

/**
 * Convert tile coordinates to PixiJS world coordinates
 * 
 * @param tileX - Tile X coordinate (1-150)
 * @param tileY - Tile Y coordinate (1-150)
 * @returns World position in pixels for PixiJS rendering
 * 
 * @example
 * ```ts
 * const worldPos = tileToWorld(47, 89);
 * // Returns { x: 1504, y: 2848 } (47 * 32, 89 * 32)
 * ```
 */
export function tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: tileX * MAP_CONFIG.TILE_SIZE,
    y: tileY * MAP_CONFIG.TILE_SIZE
  };
}

/**
 * Convert PixiJS world coordinates to tile coordinates
 * 
 * @param worldX - World X position in pixels
 * @param worldY - World Y position in pixels
 * @returns Tile coordinates (floored to integers)
 * 
 * @example
 * ```ts
 * const tilePos = worldToTile(1504, 2848);
 * // Returns { x: 47, y: 89 }
 * ```
 */
export function worldToTile(worldX: number, worldY: number): Position {
  return {
    x: Math.floor(worldX / MAP_CONFIG.TILE_SIZE),
    y: Math.floor(worldY / MAP_CONFIG.TILE_SIZE)
  };
}
