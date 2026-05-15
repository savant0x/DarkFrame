/**
 * @file app/api/tile/route.ts
 * @created 2025-10-16
 * @updated 2026-05-04 — Use mapCamelCase, eliminate ...tile spread, add harvest cooldown
 * @overview Tile data retrieval API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTileAt } from '@/lib/movementService';
import { createServiceClient } from '@/lib/supabase/server';
import { mapCamelCase } from '@/lib/supabase/mapCamelCase';
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

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('tile-get');
  const endTimer = log.time('tile-get');
  try {
    const { searchParams } = request.nextUrl;
    const xParam = searchParams.get('x');
    const yParam = searchParams.get('y');
    
    if (!xParam || !yParam) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Coordinates (x, y) are required');
    }
    
    const x = parseInt(xParam, 10);
    const y = parseInt(yParam, 10);
    
    if (isNaN(x) || isNaN(y) || x < 1 || x > 150 || y < 1 || y > 150) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Coordinates must be numbers between 1 and 150');
    }
    
    const tile = await getTileAt(x, y);
    
    if (!tile) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Tile not found');
    }

    // Full camelCase conversion — no ...tile spread
    const tileData = mapCamelCase(tile) as Record<string, unknown>;

    // Determine current reset period: tiles 1-75 reset at AM, 76-150 at PM
    const currentResetPeriod = x >= 1 && x <= 75 ? 'AM' : 'PM';

    // Query harvest records for cooldown status
    try {
      const supabase = createServiceClient();
      const { data: harvestRecords } = await supabase
        .from('tile_harvest_records')
        .select('player_id, harvested_at')
        .eq('tile_x', x)
        .eq('tile_y', y)
        .eq('reset_period', currentResetPeriod);

      if (harvestRecords && harvestRecords.length > 0) {
        tileData.lastHarvestedBy = harvestRecords.map(r => ({
          playerId: r.player_id,
          harvestedAt: r.harvested_at,
        }));
      }
    } catch (error) {
      log.error('Error fetching harvest records', error instanceof Error ? error : new Error(String(error)));
    }

    // Check if any player has their base at this tile — dynamic lookup ensures
    // bases render correctly even after a map reset where occupied_by_base may not be set
    try {
      const supabase = createServiceClient();
      const { data: baseOwner } = await supabase
        .from('players')
        .select('username, base_greeting')
        .eq('base_x', x)
        .eq('base_y', y)
        .maybeSingle();

      if (baseOwner) {
        tileData.occupiedByBase = true;
        tileData.baseOwner = baseOwner.username;
        tileData.baseGreeting = (baseOwner as Record<string, unknown>).base_greeting || '';
      }
    } catch (error) {
      log.error('Error fetching base owner', error instanceof Error ? error : new Error(String(error)));
    }

    try {
      const supabase = createServiceClient();
      const { data: flag } = await supabase
        .from('flags')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (flag && flag.bearer_id) {
        if (flag.position_x === x && flag.position_y === y) {
          tileData.hasFlagBearer = true;
        }
      }
    } catch (error) {
      log.error('Error checking flag bearer', error instanceof Error ? error : new Error(String(error)));
    }

    // Check for bots (including beer bases) at this tile — they use current_x/current_y
    try {
      const supabase = createServiceClient();
      const { data: botAtTile } = await supabase
        .from('players')
        .select('username, is_special_base, total_strength, total_defense, resources_metal, resources_energy, spec_doctrine')
        .eq('is_bot', true)
        .eq('current_x', x)
        .eq('current_y', y)
        .maybeSingle();

      if (botAtTile) {
        const tierMatch = botAtTile.username?.match(/-(WEAK|MID|STRONG|ELITE|ULTRA|LEGENDARY)-/);
        tileData.botAtLocation = {
          username: botAtTile.username,
          isBeerBase: botAtTile.is_special_base || false,
          tier: tierMatch ? tierMatch[1] : 'WEAK',
          specialization: botAtTile.spec_doctrine || 'balanced',
          strength: botAtTile.total_strength || 0,
          defense: botAtTile.total_defense || 0,
          resources: { metal: botAtTile.resources_metal || 0, energy: botAtTile.resources_energy || 0 },
        };
      }
    } catch (error) {
      log.error('Error checking bot at tile', error instanceof Error ? error : new Error(String(error)));
    }
    
    log.debug('Tile data retrieved', { x, y, terrain: tile.terrain, occupied_by_base: tile.occupied_by_base });
    return NextResponse.json({ success: true as const, data: tileData });
    
  } catch (error) {
    log.error('Failed to fetch tile', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
