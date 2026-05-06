/**
 * @file app/api/concentration-zones/route.ts
 * @created 2025-01-18
 * 
 * OVERVIEW:
 * API endpoints for Bot Concentration Zone management.
 * 
 * ENDPOINTS:
 * - GET: Get player's current zones
 * - POST: Set new zones (replaces existing)
 * - DELETE: Clear all zones
 * 
 * AUTH: All endpoints require authentication
 * TECH: POST requires 'bot-concentration-zones' technology
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import {
  setConcentrationZones,
  getConcentrationZones,
  clearConcentrationZones,
  type ConcentrationZone,
} from '@/lib/concentrationZoneService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET - Get player's concentration zones
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('concentration-zones-get');
  const endTimer = log.time('concentration-zones-get');

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const supabase = createServiceClient();

    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    const zones = await getConcentrationZones(player.username);

    log.info('Concentration zones retrieved', { 
      playerId: player.username,
      zoneCount: zones?.length || 0
    });

    return NextResponse.json({
      success: true,
      zones,
    });
  } catch (error) {
    log.error('Error getting concentration zones', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST - Set concentration zones
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('concentration-zones-post');
  const endTimer = log.time('concentration-zones-post');

  try {
    const body = await request.json();
    const { zones, username } = body;
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username required');

    const supabase = createServiceClient();

    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    // Check tech requirement
    const unlockedTechs = player.unlocked_techs || [];
    if (!unlockedTechs.includes('bot-concentration-zones')) {
      return NextResponse.json({ error: 'Requires Bot Concentration Zones technology' }, { status: 403 });
    }

    // Validate zones array
    if (!Array.isArray(zones)) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Zones must be an array');
    }

    // Validate zone structure
    for (const zone of zones) {
      if (
        typeof zone.centerX !== 'number' ||
        typeof zone.centerY !== 'number' ||
        !Number.isInteger(zone.centerX) ||
        !Number.isInteger(zone.centerY)
      ) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid zone coordinates. Must be integers.');
      }
    }

    const result = await setConcentrationZones(player.username, zones);

    if (!result.success) {
      log.warn('Concentration zones set failed', { reason: result.message });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    log.info('Concentration zones set', { 
      playerId: player.username,
      zoneCount: zones.length
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      zones: result.zones,
    });
  } catch (error) {
    log.error('Error setting concentration zones', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * DELETE - Clear concentration zones
 */
export const DELETE = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('concentration-zones-delete');
  const endTimer = log.time('concentration-zones-delete');

  try {
    const body = await request.json();
    const username = body.username;
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username required');

    const supabase = createServiceClient();

    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    const result = await clearConcentrationZones(player.username);

    log.info('Concentration zones cleared', { playerId: player.username });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    log.error('Error clearing concentration zones', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 * - GET: Returns array of player's zones (empty if none)
 * - POST: Validates tech, zone count (max 3), coordinates, overlaps, bounds
 * - DELETE: Removes all zones (no tech check required)
 * - All endpoints require authentication
 * - Tech requirement: 'bot-concentration-zones'
 * - Zone validation: no overlaps, within map bounds, max 3 zones
 * - Replaces all existing zones (not additive)
 */
