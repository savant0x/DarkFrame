/**
 * @file app/api/move/route.ts
 * @created 2025-10-16
 * @updated 2026-05-04 — Use mapCamelCase, eliminate ...player spread
 * @overview Player movement API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { movePlayer } from '@/lib/movementService';
import { createServiceClient } from '@/lib/supabase/server';
import { MovementDirection } from '@/types';
import type { Tables } from '@/types/database';
import { mapCamelCase } from '@/lib/supabase/mapCamelCase';
import { logMovement } from '@/lib/activityLogger';
import { updateSession } from '@/lib/sessionTracker';
import { detectSpeedHack } from '@/lib/antiCheatDetector';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  MoveSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode,
} from '@/lib';
import { ZodError } from 'zod';

type PlayerRow = Tables<'players'>;
type TileRow = Tables<'tiles'>;

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.movement);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('MovementAPI');
  const endTimer = log.time('playerMovement');

  try {
    const body = await request.json();
    const validated = MoveSchema.parse(body);
    const { username, direction } = validated;

    log.debug('Movement initiated', { username, direction });

    const { player, tile } = await movePlayer(username, direction as MovementDirection);

    const playerCurrentX = player.current_x;
    const playerCurrentY = player.current_y;

    log.info('Player moved', {
      username,
      to: { x: playerCurrentX, y: playerCurrentY },
      tileData: tile.terrain,
    });

    // Update flag position if player holds the flag
    try {
      const supabase = createServiceClient();
      const { data: flag } = await supabase
        .from('flags')
        .select('id, bearer_username')
        .limit(1)
        .maybeSingle();

      if (flag && flag.bearer_username === player.username) {
        await supabase
          .from('flags')
          .update({ position_x: playerCurrentX, position_y: playerCurrentY })
          .eq('id', flag.id);
      }
    } catch {
      log.error('Flag update error', new Error('Flag update failed'));
    }

    // Log movement activity and anti-cheat
    try {
      const sessionId = request.cookies.get('sessionId')?.value;
      if (sessionId) {
        const posObj = { x: playerCurrentX, y: playerCurrentY };
        await logMovement(username, sessionId, posObj, posObj);
        await updateSession(sessionId);

        const speedCheck = await detectSpeedHack(
          username,
          posObj,
          posObj,
          Date.now()
        );
        if (speedCheck.suspicious) {
          log.warn('Speed hack detected', { username, evidence: speedCheck.evidence });
        }
      }
    } catch {
      log.error('Activity logging error', new Error('Activity logging failed'));
    }

    log.info('Movement completed', {
      username,
      direction,
      position: { x: playerCurrentX, y: playerCurrentY },
    });

    // Full camelCase conversion — no ...player spread
    const mappedPlayer = mapCamelCase(player);
    const mappedTile = mapCamelCase(tile) as Record<string, unknown>;

    // Query harvest records for cooldown status on destination tile
    const tileCurrentX = player.current_x!;
    const tileCurrentY = player.current_y!;
    const currentResetPeriod = tileCurrentX >= 1 && tileCurrentX <= 75 ? 'AM' : 'PM';
    try {
      const supabaseHarvest = createServiceClient();
      const { data: harvestRecords } = await supabaseHarvest
        .from('tile_harvest_records')
        .select('player_id, harvested_at')
        .eq('tile_x', tileCurrentX)
        .eq('tile_y', tileCurrentY)
        .eq('reset_period', currentResetPeriod);

      if (harvestRecords && harvestRecords.length > 0) {
        mappedTile.lastHarvestedBy = harvestRecords.map(r => ({
          playerId: r.player_id,
          harvestedAt: r.harvested_at,
        }));
      }
    } catch {
      // Non-critical, continue without cooldown data
    }

    return NextResponse.json({
      success: true,
      data: {
        player: {
          ...mappedPlayer,
          currentPosition: { x: player.current_x || 0, y: player.current_y || 0 },
          base: { x: player.base_x || 0, y: player.base_y || 0 },
          resources: { metal: player.resources_metal || 0, energy: player.resources_energy || 0 },
          gatheringBonus: {
            metalBonus: player.gathering_metal_bonus || 0,
            energyBonus: player.gathering_energy_bonus || 0,
          },
          totalStrength: player.total_strength || 0,
          totalDefense: player.total_defense || 0,
        },
        currentTile: mappedTile,
      },
    });
  } catch (error) {
    log.error('Movement error', error instanceof Error ? error : new Error(String(error)));
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
