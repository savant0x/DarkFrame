// @vitest-environment node
/**
 * @file __tests__/lib/baseTier.test.ts
 * @overview FID-20260917-003 — the level→base-artwork tier formula.
 *
 * Own-base art was previously wired to `player.rank` (admin-gating column,
 * default 1) and collapsed every own base onto tier-1 art via getBaseImage's
 * first-entry fallback. These pins hold the SHARED formula that both base-art
 * branches (own = player.level, enemy = tile.baseLevel) now consume.
 */

import { describe, it, expect } from 'vitest';
import { levelToBaseTier, getBaseImage } from '@/lib/imageService';

describe('FID-20260917-003 — levelToBaseTier (10 levels per tier, clamp 1..10)', () => {
  it('maps the first tier band onto 1.jpg', () => {
    expect(levelToBaseTier(1)).toBe(1);
    expect(levelToBaseTier(10)).toBe(1);
  });

  it('maps the operator-reported level onto tier 2', () => {
    // The defect report: level 19 rendered tier-1 art.
    expect(levelToBaseTier(19)).toBe(2);
    expect(levelToBaseTier(20)).toBe(2);
  });

  it('rolls into tier 3 at level 21', () => {
    expect(levelToBaseTier(21)).toBe(3);
  });

  it('clamps the top band and beyond onto 10.jpg', () => {
    expect(levelToBaseTier(91)).toBe(10);
    expect(levelToBaseTier(95)).toBe(10);
    expect(levelToBaseTier(1000)).toBe(10);
  });

  it('clamps corrupt/out-of-range input into the asset set', () => {
    expect(levelToBaseTier(0)).toBe(1);
    expect(levelToBaseTier(-5)).toBe(1);
  });
});

describe('FID-20260917-003 — getBaseImage is level-driven', () => {
  it('returns the tier path for the given level (static, no manifest lookup)', async () => {
    await expect(getBaseImage(19)).resolves.toBe('/assets/tiles/bases/2.jpg');
    await expect(getBaseImage(1)).resolves.toBe('/assets/tiles/bases/1.jpg');
    await expect(getBaseImage(95)).resolves.toBe('/assets/tiles/bases/10.jpg');
  });
});
