/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2026-09-05 (FID-20260905-001 B2: real schema mapping + admin terrain upsert)
 * 🎯 OVERVIEW:
 * Admin Tiles Endpoint
 *
 * GET /api/admin/tiles — all map tiles for admin inspection (limit 10,000).
 * POST /api/admin/tiles — admin terrain edit (upsert) for the Tile Inspector's Edit action.
 *
 * Both admin-only via requireAdmin (JWT isAdmin flag).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { tiles, modLog } from '@/lib/db/schema';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createValidationErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { TerrainType } from '@/types';
import { z } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

// Map view bounds (mapService const) — bounds-checked so a bad coord can't widen the table.
const MAP_MIN = 1;
const MAP_MAX = 150;

const UpsertTileSchema = z.object({
  x: z.number().int().min(MAP_MIN).max(MAP_MAX),
  y: z.number().int().min(MAP_MIN).max(MAP_MAX),
  terrain: z.enum(
    Object.values(TerrainType) as [TerrainType, ...TerrainType[]]
  ),
});

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/tiles');
  const endTimer = log.time('get-tiles');

  try {
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }

    const allTiles = await db.select().from(tiles).limit(10000);

    // FID-20260905-001 B2: map the REAL columns (the previous transform referenced
    // Mongo-era fields that don't exist on the tiles table — type/ownedBy/structure/
    // resources all rendered as their fallback constants for every row).
    const transformedTiles = allTiles.map((tile) => ({
      x: tile.x,
      y: tile.y,
      type: tile.terrain,
      ownedBy: tile.baseOwner || null,
      structure: tile.bankType || null,
      resources: {},
      isPlayerBase: tile.occupiedByBase !== null,
      isFactory: tile.terrain === TerrainType.Factory,
      isCave: tile.terrain === TerrainType.Cave,
      discoveredBy: [],
    }));

    log.info('Tiles retrieved', { totalTiles: transformedTiles.length });

    return NextResponse.json({
      success: true,
      tiles: transformedTiles,
      total: transformedTiles.length,
    });

  } catch (error) {
    log.error('Failed to fetch tiles', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

const upsertRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const POST = withRequestLogging(upsertRateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/tiles');
  const endTimer = log.time('upsert-tile');

  try {
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }

    const body = await request.json();
    const validated = UpsertTileSchema.parse(body);

    const result = await db
      .insert(tiles)
      .values({ x: validated.x, y: validated.y, terrain: validated.terrain })
      .onConflictDoUpdate({
        target: [tiles.x, tiles.y],
        set: { terrain: validated.terrain },
      })
      .returning({ x: tiles.x, y: tiles.y, terrain: tiles.terrain });

    const row = result[0];
    if (!row) {
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Tile upsert returned no row',
      });
    }

    // FID-20260905-001 B3-class audit: admin terrain edits leave a mod_log trail.
    await db.insert(modLog).values({
      moderatorId: adminAuth.username.slice(0, 20),
      action: 'TILE_EDIT',
      targetId: `(${row.x},${row.y})`.slice(0, 24),
      reason: `Terrain set to ${row.terrain}`,
      createdAt: new Date(),
    });

    log.info('Tile upserted', { x: row.x, y: row.y, terrain: row.terrain });

    return NextResponse.json({
      success: true,
      tile: { x: row.x, y: row.y, type: row.terrain },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Failed to upsert tile', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
