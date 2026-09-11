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

import { useState, useEffect, useMemo } from 'react';
import { useGameContext } from '@/context/GameContext';
import { GameLayout, StatsPanel, ControlsPanel } from '@/components';
import TopNavBar from '@/components/TopNavBar';
import { CanvasMapRenderer } from '@/components/map/CanvasMapRenderer';
import { MapLegend } from '@/components/map/MapLegend';
import { ZoomControls } from '@/components/map/ZoomControls';
import BackButton from '@/components/BackButton';
import { Loader2 } from 'lucide-react';
import {
  type ZoomLevel,
  type PlayerMarker,
  type MapTile,
  type MapViewport,
  MAP_CONFIG
} from '@/types';
// FID-20260909-023 §3.3: GridRenderer.tsx (Pixi) deleted — generator lives with
// the other map utilities now.
import { generateMockMapData } from '@/lib/mapService';
import { decodeTerrainGrid, COMPACT_TERRAIN_FORMAT } from '@/lib/terrainCodec';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';
import { logger } from '@/lib/logger';

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
  const [, setPlayerMarkers] = useState<PlayerMarker[]>([]);
  /** Live flag overlay (FID-20260905-001 §7.2 extension): bearer marker + fading trail. */
  const [flagState, setFlagState] = useState<{
    position: { x: number; y: number };
    username: string;
    trail: Array<{ x: number; y: number; timestamp: string; expiresAt: string }>;
  } | null>(null);
  // FID-20260910-038 D1: occupied base intel for the map overlay
  // (owner/level/Beer-class) — 30s server-cached endpoint, refetch on mount.
  const [baseMarkers, setBaseMarkers] = useState<Array<{ x: number; y: number; owner: string; level: number; isBeerBase: boolean }>>([]);
  useEffect(() => {
    let cancelled = false;
    const loadBases = async () => {
      try {
        const res = await fetch('/api/map/bases');
        const body = await res.json();
        if (!cancelled && res.ok && body.success && Array.isArray(body.data?.bases)) {
          setBaseMarkers(body.data.bases);
        }
      } catch {
        // non-critical: map renders without base chips
      }
    };
    loadBases();
    const interval = setInterval(loadBases, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

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
  const playerPosition = useMemo(() => context?.currentTile || { x: 75, y: 75 }, [context?.currentTile]);
  
  /**
   * Initialize map data
   * Loads real terrain from /api/map/terrain (falls back to mock on error)
   */
  useEffect(() => {
    logger.debug('[MapPage] Initializing map data...');
    let cancelled = false;

    const loadRealMap = async (): Promise<void> => {
      let map: MapTile[][] | null = null;
      try {
        // FID-20260909-026: terrain is immutable after generation — default
        // browser caching applies (endpoint sends Cache-Control); no-store
        // re-downloaded ~2MB per map visit.
        // §6 follow-up: wire format is one char per tile (~22 KB) — decoded
        // client-side via the shared codec; decode failure falls back to mock.
        const res = await fetch('/api/map/terrain');
        const body = (await res.json()) as {
          success?: boolean;
          data?: { format?: string; width?: number; height?: number; grid?: string };
        };
        if (
          res.ok &&
          body.success &&
          body.data &&
          body.data.format === COMPACT_TERRAIN_FORMAT &&
          typeof body.data.width === 'number' &&
          typeof body.data.height === 'number' &&
          typeof body.data.grid === 'string'
        ) {
          map = decodeTerrainGrid({
            width: body.data.width,
            height: body.data.height,
            grid: body.data.grid,
          });
        }
      } catch (err) {
        console.error('[MapPage] Failed to load real terrain, falling back to mock', err);
      }
      if (cancelled) return;

      // Real data unavailable (map not generated yet) → mock for UI testing
      const data = map ?? generateMockMapData();
      setMapData(data);
      logger.debug('[MapPage] Map data loaded', {
        source: map ? 'api/map/terrain' : 'mock (fallback)',
        dimensions: `${data.length}x${data[0].length}`,
        tiles: data.length * data[0].length
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
    };

    void loadRealMap();
    return () => {
      cancelled = true;
    };
  }, [playerPosition.x, playerPosition.y]);
  
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
    
    const _handleResize = () => {
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
    const player = context?.player;
    if (!player) return;

    // Fetch the flag bearer and build markers (FID-20260905-001 §7.2).
    // The bearer gets an animated marker; if the viewer IS the bearer their own
    // marker animates instead. Trail tiles are intentionally not drawn here —
    // the in-game tile view renders them with expiry fading.
    let cancelled = false;
    const buildMarkers = async () => {
      const currentPlayerMarker: PlayerMarker = {
        playerId: player.username, // Use username as unique ID
        username: player.username,
        position: playerPosition,
        color: '#2196F3', // Blue
        isCurrentPlayer: true,
        isFlagBearer: false,
        size: 8
      };

      const markers: PlayerMarker[] = [currentPlayerMarker];

      try {
        const res = await fetch('/api/flag');
        const data = await res.json();
        // FID-20260905-001 §7.2: the payload nests the bearer at data.data.bearer
        // (this page still read the old envelope → flagState{position:undefined}
        // → CanvasMapRenderer crashed on position.x, blanking the whole map).
        const bearer = data?.data?.bearer;
        if (data?.success && bearer && bearer.position) {
          if (bearer.username === player.username) {
            currentPlayerMarker.isFlagBearer = true;
          }
          if (!cancelled) {
            setFlagState({
              position: bearer.position,
              username: bearer.username,
              trail: (bearer.trail ?? []).map((t: { x: number; y: number; timestamp: string; expiresAt: string }) => ({
                x: t.x,
                y: t.y,
                timestamp: t.timestamp,
                expiresAt: t.expiresAt,
              })),
            });
          }
        } else if (!cancelled) {
          setFlagState(null);
        }
      } catch {
        // Flag data is optional overlay — render without it
      }

      if (!cancelled) setPlayerMarkers(markers);
    };

    buildMarkers();
    const flagPoll = setInterval(buildMarkers, 20000); // FLAG_CONFIG.POSITION_UPDATE_INTERVAL

    return () => {
      cancelled = true;
      clearInterval(flagPoll);
    };
  }, [context?.player, playerPosition]);
  
  /**
   * WebSocket: Listen for map updates
   * TODO: Integrate with WebSocketContext when available
   */
  useEffect(() => {
    // WebSocket integration will be added in future
    // For now, map only shows static player position
    
    logger.debug('[MapPage] WebSocket integration pending');
  }, [mapData]);
  
  /**
   * Handle tile click
   */
  const handleTileClick = (x: number, y: number) => {
    setSelectedTile({ x, y });
    logger.debug(`[MapPage] Tile selected: (${x}, ${y})`);
  };
  
  /**
   * Handle zoom change
   */
  const handleZoomChange = (newZoom: ZoomLevel) => {
    setZoomLevel(newZoom);
    logger.debug(`[MapPage] Zoom changed: ${newZoom}`);
  };
  
  const renderMapContent = () => (
    <div className="h-full w-full flex flex-col bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)] overflow-hidden">
      {/* Header */}
      <header className="nn-panel__header border-b border-[color-mix(in_oklab,var(--nn-cyan)_18%,transparent)] p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--nn-font-display)' }}>DarkFrame Map</h1>
              <p className="text-sm text-[color:var(--nn-text-secondary)]">
                150x150 Interactive Grid • {zoomLevel} View
              </p>
            </div>
          </div>
          
          {/* Player position indicator */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            <div>
              <span className="text-[color:var(--nn-text-secondary)]">Position:</span>{' '}
              <span className="font-mono text-[color:var(--nn-cyan)]">
                ({playerPosition.x}, {playerPosition.y})
              </span>
            </div>
            {selectedTile && (
              <div>
                <span className="text-[color:var(--nn-text-secondary)]">Selected:</span>{' '}
                <span className="font-mono text-[color:var(--nn-green)]">
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
        <aside className="hidden lg:block w-64 nn-panel border-r border-[color-mix(in_oklab,var(--nn-cyan)_18%,transparent)] p-4 overflow-y-auto rounded-none">
          <div className="space-y-6">
            {/* Zoom Controls */}
            <div>
              <h2 className="nn-panel__title text-base mb-3">Zoom Level</h2>
              <ZoomControls
                currentZoom={zoomLevel}
                onZoomChange={handleZoomChange}
              />
            </div>
            
            {/* Map Legend */}
            <div>
              <h2 className="nn-panel__title text-base mb-3">Legend</h2>
              {/* FID-20260906-005 R5: compact 2-col grid — the w-64 sidebar
                  previously forced the 7-col desktop grid into a run-on line */}
              <MapLegend compact />
            </div>
            
            {/* Map Info */}
            <div className="nn-panel rounded-none p-4">
              <h3 className="nn-panel__title text-sm mb-2">Your Position</h3>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-[color:var(--nn-text-secondary)]">X:</span>{' '}
                  <span className="font-mono">{playerPosition.x}</span>
                </p>
                <p>
                  <span className="text-[color:var(--nn-text-secondary)]">Y:</span>{' '}
                  <span className="font-mono">{playerPosition.y}</span>
                </p>
              </div>
            </div>
            
            {/* Selected Tile Info */}
            {selectedTile && (
              <div className="nn-panel rounded-none p-4">
                <h3 className="nn-panel__title text-sm mb-2">Selected Tile</h3>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-[color:var(--nn-text-secondary)]">Coords:</span>{' '}
                    <span className="font-mono">({selectedTile.x}, {selectedTile.y})</span>
                  </p>
                  {mapData && mapData[selectedTile.y - 1] && mapData[selectedTile.y - 1][selectedTile.x - 1] && (
                    <p>
                      <span className="text-[color:var(--nn-text-secondary)]">Terrain:</span>{' '}
                      <span className="capitalize">
                        {mapData[selectedTile.y - 1][selectedTile.x - 1].terrain}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Keyboard Shortcuts */}
            <div className="nn-panel rounded-none p-4 text-xs">
              <h3 className="nn-panel__title text-sm mb-2">Shortcuts</h3>
              <ul className="space-y-1 text-[color:var(--nn-text-primary)]">
                <li>Arrow Keys / WASD: Pan</li>
                <li>+/- Keys: Zoom</li>
                <li>Home / H: Center on player</li>
                <li>Click Tile: Select</li>
              </ul>
            </div>
          </div>
        </aside>
        
        {/* Map Canvas - Full Map View */}
        <main className="flex-1 bg-[color:var(--nn-glass-dark)] relative overflow-auto">
          {mapData ? (
            <>
              {/* Map Container - Shows entire 150×150 grid */}
              <div className="relative bg-[color:var(--nn-void)] m-6 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_20%,transparent)] inline-block" 
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
                    flagMarker={
                      flagState && flagState.username !== context?.player?.username
                        ? { position: flagState.position, username: flagState.username }
                        : null
                    }
                    flagTrail={flagState?.trail}
                    baseMarkers={baseMarkers}
                    onTileClick={handleTileClick}
                  />
                </div>
                
                {/* Map Info Overlay */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none text-sm shadow-[0_0_18px_color-mix(in_oklab,var(--nn-cyan)_14%,transparent)]">
                  <p className="text-center">
                    <span className="font-bold">Full Map View:</span> 150×150 tiles visible • 
                    <span className="font-bold ml-2">Click:</span> Select Tile • 
                    <span className="font-bold ml-2">Scroll:</span> Navigate
                  </p>
                  <p className="text-center text-xs text-[color:var(--nn-text-secondary)] mt-1">
                    Your position: ({playerPosition.x}, {playerPosition.y}) • Total tiles: 22,500
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="nn-spin-icon w-16 h-16 text-[color:var(--nn-cyan)] mx-auto mb-4" aria-label="Loading map data" />
                <p className="text-[color:var(--nn-text-secondary)]">Loading map data...</p>
              </div>
            </div>
          )}
          
          {/* Mobile Zoom Controls (Overlay) */}
          <div className="lg:hidden absolute bottom-4 left-4 right-4">
            <div className="nn-panel rounded-none p-3 shadow-[0_0_18px_color-mix(in_oklab,var(--nn-cyan)_14%,transparent)]">
              <ZoomControls
                currentZoom={zoomLevel}
                onZoomChange={handleZoomChange}
              />
            </div>
          </div>
          
          {/* Mobile Position Indicator */}
          <div className="lg:hidden absolute top-4 left-4 right-4">
            <div className="nn-panel rounded-none p-3 shadow-[0_0_18px_color-mix(in_oklab,var(--nn-cyan)_14%,transparent)] text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[color:var(--nn-text-secondary)]">Position:</span>
                <span className="font-mono text-[color:var(--nn-cyan)]">
                  ({playerPosition.x}, {playerPosition.y})
                </span>
              </div>
              {selectedTile && (
                <div className="flex justify-between items-center mt-1 pt-1 border-t border-[color-mix(in_oklab,var(--nn-cyan)_20%,transparent)]">                    <span className="text-[color:var(--nn-text-secondary)]">Selected:</span>
                    <span className="font-mono text-[color:var(--nn-green)]">
                      ({selectedTile.x}, {selectedTile.y})
                    </span>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      
      {/* Mobile Legend (Bottom Sheet) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 nn-panel border-t border-[color-mix(in_oklab,var(--nn-cyan)_18%,transparent)] p-4 rounded-none">
        <details className="group">
          <summary className="cursor-pointer font-semibold text-center">
            Map Legend <span className="text-[color:var(--nn-text-secondary)] text-sm">(tap to expand)</span>
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
