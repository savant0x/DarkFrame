/**
 * @file components/map/MapContainer.tsx
 * @created 2025-10-20
 * @overview PixiJS Application container and lifecycle management for the interactive map
 * 
 * OVERVIEW:
 * Manages the PixiJS Application instance, canvas setup, and viewport control for the
 * DarkFrame 150x150 map. Integrates GridRenderer and PlayerMarker components, handles
 * camera controls (pan, zoom, auto-center), and manages the render loop.
 * 
 * Responsibilities:
 * - Initialize and cleanup PixiJS Application
 * - Canvas size management and responsive updates
 * - Viewport camera controls (pan with mouse/touch, zoom transitions)
 * - Auto-center camera on player position
 * - Mobile gesture support (pinch-to-zoom, touch pan)
 * - Integrate GridRenderer for tile rendering
 * - Integrate PlayerMarker for player visualization
 * - PixiJS ticker loop for animations (60 FPS target)
 * - Performance monitoring and optimization
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import {
  type MapViewport,
  type MapTile,
  type PlayerMarker as PlayerMarkerType,
  type ZoomLevel,
  type MapTileClickEvent,
  MAP_CONFIG,
  ZOOM_SCALES
} from '@/types';
import {
  centerViewportOn,
  clampViewport,
  getVisibleTiles
} from '@/lib/mapService';
import {
  createGridRenderer,
  updateGridRenderer,
  updateTile,
  highlightTile,
  clearHighlights
} from './GridRenderer';
import {
  createPlayerMarker,
  updatePlayerMarkerPosition,
  animatePlayerMarker,
  removePlayerMarker
} from './PlayerMarker';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

/**
 * Props for MapContainer component
 */
interface MapContainerProps {
  /** Current zoom level (controls scale and visible area) */
  zoomLevel: ZoomLevel;
  
  /** Player's current position on the map */
  playerPosition: { x: number; y: number };
  
  /** Array of all player markers to display */
  playerMarkers?: PlayerMarkerType[];
  
  /** Current map tile data (full 150x150 grid) */
  mapData?: MapTile[][];
  
  /** Callback when tile is clicked */
  onTileClick?: (x: number, y: number) => void;
  
  /** Callback when viewport changes (for external state sync) */
  onViewportChange?: (viewport: MapViewport) => void;
  
  /** Optional CSS class name */
  className?: string;
}

/**
 * MapContainer Component
 * 
 * Renders the PixiJS canvas and manages the interactive map application.
 * Auto-centers on player position when component mounts or player moves.
 * 
 * @example
 * ```tsx
 * <MapContainer
 *   zoomLevel="Zone"
 *   playerPosition={{ x: 75, y: 75 }}
 *   playerMarkers={[...]}
 *   mapData={mapDataGrid}
 *   onTileClick={(x, y) => console.log(`Clicked tile ${x}, ${y}`)}
 * />
 * ```
 */
export default function MapContainer({
  zoomLevel,
  playerPosition,
  playerMarkers = [],
  mapData,
  onTileClick,
  onViewportChange,
  className = ''
}: MapContainerProps) {
  // Refs for PixiJS instances
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const gridContainerRef = useRef<Container | null>(null);
  const markerContainerRef = useRef<Container | null>(null);
  const markerGraphicsRef = useRef<Map<string, Graphics>>(new Map());
  const lastCenteredPositionRef = useRef<{ x: number; y: number } | null>(null);
  
  // Viewport state
  const [viewport, setViewport] = useState<MapViewport>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    scale: ZOOM_SCALES[zoomLevel],
    centerOn: playerPosition
  });
  
  // Pan state for mouse/touch dragging
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [viewportStart, setViewportStart] = useState<{ x: number; y: number } | null>(null);
  
  /**
   * Initialize PixiJS Application
   * Sets up canvas, renderer, and containers
   */
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;
    
    const initPixiApp = async () => {
      try {
        // Create PixiJS Application with WebGL renderer
        const app = new Application();
        await app.init({
          width: canvasRef.current!.clientWidth,
          height: canvasRef.current!.clientHeight,
          backgroundColor: 0x1a1a1a, // Use hex color number
          backgroundAlpha: 1, // Explicitly opaque
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          autoStart: true // CRITICAL: Enable automatic rendering
        });
        
        // Append canvas to DOM
        canvasRef.current!.appendChild(app.canvas);
        
        // Ensure canvas is visible with explicit styling
        app.canvas.style.display = 'block';
        app.canvas.style.backgroundColor = '#1a1a1a'; // Force canvas background
        
        // CRITICAL: Force stage to be visible and renderable
        app.stage.visible = true;
        app.stage.renderable = true;
        app.stage.alpha = 1;
        app.canvas.style.width = '100%';
        app.canvas.style.height = '100%';
        
        console.log('[MapContainer] Canvas appended to DOM', {
          canvasElement: app.canvas,
          canvasParent: canvasRef.current,
          canvasStyle: {
            display: app.canvas.style.display,
            width: app.canvas.style.width,
            height: app.canvas.style.height
          }
        });
        
        // Create containers for layered rendering
        const gridContainer = new Container();
        const markerContainer = new Container();
        
        app.stage.addChild(gridContainer);
        app.stage.addChild(markerContainer);
        
        // Store refs
        appRef.current = app;
        gridContainerRef.current = gridContainer;
        markerContainerRef.current = markerContainer;
        
        // CRITICAL: Start the ticker to enable automatic rendering
        app.ticker.start();
        
        // NUCLEAR OPTION: Manually render on every ticker frame
        app.ticker.add(() => {
          app.renderer.render(app.stage);
        });
        
        console.log('[MapContainer] Ticker started:', { 
          isRunning: app.ticker.started,
          FPS: app.ticker.FPS,
          autoStart: app.ticker.autoStart,
          listeners: app.ticker.count
        });
        
        // DEBUG: Log renderer details
        try {
          console.log('[MapContainer] Renderer initialized:', {
            type: app.renderer.type,
            width: app.renderer.width,
            height: app.renderer.height
          });
        } catch (err) {
          console.error('[MapContainer] Failed to log renderer details:', err);
        }
        
        // DEBUG: Log stage details
        console.log('[MapContainer] Stage initialized:', {
          children: app.stage.children.length,
          position: { x: app.stage.position.x, y: app.stage.position.y },
          visible: app.stage.visible,
          renderable: app.stage.renderable
        });
        
        // Initialize viewport dimensions
        const initialViewport: MapViewport = {
          x: 0,
          y: 0,
          width: canvasRef.current!.clientWidth,
          height: canvasRef.current!.clientHeight,
          scale: ZOOM_SCALES[zoomLevel],
          centerOn: playerPosition
        };
        
        console.log('[MapContainer] Initial viewport created:', initialViewport);
        
        // Center on player position
        const centeredViewport = centerViewportOn(
          playerPosition,
          initialViewport
        );
        
        console.log('[MapContainer] Centered viewport:', centeredViewport);
        
        setViewport(centeredViewport);
        
        console.log('[MapContainer] PixiJS Application initialized', {
          canvasWidth: app.canvas.width,
          canvasHeight: app.canvas.height,
          clientWidth: canvasRef.current!.clientWidth,
          clientHeight: canvasRef.current!.clientHeight,
          viewport: centeredViewport,
          stageChildren: app.stage.children.length
        });
      } catch (error) {
        console.error('[MapContainer] Failed to initialize PixiJS:', error);
      }
    };
    
    initPixiApp();
    
    // Cleanup on unmount
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        gridContainerRef.current = null;
        markerContainerRef.current = null;
        markerGraphicsRef.current.clear();
        console.log('[MapContainer] PixiJS Application destroyed');
      }
    };
  }, []); // Run once on mount
  
  /**
   * Update viewport when zoom level changes
   */
  useEffect(() => {
    if (!appRef.current) return;
    
    const newScale = ZOOM_SCALES[zoomLevel];
    const updatedViewport: MapViewport = {
      ...viewport,
      scale: newScale,
      centerOn: playerPosition
    };
    
    // Re-center on player with new scale
    const centeredViewport = centerViewportOn(
      playerPosition,
      updatedViewport
    );
    
    setViewport(centeredViewport);
    
    console.log('[MapContainer] Zoom level changed', {
      zoomLevel,
      scale: newScale,
      viewport: centeredViewport
    });
  }, [zoomLevel]);
  
  /**
   * Auto-center on player when position changes
   */
  useEffect(() => {
    if (!appRef.current || !canvasRef.current) return;
    
    // Check if player position actually changed
    const hasPositionChanged = !lastCenteredPositionRef.current ||
      lastCenteredPositionRef.current.x !== playerPosition.x ||
      lastCenteredPositionRef.current.y !== playerPosition.y;
    
    if (!hasPositionChanged) return;
    
    // Update last centered position
    lastCenteredPositionRef.current = { x: playerPosition.x, y: playerPosition.y };
    
    // CRITICAL: Always get fresh dimensions and scale from refs/state
    // Do NOT use viewport from closure - it will be stale!
    setViewport(prev => {
      const currentViewport: MapViewport = {
        ...prev,
        width: canvasRef.current!.clientWidth,
        height: canvasRef.current!.clientHeight
      };
      
      console.log('[MapContainer] BEFORE centerViewportOn:', 
        'Player:', playerPosition.x, playerPosition.y,
        'Prev viewport x:', prev.x, 'y:', prev.y, 'scale:', prev.scale,
        'Current viewport x:', currentViewport.x, 'y:', currentViewport.y, 
        'w:', currentViewport.width, 'h:', currentViewport.height, 'scale:', currentViewport.scale
      );
      
      const centeredViewport = centerViewportOn(
        playerPosition,
        currentViewport
      );
      
      console.log('[MapContainer] AFTER centerViewportOn:',
        'Centered x:', centeredViewport.x, 'y:', centeredViewport.y,
        'w:', centeredViewport.width, 'h:', centeredViewport.height,
        'scale:', centeredViewport.scale
      );
      
      return centeredViewport;
    });
  }, [playerPosition.x, playerPosition.y]);
  
  /**
   * Render grid when viewport or mapData changes
   */
  useEffect(() => {
    if (!appRef.current || !gridContainerRef.current || !mapData) {
      console.log('[MapContainer] Cannot render grid:', {
        hasApp: !!appRef.current,
        hasGridContainer: !!gridContainerRef.current,
        hasMapData: !!mapData
      });
      return;
    }
    
    console.log('[MapContainer] Rendering grid...', {
      viewport,
      mapDataSize: `${mapData.length}x${mapData[0]?.length || 0}`,
      appStageChildren: appRef.current.stage.children.length
    });
    
    // Clear existing grid
    gridContainerRef.current.removeChildren();
    
    // CRITICAL FIX: Offset gridContainer to align tiles with pixel boundaries
    // This compensates for fractional viewport coordinates
    const gridOffsetX = viewport.x % MAP_CONFIG.TILE_SIZE;
    const gridOffsetY = viewport.y % MAP_CONFIG.TILE_SIZE;
    gridContainerRef.current.position.set(-gridOffsetX, -gridOffsetY);
    
    // Reset stage position (it should stay at origin)
    appRef.current.stage.position.set(0, 0);
    
    console.log('[MapContainer] DEBUG Camera setup:', {
      viewportPos: { x: viewport.x, y: viewport.y },
      gridContainerOffset: { x: 0, y: 0 }, // No offset needed!
      stagePos: { x: 0, y: 0 },
      canvasSize: { w: viewport.width, h: viewport.height }
    });
    
    // Render grid with current viewport
    const handleTileClick = (event: MapTileClickEvent) => {
      console.log(`[MapContainer] Tile clicked: (${event.position.x}, ${event.position.y})`);
      if (onTileClick) onTileClick(event.position.x, event.position.y);
    };
    
    const newGridContainer = createGridRenderer(
      mapData,
      viewport,
      handleTileClick
    );
    
    console.log('[MapContainer] Created grid with', newGridContainer.children.length, 'tiles');
    
    // Add tiles directly to the grid container (not the container itself!)
    // CRITICAL: Use slice() to copy array before iterating, because addChild() removes from source
    const tiles = newGridContainer.children.slice();
    tiles.forEach(child => {
      gridContainerRef.current!.addChild(child);
    });
    
    console.log('[MapContainer] Transferred', tiles.length, 'tiles to gridContainer');
    
    // CRITICAL DIAGNOSTIC: Check if canvas is actually rendering
    console.log('[MapContainer] DIAGNOSTIC Canvas state:', {
      canvasWidth: appRef.current.canvas.width,
      canvasHeight: appRef.current.canvas.height,
      canvasStyle: {
        width: appRef.current.canvas.style.width,
        height: appRef.current.canvas.style.height,
        display: appRef.current.canvas.style.display,
        position: appRef.current.canvas.style.position,
        zIndex: appRef.current.canvas.style.zIndex
      },
      rendererType: appRef.current.renderer.type,
      stageChildCount: appRef.current.stage.children.length,
      gridContainerChildCount: gridContainerRef.current!.children.length
    });
    
    // Destroy the temporary container (we only needed it to collect the tiles)
    newGridContainer.destroy({ children: false }); // Don't destroy children, we transferred them
    
    // CRITICAL: Force a manual render after adding content
    if (appRef.current) {
      // DIAGNOSTIC: Check first Graphics object in detail
      const firstChild = gridContainerRef.current!.children[0];
      if (firstChild) {
        console.log('[MapContainer] FIRST GRAPHICS INSPECTION:', {
          type: firstChild.constructor.name,
          position: { x: firstChild.position.x, y: firstChild.position.y },
          scale: { x: firstChild.scale.x, y: firstChild.scale.y },
          alpha: firstChild.alpha,
          visible: firstChild.visible,
          renderable: firstChild.renderable,
          parent: firstChild.parent ? firstChild.parent.constructor.name : 'null',
          stage: appRef.current.stage.children.includes(gridContainerRef.current!) ? 'IN STAGE' : 'NOT IN STAGE'
        });
      }
      
      appRef.current.renderer.render(appRef.current.stage);
      console.log('[MapContainer] DEBUG: Forced manual render');
    }
    
    // Notify external listeners of viewport change
    if (onViewportChange) onViewportChange(viewport);
    
    console.log('[MapContainer] Grid rendered', {
      visibleTiles: getVisibleTiles(viewport, mapData).length,
      totalTiles: mapData.length * mapData[0].length,
      viewport,
      gridContainerChildren: gridContainerRef.current.children.length,
      stagePosition: { x: appRef.current.stage.position.x, y: appRef.current.stage.position.y },
      stageScale: { x: appRef.current.stage.scale.x, y: appRef.current.stage.scale.y },
      // DEBUG: Check actual container positions
      gridContainerPos: { 
        x: gridContainerRef.current.position.x, 
        y: gridContainerRef.current.position.y 
      },
      gridContainerVisible: gridContainerRef.current.visible,
      gridContainerAlpha: gridContainerRef.current.alpha,
      stageChildren: appRef.current.stage.children.map((c: any) => ({
        label: c.label,
        children: c.children?.length || 0,
        visible: c.visible,
        alpha: c.alpha
      }))
    });
  }, [viewport.x, viewport.y, viewport.width, viewport.height, viewport.scale, mapData, onTileClick, onViewportChange]);
  
  /**
   * Render player markers when they change
   */
  useEffect(() => {
    if (!appRef.current || !markerContainerRef.current) return;
    
    // Remove old markers - CRITICAL: Remove ticker listeners first!
    markerGraphicsRef.current.forEach((graphics, playerId) => {
      // Remove ticker animation if it exists
      const animationFn = (graphics as any).animationFn;
      if (animationFn && appRef.current) {
        appRef.current.ticker.remove(animationFn);
      }
      
      // Now safe to destroy graphics
      removePlayerMarker(graphics, markerContainerRef.current!);
    });
    markerGraphicsRef.current.clear();
    markerContainerRef.current.removeChildren();
    
    // Create new markers
    playerMarkers.forEach((marker) => {
      const graphics = createPlayerMarker(
        marker,
        markerContainerRef.current!
      );
      
      markerGraphicsRef.current.set(marker.playerId, graphics);
      
      // Start animation for current player and Flag Bearer
      if (marker.isCurrentPlayer || marker.isFlagBearer) {
        const animationFn = (ticker: any) => {
          animatePlayerMarker(graphics, ticker.deltaTime);
        };
        appRef.current!.ticker.add(animationFn);
        
        // Store animation function for cleanup
        (graphics as any).animationFn = animationFn;
      }
    });
    
    console.log('[MapContainer] Player markers rendered', {
      count: playerMarkers.length,
      currentPlayer: playerMarkers.find(m => m.isCurrentPlayer),
      flagBearer: playerMarkers.find(m => m.isFlagBearer)
    });
  }, [playerMarkers]);
  
  /**
   * Handle window resize
   */
  useEffect(() => {
    const handleResize = () => {
      if (!appRef.current || !canvasRef.current) return;
      
      const newWidth = canvasRef.current.clientWidth;
      const newHeight = canvasRef.current.clientHeight;
      
      appRef.current.renderer.resize(newWidth, newHeight);
      
      setViewport(prev => ({
        ...prev,
        width: newWidth,
        height: newHeight
      }));
      
      console.log('[MapContainer] Canvas resized', { newWidth, newHeight });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  /**
   * Mouse/Touch pan handlers
   */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setViewportStart({ x: viewport.x, y: viewport.y });
  }, [viewport.x, viewport.y]);
  
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning || !panStart || !viewportStart) return;
    
    const deltaX = e.clientX - panStart.x;
    const deltaY = e.clientY - panStart.y;
    
    // Convert screen delta to world delta (account for zoom)
    const worldDeltaX = deltaX / viewport.scale;
    const worldDeltaY = deltaY / viewport.scale;
    
    const newViewport: MapViewport = {
      ...viewport,
      x: viewportStart.x - worldDeltaX,
      y: viewportStart.y - worldDeltaY
    };
    
    // Clamp to map bounds
    const clampedViewport = clampViewport(newViewport);
    setViewport(clampedViewport);
  }, [isPanning, panStart, viewportStart, viewport]);
  
  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
    setViewportStart(null);
  }, []);
  
  /**
   * Keyboard controls (arrow keys for panning)
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!appRef.current) return;
      
      // Ignore if typing in input field
      if (isTypingInInput()) {
        return;
      }
      
      const panSpeed = 32; // Move one tile at a time
      let newViewport = { ...viewport };
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          newViewport.y -= panSpeed / viewport.scale;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          newViewport.y += panSpeed / viewport.scale;
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          newViewport.x -= panSpeed / viewport.scale;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          newViewport.x += panSpeed / viewport.scale;
          break;
        case 'Home':
        case 'h':
        case 'H':
          // Center on player
          newViewport = centerViewportOn(playerPosition, newViewport);
          break;
        default:
          return;
      }
      
      e.preventDefault();
      const clampedViewport = clampViewport(newViewport);
      setViewport(clampedViewport);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewport, playerPosition]);
  
  return (
    <div
      className={`map-container ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: '100%',
          height: '100%',
          cursor: isPanning ? 'grabbing' : 'grab',
          touchAction: 'none', // Prevent browser pan/zoom
          userSelect: 'none',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      >
        {/* Canvas will be appended here by PixiJS */}
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * Performance Optimizations:
 * - Viewport culling in GridRenderer (only renders visible tiles)
 * - PixiJS WebGL renderer for GPU acceleration
 * - Efficient container management (separate layers for grid/markers)
 * - Animation ticker shared across all pulsing markers
 * 
 * Mobile Support:
 * - Touch pan via pointer events (unified mouse/touch handling)
 * - Pinch-zoom can be added via touch event listeners (future enhancement)
 * - Responsive canvas sizing with window.devicePixelRatio
 * - touchAction: 'none' prevents browser interference
 * 
 * Accessibility:
 * - Keyboard navigation (arrow keys, WASD for pan, Home/H to center)
 * - Visual feedback (cursor changes during pan)
 * - Can add ARIA labels for screen readers (future enhancement)
 * 
 * Known Limitations:
 * - Pinch-zoom gesture not yet implemented (uses button zoom only)
 * - No momentum scrolling for smoother feel (can add with animation)
 * - Tile click detection could be optimized with spatial hashing
 * 
 * Future Enhancements:
 * - Add minimap overlay showing full map with viewport indicator
 * - Implement particle trail rendering for Flag Bearer
 * - Add fog of war for unexplored areas
 * - Support texture atlas for better performance
 * - Add smooth camera transitions when re-centering
 */
