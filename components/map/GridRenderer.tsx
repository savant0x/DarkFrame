/**
 * @file components/map/GridRenderer.tsx
 * @created 2025-10-20
 * @overview Core 150x150 grid rendering system using PixiJS
 * 
 * OVERVIEW:
 * Renders the DarkFrame 150x150 tile map using PixiJS Graphics with GPU acceleration.
 * Implements viewport culling to only render visible tiles for optimal performance.
 * Handles tile coloring based on terrain type, tile click events, and real-time updates.
 * 
 * Features:
 * - Efficient rendering (only visible tiles, viewport culling)
 * - Color-coded terrain tiles
 * - Interactive tile clicking (shows coordinates)
 * - Real-time tile updates via WebSocket
 * - Texture atlas support (future optimization)
 * - 60 FPS target on desktop, 30 FPS on mobile
 */

import { Graphics, Container } from 'pixi.js';
import { 
  type MapTile, 
  type MapViewport,
  type MapTileClickEvent,
  TerrainType,  // Import as value (enum)
  MAP_CONFIG, 
  TILE_COLORS,
  tileToWorld,
  worldToTile
} from '@/types';
import { getVisibleTiles } from '@/lib/mapService';

/**
 * Create the grid renderer container
 * 
 * Initializes a PixiJS Container for the 150x150 grid with all tiles.
 * Uses viewport culling to only render visible tiles for performance.
 * 
 * @param allTiles - Complete 150x150 map data
 * @param viewport - Current viewport configuration
 * @param onTileClick - Callback when user clicks a tile
 * @returns PixiJS Container with rendered grid
 * 
 * @example
 * ```ts
 * const gridContainer = createGridRenderer(
 *   mapData,
 *   viewport,
 *   (event) => console.log(`Clicked tile at (${event.position.x}, ${event.position.y})`)
 * );
 * mapApp.stage.addChild(gridContainer);
 * ```
 */
export function createGridRenderer(
  allTiles: MapTile[][],
  viewport: MapViewport,
  onTileClick?: (event: MapTileClickEvent) => void
): Container {
  const gridContainer = new Container();
  gridContainer.label = 'GridContainer';
  
  console.log('[GridRenderer] Creating grid:', {
    allTilesSize: `${allTiles.length}x${allTiles[0]?.length || 0}`,
    viewport,
    firstTile: allTiles[0]?.[0]
  });
  
  // Get only visible tiles (viewport culling)
  const visibleTiles = getVisibleTiles(viewport, allTiles);
  
  console.log('[GridRenderer] Visible tiles:', visibleTiles.length, 'First few:', visibleTiles.slice(0, 3));
  
  // DEBUG: Show tile coordinate range
  if (visibleTiles.length > 0) {
    const firstTile = visibleTiles[0];
    const lastTile = visibleTiles[visibleTiles.length - 1];
    const firstWorld = tileToWorld(firstTile.x, firstTile.y);
    const lastWorld = tileToWorld(lastTile.x, lastTile.y);
    console.log('[GridRenderer] DEBUG Tile range:', {
      first: { tile: `(${firstTile.x}, ${firstTile.y})`, world: firstWorld },
      last: { tile: `(${lastTile.x}, ${lastTile.y})`, world: lastWorld },
      viewportOffset: { x: -viewport.x, y: -viewport.y }
    });
  }
  
  // Render each visible tile
  visibleTiles.forEach((tile) => {
    const tileGraphics = createTileGraphics(tile, viewport, onTileClick);
    gridContainer.addChild(tileGraphics);
  });
  
  console.log('[GridRenderer] Grid container created with', gridContainer.children.length, 'tiles');
  
  return gridContainer;
}

/**
 * Create PixiJS Graphics object for a single tile
 * 
 * Renders a square tile with color based on terrain type.
 * Adds click event handler for tile interaction.
 * 
 * @param tile - Tile data to render
 * @param viewport - Current viewport to calculate screen position
 * @param onTileClick - Optional click handler
 * @returns PixiJS Graphics object
 */
function createTileGraphics(
  tile: MapTile,
  viewport: MapViewport,
  onTileClick?: (event: MapTileClickEvent) => void
): Graphics {
  const graphics = new Graphics();
  
  // Get world position for this tile
  const worldPos = tileToWorld(tile.x, tile.y);
  
  // CRITICAL: Convert world position to SCREEN position
  // Screen position = world position - viewport offset
  const screenX = worldPos.x - viewport.x;
  const screenY = worldPos.y - viewport.y;
  
  // Get tile color based on terrain type
  const color = TILE_COLORS[tile.terrain];
  
  // CRITICAL DEBUG: Verify color is valid
  if (!color) {
    console.error('[GridRenderer] INVALID COLOR for terrain:', tile.terrain, 'Available:', Object.keys(TILE_COLORS));
  }
  
  // DEBUG: Log first tile's rendering details
  if (tile.x === 1 && tile.y === 1) {
    console.log('[GridRenderer] DEBUG First tile:', {
      tileCoords: { x: tile.x, y: tile.y },
      worldPos,
      screenPos: { x: screenX, y: screenY },
      viewport: { x: viewport.x, y: viewport.y },
      color: `0x${color?.toString(16)}`,
      colorValue: color,
      terrain: tile.terrain
    });
  }
  
  // CRITICAL DEBUG: Log first few tiles to verify screen positioning
  if (tile.x >= 54 && tile.x <= 56 && tile.y >= 0 && tile.y <= 2) {
    console.log('[GridRenderer] TILE POSITION:', {
      tile: `(${tile.x}, ${tile.y})`,
      world: worldPos,
      screen: { x: screenX, y: screenY },
      color: `0x${color?.toString(16)}`,
      colorValue: color,
      terrain: tile.terrain,
      isVisible: screenX >= 0 && screenX < viewport.width && screenY >= 0 && screenY < viewport.height
    });
  }
  
  // Position the Graphics object at SCREEN coordinates
  graphics.position.set(screenX, screenY);
  
  // CRITICAL DEBUG: Draw a bright test rectangle to verify rendering
  graphics.clear(); // Clear any existing drawing
  graphics.rect(0, 0, MAP_CONFIG.TILE_SIZE, MAP_CONFIG.TILE_SIZE);
  graphics.fill({ color: 0xFF00FF, alpha: 1.0 }); // MAGENTA - highly visible
  graphics.rect(0, 0, MAP_CONFIG.TILE_SIZE, MAP_CONFIG.TILE_SIZE);
  graphics.stroke({ color: 0x00FFFF, width: 2, alpha: 1.0 }); // CYAN border
  
  // CRITICAL DEBUG: Verify Graphics object has geometry
  if (tile.x === 54 && tile.y === 1) {
    console.log('[GridRenderer] Graphics DEBUG:', {
      tile: `(${tile.x}, ${tile.y})`,
      boundsWidth: graphics.width,
      boundsHeight: graphics.height,
      position: { x: graphics.position.x, y: graphics.position.y },
      visible: graphics.visible,
      alpha: graphics.alpha,
      renderable: graphics.renderable
    });
  }
  
  // Make tile interactive
  graphics.eventMode = 'static';
  graphics.cursor = 'pointer';
  
  // Store tile data for click events
  (graphics as any).tileData = tile;
  
  // Add click handler
  if (onTileClick) {
    graphics.on('pointerdown', (event) => {
      const clickEvent: MapTileClickEvent = {
        tile,
        position: { x: tile.x, y: tile.y },
        worldPosition: { x: worldPos.x, y: worldPos.y },
        screenPosition: { x: event.globalX, y: event.globalY }
      };
      onTileClick(clickEvent);
    });
    
    // Add hover effect
    graphics.on('pointerover', () => {
      graphics.alpha = 0.8;
    });
    
    graphics.on('pointerout', () => {
      graphics.alpha = 1.0;
    });
  }
  
  return graphics;
}

/**
 * Update grid renderer with new viewport
 * 
 * Re-renders only visible tiles when viewport changes (zoom, pan).
 * Efficiently removes out-of-view tiles and adds new visible tiles.
 * 
 * @param gridContainer - Existing grid container
 * @param allTiles - Complete map data
 * @param viewport - New viewport configuration
 * @param onTileClick - Click handler
 * 
 * @example
 * ```ts
 * // When user zooms or pans
 * updateGridRenderer(gridContainer, mapData, newViewport, handleTileClick);
 * ```
 */
export function updateGridRenderer(
  gridContainer: Container,
  allTiles: MapTile[][],
  viewport: MapViewport,
  onTileClick?: (event: MapTileClickEvent) => void
): void {
  // Clear existing tiles
  gridContainer.removeChildren();
  
  // Get new visible tiles
  const visibleTiles = getVisibleTiles(viewport, allTiles);
  
  // Render visible tiles
  visibleTiles.forEach((tile) => {
    const tileGraphics = createTileGraphics(tile, viewport, onTileClick);
    gridContainer.addChild(tileGraphics);
  });
}

/**
 * Update a specific tile's appearance
 * 
 * Used for real-time tile state changes (e.g., Flag Bearer leaves trail on tile).
 * 
 * @param gridContainer - Grid container
 * @param tile - Updated tile data
 * @param onTileClick - Click handler
 * 
 * @example
 * ```ts
 * // When Flag Bearer moves across a tile
 * updateTile(gridContainer, { ...tile, hasParticleTrail: true }, handleClick);
 * ```
 */
export function updateTile(
  gridContainer: Container,
  tile: MapTile,
  viewport: MapViewport,
  onTileClick?: (event: MapTileClickEvent) => void
): void {
  // Find existing tile graphics
  const existingTile = gridContainer.children.find((child) => {
    const tileData = (child as any).tileData as MapTile | undefined;
    return tileData && tileData.x === tile.x && tileData.y === tile.y;
  });
  
  if (existingTile) {
    // Remove old tile
    gridContainer.removeChild(existingTile);
    existingTile.destroy();
  }
  
  // Add updated tile
  const newTileGraphics = createTileGraphics(tile, viewport, onTileClick);
  gridContainer.addChild(newTileGraphics);
}

/**
 * Highlight a specific tile (e.g., selected tile, target tile)
 * 
 * Adds visual emphasis to a tile by drawing a colored border.
 * 
 * @param gridContainer - Grid container
 * @param position - Tile position to highlight
 * @param color - Highlight color (hex number)
 * @returns Graphics object for the highlight (can be removed later)
 * 
 * @example
 * ```ts
 * // Highlight player's current tile
 * const highlight = highlightTile(gridContainer, playerPos, 0x2196F3);
 * 
 * // Remove highlight later
 * gridContainer.removeChild(highlight);
 * ```
 */
export function highlightTile(
  gridContainer: Container,
  position: { x: number; y: number },
  color: number = 0xFFFF00
): Graphics {
  const worldPos = tileToWorld(position.x, position.y);
  
  const highlight = new Graphics();
  // PixiJS v8 API - stroke only (no fill for highlight)
  highlight
    .rect(worldPos.x, worldPos.y, MAP_CONFIG.TILE_SIZE, MAP_CONFIG.TILE_SIZE)
    .stroke({ width: 3, color, alpha: 1.0 });
  
  (highlight as any).isHighlight = true;
  (highlight as any).highlightPosition = position;
  
  gridContainer.addChild(highlight);
  
  return highlight;
}

/**
 * Remove all tile highlights from grid
 * 
 * @param gridContainer - Grid container
 * 
 * @example
 * ```ts
 * // Clear all highlights when user clicks elsewhere
 * clearHighlights(gridContainer);
 * ```
 */
export function clearHighlights(gridContainer: Container): void {
  const highlights = gridContainer.children.filter(
    (child) => (child as any).isHighlight === true
  );
  
  highlights.forEach((highlight) => {
    gridContainer.removeChild(highlight);
    highlight.destroy();
  });
}

/**
 * Generate mock map data for testing (150x150 grid)
 * 
 * Creates a basic map with terrain distribution:
 * - Metal: 20%
 * - Energy: 20%
 * - Cave: 8%
 * - Forest: 2%
 * - Factory: 10%
 * - Wasteland: 40%
 * 
 * @returns 150x150 array of MapTile objects
 * 
 * @example
 * ```ts
 * const testMap = generateMockMapData();
 * const gridContainer = createGridRenderer(testMap, viewport);
 * ```
 */
export function generateMockMapData(): MapTile[][] {
  const map: MapTile[][] = [];
  
  // Terrain distribution percentages
  const terrainDistribution: Array<{ terrain: TerrainType; weight: number }> = [
    { terrain: TerrainType.Metal, weight: 20 },
    { terrain: TerrainType.Energy, weight: 20 },
    { terrain: TerrainType.Cave, weight: 8 },
    { terrain: TerrainType.Forest, weight: 2 },
    { terrain: TerrainType.Factory, weight: 10 },
    { terrain: TerrainType.Wasteland, weight: 40 }
  ];
  
  // Generate 150x150 tiles
  for (let y = 1; y <= MAP_CONFIG.HEIGHT; y++) {
    const row: MapTile[] = [];
    
    for (let x = 1; x <= MAP_CONFIG.WIDTH; x++) {
      // Random terrain type based on distribution
      const rand = Math.random() * 100;
      let cumulative = 0;
      let terrain: TerrainType = TerrainType.Wasteland;
      
      for (const { terrain: t, weight } of terrainDistribution) {
        cumulative += weight;
        if (rand <= cumulative) {
          terrain = t;
          break;
        }
      }
      
      row.push({
        x,
        y,
        terrain,
        isVisible: false
      });
    }
    
    map.push(row);
  }
  
  return map;
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. **Performance Optimization:**
 *    - Viewport culling: Only renders 300-900 visible tiles instead of all 22,500
 *    - Efficient Graphics objects: GPU-accelerated drawing
 *    - Minimal draw calls: 1 per visible tile
 *    - Future: Texture atlas for single draw call
 * 
 * 2. **Grid Rendering:**
 *    - 150x150 tiles (22,500 total)
 *    - 32x32 pixel tile size
 *    - Color-coded by terrain type
 *    - 1px black borders for grid lines
 * 
 * 3. **Interactivity:**
 *    - Click events on individual tiles
 *    - Hover effects (opacity change)
 *    - Highlight selected tiles
 *    - Cursor changes on hover
 * 
 * 4. **Real-Time Updates:**
 *    - Individual tile updates (efficient)
 *    - Full grid refresh on zoom/pan
 *    - WebSocket tile state changes
 * 
 * 5. **Future Enhancements:**
 *    - Texture atlas for better performance
 *    - Tile sprites instead of Graphics
 *    - Batch rendering for multiple tiles
 *    - LOD (Level of Detail) for distant tiles
 *    - Tile animation support
 */
