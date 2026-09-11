/**
 * @file app/api/map/bases/route.ts
 * @created 2026-09-10 (FID-20260910-038 D1)
 * @overview Occupied base tiles for the world map — owner, level, class.
 *
 * GET → { success, data: { bases: [{ x, y, owner, level, isBeerBase }] } }
 *
 * Public read (matches /api/map/terrain): base positions/intel are world
 * state every player can see on the map. Payload is tiny — one row per
 * occupied tile (~60 occupied tiles today) — and the response is cached 30s
 * server-side so map refreshes don't re-scan the tiles table (egress-aware
 * after FID-037: this replaces nothing heavier, it enables the map layer).
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiles, players } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { ApiResponse } from '@/types';
import { createErrorFromException, createRouteLogger, withRequestLogging, createRateLimiter, ErrorCode } from '@/lib';
import { getRateLimitConfig } from '@/lib';

export const dynamic = 'force-dynamic';

let cache: { at: number; bases: Array<{ x: number; y: number; owner: string; level: number; isBeerBase: boolean }> } | null = null;
const CACHE_MS = 30_000;

export const GET = withRequestLogging(createRateLimiter(getRateLimitConfig('mapData'))(async (_request: NextRequest) => {
  const log = createRouteLogger('map-bases');
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return NextResponse.json({ success: true, data: { bases: cache.bases } } satisfies ApiResponse<{ bases: typeof cache.bases }>);
    }

    // Occupied base tiles joined to their owner's level + Beer Base flag.
    const rows = await db
      .select({
        x: tiles.x,
        y: tiles.y,
        owner: tiles.baseOwner,
        level: players.level,
        isBeerBase: players.isSpecialBase,
      })
      .from(tiles)
      .innerJoin(players, eq(players.username, tiles.baseOwner))
      .where(and(eq(tiles.occupiedByBase, 1)))
      .limit(400);

    const bases = rows.map((r) => ({
      x: r.x,
      y: r.y,
      owner: r.owner ?? 'UNKNOWN',
      level: r.level ?? 1,
      isBeerBase: r.isBeerBase === 1,
    }));

    cache = { at: Date.now(), bases };
    return NextResponse.json({ success: true, data: { bases } } satisfies ApiResponse<{ bases: typeof bases }>);
  } catch (error) {
    log.error('Failed to load base map intel', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));
