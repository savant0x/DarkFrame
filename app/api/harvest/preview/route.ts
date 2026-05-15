/**
 * @file app/api/harvest/preview/route.ts
 * @overview Returns expected harvest amounts for the player's current tile.
 * Server-side calculation — single source of truth. Client never computes harvest.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { getPlayer } from '@/lib/playerService';
import { getTileAt } from '@/lib/movementService';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateBalanceEffects } from '@/lib/balanceService';
import { calculateTotalMultiplier } from '@/lib/multiplierService';
import { GAME_CONSTANTS, TerrainType } from '@/types';
import {
  withRequestLogging, createRouteLogger, createRateLimiter,
  ENDPOINT_RATE_LIMITS, createErrorResponse, createErrorFromException, ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('HarvestPreview');
  const endTimer = log.time('harvest-preview');

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const player = await getPlayer(username);
    if (!player) return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');

    const tile = await getTileAt(player.current_x, player.current_y);
    if (!tile) return createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Tile not found');

    const isResource = tile.terrain === 'Metal' || tile.terrain === 'Energy';
    if (!isResource) {
      return NextResponse.json({ success: true, data: null });
    }

    const { MIN_AMOUNT, MAX_AMOUNT } = GAME_CONSTANTS.HARVEST;
    const permanentBonus = tile.terrain === TerrainType.Metal
      ? (player.gathering_metal_bonus || 0)
      : (player.gathering_energy_bonus || 0);

    // Fetch shrine boosts
    const supabase = createServiceClient();
    const now = new Date().toISOString();
    const { data: shrineBoosts } = await supabase
      .from('player_shrine_boosts')
      .select('yield_bonus')
      .eq('player_username', username)
      .gt('expires_at', now);

    let shrineBonus = 0;
    if (shrineBoosts && shrineBoosts.length > 0) {
      const raw = shrineBoosts.reduce((sum: number, b: { yield_bonus: number | null }) => sum + (b.yield_bonus || 0), 0);
      let effective = 0;
      let remaining = raw * 100;
      const t1 = Math.min(remaining, 25); effective += t1; remaining -= t1;
      if (remaining > 0) { const t2 = Math.min(remaining, 20); effective += t2; remaining -= t2; }
      if (remaining > 0) { const t3 = Math.min(remaining, 15); effective += t3; remaining -= t3; }
      if (remaining > 0) { effective += Math.min(remaining, 10); }
      shrineBonus = effective;
    }

    // VIP
    const vipBonus = (player.is_vip && player.vip_expiration && new Date(player.vip_expiration) > new Date()) ? 50 : 0;

    // Flag bearer
    let flagBearerBonus = 0;
    const { data: flagDoc } = await supabase.from('flags').select('bearer_username').limit(1).maybeSingle();
    if (flagDoc && flagDoc.bearer_username === username) {
      flagBearerBonus = 50;
    }

    const totalMultiplier = calculateTotalMultiplier([
      { name: 'VIP', bonusPercent: vipBonus },
      { name: 'Flag Bearer', bonusPercent: flagBearerBonus },
      { name: 'Shrine', bonusPercent: shrineBonus },
    ]);

    // Balance multiplier
    const balanceEffects = calculateBalanceEffects(player.total_strength || 0, player.total_defense || 0);
    const balanceMultiplier = balanceEffects.gatheringMultiplier;

    // Final: base × (1 + permanent/100) × totalMultiplier × balanceMultiplier
    const permanentMultiplier = 1 + (permanentBonus / 100);
    const minExpected = Math.floor(MIN_AMOUNT * permanentMultiplier * totalMultiplier * balanceMultiplier);
    const maxExpected = Math.floor(MAX_AMOUNT * permanentMultiplier * totalMultiplier * balanceMultiplier);

    return NextResponse.json({
      success: true,
      data: {
        minExpected,
        maxExpected,
        permanentBonus,
        shrineBonus,
        vipBonus,
        flagBearerBonus,
        totalMultiplier: Math.round(totalMultiplier * 100) / 100,
        balanceMultiplier: Math.round(balanceMultiplier * 100) / 100,
      },
    });
  } catch (error) {
    log.error('Harvest preview failed', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
