import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  requireAuth,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  calculateUpgradeCost,
  logger,
} from '@/lib';

const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);
const getRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const POST = postRateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { type } = body;
    const username = auth.username;

    if (!username || !type) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username and type are required');
    }

    if (type !== 'strength' && type !== 'defense') {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Type must be "strength" or "defense"');
    }

    const supabase = createServiceClient();
    const { data: player } = await supabase
      .from('players')
      .select('total_strength, total_defense, resources_metal, resources_energy')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      return createErrorResponse(ErrorCode.NOT_FOUND, 'Player not found');
    }

    const currentValue = type === 'strength' ? (player.total_strength || 0) : (player.total_defense || 0);
    const cost = calculateUpgradeCost(currentValue);

    const playerMetal = player.resources_metal || 0;
    const playerEnergy = player.resources_energy || 0;

    if (playerMetal < cost.metal || playerEnergy < cost.energy) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.INSUFFICIENT_RESOURCES,
          message: 'Insufficient resources',
          details: { required: cost, available: { metal: playerMetal, energy: playerEnergy } }
        }
      }, { status: 400 });
    }

    const statUpdate = type === 'strength'
      ? { total_strength: currentValue + 1 }
      : { total_defense: currentValue + 1 };

    // Atomic resource deductions with TOCTOU protection via checked RPC
    const { data: metalOk } = await supabase
      .rpc('increment_player_resource_checked', {
        p_username: username,
        p_column: 'resources_metal',
        p_amount: -cost.metal,
      });

    if (!metalOk) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.INSUFFICIENT_RESOURCES,
          message: 'Insufficient metal',
          details: { required: cost, available: { metal: playerMetal, energy: playerEnergy } }
        }
      }, { status: 400 });
    }

    const { data: energyOk } = await supabase
      .rpc('increment_player_resource_checked', {
        p_username: username,
        p_column: 'resources_energy',
        p_amount: -cost.energy,
      });

    if (!energyOk) {
      // Rollback metal deduction
      await supabase.rpc('increment_player_resource_checked', {
        p_username: username,
        p_column: 'resources_metal',
        p_amount: cost.metal,
      });
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.INSUFFICIENT_RESOURCES,
          message: 'Insufficient energy',
          details: { required: cost, available: { metal: playerMetal, energy: playerEnergy } }
        }
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('players')
      .update(statUpdate)
      .eq('username', username);

    if (error) {
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to upgrade');
    }

    const nextCost = calculateUpgradeCost(currentValue + 1);

    return NextResponse.json({
      success: true,
      type,
      newValue: currentValue + 1,
      cost,
      nextCost,
      remainingResources: {
        metal: playerMetal - cost.metal,
        energy: playerEnergy - cost.energy
      }
    });

  } catch (error) {
    logger.error('Error upgrading unit:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});

export const GET = getRateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const username = auth.username;

    if (!username || !type) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'username and type are required');
    }

    if (type !== 'strength' && type !== 'defense') {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Type must be "strength" or "defense"');
    }

    const supabase = createServiceClient();
    const { data: player } = await supabase
      .from('players')
      .select('total_strength, total_defense, resources_metal, resources_energy')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      return createErrorResponse(ErrorCode.NOT_FOUND, 'Player not found');
    }

    const currentValue = type === 'strength' ? (player.total_strength || 0) : (player.total_defense || 0);
    const cost = calculateUpgradeCost(currentValue);

    return NextResponse.json({
      success: true,
      type,
      currentValue,
      cost,
      canAfford: (player.resources_metal || 0) >= cost.metal && (player.resources_energy || 0) >= cost.energy,
      available: { metal: player.resources_metal || 0, energy: player.resources_energy || 0 }
    });
  } catch (error) {
    logger.error('Error getting upgrade cost:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
