/**
 * @file lib/terrainCodec.ts
 * @overview Compact wire codec for the 150×150 terrain grid (FID-20260909-026
 *   §6 follow-up: terrain payload reduction).
 *
 * OVERVIEW:
 * The legacy /api/map/terrain payload shipped one JSON object per tile
 * (`{x, y, terrain}` × 22,500 ≈ 1.5–2 MB). Since a tile's (x, y) are fully
 * implied by its grid position (row-major, 1-based), the honest wire format is
 * ONE CHARACTER PER TILE:
 *
 *   "MMWWE..." — width × height characters, row-major from (1,1), rows
 *   separated by nothing; width/height ride the envelope.
 *
 * The encoder/decoder live HERE — one symbol home — so the route and the map
 * page share a single typed contract. Character map covers every TerrainType
 * member; decoders must fail loudly on unknown characters (Law 14) rather
 * than fabricate terrain.
 *
 * PAYLOAD MATH: 22,500 chars ≈ 22 KB raw (vs ~1.9 MB of JSON objects) —
 * ~98% smaller; well under any gzip threshold regardless.
 */

import { TerrainType } from '@/types';
import type { MapTile } from '@/types';

/** Wire-format identifier carried in the route envelope (front-compat). */
export const COMPACT_TERRAIN_FORMAT = 'terrain-char-v1' as const;

/** Terrain value → single wire character (stable contract — never remap). */
const TERRAIN_TO_CHAR: Record<TerrainType, string> = {
  [TerrainType.Metal]: 'M',
  [TerrainType.Energy]: 'E',
  [TerrainType.Cave]: 'C',
  [TerrainType.Forest]: 'F',
  [TerrainType.Factory]: 'A',
  [TerrainType.Wasteland]: 'W',
  [TerrainType.Bank]: 'B',
  [TerrainType.Shrine]: 'S',
  [TerrainType.AuctionHouse]: 'H',
};

const CHAR_TO_TERRAIN: Record<string, TerrainType> = Object.fromEntries(
  Object.entries(TERRAIN_TO_CHAR).map(([terrain, char]) => [char, terrain as TerrainType])
) as Record<string, TerrainType>;

/**
 * Encode a MapTile[][] grid (row-major, 1-based coords) into a compact
 * one-char-per-tile string. Rows are concatenated top-to-bottom
 * (y = 1..height); within a row, x = 1..width.
 */
export function encodeTerrainGrid(map: MapTile[][]): string {
  let out = '';
  for (const row of map) {
    for (const tile of row) {
      const char = TERRAIN_TO_CHAR[tile.terrain];
      if (!char) {
        throw new Error(`Terrain "${String(tile.terrain)}" has no wire character`);
      }
      out += char;
    }
  }
  return out;
}

/** Envelope for decodeTerrainGrid — the /api/map/terrain response contract. */
export interface CompactTerrainPayload {
  width: number;
  height: number;
  grid: string;
}

/**
 * Decode a compact terrain string back into the consumer-side MapTile[][]
 * grid. Coordinates are recomputed from position (1-based). Throws on length
 * mismatch or an unknown character — never fabricates terrain (Law 14).
 */
export function decodeTerrainGrid(payload: CompactTerrainPayload): MapTile[][] {
  const { width, height, grid } = payload;

  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error(`Invalid terrain grid dimensions: ${width}×${height}`);
  }
  if (grid.length !== width * height) {
    throw new Error(
      `Terrain grid length mismatch: expected ${width * height} chars for ${width}×${height}, got ${grid.length}`
    );
  }

  const map: MapTile[][] = [];
  let index = 0;
  for (let y = 1; y <= height; y++) {
    const row: MapTile[] = [];
    for (let x = 1; x <= width; x++) {
      const char = grid[index++];
      const terrain = CHAR_TO_TERRAIN[char];
      if (!terrain) {
        throw new Error(`Unknown terrain wire character at grid index ${index - 1}: "${char}"`);
      }
      row.push({ x, y, terrain });
    }
    map.push(row);
  }
  return map;
}
