/**
 * @file app/api/player/route.ts
 * @created 2025-10-16
 * @updated 2026-05-04 — Use mapCamelCase, eliminate ...player spread
 * @overview Player data retrieval API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { getPlayer } from '@/lib/playerService';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateBalanceEffects } from '@/lib/balanceService';
import { getXPProgress } from '@/lib/xpService';
import { mapCamelCase } from '@/lib/supabase/mapCamelCase';
import { normalizeItemRow } from '@/lib/itemUtils';
import { logger } from '@/lib/logger';
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
  const log = createRouteLogger('player-get');
  const endTimer = log.time('player-get');
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;
    
    const player = await getPlayer(username);
    
    if (!player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }
    
    // Full snake_case → camelCase conversion — no ...player spread leakage
    const mapped = mapCamelCase(player);
    
    const balanceEffects = calculateBalanceEffects(
      player.total_strength || 0,
      player.total_defense || 0
    );
    
    const xpProgress = getXPProgress(player.xp || 0);
    
    // Fetch real inventory items
    const supabase = createServiceClient();
    const { data: inventoryItems } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('player_username', username);

    const result = {
      ...mapped,
      currentPosition: { x: player.current_x || 0, y: player.current_y || 0 },
      base: { x: player.base_x || 0, y: player.base_y || 0 },
      totalStrength: player.total_strength || 0,
      totalDefense: player.total_defense || 0,
      resources: { metal: player.resources_metal || 0, energy: player.resources_energy || 0 },
      gatheringBonus: {
        metalBonus: player.gathering_metal_bonus || 0,
        energyBonus: player.gathering_energy_bonus || 0,
      },
      balanceEffects,
      xpProgress,
      inventory: {
        items: (inventoryItems || []).map(item => {
          const normalized = normalizeItemRow(item);
          return {
            ...mapCamelCase(item),
            name: normalized.name,
            type: item.item_type,
            description: normalized.description,
          };
        }),
        capacity: player.inventory_capacity || 50,
        metalDiggerCount: player.inventory_metal_digger_count || 0,
        energyDiggerCount: player.inventory_energy_digger_count || 0,
      },
      bank: { metal: player.bank_metal || 0, energy: player.bank_energy || 0 },
      factoryCount: player.factory_count || 0,
    };
    
    log.debug('Player data retrieved', { username, level: player.level, effectivePower: balanceEffects.effectivePower });
    return NextResponse.json({ success: true as const, data: result });
    
  } catch (error) {
    log.error('Failed to fetch player', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
