/**
 * FID-20260912-089 — animated fly-to camera contract tests.
 *
 * The warp must feel like one continuous move: eased (flat at both ends),
 * never zooming out, geometric scale blending (constant perceived zoom rate),
 * distance-scaled duration with hard bounds, and endpoints that match the
 * pre-clamped target exactly.
 */
import { describe, it, expect } from 'vitest';
import {
  easeInOutCubic,
  resolveFlyToTarget,
  flyToDuration,
  sampleFlyTo,
  type Camera,
  type FlyToState,
} from '@/lib/mapCamera';

const VIEW = { w: 800, h: 600 };
const FIT = 4;
const MAX = 48;
const from: Camera = { cx: 10.5, cy: 20.5, scale: 4 };

describe('easeInOutCubic', () => {
  it('hits the endpoints exactly and stays in [0, 1]', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    for (let i = 0; i <= 20; i++) {
      const v = easeInOutCubic(i / 20);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is flat at both ends (ease-in then ease-out, not linear)', () => {
    const early = easeInOutCubic(0.1);
    const late = easeInOutCubic(0.9);
    // Linear would give 0.1 / 0.9; cubic ease gives substantially less/more.
    expect(early).toBeLessThan(0.05);
    expect(late).toBeGreaterThan(0.95);
  });
});

describe('resolveFlyToTarget', () => {
  it('zooms IN to Region scale (fit×8) when starting zoomed out', () => {
    const to = resolveFlyToTarget(from, 120.5, 130.5, VIEW.w, VIEW.h, 150, FIT, MAX);
    expect(to.scale).toBeCloseTo(FIT * 8, 5);
  });

  it('never zooms OUT below the current scale (sub-Region warps snap UP to Region)', () => {
    const zoomedIn: Camera = { cx: 75, cy: 75, scale: 30 };
    const to = resolveFlyToTarget(zoomedIn, 10.5, 10.5, VIEW.w, VIEW.h, 150, FIT, MAX);
    expect(to.scale).toBeGreaterThanOrEqual(zoomedIn.scale);
    // Between Zone and Region scale, warps land exactly on Region (fit×8).
    expect(to.scale).toBe(FIT * 8);
  });

  it('preserves the current scale when already above Region', () => {
    const zoomedIn: Camera = { cx: 75, cy: 75, scale: 40 };
    const to = resolveFlyToTarget(zoomedIn, 10.5, 10.5, VIEW.w, VIEW.h, 150, FIT, MAX);
    expect(to.scale).toBe(40);
  });

  it('lands the target center and respects map bounds', () => {
    const to = resolveFlyToTarget(from, 0.5, 0.5, VIEW.w, VIEW.h, 150, FIT, MAX);
    // Corner target: clamped so the viewport stays on the map.
    expect(to.cx).toBeGreaterThanOrEqual(VIEW.w / (2 * to.scale));
    expect(to.cy).toBeGreaterThanOrEqual(VIEW.h / (2 * to.scale));
  });
});

describe('flyToDuration', () => {
  it('scales with distance and clamps to [450, 1100] ms', () => {
    const near: Camera = { cx: from.cx + 2, cy: from.cy, scale: 4 };
    const far: Camera = { cx: 140.5, cy: 140.5, scale: 32 };
    const nearMs = flyToDuration(from, near);
    const farMs = flyToDuration(from, far);
    expect(nearMs).toBe(450); // short hop → floor
    expect(farMs).toBeGreaterThan(nearMs);
    expect(farMs).toBeLessThanOrEqual(1100);
  });
});

describe('sampleFlyTo', () => {
  const to = resolveFlyToTarget(from, 120.5, 130.5, VIEW.w, VIEW.h, 150, FIT, MAX);
  const state = (elapsedMs: number): FlyToState => ({
    from,
    to,
    durationMs: flyToDuration(from, to),
    elapsedMs,
  });

  it('starts exactly at `from` and ends exactly at `to`', () => {
    const start = sampleFlyTo(state(0));
    expect(start.cx).toBeCloseTo(from.cx, 9);
    expect(start.cy).toBeCloseTo(from.cy, 9);
    expect(start.scale).toBeCloseTo(from.scale, 9);
    const end = sampleFlyTo(state(1e9));
    expect(end.cx).toBeCloseTo(to.cx, 9);
    expect(end.cy).toBeCloseTo(to.cy, 9);
    expect(end.scale).toBeCloseTo(to.scale, 9);
  });

  it('never zooms out mid-flight (scale blend is monotone non-decreasing)', () => {
    let prev = from.scale;
    for (let ms = 0; ms <= 2000; ms += 16) {
      const c = sampleFlyTo(state(ms));
      expect(c.scale).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = c.scale;
    }
  });

  it('blends scale geometrically — midpoint is the geometric mean', () => {
    // Equal scales (pure pan): midpoint scale = endpoint scale.
    const panState: FlyToState = {
      from: { cx: 10, cy: 10, scale: 16 },
      to: { cx: 80, cy: 80, scale: 16 },
      durationMs: 600,
      elapsedMs: 300,
    };
    expect(sampleFlyTo(panState).scale).toBeCloseTo(16, 6);
    // Scale change with symmetric ease: midpoint hits the geometric mean.
    const zoomState: FlyToState = {
      from: { cx: 10, cy: 10, scale: 4 },
      to: { cx: 10, cy: 10, scale: 16 },
      durationMs: 600,
      elapsedMs: 300,
    };
    expect(sampleFlyTo(zoomState).scale).toBeCloseTo(Math.sqrt(4 * 16), 6);
  });

  it('keeps position monotone toward the target (no overshoot)', () => {
    let prevDx = from.cx - to.cx;
    let prevDy = from.cy - to.cy;
    for (let ms = 0; ms <= 2000; ms += 16) {
      const c = sampleFlyTo(state(ms));
      const dx = c.cx - to.cx;
      const dy = c.cy - to.cy;
      expect(Math.abs(dx)).toBeLessThanOrEqual(Math.abs(prevDx) + 1e-9);
      expect(Math.abs(dy)).toBeLessThanOrEqual(Math.abs(prevDy) + 1e-9);
      prevDx = dx;
      prevDy = dy;
    }
  });

  it('mid-flight frames stay within map bounds for a corner warp', () => {
    const cornerTo = resolveFlyToTarget(from, 0.5, 0.5, VIEW.w, VIEW.h, 150, FIT, MAX);
    const cornerState: FlyToState = { from, to: cornerTo, durationMs: 800, elapsedMs: 0 };
    for (let ms = 0; ms <= 800; ms += 10) {
      const c = sampleFlyTo({ ...cornerState, elapsedMs: ms });
      expect(c.cx).toBeGreaterThan(0);
      expect(c.cy).toBeGreaterThan(0);
      expect(c.cx).toBeLessThan(150);
      expect(c.cy).toBeLessThan(150);
    }
  });
});
