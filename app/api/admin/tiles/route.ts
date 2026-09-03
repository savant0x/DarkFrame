/**
 * 📅 Created: 2025-01-18
 * 🎯 OVERVIEW:
 * Admin Tiles Endpoint
 * 
 * Returns all map tiles for admin inspection.
 * Includes tile type, owner, structures, and resources.
 * 
 * GET /api/admin/tiles
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { db } from '@/lib/db';
import { tiles } from '@/lib/db/schema';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/tiles');
  const endTimer = log.time('get-tiles');

  try {
    const user = await getAuthenticatedUser();
    if (!user || !user.rank || user.rank < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, 'Admin access required (rank 5+)');
    }

    const allTiles = await db.select().from(tiles).limit(10000);

    const transformedTiles = allTiles.map((tile: any) => ({
      x: tile.x,
      y: tile.y,
      type: tile.type || 'Wasteland',
      ownedBy: tile.ownedBy || null,
      structure: tile.structure || null,
      resources: tile.resources || {},
      isPlayerBase: tile.isPlayerBase || false,
      isFactory: tile.isFactory || false,
      isCave: tile.type === 'Cave',
      discoveredBy: tile.discoveredBy || []
    }));

    log.info('Tiles retrieved', { totalTiles: transformedTiles.length });

    return NextResponse.json({
      success: true,
      tiles: transformedTiles,
      total: transformedTiles.length
    });

  } catch (error) {
    log.error('Failed to fetch tiles', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Admin-only access (rank >= 5)
 * - Returns all tiles with limit of 10,000
 * - Transforms data for admin view
 * - Includes special properties (bases, factories)
 * 
 * 🔐 SECURITY:
 * - Admin authentication required
 * - Result limit to prevent DoS
 * - No sensitive data exposure
 * 
 * 📊 RESPONSE STRUCTURE:
 * {
 *   success: true,
 *   tiles: [{ x, y, type, ownedBy, structure, resources, flags }],
 *   total: number
 * }
 */
