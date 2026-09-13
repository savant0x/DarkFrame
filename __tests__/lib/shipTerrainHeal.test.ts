/**
 * FID-20260912-089 — ship-terrain heal contract tests.
 *
 * One unknown terrain value in the tiles table makes encodeTerrainGrid throw,
 * which 500s /api/map/terrain and silently swaps the real map for mock data.
 * These tests pin the two invariants that keep that from recurring:
 *   1. every TerrainType member has a wire character (codec coverage)
 *   2. the heal's classification: codec-expressible vs orphaned values
 */
import { describe, it, expect } from 'vitest';
import { encodeTerrainGrid } from '@/lib/terrainCodec';
import { TerrainType } from '@/types';
import { codecTerrainValues } from '@/lib/migrations/shipTerrainHeal';

describe('terrain codec coverage (the invariant SHIP broke)', () => {
  it('every TerrainType member encodes without throwing', () => {
    const members = Object.values(TerrainType);
    expect(members.length).toBeGreaterThanOrEqual(9);
    const map = [
      members.map((t, i) => ({ x: i + 1, y: 1, terrain: t })),
    ];
    expect(() => encodeTerrainGrid(map as never)).not.toThrow();
  });

  it('codec values list matches the full TerrainType enum', () => {
    const enumMembers = Object.values(TerrainType).sort();
    const codecList = [...codecTerrainValues()].sort();
    expect(codecList).toEqual(enumMembers);
  });
});

describe('orphaned-terrain classification (what the heal demotes)', () => {
  it('SHIP and other removed-feature values are classified unknown', () => {
    const valid = new Set(codecTerrainValues());
    expect(valid.has('SHIP')).toBe(false);
    expect(valid.has('Wasteland')).toBe(true);
    expect(valid.has('Metal')).toBe(true);
    expect(valid.has('AuctionHouse')).toBe(true);
  });

  it('demotion target is Wasteland — the map neutral fill', () => {
    // The heal writes TerrainType.Wasteland; pin it so a refactor can't
    // silently change the demotion target to something lossy.
    expect(TerrainType.Wasteland).toBe('Wasteland');
  });
});
