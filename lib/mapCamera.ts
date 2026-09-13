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

// --- FID-20260912-089: animated fly-to -------------------------------------

/** A camera flight in progress: start, target, duration, elapsed. */
export interface FlyToState {
  readonly from: Camera;
  readonly to: Camera;
  /** Total flight duration in ms (>= 1). */
  readonly durationMs: number;
  /** Elapsed ms — advanced by the page's animation loop. */
  elapsedMs: number;
}

/** Smooth ease-in-out (cubic): 0 at t=0, 1 at t=1, flat at both ends. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Resolve a fly-to target into a fully-clamped destination camera.
 * Never zooms OUT below the current scale: panning across the whole map at
 * fit zoom must not be forced through a pointless dive. Zooming in is capped
 * at Region scale (fit×8) — warps reveal, they don't max out.
 */
export function resolveFlyToTarget(
  from: Camera,
  targetCx: number,
  targetCy: number,
  canvasW: number,
  canvasH: number,
  mapTiles: number,
  fit: number,
  maxScale: number
): Camera {
  const scale = Math.min(Math.max(from.scale, fit * 8), maxScale);
  return clampCameraToMap({ cx: targetCx, cy: targetCy, scale }, canvasW, canvasH, mapTiles);
}

/**
 * Flight duration: distance-scaled, clamped to [450, 1100] ms. Long warps
 * sweep, short hops snap — neither drags.
 */
export function flyToDuration(from: Camera, to: Camera): number {
  const dist = Math.hypot(to.cx - from.cx, to.cy - from.cy);
  return Math.round(Math.min(1100, Math.max(450, dist * 14)));
}

/**
 * Interpolate the camera at `state.elapsedMs`. Position eases (cubic);
 * scale blends GEOMETRICALLY so the perceived zoom rate is constant.
 * Pure: safe to call per frame from anywhere.
 *
 * No mid-flight clamping needed: `to` is pre-clamped (resolveFlyToTarget),
 * the scale blend is monotone non-decreasing (never zooms out), and both
 * endpoints fit the viewport at their own scales — so every interpolated
 * frame stays inside the map by construction.
 */
export function sampleFlyTo(state: FlyToState): Camera {
  const t = Math.min(1, Math.max(0, state.elapsedMs / state.durationMs));
  const k = easeInOutCubic(t);
  const logScale = Math.log(state.from.scale) + (Math.log(state.to.scale) - Math.log(state.from.scale)) * k;
  return {
    cx: state.from.cx + (state.to.cx - state.from.cx) * k,
    cy: state.from.cy + (state.to.cy - state.from.cy) * k,
    scale: Math.min(Math.max(Math.exp(logScale), 0.0001), 1e9),
  };
}
