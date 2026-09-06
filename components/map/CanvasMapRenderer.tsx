/**
 * @file components/map/CanvasMapRenderer.tsx
 * @created 2025-10-20
 * @overview Simple Canvas 2D map renderer - PixiJS replacement
 * 
 * OVERVIEW:
 * Ultra-simple Canvas 2D renderer that ACTUALLY WORKS.
 * No PixiJS complexity, just straightforward drawing.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { type MapTile, type MapViewport, MAP_CONFIG, TILE_COLORS } from '@/types';

interface CanvasMapRendererProps {
  mapData: MapTile[][];
  viewport: MapViewport;
  playerPosition?: { x: number; y: number };
  /** Gold animated flag-bearer marker (omit when the viewer IS the bearer — their own marker suffices). */
  flagMarker?: {
    position: { x: number; y: number };
    username: string;
  } | null;
  /** Live trail tiles with expiry — rendered as fading gold glimmer. */
  flagTrail?: Array<{ x: number; y: number; timestamp: string | Date; expiresAt: string | Date }>;
  onTileClick?: (x: number, y: number) => void;
}

export function CanvasMapRenderer({
  mapData,
  viewport,
  playerPosition,
  flagMarker,
  flagTrail,
  onTileClick
}: CanvasMapRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  // Render the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    console.log('[Canvas2D] Rendering FULL MAP: 150×150 tiles');
    
    let tilesDrawn = 0;
    
    // Draw ALL tiles (no viewport culling - show entire map)
    for (let tileY = 1; tileY <= MAP_CONFIG.HEIGHT; tileY++) {
      for (let tileX = 1; tileX <= MAP_CONFIG.WIDTH; tileX++) {
        // mapData is [row][column] = [y-1][x-1] (0-indexed array)
        const tile = mapData[tileY - 1]?.[tileX - 1];
        if (!tile) continue;
        
        // Calculate screen position (tile (1,1) is at pixel (0,0))
        const screenX = (tile.x - 1) * MAP_CONFIG.TILE_SIZE;
        const screenY = (tile.y - 1) * MAP_CONFIG.TILE_SIZE;
        
        // Get tile color
        const colorHex = TILE_COLORS[tile.terrain];
        const color = `#${colorHex.toString(16).padStart(6, '0')}`;
        
        // Draw tile
        ctx.fillStyle = color;
        ctx.fillRect(screenX, screenY, MAP_CONFIG.TILE_SIZE, MAP_CONFIG.TILE_SIZE);
        
        // Draw border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX, screenY, MAP_CONFIG.TILE_SIZE, MAP_CONFIG.TILE_SIZE);
        
        tilesDrawn++;
      }
    }
    
    console.log('[Canvas2D] Drew', tilesDrawn, 'tiles (full map)');
    
    // Draw coordinate grid overlay (every 10 tiles for full map view)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, 20); // Top bar for X coordinates
    ctx.fillRect(canvas.width - 40, 0, 40, canvas.height); // Right bar for Y coordinates
    
    // Draw axis labels (X and Y coordinates)
    ctx.fillStyle = '#00ff00'; // Bright green for visibility
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // X-axis labels (top) - every 10 tiles for full map
    for (let tileX = 10; tileX <= MAP_CONFIG.WIDTH; tileX += 10) {
      const screenX = (tileX - 1) * MAP_CONFIG.TILE_SIZE;
      ctx.fillText(`${tileX}`, screenX, 10);
    }
    
    // Y-axis labels (right) - every 10 tiles for full map
    for (let tileY = 10; tileY <= MAP_CONFIG.HEIGHT; tileY += 10) {
      const screenY = (tileY - 1) * MAP_CONFIG.TILE_SIZE;
      ctx.fillText(`${tileY}`, canvas.width - 20, screenY);
    }
    
    // Draw flag-bearer trail (fading gold glimmer — mirrors in-game TileRenderer)
    if (flagTrail?.length) {
      const now = Date.now();
      for (const t of flagTrail) {
        const expiresAt = new Date(t.expiresAt).getTime();
        const remaining = expiresAt - now;
        if (remaining <= 0) continue; // expired — server already filters, belt and suspenders

        // Fade from 0.55 (fresh) to 0.15 (about to expire) over the 8-minute TTL
        const TTL = 8 * 60 * 1000;
        const age = Math.max(0, Math.min(1, 1 - remaining / TTL));
        const alpha = 0.55 - 0.4 * age;

        const screenX = (t.x - 1) * MAP_CONFIG.TILE_SIZE;
        const screenY = (t.y - 1) * MAP_CONFIG.TILE_SIZE;
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha.toFixed(3)})`;
        ctx.fillRect(screenX + 3, screenY + 3, MAP_CONFIG.TILE_SIZE - 6, MAP_CONFIG.TILE_SIZE - 6);
        ctx.strokeStyle = `rgba(255, 215, 0, ${(alpha + 0.15).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX + 3, screenY + 3, MAP_CONFIG.TILE_SIZE - 6, MAP_CONFIG.TILE_SIZE - 6);
      }
    }

    // Draw flag-bearer marker (gold, larger than player)
    // FID-20260906-005 R-map: guard position — a truthy marker without a
    // resolved position must never crash the whole canvas.
    if (flagMarker?.position) {
      const bx = (flagMarker.position.x - 1) * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;
      const by = (flagMarker.position.y - 1) * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;

      // Pulsing glow
      const pulse = 0.25 + 0.15 * Math.sin(Date.now() / 400);
      ctx.fillStyle = `rgba(255, 215, 0, ${pulse.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(bx, by, 18, 0, Math.PI * 2);
      ctx.fill();

      // Main marker
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(bx, by, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5c00';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flag emoji label
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(bx - 26, by - 32, 52, 16);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏴 FLAG', bx, by - 24);
    }

    // Draw player marker
    if (playerPosition) {
      const playerScreenX = (playerPosition.x - 1) * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;
      const playerScreenY = (playerPosition.y - 1) * MAP_CONFIG.TILE_SIZE + MAP_CONFIG.TILE_SIZE / 2;
      
      // Draw player marker with glow effect
      // Outer glow
      ctx.fillStyle = 'rgba(33, 150, 243, 0.3)';
      ctx.beginPath();
      ctx.arc(playerScreenX, playerScreenY, 16, 0, Math.PI * 2);
      ctx.fill();
      
      // Main circle
      ctx.fillStyle = '#2196F3';
      ctx.beginPath();
      ctx.arc(playerScreenX, playerScreenY, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // White border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Player label with background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(playerScreenX - 20, playerScreenY - 30, 40, 16);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('YOU', playerScreenX, playerScreenY - 22);
      
      // Coordinate label
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(playerScreenX - 25, playerScreenY + 12, 50, 14);
      
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`(${playerPosition.x}, ${playerPosition.y})`, playerScreenX, playerScreenY + 19);
    }
    
  }, [mapData, viewport, playerPosition, flagMarker, flagTrail, canvasSize]); // flag overlay re-renders
  
  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const parent = canvas.parentElement;
    if (!parent) return;
    
    const resize = () => {
      const newWidth = parent.clientWidth;
      const newHeight = parent.clientHeight;
      
      // Only resize if dimensions actually changed
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        setCanvasSize({ width: newWidth, height: newHeight }); // Trigger re-render
        
        console.log('[Canvas2D] Resized canvas:', { width: newWidth, height: newHeight });
      }
    };
    
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  
  // Handle clicks
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onTileClick) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    const worldX = canvasX + viewport.x;
    const worldY = canvasY + viewport.y;
    
    const tileX = Math.floor(worldX / MAP_CONFIG.TILE_SIZE);
    const tileY = Math.floor(worldY / MAP_CONFIG.TILE_SIZE);
    
    onTileClick(tileX, tileY);
  };
  
  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        cursor: 'pointer'
      }}
    />
  );
}
