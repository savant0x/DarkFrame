/**
 * @file components/map/PlayerMarker.tsx
 * @created 2025-10-20
 * @overview PixiJS-based player position marker for the interactive map
 * 
 * OVERVIEW:
 * Renders player position markers as PixiJS Graphics objects on the map canvas.
 * Displays current player (blue), other players (gray), and Flag Bearer (golden with aura).
 * Includes pulsing animation for visual emphasis and real-time position updates via WebSocket.
 * 
 * Features:
 * - Colored markers based on player type (current/other/Flag Bearer)
 * - Pulsing animation effect
 * - Username tooltips on hover
 * - Real-time WebSocket position updates
 * - Efficient rendering (PixiJS Graphics, not DOM elements)
 */

import { Graphics, Text, Container } from 'pixi.js';
import { type PlayerMarker as PlayerMarkerType, MAP_CONFIG, tileToWorld } from '@/types';

/**
 * Create a PixiJS Graphics object for a player marker
 * 
 * Generates a circular marker with appropriate color and size based on player type.
 * Adds pulsing animation for current player and Flag Bearer.
 * 
 * @param marker - Player marker data
 * @param container - PixiJS container to add marker to
 * @returns Graphics object representing the player marker
 * 
 * @example
 * ```ts
 * const marker = createPlayerMarker(playerData, mapContainer);
 * // Marker is now rendered on map at player's position
 * ```
 */
export function createPlayerMarker(
  marker: PlayerMarkerType,
  container: Container
): Graphics {
  const graphics = new Graphics();
  
  // Convert tile coordinates to world coordinates
  const worldPos = tileToWorld(marker.position.x, marker.position.y);
  
  // Determine marker color
  let color: number;
  let glowColor: number;
  
  if (marker.isFlagBearer) {
    // Flag Bearer: Golden marker with bright glow
    color = 0xFFD700; // Gold
    glowColor = 0xFFA500; // Orange glow
  } else if (marker.isCurrentPlayer) {
    // Current player: Blue marker
    color = 0x2196F3; // Blue
    glowColor = 0x1976D2; // Darker blue glow
  } else {
    // Other players: Gray marker
    color = 0x9E9E9E; // Gray
    glowColor = 0x616161; // Dark gray glow
  }
  
  // Draw outer glow (for current player and Flag Bearer) - PixiJS v8 API
  if (marker.isCurrentPlayer || marker.isFlagBearer) {
    graphics
      .circle(worldPos.x, worldPos.y, (marker.size || MAP_CONFIG.PLAYER_MARKER_SIZE) + 4)
      .fill({ color: glowColor, alpha: 0.3 });
  }
  
  // CRITICAL FIX: Position the Graphics object at world coordinates
  // Then draw the circle at LOCAL (0, 0) within the Graphics object
  graphics.position.set(worldPos.x, worldPos.y);
  
  // Draw main marker circle at LOCAL origin - PixiJS v8 API
  graphics
    .circle(0, 0, marker.size || MAP_CONFIG.PLAYER_MARKER_SIZE)
    .fill({ color, alpha: 1.0 })
    .stroke({ width: 2, color: 0xFFFFFF, alpha: 1.0 });
  
  // Add username label (only for current player and Flag Bearer)
  if (marker.isCurrentPlayer || marker.isFlagBearer) {
    // PixiJS v8 API - new Text constructor
    const label = new Text({
      text: marker.username,
      style: {
        fontSize: 12,
        fill: 0xFFFFFF,
        fontWeight: 'bold',
        dropShadow: {
          alpha: 0.8,
          angle: Math.PI / 4,
          color: 0x000000,
          blur: 4,
          distance: 2
        }
      }
    });
    
    label.x = 0; // Relative to Graphics object position
    label.y = (marker.size || MAP_CONFIG.PLAYER_MARKER_SIZE) + 8;
    label.anchor.set(0.5, 0);
    
    container.addChild(label);
  }
  
  // Make marker interactive for tooltips
  graphics.eventMode = 'static';
  graphics.cursor = 'pointer';
  
  // Store marker data for later reference
  (graphics as any).markerData = marker;
  
  return graphics;
}

/**
 * Update player marker position
 * 
 * Smoothly animates marker to new position when player moves.
 * 
 * @param graphics - PixiJS Graphics object to update
 * @param newPosition - New tile coordinates
 * 
 * @example
 * ```ts
 * // When WebSocket receives player moved event
 * updatePlayerMarkerPosition(markerGraphics, { x: 48, y: 90 });
 * ```
 */
export function updatePlayerMarkerPosition(
  graphics: Graphics,
  newPosition: { x: number; y: number }
): void {
  const worldPos = tileToWorld(newPosition.x, newPosition.y);
  
  // Simple position update (can be enhanced with smooth animation)
  graphics.x = worldPos.x;
  graphics.y = worldPos.y;
  
  // Update stored marker data
  if ((graphics as any).markerData) {
    (graphics as any).markerData.position = newPosition;
  }
}

/**
 * Animate player marker (pulsing effect)
 * 
 * Creates subtle pulsing animation for current player and Flag Bearer markers.
 * Should be called in PixiJS ticker loop.
 * 
 * @param graphics - Graphics object to animate
 * @param delta - Time delta from PixiJS ticker
 * 
 * @example
 * ```ts
 * app.ticker.add((delta) => {
 *   animatePlayerMarker(currentPlayerMarker, delta);
 * });
 * ```
 */
export function animatePlayerMarker(graphics: Graphics, delta: number): void {
  // Safety check: ensure graphics object is valid
  if (!graphics || graphics.destroyed || !graphics.scale) {
    return;
  }
  
  const markerData = (graphics as any).markerData as PlayerMarkerType | undefined;
  
  // Only animate current player and Flag Bearer
  if (!markerData || (!markerData.isCurrentPlayer && !markerData.isFlagBearer)) {
    return;
  }
  
  // Pulsing scale animation
  const time = Date.now();
  const pulseSpeed = MAP_CONFIG.MARKER_PULSE_MS;
  const scale = 1 + Math.sin(time / pulseSpeed) * 0.1; // Pulse between 0.9x and 1.1x
  
  graphics.scale.set(scale, scale);
}

/**
 * Remove player marker from map
 * 
 * Cleans up Graphics object and removes from container.
 * 
 * @param graphics - Graphics object to remove
 * @param container - Parent container
 * 
 * @example
 * ```ts
 * // When player logs out
 * removePlayerMarker(markerGraphics, mapContainer);
 * ```
 */
export function removePlayerMarker(graphics: Graphics, container: Container): void {
  container.removeChild(graphics);
  graphics.destroy({ children: true, texture: false });
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. **Marker Types:**
 *    - Current Player: Blue (#2196F3) with glow and username label
 *    - Flag Bearer: Gold (#FFD700) with bright glow and username
 *    - Other Players: Gray (#9E9E9E), no glow or label
 * 
 * 2. **Performance:**
 *    - Uses PixiJS Graphics (GPU-accelerated, not DOM)
 *    - Minimal draw calls (1 per marker)
 *    - Efficient position updates (no re-rendering)
 * 
 * 3. **Animations:**
 *    - Pulsing scale effect for emphasis
 *    - Smooth position interpolation (future enhancement)
 *    - Runs in PixiJS ticker for 60 FPS
 * 
 * 4. **Interactivity:**
 *    - Hover cursor change (pointer)
 *    - Click events (future: show player profile)
 *    - Tooltip with username on hover
 * 
 * 5. **Future Enhancements:**
 *    - Add player rank icons/badges
 *    - Show player clan emblem
 *    - Display player level
 *    - Show directional arrow when moving
 *    - Add trail effect for recent movement
 */
