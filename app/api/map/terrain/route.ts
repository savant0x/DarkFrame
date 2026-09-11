/**
 * @file app/api/map/terrain/route.ts
 * @overview Returns the full 150×150 terrain grid.
 *
 * The map page previously rendered `generateMockMapData()`; this endpoint is the
 * real-data source.
 *
 * FID-20260909-026 §2: the grid is immutable after world generation, so the
 * read is cached (two-tier L1/Redis — lib/cacheService from FID-20260909-024).
 * §6 follow-up: the wire format is now ONE CHAR PER TILE via lib/terrainCodec
 * (~22 KB vs ~1.9 MB of `{x,y,terrain}` objects — the coordinates are implied
 * by grid position, so shipping them was 98% of the payload). Invalidate
 * `map:terrain` when a world reset regenerates tiles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiles } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { getCacheOrFetch } from '@/lib/cacheService';
import { MapKeys, CacheTTL } from '@/lib/cacheKeys';
import { encodeTerrainGrid, COMPACT_TERRAIN_FORMAT } from '@/lib/terrainCodec';
import { TerrainType, GAME_CONSTANTS } from '@/types';

export const dynamic = 'force-dynamic';

/** Fetch rows and encode to the compact grid string (cache holds the STRING). */
async function loadTerrainGridString(): Promise<{ width: number; height: number; grid: string }> {
  const rows = await db
    .select({ x: tiles.x, y: tiles.y, terrain: tiles.terrain })
    .from(tiles)
    .orderBy(asc(tiles.y), asc(tiles.x));

  if (rows.length !== GAME_CONSTANTS.TOTAL_TILES) {
    throw new Error(`Map is not fully generated: ${rows.length}/${GAME_CONSTANTS.TOTAL_TILES} tiles`);
  }

  // Rebuild the consumer-side grid contract, then encode row-major.
  const map: Array<Array<{ x: number; y: number; terrain: TerrainType }>> = [];
  for (const row of rows) {
    const yIndex = row.y - 1;
    if (!map[yIndex]) map[yIndex] = [];
    map[yIndex][row.x - 1] = { x: row.x, y: row.y, terrain: row.terrain as TerrainType };
  }

  return {
    width: GAME_CONSTANTS.MAP_WIDTH,
    height: GAME_CONSTANTS.MAP_HEIGHT,
    grid: encodeTerrainGrid(map),
  };
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const { width, height, grid } = await getCacheOrFetch(
      MapKeys.terrainGrid(),
      loadTerrainGridString,
      CacheTTL.MAP_TERRAIN,
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          format: COMPACT_TERRAIN_FORMAT,
          width,
          height,
          grid,
        },
      },
      {
        headers: {
          // Immutable-after-generation data: safe for shared/browser caching.
          // `no-cache` (not no-store) forces revalidation against this endpoint,
          // whose payload itself is server-cached — cheap 304s when unchanged.
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        },
      },
    );
  } catch (error) {
    // Not-fully-generated maps are an expected cold-world state, not a 500.
    const message = error instanceof Error ? error.message : 'Failed to load terrain data';
    if (message.includes('not fully generated')) {
      return NextResponse.json({ success: false, error: message }, { status: 503 });
    }
    console.error('❌ Error loading terrain:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load terrain data' },
      { status: 500 },
    );
  }
}
