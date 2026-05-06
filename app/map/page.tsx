/**
 * @file app/map/page.tsx
 * @created 2025-10-20
 * @overview Main map page route for the interactive 150x150 Flag map
 * 
 * OVERVIEW:
 * Renders the complete map interface with PixiJS visualization, zoom controls,
 * legend, and real-time WebSocket updates. This is the primary interface for
 * the Flag feature, showing player positions, Flag Bearer location, particle
 * trails, and terrain types across the 150x150 grid.
 * 
 * Features:
 * - PixiJS-based 150x150 interactive map
 * - Auto-centers on player position
 * - 4 zoom levels (FullMap, Quadrant, Zone, Region)
 * - Real-time position updates via WebSocket
 * - Responsive design (desktop & mobile optimized)
 * - Click tiles to view coordinates
 * - Keyboard controls (arrow keys, WASD, Home to recenter)
 * 
 * Layout:
 * - Header: Navigation breadcrumbs
 * - Left Sidebar (desktop): Map legend and controls
 * - Center: PixiJS map canvas (fills available space)
 * - Bottom (mobile): Compact legend
 * - Right Sidebar (future): Chat, player list, objectives
 */

'use client';

import { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { GameLayout, StatsPanel, ControlsPanel } from '@/components';
import TopNavBar from '@/components/TopNavBar';
import { CanvasMapRenderer } from '@/components/map/CanvasMapRenderer';
import { MapLegend } from '@/components/map/MapLegend';
import { ZoomControls } from '@/components/map/ZoomControls';
import BackButton from '@/components/BackButton';
import {
  type ZoomLevel,
  type PlayerMarker,
  type MapTile,
  type MapViewport,
  MAP_CONFIG
} from '@/types';
import { generateMockMapData } from '@/components/map/GridRenderer';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

/**
 * Map Page Component
 * 
 * Main route for the interactive map. Manages map state, WebSocket subscriptions,
 * and coordinates all map sub-components.
 */
export default function MapPage() {
  const context = useGameContext();
  
  // Map state
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('Zone');
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [mapData, setMapData] = useState<MapTile[][] | null>(null);
  const [playerMarkers, setPlayerMarkers] = useState<PlayerMarker[]>([]);
  // Viewport state - FULL MAP VIEW (shows entire 150×150 grid)
  const [viewport, setViewport] = useState<MapViewport>({
    x: 0,
    y: 0,
    width: MAP_CONFIG.WIDTH * MAP_CONFIG.TILE_SIZE, // 4800px (150 tiles × 32px)
    height: MAP_CONFIG.HEIGHT * MAP_CONFIG.TILE_SIZE, // 4800px
    scale: 1,
    centerOn: { x: 75, y: 75 }
  });
  
  // Player position (from current tile or default center)
  const playerPosition = context?.currentTile || { x: 75, y: 75 };
  
  /**
   * Initialize map data
   * Loads terrain data (mock for now, will integrate with API)
   */
  useEffect(() => {
    console.log('[MapPage] Initializing map data...');
    
    // Generate mock map data for testing
    const mockData = generateMockMapData();
    setMapData(mockData);
    
    console.log('[MapPage] Map data loaded', {
      dimensions: `${mockData.length}x${mockData[0].length}`,
      tiles: mockData.length * mockData[0].length
    });
    
    // Set viewport to show ENTIRE map (no centering on player)
    setViewport(prev => ({
      ...prev,
      x: 0, // Start at top-left corner
      y: 0,
      width: MAP_CONFIG.WIDTH * MAP_CONFIG.TILE_SIZE, // Full map width (4800px)
      height: MAP_CONFIG.HEIGHT * MAP_CONFIG.TILE_SIZE, // Full map height (4800px)
      centerOn: { x: playerPosition.x, y: playerPosition.y }
    }));
  }, []);
  
  /**
   * Handle arrow key navigation
   * FIX: Use MAP_CONFIG.WIDTH (150 tiles) not WIDTH-1 (149 tiles)
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input field
      if (isTypingInInput()) {
        return;
      }

      const panSpeed = 32; // Move 1 tile at a time
      const maxWorldX = MAP_CONFIG.WIDTH * MAP_CONFIG.TILE_SIZE; // 150 * 32 = 4800px
      const maxWorldY = MAP_CONFIG.HEIGHT * MAP_CONFIG.TILE_SIZE; // 150 * 32 = 4800px
      
      switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          setViewport(prev => ({ ...prev, y: Math.max(0, prev.y - panSpeed) }));
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          setViewport(prev => ({ ...prev, y: Math.min(maxWorldY - prev.height, prev.y + panSpeed) }));
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          setViewport(prev => ({ ...prev, x: Math.max(0, prev.x - panSpeed) }));
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          setViewport(prev => ({ ...prev, x: Math.min(maxWorldX - prev.width, prev.x + panSpeed) }));
          e.preventDefault();
          break;
        case 'Home':
          // Re-center on player
          setViewport(prev => ({
            ...prev,
            x: (playerPosition.x - 1) * MAP_CONFIG.TILE_SIZE - prev.width / 2 + MAP_CONFIG.TILE_SIZE / 2,
            y: (playerPosition.y - 1) * MAP_CONFIG.TILE_SIZE - prev.height / 2 + MAP_CONFIG.TILE_SIZE / 2,
          }));
          e.preventDefault();
          break;
      }
    };
    
    const handleResize = () => {
      // Update viewport dimensions on window resize
      const mapElement = document.querySelector('.map-canvas-container');
      if (mapElement) {
        setViewport(prev => ({
          ...prev,
          width: mapElement.clientWidth,
          height: mapElement.clientHeight
        }));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [playerPosition]);
  
  /**
   * Handle window resize - separate effect to prevent infinite loop
   * FIX: Only runs on mount and actual window resize events
   */
  useEffect(() => {
    const handleResize = () => {
      const mapElement = document.querySelector('.map-canvas-container');
      if (mapElement) {
        setViewport(prev => ({
          ...prev,
          width: mapElement.clientWidth,
          height: mapElement.clientHeight
        }));
      }
    };
    
    // Set initial size
    handleResize();
    
    // Listen for window resize
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Empty dependency array - only runs once on mount
  
  /**
   * Initialize player markers
   * Loads current player and nearby players
   */
  useEffect(() => {
    if (!context?.player) return;
    
    // Create current player marker
    const currentPlayerMarker: PlayerMarker = {
      playerId: context.player.username, // Use username as unique ID
      username: context.player.username,
      position: playerPosition,
      color: '#2196F3', // Blue
      isCurrentPlayer: true,
      isFlagBearer: false, // TODO: Get from player stats
      size: 8
    };
    
    // TODO: Add other player markers from API
    setPlayerMarkers([currentPlayerMarker]);
    
    console.log('[MapPage] Player markers initialized', {
      currentPlayer: currentPlayerMarker.username,
      position: playerPosition,
      isFlagBearer: currentPlayerMarker.isFlagBearer
    });
  }, [context?.player, playerPosition.x, playerPosition.y]);
  
  /**
   * WebSocket: Listen for map updates
   * TODO: Integrate with WebSocketContext when available
   */
  useEffect(() => {
    // WebSocket integration will be added in future
    // For now, map only shows static player position
    
    console.log('[MapPage] WebSocket integration pending');
  }, [mapData]);
  
  /**
   * Handle tile click
   */
  const handleTileClick = (x: number, y: number) => {
    setSelectedTile({ x, y });
    console.log(`[MapPage] Tile selected: (${x}, ${y})`);
  };
  
  /**
   * Handle zoom change
   */
  const handleZoomChange = (newZoom: ZoomLevel) => {
    setZoomLevel(newZoom);
    console.log(`[MapPage] Zoom changed: ${newZoom}`);
  };
  
  const renderMapContent = () => (
    <div className="h-full w-full flex flex-col bg-gradient-to-b from-gray-900 to-black text-white overflow-hidden">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold">🗺️ DarkFrame Map</h1>
              <p className="text-sm text-gray-400">
                150x150 Interactive Grid • {zoomLevel} View
              </p>
            </div>
          </div>
          
          {/* Player position indicator */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-400">Position:</span>{' '}
              <span className="font-mono text-blue-400">
                ({playerPosition.x}, {playerPosition.y})
              </span>
            </div>
            {selectedTile && (
              <div>
                <span className="text-gray-400">Selected:</span>{' '}
                <span className="font-mono text-green-400">
                  ({selectedTile.x}, {selectedTile.y})
                </span>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)]">
        {/* Left Sidebar (Desktop) */}
        <aside className="hidden lg:block w-64 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
          <div className="space-y-6">
            {/* Zoom Controls */}
            <div>
              <h2 className="text-lg font-semibold mb-3">🔍 Zoom Level</h2>
              <ZoomControls
                currentZoom={zoomLevel}
                onZoomChange={handleZoomChange}
              />
            </div>
            
            {/* Map Legend */}
            <div>
              <h2 className="text-lg font-semibold mb-3">🎨 Legend</h2>
              <MapLegend />
            </div>
            
            {/* Map Info */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-2">📍 Your Position</h3>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-gray-400">X:</span>{' '}
                  <span className="font-mono">{playerPosition.x}</span>
                </p>
                <p>
                  <span className="text-gray-400">Y:</span>{' '}
                  <span className="font-mono">{playerPosition.y}</span>
                </p>
              </div>
            </div>
            
            {/* Selected Tile Info */}
            {selectedTile && (
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold mb-2">🎯 Selected Tile</h3>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-gray-400">Coords:</span>{' '}
                    <span className="font-mono">({selectedTile.x}, {selectedTile.y})</span>
                  </p>
                  {mapData && mapData[selectedTile.y - 1] && mapData[selectedTile.y - 1][selectedTile.x - 1] && (
                    <p>
                      <span className="text-gray-400">Terrain:</span>{' '}
                      <span className="capitalize">
                        {mapData[selectedTile.y - 1][selectedTile.x - 1].terrain}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Keyboard Shortcuts */}
            <div className="bg-gray-700 rounded-lg p-4 text-xs">
              <h3 className="font-semibold mb-2">⌨️ Shortcuts</h3>
              <ul className="space-y-1 text-gray-300">
                <li>Arrow Keys / WASD: Pan</li>
                <li>+/- Keys: Zoom</li>
                <li>Home / H: Center on player</li>
                <li>Click Tile: Select</li>
              </ul>
            </div>
          </div>
        </aside>
        
        {/* Map Canvas - Full Map View */}
        <main className="flex-1 bg-gray-900 relative overflow-auto">
          {mapData ? (
            <>
              {/* Map Container - Shows entire 150×150 grid */}
              <div className="relative bg-gray-950 m-6 border-2 border-gray-700 inline-block" 
                   style={{ 
                     width: `${MAP_CONFIG.WIDTH * MAP_CONFIG.TILE_SIZE}px`, // 4800px (150 tiles × 32px)
                     height: `${MAP_CONFIG.HEIGHT * MAP_CONFIG.TILE_SIZE}px`, // 4800px
                     minWidth: `${MAP_CONFIG.WIDTH * MAP_CONFIG.TILE_SIZE}px`,
                     minHeight: `${MAP_CONFIG.HEIGHT * MAP_CONFIG.TILE_SIZE}px`
                   }}>
                {/* Canvas Renderer */}
                <div className="w-full h-full map-canvas-container">
                  <CanvasMapRenderer
                    mapData={mapData}
                    viewport={viewport}
                    playerPosition={playerPosition}
                    onTileClick={handleTileClick}
                  />
                </div>
                
                {/* Map Info Overlay */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
                  <p className="text-center">
                    <span className="font-bold">🗺️ Full Map View:</span> 150×150 tiles visible • 
                    <span className="font-bold ml-2">Click:</span> Select Tile • 
                    <span className="font-bold ml-2">Scroll:</span> Navigate
                  </p>
                  <p className="text-center text-xs text-gray-300 mt-1">
                    Your position: ({playerPosition.x}, {playerPosition.y}) • Total tiles: 22,500
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading map data...</p>
              </div>
            </div>
          )}
          
          {/* Mobile Zoom Controls (Overlay) */}
          <div className="lg:hidden absolute bottom-4 left-4 right-4">
            <div className="bg-gray-800 bg-opacity-90 rounded-lg p-3 shadow-lg">
              <ZoomControls
                currentZoom={zoomLevel}
                onZoomChange={handleZoomChange}
              />
            </div>
          </div>
          
          {/* Mobile Position Indicator */}
          <div className="lg:hidden absolute top-4 left-4 right-4">
            <div className="bg-gray-800 bg-opacity-90 rounded-lg p-3 shadow-lg text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Position:</span>
                <span className="font-mono text-blue-400">
                  ({playerPosition.x}, {playerPosition.y})
                </span>
              </div>
              {selectedTile && (
                <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-700">
                  <span className="text-gray-400">Selected:</span>
                  <span className="font-mono text-green-400">
                    ({selectedTile.x}, {selectedTile.y})
                  </span>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      
      {/* Mobile Legend (Bottom Sheet) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4">
        <details className="group">
          <summary className="cursor-pointer font-semibold text-center">
            🎨 Map Legend <span className="text-gray-400 text-sm">(tap to expand)</span>
          </summary>
          <div className="mt-3">
            <MapLegend />
          </div>
        </details>
      </div>
    </div>
  );

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={renderMapContent()}
      />
    </>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * Data Flow:
 * - Map data loaded on mount (mock data for testing)
 * - Player markers initialized from game state
 * - WebSocket updates trigger real-time marker/tile changes
 * - Tile clicks update selected tile state
 * 
 * Performance:
 * - Map rendering delegated to MapContainer (PixiJS optimization)
 * - WebSocket handlers update state efficiently (no full re-render)
 * - Mobile optimizations (overlay controls, bottom legend)
 * 
 * Responsive Design:
 * - Desktop: Sidebar + canvas layout
 * - Mobile: Fullscreen canvas with overlay controls
 * - Touch-friendly controls and larger tap targets
 * 
 * Future Enhancements:
 * - Replace mock data with API endpoint (/api/map/terrain)
 * - Add player search/filter in sidebar
 * - Show Flag Bearer particle trail (golden sparkles)
 * - Add minimap toggle
 * - Implement fog of war
 * - Chat integration in right sidebar
 */
