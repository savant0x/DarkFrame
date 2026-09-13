/**
 * @file components/map/CanvasMapRenderer.tsx
 * @created 2025-10-20 (rewritten 2026-09-12, FID-20260912-087)
 * @overview Camera-based Canvas 2D map renderer — the AAA cartographic pass.
 *
 * Architecture (spec: dev/art/MAP-OVERHAUL-SPEC.md):
 *   • TERRAIN LAYER, cached offscreen at BASE_PX/tile — blitted through the
 *     camera each frame; re-rendered only when mapData or size changes.
 *   • OVERLAY PASS per frame (cheap): trail, markers, hover crosshair,
 *     selection ring, sector labels. rAF loop only while the flag pulses.
 *   • At high zoom (scale > BASE_PX) terrain draws culled tiles directly —
 *     sharper than upscaling the cache, and tile count stays tiny.
 *   • devicePixelRatio-aware: crisp on retina.
 * All colors come from lib/mapPalette (single source shared with MapLegend).
 * Camera math lives in lib/mapCamera (pure, unit-tested) — this component is
 * a pure drawing surface: page owns camera state and pointer handling.
 */

'use client';

import { useEffect, useRef, useMemo } from 'react';
import { MAP_CONFIG } from '@/types';
import { TERRAIN_PALETTE, MAP_MARKERS, LABEL_BG, tierColor, tileJitter, shadeHex } from '@/lib/mapPalette';
import { tileShade } from '@/lib/mapElevation';
import { worldToScreen, type Camera } from '@/lib/mapCamera';
import { logger } from '@/lib/logger';

/** Offscreen terrain cache resolution, in world px per tile. */
const BASE_PX = 8;
const SECTOR = 50;

interface CanvasMapRendererProps {
  mapData: Array<Array<{ x: number; y: number; terrain: string }>>;
  cam: Camera;
  /** CSS pixel size of the canvas (page-owned, from the container). */
  canvasW: number;
  canvasH: number;
  playerPosition?: { x: number; y: number };
  flagMarker?: { position: { x: number; y: number }; username: string } | null;
  flagTrail?: Array<{ x: number; y: number; timestamp: string | Date; expiresAt: string | Date }>;
  baseMarkers?: Array<{ x: number; y: number; owner: string; level: number; isBeerBase: boolean; tier?: number | null }>;
  selectedTile?: { x: number; y: number } | null;
  hoveredTile?: { x: number; y: number } | null;
  onTileClick?: (x: number, y: number) => void;
  onTileHover?: (tile: { x: number; y: number } | null) => void;
  /** Expose the cached terrain thumbnail for the minimap (1px/tile). */
  onTerrainReady?: (thumbnail: HTMLCanvasElement) => void;
}

export function CanvasMapRenderer({
  mapData,
  cam,
  canvasW,
  canvasH,
  playerPosition,
  flagMarker,
  flagTrail,
  baseMarkers,
  selectedTile,
  hoveredTile,
  onTileClick,
  onTileHover,
  onTerrainReady,
}: CanvasMapRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const camRef = useRef(cam);
  camRef.current = cam;
  const hoverRef = useRef(hoveredTile);
  hoverRef.current = hoveredTile;
  const selRef = useRef(selectedTile);
  selRef.current = selectedTile;

  // --- TERRAIN CACHE --------------------------------------------------------
  // Renders the whole map at BASE_PX/tile once per (mapData, size-less) change.
  // Also produces the 1px/tile minimap thumbnail via drawImage downscale.
  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = MAP_CONFIG.WIDTH * BASE_PX;
    off.height = MAP_CONFIG.HEIGHT * BASE_PX;
    const octx = off.getContext('2d');
    if (!octx) return;

    octx.fillStyle = TERRAIN_PALETTE.Wasteland.base;
    octx.fillRect(0, 0, off.width, off.height);

    // Bucket per terrain (FID-026 §2 batching preserved) — one fill per bucket.
    const buckets = new Map<string, number[]>();
    for (let ty = 1; ty <= MAP_CONFIG.HEIGHT; ty++) {
      for (let tx = 1; tx <= MAP_CONFIG.WIDTH; tx++) {
        const tile = mapData[ty - 1]?.[tx - 1];
        if (!tile) continue;
        const arr = buckets.get(tile.terrain) ?? [];
        arr.push(tx, ty);
        buckets.set(tile.terrain, arr);
      }
    }

    // Wasteland first (bottom), then resources, specials last (glyphs on top).
    const order = ['Wasteland', 'Metal', 'Energy', 'Cave', 'Forest', 'Factory', 'Bank', 'Shrine', 'AuctionHouse'];
    for (const terrain of order) {
      const coords = buckets.get(terrain);
      if (!coords) continue;
      const entry = TERRAIN_PALETTE[terrain as keyof typeof TERRAIN_PALETTE];
      if (!entry) continue;
      for (let i = 0; i < coords.length; i += 2) {
        const tx = coords[i];
        const ty = coords[i + 1];
        // FID-088: hillshade × jitter — one combined lightness factor.
        const light = tileShade(tx, ty, terrain) * tileJitter(tx, ty);
        octx.fillStyle = shadeHex(entry.base, light);
        octx.fillRect((tx - 1) * BASE_PX, (ty - 1) * BASE_PX, BASE_PX, BASE_PX);
        // Specials get a bright core dot at cache resolution.
        if (entry.accent) {
          octx.fillStyle = entry.accent;
          octx.fillRect((tx - 1) * BASE_PX + BASE_PX / 2 - 1, (ty - 1) * BASE_PX + BASE_PX / 2 - 1, 2, 2);
        }
      }
    }

    terrainRef.current = off;

    // Minimap thumbnail (1px/tile).
    const thumb = document.createElement('canvas');
    thumb.width = MAP_CONFIG.WIDTH;
    thumb.height = MAP_CONFIG.HEIGHT;
    const tctx = thumb.getContext('2d');
    if (tctx) tctx.drawImage(off, 0, 0, thumb.width, thumb.height);
    onTerrainReady?.(thumb);

    logger.debug('[Map] terrain cache rendered', { basePx: BASE_PX, buckets: buckets.size });
  }, [mapData, onTerrainReady]);

  // --- OVERLAY / COMPOSITE PASS --------------------------------------------
  const draw = (t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvasW;
    const H = canvasH;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Backdrop (space beyond the map edge — visible only transiently during
    // zoom transitions; the camera clamp normally prevents this).
    ctx.fillStyle = '#07080d';
    ctx.fillRect(0, 0, W, H);

    const c = camRef.current;
    const s = c.scale;

    // Terrain: blit the cached layer when downscaling; direct-draw culled
    // tiles when the zoom exceeds cache resolution.
    const terrain = terrainRef.current;
    if (terrain && s <= BASE_PX) {
      const tl = worldToScreen(c, 0, 0, W, H);
      const mapW = MAP_CONFIG.WIDTH * s;
      const mapH = MAP_CONFIG.HEIGHT * s;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(terrain, tl.x, tl.y, mapW, mapH);
    } else {
      // Culled direct draw — sharp at high zoom.
      const worldTL = { x: c.cx - W / (2 * s), y: c.cy - H / (2 * s) };
      const tx0 = Math.max(1, Math.floor(worldTL.x) + 1);
      const ty0 = Math.max(1, Math.floor(worldTL.y) + 1);
      const tx1 = Math.min(MAP_CONFIG.WIDTH, Math.ceil(worldTL.x + W / s) + 1);
      const ty1 = Math.min(MAP_CONFIG.HEIGHT, Math.ceil(worldTL.y + H / s) + 1);
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const tile = mapData[ty - 1]?.[tx - 1];
          const entry = tile ? TERRAIN_PALETTE[tile.terrain as keyof typeof TERRAIN_PALETTE] : undefined;
          // FID-088: same shade decision as the cache path — identical pixels.
          ctx.fillStyle = entry
            ? shadeHex(entry.base, tileShade(tx, ty, tile.terrain) * tileJitter(tx, ty))
            : '#07080d';
          const p = worldToScreen(c, tx - 1, ty - 1, W, H);
          const size = s + 0.5; // overlap to hide seams
          ctx.fillRect(p.x, p.y, size, size);
          if (entry?.accent) {
            ctx.fillStyle = entry.accent;
            ctx.beginPath();
            ctx.arc(p.x + s / 2, p.y + s / 2, Math.max(2, s * 0.12), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Grid: minor 10-tile lines only when zoomed in enough to matter.
    if (s >= 6) {
      ctx.strokeStyle = MAP_MARKERS.gridLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = 10; gx < MAP_CONFIG.WIDTH; gx += 10) {
        const p = worldToScreen(c, gx, 0, W, H);
        ctx.moveTo(Math.round(p.x) + 0.5, 0);
        ctx.lineTo(Math.round(p.x) + 0.5, H);
      }
      for (let gy = 10; gy < MAP_CONFIG.HEIGHT; gy += 10) {
        const p = worldToScreen(c, 0, gy, W, H);
        ctx.moveTo(0, Math.round(p.y) + 0.5);
        ctx.lineTo(W, Math.round(p.y) + 0.5);
      }
      ctx.stroke();
    }

    // Sector borders + labels every 50 tiles.
    ctx.strokeStyle = MAP_MARKERS.gridLineMajor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let g = SECTOR; g < MAP_CONFIG.WIDTH; g += SECTOR) {
      const p = worldToScreen(c, g, 0, W, H);
      ctx.moveTo(Math.round(p.x) + 0.5, 0);
      ctx.lineTo(Math.round(p.x) + 0.5, H);
      const q = worldToScreen(c, 0, g, W, H);
      ctx.moveTo(0, Math.round(q.y) + 0.5);
      ctx.lineTo(W, Math.round(q.y) + 0.5);
    }
    ctx.stroke();

    if (s >= 2.5) {
      ctx.fillStyle = MAP_MARKERS.sectorLabel;
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const sectors = [['NW', 0, 0], ['N', 50, 0], ['NE', 100, 0], ['W', 0, 50], ['C', 50, 50], ['E', 100, 50], ['SW', 0, 100], ['S', 50, 100], ['SE', 100, 100]] as const;
      for (const [name, sx0, sy0] of sectors) {
        const p = worldToScreen(c, sx0 + 0.6, sy0 + 0.6, W, H);
        if (p.x < -40 || p.x > W || p.y < -20 || p.y > H) continue;
        ctx.fillText(name, p.x, p.y);
      }
    }

    // Flag trail (fading gold glimmer — TTL semantics preserved).
    const now = Date.now();
    if (flagTrail?.length) {
      for (const tr of flagTrail) {
        const remaining = new Date(tr.expiresAt).getTime() - now;
        if (remaining <= 0) continue;
        const TTL = 8 * 60 * 1000;
        const age = Math.max(0, Math.min(1, 1 - remaining / TTL));
        const alpha = 0.55 - 0.4 * age;
        const p = worldToScreen(c, tr.x - 0.5, tr.y - 0.5, W, H);
        ctx.fillStyle = `rgba(${MAP_MARKERS.flagTrail}, ${alpha.toFixed(3)})`;
        const r = Math.max(2, s * 0.3);
        ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
      }
    }

    // Base markers — diamonds; beer bases get the FID-086 tier ring.
    for (const b of baseMarkers ?? []) {
      const p = worldToScreen(c, b.x - 0.5, b.y - 0.5, W, H);
      const r = Math.max(4, Math.min(9, s * 0.35));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = b.isBeerBase ? MAP_MARKERS.beerBase : MAP_MARKERS.botBase;
      ctx.fillRect(-r / 2, -r / 2, r, r);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-r / 2, -r / 2, r, r);
      ctx.restore();
      if (b.isBeerBase && b.tier) {
        ctx.strokeStyle = tierColor(b.tier);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Labels only when zoomed in enough to spread out (Quadrant+) —
      // at fit zoom the marker field itself carries the information.
      if (s >= 8) {
        const label = `${b.owner} · LV ${b.level}`;
        ctx.font = '600 10px ui-monospace, monospace';
        const w = ctx.measureText(label).width + 8;
        ctx.fillStyle = LABEL_BG;
        ctx.fillRect(p.x - w / 2, p.y + r + 3, w, 14);
        ctx.fillStyle = b.isBeerBase ? '#ff9bc0' : '#ff8a80';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, p.x, p.y + r + 10);
      }
    }

    // Flag bearer — pulsing gold.
    if (flagMarker?.position) {
      const p = worldToScreen(c, flagMarker.position.x - 0.5, flagMarker.position.y - 0.5, W, H);
      const pulse = 0.25 + 0.15 * Math.sin(t / 400);
      ctx.fillStyle = `rgba(${MAP_MARKERS.flagTrail}, ${pulse.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(12, s * 0.9), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = MAP_MARKERS.flag;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(7, s * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5c00';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = LABEL_BG;
      ctx.fillRect(p.x - 26, p.y - Math.max(12, s * 0.9) - 18, 52, 16);
      ctx.fillStyle = MAP_MARKERS.flag;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏴 FLAG', p.x, p.y - Math.max(12, s * 0.9) - 10);
    }

    // Player — cyan glow disc.
    if (playerPosition) {
      const p = worldToScreen(c, playerPosition.x - 0.5, playerPosition.y - 0.5, W, H);
      ctx.fillStyle = 'rgba(55, 214, 245, 0.28)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(11, s * 0.8), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = MAP_MARKERS.player;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(6.5, s * 0.45), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = MAP_MARKERS.playerCore;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (s >= 2.5) {
        ctx.fillStyle = LABEL_BG;
        ctx.fillRect(p.x - 17, p.y - Math.max(11, s * 0.8) - 17, 34, 15);
        ctx.fillStyle = MAP_MARKERS.playerCore;
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('YOU', p.x, p.y - Math.max(11, s * 0.8) - 9);
      }
    }

    // Hover crosshair + selected ring.
    const hv = hoverRef.current;
    if (hv) {
      const p = worldToScreen(c, hv.x - 1, hv.y - 1, W, H);
      ctx.strokeStyle = MAP_MARKERS.hover;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, s - 1, s - 1);
    }
    const sel = selRef.current;
    if (sel) {
      const p = worldToScreen(c, sel.x - 1, sel.y - 1, W, H);
      ctx.strokeStyle = MAP_MARKERS.selection;
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x + 1, p.y + 1, s - 2, s - 2);
    }
  };

  // rAF loop: continuous while a flag pulse is visible, single-pass otherwise.
  const hasFlag = Boolean(flagMarker?.position);
  useEffect(() => {
    if (!hasFlag) {
      draw(performance.now());
      return;
    }
    const loop = (t: number) => draw(t);
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFlag, cam, canvasW, canvasH, mapData, playerPosition, flagMarker, flagTrail, baseMarkers, selectedTile, hoveredTile]);

  // Hover / click → tile coords (camera-aware).
  const tileFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = { x: (sx - canvasW / 2) / cam.scale + cam.cx, y: (sy - canvasH / 2) / cam.scale + cam.cy };
    return { x: Math.floor(w.x) + 1, y: Math.floor(w.y) + 1 };
  };

  const inBounds = (t: { x: number; y: number }) =>
    t.x >= 1 && t.x <= MAP_CONFIG.WIDTH && t.y >= 1 && t.y <= MAP_CONFIG.HEIGHT;

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: canvasW, height: canvasH, cursor: 'crosshair' }}
      onClick={(e) => {
        const t = tileFromEvent(e);
        if (inBounds(t)) onTileClick?.(t.x, t.y);
      }}
      onMouseMove={(e) => {
        const t = tileFromEvent(e);
        onTileHover?.(inBounds(t) ? t : null);
      }}
      onMouseLeave={() => onTileHover?.(null)}
    />
  );
}

/** Hook helper: memoized empty deps guard for onTerrainReady consumers. */
export function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fn, []);
}
