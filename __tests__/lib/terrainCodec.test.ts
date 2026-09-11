/**
 * @file __tests__/lib/terrainCodec.test.ts
 * @overview FID-20260909-026 §6 follow-up — compact terrain wire codec.
 *
 * Contract pins:
 * - Roundtrip: encode(decode(payload)) preserves the exact grid string, and
 *   decode(encode(grid)) preserves terrain at every coordinate.
 * - Coordinates are positionally derived (1-based, row-major) — (x, y) are
 *   correct without being on the wire.
 * - Dimension/length mismatch and unknown characters FAIL LOUDLY (Law 14) —
 *   the codec must never fabricate terrain or silently truncate.
 */

import { describe, it, expect } from 'vitest';
import { TerrainType, type MapTile } from '@/types';
import {
  encodeTerrainGrid,
  decodeTerrainGrid,
  COMPACT_TERRAIN_FORMAT,
} from '@/lib/terrainCodec';

function makeGrid(terrainFor: (x: number, y: number) => TerrainType, w = 3, h = 2): MapTile[][] {
  const map: MapTile[][] = [];
  for (let y = 1; y <= h; y++) {
    const row: MapTile[] = [];
    for (let x = 1; x <= w; x++) {
      row.push({ x, y, terrain: terrainFor(x, y) });
    }
    map.push(row);
  }
  return map;
}

describe('FID-026 — terrain wire codec', () => {
  it('covers every TerrainType member with a distinct character', () => {
    const all = Object.values(TerrainType);
    const chars = all.map((t) => encodeTerrainGrid([[{ x: 1, y: 1, terrain: t }]]));
    expect(new Set(chars).size).toBe(all.length); // bijection: no two terrains share a char
    expect(chars.every((c) => c.length === 1)).toBe(true);
  });

  it('roundtrips a grid losslessly (encode → decode → same terrains at same coords)', () => {
    const grid = makeGrid((x, y) =>
      (x + y) % 2 === 0 ? TerrainType.Metal : y === 1 ? TerrainType.Cave : TerrainType.AuctionHouse
    );
    const decoded = decodeTerrainGrid({ width: 3, height: 2, grid: encodeTerrainGrid(grid) });

    expect(decoded).toHaveLength(2);
    for (let y = 1; y <= 2; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(decoded[y - 1][x - 1].terrain).toBe(grid[y - 1][x - 1].terrain);
        expect(decoded[y - 1][x - 1].x).toBe(x);
        expect(decoded[y - 1][x - 1].y).toBe(y);
      }
    }
  });

  it('emits row-major 1-based ordering (decode(encode) reconstructs positionally)', () => {
    // Distinct terrain per cell → the string itself proves the ordering
    const grid: MapTile[][] = [
      [{ x: 1, y: 1, terrain: TerrainType.Metal }, { x: 2, y: 1, terrain: TerrainType.Energy }, { x: 3, y: 1, terrain: TerrainType.Cave }],
      [{ x: 1, y: 2, terrain: TerrainType.Forest }, { x: 2, y: 2, terrain: TerrainType.Factory }, { x: 3, y: 2, terrain: TerrainType.Wasteland }],
    ];
    expect(encodeTerrainGrid(grid)).toBe('MECFAW');

    const decoded = decodeTerrainGrid({ width: 3, height: 2, grid: 'MECFAW' });
    expect(decoded[0][0]).toMatchObject({ x: 1, y: 1, terrain: TerrainType.Metal });
    expect(decoded[1][2]).toMatchObject({ x: 3, y: 2, terrain: TerrainType.Wasteland });
  });

  it('rejects a length that does not match the declared dimensions (Law 14)', () => {
    expect(() => decodeTerrainGrid({ width: 3, height: 3, grid: 'MEC' })).toThrow(/length mismatch/i);
    expect(() => decodeTerrainGrid({ width: 2, height: 2, grid: 'MECFA' })).toThrow(/length mismatch/i);
  });

  it('rejects invalid dimensions', () => {
    expect(() => decodeTerrainGrid({ width: 0, height: 2, grid: '' })).toThrow(/dimensions/i);
    expect(() => decodeTerrainGrid({ width: 2.5, height: 2, grid: 'MECFA' })).toThrow(/dimensions/i);
  });

  it('fails loudly on an unknown wire character instead of fabricating terrain', () => {
    expect(() => decodeTerrainGrid({ width: 3, height: 1, grid: 'MEZ' })).toThrow(/unknown terrain wire character/i);
  });

  it('exposes the format id the page pins its acceptance check to', () => {
    expect(COMPACT_TERRAIN_FORMAT).toBe('terrain-char-v1');
  });
});
