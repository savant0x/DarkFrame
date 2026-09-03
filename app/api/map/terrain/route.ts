/**
 * @file app/api/map/terrain/route.ts
 * @overview Returns the full 150×150 terrain grid from the database.
 *
 * The map page previously rendered `generateMockMapData()`; this endpoint is the
 * real-data source. Response shape matches the page's `MapTile[][]` contract
 * (rows indexed by y-1, cells by x-1), wrapped as `{ map }`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiles } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import type { MapTile, TerrainType } from '@/types';
import { GAME_CONSTANTS } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const rows = await db
      .select({ x: tiles.x, y: tiles.y, terrain: tiles.terrain })
      .from(tiles)
      .orderBy(asc(tiles.y), asc(tiles.x));

    if (rows.length !== GAME_CONSTANTS.TOTAL_TILES) {
      return NextResponse.json(
        {
          success: false,
          error: `Map is not fully generated: ${rows.length}/${GAME_CONSTANTS.TOTAL_TILES} tiles`,
        },
        { status: 503 },
      );
    }

    const map: MapTile[][] = [];
    for (const row of rows) {
      const yIndex = row.y - 1;
      if (!map[yIndex]) map[yIndex] = [];
      map[yIndex][row.x - 1] = {
        x: row.x,
        y: row.y,
        terrain: row.terrain as TerrainType,
      };
    }

    return NextResponse.json({ success: true, data: { map } });
  } catch (error) {
    console.error('❌ Error loading terrain:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load terrain data' },
      { status: 500 },
    );
  }
}
