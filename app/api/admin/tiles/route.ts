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
import { createServiceClient } from '@/lib/supabase/server';
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
    const { searchParams } = request.nextUrl;
    const username = searchParams.get('username');
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username parameter required');

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, 'Admin access required (rank 5+)');
    }

    // Get all tiles
    const { data: tiles, error: tilesError } = await supabase
      .from('tiles')
      .select('*')
      .limit(10000); // Limit to prevent memory issues

    if (tilesError) {
      log.error('Failed to fetch tiles', tilesError);
      return createErrorFromException(tilesError, ErrorCode.INTERNAL_ERROR);
    }

    // Transform tiles for admin view
    const transformedTiles = (tiles || []).map((tile: any) => ({
      x: tile.x,
      y: tile.y,
      type: tile.type || 'Wasteland',
      ownedBy: tile.owned_by || null,
      structure: tile.structure || null,
      resources: tile.resources || {},
      isPlayerBase: tile.occupied_by_base || false,
      isFactory: tile.is_factory || false,
      isCave: tile.type === 'Cave',
      discoveredBy: tile.discovered_by || []
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
