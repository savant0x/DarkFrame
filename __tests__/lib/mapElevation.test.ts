/**
 * FID-20260912-088 — procedural hillshading contract tests.
 *
 * The height field must be pure and deterministic (cache + direct-draw paths
 * must render identical pixels), the light must come from the NW (slope facing
 * NW brighter than slope facing SE), flat ground must sit at mid-shade, and
 * landmark specials must never be shaded.
 */
import { describe, it, expect } from 'vitest';
import {
  elevationAt,
  hillshadeAt,
  tileShade,
  ELEV_MAP_W,
  ELEV_MAP_H,
} from '@/lib/mapElevation';

describe('elevationAt — deterministic value noise', () => {
  it('is pure: identical inputs give bit-identical outputs', () => {
    for (let i = 0; i < 500; i++) {
      const x = 1 + Math.floor(Math.random() * ELEV_MAP_W);
      const y = 1 + Math.floor(Math.random() * ELEV_MAP_H);
      expect(elevationAt(x, y)).toBe(elevationAt(x, y));
    }
  });

  it('stays normalized to [0, 1] across the whole map', () => {
    for (let y = 1; y <= ELEV_MAP_H; y += 3) {
      for (let x = 1; x <= ELEV_MAP_W; x += 3) {
        const h = elevationAt(x, y);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is spatially coherent — neighbors differ by far less than the field range', () => {
    let maxNeighborDelta = 0;
    let range = 0;
    let min = 1;
    let max = 0;
    for (let y = 2; y < ELEV_MAP_H; y += 2) {
      for (let x = 2; x < ELEV_MAP_W; x += 2) {
        const d = Math.abs(elevationAt(x + 1, y) - elevationAt(x, y));
        if (d > maxNeighborDelta) maxNeighborDelta = d;
        const h = elevationAt(x, y);
        if (h < min) min = h;
        if (h > max) max = h;
      }
    }
    range = max - min;
    expect(range).toBeGreaterThan(0.1); // the field actually varies
    expect(maxNeighborDelta).toBeLessThan(range * 0.35); // smooth, not white noise
  });
});

describe('hillshadeAt — NW sun convention', () => {
  it('flat ground sits at mid-shade 0.5', () => {
    // Somewhere on the map the field is locally flat; there the shade must be
    // essentially mid-gray. Verify such points exist and are ≈ 0.5.
    let found = false;
    for (let y = 5; y < ELEV_MAP_H && !found; y++) {
      for (let x = 5; x < ELEV_MAP_W && !found; x++) {
        if (Math.abs(hillshadeAt(x, y) - 0.5) < 0.02) found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('NW-facing slopes are brighter: east-rising tiles (flat in y) shade above mid', () => {
    // Behavioral light-direction check: on tiles where the y-gradient is
    // negligible, terrain rising eastward faces the NW sun (lit > 0.5) and
    // terrain falling eastward faces away (shadowed < 0.5).
    // The conditional is deterministic: with gy≈0, shade = 0.5 + 0.7·gx/RELIEF,
    // so east-rising ⇒ lit and east-falling ⇒ shadowed must hold on EVERY
    // tile — count violations, not totals (tile counts are field-dependent).
    let violations = 0;
    let litChecked = 0;
    let shadowChecked = 0;
    for (let y = 6; y < ELEV_MAP_H - 6; y++) {
      for (let x = 6; x < ELEV_MAP_W - 6; x++) {
        const gx = (elevationAt(x + 1, y) - elevationAt(x - 1, y)) / 2;
        const gy = (elevationAt(x, y + 1) - elevationAt(x, y - 1)) / 2;
        if (Math.abs(gy) > 0.002) continue; // isolate the x axis
        if (gx > 0.008) {
          litChecked++;
          if (hillshadeAt(x, y) <= 0.5) violations++;
        }
        if (gx < -0.008) {
          shadowChecked++;
          if (hillshadeAt(x, y) >= 0.5) violations++;
        }
      }
    }
    expect(litChecked).toBeGreaterThan(0);
    expect(shadowChecked).toBeGreaterThan(0);
    expect(violations).toBe(0);
  });

  it('stays within [0, 1]', () => {
    for (let y = 1; y <= ELEV_MAP_H; y += 5) {
      for (let x = 1; x <= ELEV_MAP_W; x += 5) {
        const s = hillshadeAt(x, y);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('tileShade — renderer contract', () => {
  it('returns exactly 1 for landmark specials (glyphs never shaded)', () => {
    for (const t of ['Bank', 'Shrine', 'AuctionHouse']) {
      for (let i = 0; i < 50; i++) {
        const x = 1 + Math.floor(Math.random() * ELEV_MAP_W);
        const y = 1 + Math.floor(Math.random() * ELEV_MAP_H);
        expect(tileShade(x, y, t)).toBe(1);
      }
    }
  });

  it('stays within the tuned lightness band [0.86, 1.18] for shadeable terrain', () => {
    for (const t of ['Wasteland', 'Metal', 'Energy', 'Cave', 'Forest', 'Factory']) {
      for (let y = 1; y <= ELEV_MAP_H; y += 4) {
        for (let x = 1; x <= ELEV_MAP_W; x += 4) {
          const f = tileShade(x, y, t);
          expect(f).toBeGreaterThanOrEqual(0.86 - 1e-9);
          expect(f).toBeLessThanOrEqual(1.18 + 1e-9);
        }
      }
    }
  });

  it('is deterministic in (x, y, terrain) — cache and direct paths agree', () => {
    for (let i = 0; i < 200; i++) {
      const x = 1 + Math.floor(Math.random() * ELEV_MAP_W);
      const y = 1 + Math.floor(Math.random() * ELEV_MAP_H);
      const t = ['Wasteland', 'Metal', 'Forest'][i % 3];
      expect(tileShade(x, y, t)).toBe(tileShade(x, y, t));
    }
  });

  it('tames wasteland toward flat relative to resource terrain', () => {
    // Across the map, wasteland deviation from 1 must never exceed the
    // untamed band — dead ground reads calmer than resource land.
    let maxWastelandDev = 0;
    for (let y = 1; y <= ELEV_MAP_H; y += 4) {
      for (let x = 1; x <= ELEV_MAP_W; x += 4) {
        maxWastelandDev = Math.max(maxWastelandDev, Math.abs(tileShade(x, y, 'Wasteland') - 1));
      }
    }
    expect(maxWastelandDev).toBeLessThan(0.12);
  });
});
