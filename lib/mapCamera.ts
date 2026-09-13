/**
 * @file lib/mapCamera.ts
 * @created 2026-09-12
 * @overview FID-20260912-087 — pure camera math for the map rebuild.
 *
 * The old "camera" was browser scrollbars. This module models a real one.
 *
 * Convention (single, consistent):
 *   • Continuous world space: the map spans [0, 150]×[0, 150]; tile (tx, ty)
 *     (1-based) occupies [tx−1, tx]×[ty−1, ty], so its CENTER is (tx−0.5, ty−0.5).
 *   • Camera center (cx, cy) is in continuous world units.
 *   • `scale` is screen pixels per world unit (= per tile).
 * Every function is pure and unit-testable — no canvas, no React, no DOM.
 */

export interface Camera {
  /** World center X in continuous tile units (map spans 0..150). */
  cx: number;
  /** World center Y in continuous tile units. */
  cy: number;
  /** Zoom as screen pixels per tile. */
  scale: number;
}

/** Convert continuous world coords → screen pixels. */
export function worldToScreen(cam: Camera, wx: number, wy: number, canvasW: number, canvasH: number): { x: number; y: number } {
  return {
    x: (wx - cam.cx) * cam.scale + canvasW / 2,
    y: (wy - cam.cy) * cam.scale + canvasH / 2,
  };
}

/** Convert screen pixels → continuous world coords (inverse of worldToScreen). */
export function screenToWorld(cam: Camera, sx: number, sy: number, canvasW: number, canvasH: number): { x: number; y: number } {
  return {
    x: (sx - canvasW / 2) / cam.scale + cam.cx,
    y: (sy - canvasH / 2) / cam.scale + cam.cy,
  };
}

/**
 * Zoom that keeps the world point under the cursor anchored — the standard
 * map-zoom behavior. `sx/sy` are the cursor's screen position; `factor` > 1
 * zooms in. Scale clamped to [minScale, maxScale]; camera re-clamped to map.
 */
export function zoomAtPoint(
  cam: Camera,
  sx: number,
  sy: number,
  canvasW: number,
  canvasH: number,
  factor: number,
  minScale: number,
  maxScale: number,
  mapTiles: number
): Camera {
  const before = screenToWorld(cam, sx, sy, canvasW, canvasH);
  const scale = Math.min(maxScale, Math.max(minScale, cam.scale * factor));
  const after: Camera = { ...cam, scale };
  // Re-pan so `before` stays under the cursor (if it now renders left of
  // the cursor, move the camera left — i.e. subtract the screen delta):
  const s = worldToScreen(after, before.x, before.y, canvasW, canvasH);
  const dx = (sx - s.x) / scale;
  const dy = (sy - s.y) / scale;
  return clampCameraToMap({ ...after, cx: after.cx - dx, cy: after.cy - dy }, canvasW, canvasH, mapTiles);
}

/**
 * Clamp the camera so the viewport never shows space beyond the map. When
 * zoomed out past fit, the map centers (no panning slack).
 */
export function clampCameraToMap(cam: Camera, canvasW: number, canvasH: number, mapTiles: number): Camera {
  const halfW = canvasW / (2 * cam.scale);
  const halfH = canvasH / (2 * cam.scale);
  const MAP_MAX = mapTiles; // world spans [0, mapTiles]

  const cx = halfW * 2 >= mapTiles
    ? MAP_MAX / 2
    : Math.min(MAP_MAX - halfW, Math.max(halfW, cam.cx));
  const cy = halfH * 2 >= mapTiles
    ? MAP_MAX / 2
    : Math.min(MAP_MAX - halfH, Math.max(halfH, cam.cy));

  return { ...cam, cx, cy };
}

/** Scale that fits the whole map in the canvas. */
export function fitScale(canvasW: number, canvasH: number, mapTiles: number): number {
  return Math.min(canvasW, canvasH) / mapTiles;
}

/** Pan by screen pixels (drag), converted to world units at current scale. */
export function panByPixels(cam: Camera, dxPx: number, dyPx: number): Camera {
  return { ...cam, cx: cam.cx + dxPx / cam.scale, cy: cam.cy + dyPx / cam.scale };
}
