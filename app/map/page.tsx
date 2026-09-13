/**
 * @file app/map/page.tsx
 * @created 2025-10-20 (camera rebuild 2026-09-12, FID-20260912-087)
 * @overview /map — the tactical 150×150 world map.
 *
 * FID-20260912-087 (spec: dev/art/MAP-OVERHAUL-SPEC.md): real camera
 * (fit-to-view by default, cursor-anchored wheel zoom, drag pan, WASD/arrow
 * keys, Home/H recenter), zoom presets that actually zoom, hover feedback,
 * and a click-to-jump minimap. Data flow unchanged: /api/map/terrain (compact
 * codec) → decoded grid; /api/map/bases + /api/flag overlays on a 20–30s poll.
 */

'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useGameContext } from '@/context/GameContext';
import { GameLayout, StatsPanel, ControlsPanel } from '@/components';
import TopNavBar from '@/components/TopNavBar';
import { CanvasMapRenderer } from '@/components/map/CanvasMapRenderer';
import { MapLegend } from '@/components/map/MapLegend';
import { ZoomControls } from '@/components/map/ZoomControls';
import BackButton from '@/components/BackButton';
import { Loader2, Minus, Plus, Maximize2 } from 'lucide-react';
import {
  type ZoomLevel,
  type MapTile,
  MAP_CONFIG
} from '@/types';
import { generateMockMapData } from '@/lib/mapService';
import { decodeTerrainGrid, COMPACT_TERRAIN_FORMAT } from '@/lib/terrainCodec';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';
import { logger } from '@/lib/logger';
import {
  type Camera,
  type FlyToState,
  zoomAtPoint,
  clampCameraToMap,
  fitScale,
  panByPixels,
  resolveFlyToTarget,
  flyToDuration,
  sampleFlyTo,
} from '@/lib/mapCamera';

const MAP_TILES = MAP_CONFIG.WIDTH;
/** Zoom presets: multipliers over fit-scale (ZoomLevel contract preserved). */
const ZOOM_MULTIPLIER: Record<ZoomLevel, number> = {
  FullMap: 1,
  Quadrant: 2,
  Zone: 4,
  Region: 8,
};
const MAX_SCALE = 48;

export default function MapPage() {
  const context = useGameContext();

  const [mapData, setMapData] = useState<MapTile[][] | null>(null);
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('FullMap');
  const [minimap, setMinimap] = useState<HTMLCanvasElement | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [flagState, setFlagState] = useState<{
    position: { x: number; y: number };
    username: string;
    trail: Array<{ x: number; y: number; timestamp: string; expiresAt: string }>;
  } | null>(null);
  const [baseMarkers, setBaseMarkers] = useState<Array<{ x: number; y: number; owner: string; level: number; isBeerBase: boolean; tier?: number | null }>>([]);

  const playerPosition = useMemo(() => context?.currentTile || { x: 75, y: 75 }, [context?.currentTile]);

  // --- canvas size (container-measured) ------------------------------------
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useMemo(() => Math.max(0.5, fitScale(canvasSize.w, canvasSize.h, MAP_TILES)), [canvasSize]);
  const maxScale = MAX_SCALE;

  // --- camera ---------------------------------------------------------------
  const [cam, setCam] = useState<Camera>({ cx: MAP_TILES / 2, cy: MAP_TILES / 2, scale: 4 });
  // FID-089: animated fly-to state. The flight lives in refs (rAF-owned);
  // every frame samples the eased camera into `cam`. Any manual input
  // (drag / wheel / keys / preset / resize) cancels the flight instantly.
  const flightRef = useRef<FlyToState | null>(null);
  const flightStartRef = useRef(0);
  const rafRef = useRef(0);
  const camRef = useRef(cam);
  camRef.current = cam;
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const canvasSizeRef = useRef(canvasSize);
  canvasSizeRef.current = canvasSize;

  const cancelFlight = useCallback(() => {
    if (flightRef.current) {
      flightRef.current = null;
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  useEffect(() => () => cancelFlight(), [cancelFlight]);

  /** Nearest zoom preset for a scale — keeps the sidebar label truthful. */
  const nearestPreset = useCallback((scale: number): ZoomLevel => {
    let best: ZoomLevel = 'FullMap';
    let bestDiff = Infinity;
    for (const level of Object.keys(ZOOM_MULTIPLIER) as ZoomLevel[]) {
      const diff = Math.abs(fit * ZOOM_MULTIPLIER[level] - scale);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = level;
      }
    }
    return best;
  }, [fit]);

  const syncZoomLabel = useCallback((scale: number) => {
    setZoomLevel(nearestPreset(scale));
  }, [nearestPreset]);

  /**
   * Fly the camera to world point (wx, wy): eased pan + geometric zoom
   * landing at Region scale (never zooming out). Cancels on any input.
   */
  const flyTo = useCallback((wx: number, wy: number) => {
    cancelAnimationFrame(rafRef.current);
    const start = camRef.current;
    const { w, h } = canvasSizeRef.current;
    const to = resolveFlyToTarget(start, wx, wy, w, h, MAP_TILES, fitRef.current, maxScale);
    flightRef.current = {
      from: start,
      to,
      durationMs: flyToDuration(start, to),
      elapsedMs: 0,
    };
    flightStartRef.current = 0;
    const tick = (t: number) => {
      const flight = flightRef.current;
      if (!flight) return;
      if (flightStartRef.current === 0) flightStartRef.current = t;
      const elapsed = t - flightStartRef.current;
      if (elapsed >= flight.durationMs) {
        flightRef.current = null;
        setCam(flight.to);
        syncZoomLabel(flight.to.scale);
        return;
      }
      setCam(sampleFlyTo({ ...flight, elapsedMs: elapsed }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [maxScale, syncZoomLabel]);

  // Keep the camera valid when the canvas resizes (and end any flight —
  // its start frame no longer matches the viewport).
  useEffect(() => {
    cancelFlight();
    setCam(c => clampCameraToMap({ ...c, scale: Math.max(fit, Math.min(maxScale, c.scale)) }, canvasSize.w, canvasSize.h, MAP_TILES));
  }, [fit, canvasSize, maxScale, cancelFlight]);

  const applyZoomPreset = useCallback((level: ZoomLevel) => {
    cancelFlight();
    setZoomLevel(level);
    setCam(c => {
      const target = Math.min(maxScale, fit * ZOOM_MULTIPLIER[level]);
      const factor = target / c.scale;
      return zoomAtPoint(c, canvasSize.w / 2, canvasSize.h / 2, canvasSize.w, canvasSize.h, factor, fit, maxScale, MAP_TILES);
    });
  }, [fit, maxScale, canvasSize, cancelFlight]);

  // Initial fit once map data + size are known.
  const didFit = useRef(false);
  useEffect(() => {
    if (mapData && !didFit.current && canvasSize.w > 0) {
      didFit.current = true;
      setCam({ cx: MAP_TILES / 2, cy: MAP_TILES / 2, scale: fit });
    }
  }, [mapData, canvasSize, fit]);

  // Wheel zoom (cursor-anchored, passive:false via non-react listener).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isTypingInInput()) return;
      cancelFlight();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      setCam(c => zoomAtPoint(c, sx, sy, rect.width, rect.height, factor, fit, maxScale, MAP_TILES));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [fit, maxScale, cancelFlight]);

  // Drag pan.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let dragging = false;
    let last = { x: 0, y: 0 };
    const down = (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
      el.style.cursor = 'grabbing';
    };
    const move = (e: MouseEvent) => {
      if (!dragging) return;
      cancelFlight();
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      setCam(c => clampCameraToMap(panByPixels(c, -dx, -dy), el.clientWidth, el.clientHeight, MAP_TILES));
    };
    const up = () => {
      dragging = false;
      el.style.cursor = '';
    };
    el.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      el.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [cancelFlight]);

  // Suppress click-select after a drag.
  const dragMoved = useRef(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let down = { x: 0, y: 0 };
    const onDown = (e: MouseEvent) => { down = { x: e.clientX, y: e.clientY }; dragMoved.current = 0; };
    const onMove = (e: MouseEvent) => {
      if (e.buttons & 1) dragMoved.current += Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
    };
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mousemove', onMove);
    return () => {
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mousemove', onMove);
    };
  }, []);

  // Keyboard pan + zoom + recenter.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput()) return;
      const stepTiles = 3;
      const set = (dx: number, dy: number) => {
        cancelFlight();
        setCam(c => clampCameraToMap(panByPixels(c, dx * c.scale, dy * c.scale), canvasSize.w, canvasSize.h, MAP_TILES));
        e.preventDefault();
      };
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': set(0, -stepTiles); break;
        case 'ArrowDown': case 's': case 'S': set(0, stepTiles); break;
        case 'ArrowLeft': case 'a': case 'A': set(-stepTiles, 0); break;
        case 'ArrowRight': case 'd': case 'D': set(stepTiles, 0); break;
        case 'Home': case 'h': case 'H':
          // FID-089: recenter is now a warp, not a snap.
          flyTo(playerPosition.x - 0.5, playerPosition.y - 0.5);
          e.preventDefault();
          break;
        case '+': case '=':
          cancelFlight();
          setCam(c => zoomAtPoint(c, canvasSize.w / 2, canvasSize.h / 2, canvasSize.w, canvasSize.h, 1.25, fit, maxScale, MAP_TILES));
          e.preventDefault();
          break;
        case '-': case '_':
          cancelFlight();
          setCam(c => zoomAtPoint(c, canvasSize.w / 2, canvasSize.h / 2, canvasSize.w, canvasSize.h, 1 / 1.25, fit, maxScale, MAP_TILES));
          e.preventDefault();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playerPosition, canvasSize, fit, maxScale, cancelFlight, flyTo]);

  // --- data: terrain ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const loadRealMap = async (): Promise<void> => {
      let map: MapTile[][] | null = null;
      try {
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
          map = decodeTerrainGrid({ width: body.data.width, height: body.data.height, grid: body.data.grid });
        }
      } catch (err) {
        logger.debug('[MapPage] terrain fetch failed, mock fallback', err);
      }
      if (cancelled) return;
      const data = map ?? generateMockMapData();
      setMapData(data);
    };
    void loadRealMap();
    return () => { cancelled = true; };
  }, []);

  // --- data: bases + flag overlays ------------------------------------------
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
        // non-critical
      }
    };
    loadBases();
    const interval = setInterval(loadBases, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    const player = context?.player;
    if (!player) return;
    let cancelled = false;
    const buildMarkers = async () => {
      try {
        const res = await fetch('/api/flag');
        const data = await res.json();
        const bearer = data?.data?.bearer;
        if (!cancelled && data?.success && bearer && bearer.position) {
          setFlagState({
            position: bearer.position,
            username: bearer.username,
            trail: (bearer.trail ?? []).map((t: { x: number; y: number; timestamp: string; expiresAt: string }) => ({
              x: t.x, y: t.y, timestamp: t.timestamp, expiresAt: t.expiresAt,
            })),
          });
        } else if (!cancelled) {
          setFlagState(null);
        }
      } catch {
        // Flag data is optional overlay
      }
    };
    buildMarkers();
    const flagPoll = setInterval(buildMarkers, 20000);
    return () => { cancelled = true; clearInterval(flagPoll); };
  }, [context?.player]);

  const handleTileClick = useCallback((x: number, y: number) => {
    if (dragMoved.current > 6) return; // it was a drag, not a click
    setSelectedTile({ x, y });
  }, []);

  const onTerrainReady = useCallback((thumb: HTMLCanvasElement) => setMinimap(thumb), []);

  /** Minimap click → animated warp to the clicked world point (FID-089). */
  const jumpFromMinimap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const wx = ((e.clientX - rect.left) / rect.width) * MAP_TILES;
    const wy = ((e.clientY - rect.top) / rect.height) * MAP_TILES;
    flyTo(wx, wy);
  };

  /** Double-click a tile → warp there (FID-089). */
  const handleTileDoubleClick = useCallback((x: number, y: number) => {
    flyTo(x - 0.5, y - 0.5);
  }, [flyTo]);

  /** Viewport rect on the minimap (tile coords, continuous). */
  const minimapViewport = useMemo(() => {
    const halfW = canvasSize.w / (2 * cam.scale);
    const halfH = canvasSize.h / (2 * cam.scale);
    return {
      x: Math.max(0, cam.cx - halfW),
      y: Math.max(0, cam.cy - halfH),
      w: Math.min(MAP_TILES, halfW * 2),
      h: Math.min(MAP_TILES, halfH * 2),
    };
  }, [cam, canvasSize]);

  const hoveredTerrain = hoveredTile
    ? mapData?.[hoveredTile.y - 1]?.[hoveredTile.x - 1]?.terrain
    : null;

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
                150×150 Tactical Grid · {zoomLevel} · {cam.scale.toFixed(1)}px/tile
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 text-sm">
            <div>
              <span className="text-[color:var(--nn-text-secondary)]">Position:</span>{' '}
              <span className="font-mono text-[color:var(--nn-cyan)]">
                ({playerPosition.x}, {playerPosition.y})
              </span>
            </div>
            {hoveredTile && (
              <div>
                <span className="text-[color:var(--nn-text-secondary)]">Hover:</span>{' '}
                <span className="font-mono text-[color:var(--nn-text-primary)]">
                  ({hoveredTile.x}, {hoveredTile.y}){hoveredTerrain ? ` · ${hoveredTerrain}` : ''}
                </span>
              </div>
            )}
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
            <div>
              <h2 className="nn-panel__title text-base mb-3">Zoom Level</h2>
              <ZoomControls
                currentZoom={zoomLevel}
                onZoomChange={applyZoomPreset}
              />
            </div>

            <div className="flex gap-2">
              <button className="nn-abtn nn-abtn--ghost flex-1" onClick={() => applyZoomPreset(zoomLevel)} title="Reapply preset">
                <Maximize2 size={13} /> Fit
              </button>
              <button className="nn-abtn nn-abtn--ghost" onClick={() => setCam(c => zoomAtPoint(c, canvasSize.w / 2, canvasSize.h / 2, canvasSize.w, canvasSize.h, 1.25, fit, maxScale, MAP_TILES))} title="Zoom in">
                <Plus size={13} />
              </button>
              <button className="nn-abtn nn-abtn--ghost" onClick={() => setCam(c => zoomAtPoint(c, canvasSize.w / 2, canvasSize.h / 2, canvasSize.w, canvasSize.h, 1 / 1.25, fit, maxScale, MAP_TILES))} title="Zoom out">
                <Minus size={13} />
              </button>
            </div>

            <div>
              <h2 className="nn-panel__title text-base mb-3">Legend</h2>
              <MapLegend compact />
            </div>

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

            {selectedTile && (
              <div className="nn-panel rounded-none p-4">
                <h3 className="nn-panel__title text-sm mb-2">Selected Tile</h3>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-[color:var(--nn-text-secondary)]">Coords:</span>{' '}
                    <span className="font-mono">({selectedTile.x}, {selectedTile.y})</span>
                  </p>
                  {mapData?.[selectedTile.y - 1]?.[selectedTile.x - 1] && (
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

            <div className="nn-panel rounded-none p-4 text-xs">
              <h3 className="nn-panel__title text-sm mb-2">Shortcuts</h3>
              <ul className="space-y-1 text-[color:var(--nn-text-primary)]">
                <li>Drag / Arrows / WASD: Pan</li>
                <li>Wheel or +/-: Zoom at cursor</li>
                <li>Double-click / Minimap: Warp</li>
                <li>Home / H: Fly to player</li>
                <li>Click Tile: Select</li>
              </ul>
            </div>
          </div>
        </aside>

        {/* Map Canvas */}
        <main className="flex-1 bg-[color:var(--nn-glass-dark)] relative overflow-hidden">
          {mapData ? (
            <div ref={containerRef} className="absolute inset-0 m-0 lg:m-4 border border-[color-mix(in_oklab,var(--nn-cyan)_20%,transparent)]">
              <CanvasMapRenderer
                mapData={mapData}
                cam={cam}
                canvasW={canvasSize.w}
                canvasH={canvasSize.h}
                playerPosition={playerPosition}
                flagMarker={
                  flagState && flagState.username !== context?.player?.username
                    ? { position: flagState.position, username: flagState.username }
                    : null
                }
                flagTrail={flagState?.trail}
                baseMarkers={baseMarkers}
                selectedTile={selectedTile}
                hoveredTile={hoveredTile}
                onTileClick={handleTileClick}
                onTileHover={setHoveredTile}
                onTileDoubleClick={handleTileDoubleClick}
                onTerrainReady={onTerrainReady}
              />

              {/* Minimap */}
              {showMinimap && minimap && (
                <div className="absolute bottom-3 right-3 nn-panel rounded-none p-2 shadow-[0_0_18px_color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
                  <div className="relative">
                    <canvas
                      ref={(node) => {
                        if (!node || !minimap) return;
                        const ctx = node.getContext('2d');
                        if (!ctx) return;
                        node.width = MAP_TILES;
                        node.height = MAP_TILES;
                        ctx.drawImage(minimap, 0, 0);
                        // viewport rect
                        ctx.strokeStyle = 'rgba(55,214,245,0.95)';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(minimapViewport.x + 0.5, minimapViewport.y + 0.5, minimapViewport.w, minimapViewport.h);
                        // player + flag dots
                        const dot = (px: number, py: number, color: string) => {
                          ctx.fillStyle = color;
                          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
                        };
                        dot(playerPosition.x, playerPosition.y, '#37d6f5');
                        if (flagState) dot(flagState.position.x, flagState.position.y, '#f5c542');
                      }}
                      width={160}
                      height={160}
                      style={{ width: 160, height: 160, imageRendering: 'pixelated', cursor: 'pointer', display: 'block' }}
                      onClick={jumpFromMinimap}
                      aria-label="Minimap — click to jump"
                    />
                  </div>
                </div>
              )}
              <button
                className="absolute bottom-3 right-3 nn-abtn nn-abtn--ghost text-xs lg:hidden"
                onClick={() => setShowMinimap(s => !s)}
              >
                {showMinimap ? 'Hide map' : 'Minimap'}
              </button>

              {/* Zoom hint */}
              <div className="absolute bottom-3 left-3 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] px-3 py-1.5 text-xs text-[color:var(--nn-text-secondary)] border border-[color-mix(in_oklab,var(--nn-cyan)_14%,transparent)]">
                Drag to pan · Scroll to zoom · Click to select
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="nn-spin-icon w-16 h-16 text-[color:var(--nn-cyan)] mx-auto mb-4" aria-label="Loading map data" />
                <p className="text-[color:var(--nn-text-secondary)]">Loading map data...</p>
              </div>
            </div>
          )}
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
