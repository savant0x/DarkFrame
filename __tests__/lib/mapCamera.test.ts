/**
 * FID-20260912-087 — map camera math tests.
 *
 * The camera is the foundation of the map rebuild; these pin the invariants:
 * round-trips, cursor-anchored zoom, bounds clamping, fit scale, drag pan.
 * Convention: world spans [0,150]²; tile (tx,ty) center = (tx−0.5, ty−0.5).
 */
import { describe, it, expect } from 'vitest';
import {
  worldToScreen,
  screenToWorld,
  zoomAtPoint,
  clampCameraToMap,
  fitScale,
  panByPixels,
  type Camera,
} from '@/lib/mapCamera';

const W = 800;
const H = 600;
const MAP = 150;

/** Camera centered on tile (75,75)'s center. */
const cam: Camera = { cx: 74.5, cy: 74.5, scale: 4 };

describe('worldToScreen / screenToWorld round-trip', () => {
  it('the world point at the camera center lands at canvas center', () => {
    const s = worldToScreen(cam, cam.cx, cam.cy, W, H);
    expect(s.x).toBeCloseTo(W / 2, 6);
    expect(s.y).toBeCloseTo(H / 2, 6);
  });

  it('tile (75,75) center sits at canvas center for a centered camera', () => {
    const s = worldToScreen(cam, 74.5, 74.5, W, H);
    expect(s.x).toBeCloseTo(400, 6);
    expect(s.y).toBeCloseTo(300, 6);
  });

  it('screenToWorld inverts worldToScreen', () => {
    for (const [wx, wy] of [[0, 0], [150, 150], [41.5, 98.5], [74.5, 19.25]]) {
      const s = worldToScreen(cam, wx, wy, W, H);
      const w = screenToWorld(cam, s.x, s.y, W, H);
      expect(w.x).toBeCloseTo(wx, 6);
      expect(w.y).toBeCloseTo(wy, 6);
    }
  });
});

describe('zoomAtPoint (cursor-anchored)', () => {
  it('the world point under the cursor stays under the cursor', () => {
    const cursor = { x: 300, y: 250 };
    const before = screenToWorld(cam, cursor.x, cursor.y, W, H);
    const zoomed = zoomAtPoint(cam, cursor.x, cursor.y, W, H, 2, fitScale(W, H, MAP), 48, MAP);
    const after = screenToWorld(zoomed, cursor.x, cursor.y, W, H);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(zoomed.scale).toBeCloseTo(cam.scale * 2, 6);
  });

  it('clamps scale to min/max', () => {
    const min = fitScale(W, H, MAP);
    const out = zoomAtPoint(cam, 0, 0, W, H, 0.0001, min, 48, MAP);
    expect(out.scale).toBe(min);
    const inn = zoomAtPoint(cam, 0, 0, W, H, 1e6, min, 48, MAP);
    expect(inn.scale).toBe(48);
  });

  it('keeps the camera inside map bounds after zooming at a corner', () => {
    const cornerCam: Camera = { cx: 2, cy: 2, scale: 32 };
    const zoomed = zoomAtPoint(cornerCam, 10, 10, W, H, 2, 1, 48, MAP);
    expect(zoomed.cx).toBeGreaterThanOrEqual(0);
    expect(zoomed.cx).toBeLessThanOrEqual(MAP);
    expect(zoomed.cy).toBeGreaterThanOrEqual(0);
    expect(zoomed.cy).toBeLessThanOrEqual(MAP);
  });
});

describe('clampCameraToMap', () => {
  it('prevents showing space beyond the right/bottom edge', () => {
    const c = clampCameraToMap({ cx: 149.9, cy: 74.5, scale: 8 }, W, H, MAP);
    // half width in tiles = 800/(2*8) = 50 → max cx = 150 − 50 = 100
    expect(c.cx).toBeCloseTo(100, 6);
  });

  it('centers the map when zoomed out past fit', () => {
    const c = clampCameraToMap({ cx: 10, cy: 10, scale: 1 }, W, H, MAP);
    expect(c.cx).toBeCloseTo(75, 6);
    expect(c.cy).toBeCloseTo(75, 6);
  });
});

describe('fitScale + panByPixels', () => {
  it('fit scale puts the whole map on the smaller axis', () => {
    expect(fitScale(W, H, MAP)).toBeCloseTo(H / MAP, 6);
  });

  it('drag converts pixels to tiles at current scale', () => {
    const panned = panByPixels(cam, -32, 16); // scale 4 → 8 tiles left, 4 down
    expect(panned.cx).toBeCloseTo(cam.cx - 8, 6);
    expect(panned.cy).toBeCloseTo(cam.cy + 4, 6);
  });
});
