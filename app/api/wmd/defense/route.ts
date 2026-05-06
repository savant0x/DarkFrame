import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedPlayer } from '@/lib/wmd/apiHelpers';
import {
  deployBattery,
  attemptInterception,
  getPlayerBatteries,
  repairBattery,
  dismantleBattery,
} from '@/lib/wmd/defenseService';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers';
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

function mapBatteryRow(row: Record<string, any>): Record<string, any> {
  const now = new Date();
  return {
    batteryId: row.battery_id,
    ownerId: row.owner_id,
    batteryType: row.name || `Tier ${row.tier}`,
    tier: row.tier || 1,
    status: row.status || 'active',
    interceptChance: row.interception_range || 3,
    successfulIntercepts: 0,
    failedIntercepts: 0,
    totalAttempts: 0,
    health: 100,
    repairing: row.recharges_at ? new Date(row.recharges_at) > now : false,
    createdAt: row.created_at,
  };
}

export const GET = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('wmd-defense-get');
  const endTimer = log.time('defense-get');
  
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }
    
    const { searchParams } = new URL(req.url);
    const batteryId = searchParams.get('batteryId');
    
    if (batteryId) {
      const supabase = createServiceClient();
      const { data: battery } = await supabase.from('wmd_defense_batteries').select('*').eq('battery_id', batteryId).single();
      
      if (!battery) {
        return NextResponse.json({ error: 'Battery not found' }, { status: 404 });
      }
      
      if (battery.owner_id !== auth.playerId) {
        return NextResponse.json({ error: 'Unauthorized - not your battery' }, { status: 403 });
      }
      
      return NextResponse.json({ success: true, battery: mapBatteryRow(battery) });
    }
    
    const rawBatteries = await getPlayerBatteries(auth.playerId);
    const batteries = (rawBatteries || []).map(mapBatteryRow);
    
    log.info('Defense batteries retrieved', { playerId: auth.playerId, batteryCount: batteries.length });
    return NextResponse.json({ success: true, batteries });
  } catch (error) {
    log.error('Failed to fetch batteries', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { action } = body;
    
    if (!action) {
      return NextResponse.json({ error: 'Missing required field: action' }, { status: 400 });
    }
    
    if (action === 'deploy') {
      const { batteryType } = body;
      
      if (!batteryType) {
        return NextResponse.json({ error: 'Missing required field: batteryType' }, { status: 400 });
      }
      
      const result = await deployBattery(
        auth.playerId,
        auth.player.username,
        auth.player.clan_id || '',
        batteryType
      );
      
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      
      try {
        if (result.batteryId) {
          const supabase = createServiceClient();
          const { data: battery } = await supabase.from('wmd_defense_batteries').select('*').eq('battery_id', result.batteryId).single();
          const io = getIO();
          if (battery && io) {
            await wmdHandlers.broadcastBatteryDeployed(io, {
              playerId: auth.playerId,
              batteryId: result.batteryId,
              batteryType: String(battery.tier),
              interceptChance: battery.interception_range || 50,
            });
          }
        }
      } catch (broadcastError) {
        console.error('Failed to broadcast battery deployment:', broadcastError);
      }
      
      return NextResponse.json({ success: true, message: result.message, batteryId: result.batteryId });
    }
    
    if (action === 'repair') {
      const { batteryId } = body;
      
      if (!batteryId) {
        return NextResponse.json({ error: 'Missing required field: batteryId' }, { status: 400 });
      }
      
      const result = await repairBattery(batteryId, auth.playerId, auth.player.username || auth.player.email || 'Unknown');
      
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      
      return NextResponse.json({ success: true, message: result.message });
    }
    
    if (action === 'intercept') {
      const { missileId } = body;
      
      if (!missileId) {
        return NextResponse.json({ error: 'Missing required field: missileId' }, { status: 400 });
      }
      
      const result = await attemptInterception(missileId, auth.playerId);
      
      return NextResponse.json({ success: result.success, message: result.message, result: result.result });
    }
    
    return NextResponse.json({ error: 'Invalid action. Use "deploy", "repair", or "intercept"' }, { status: 400 });
  } catch (error) {
    console.error('Error in defense API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const batteryId = searchParams.get('batteryId');
    
    if (!batteryId) {
      return NextResponse.json({ error: 'Missing required query param: batteryId' }, { status: 400 });
    }
    
    const result = await dismantleBattery(batteryId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    console.error('Error dismantling battery:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
