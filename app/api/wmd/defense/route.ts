/**
 * @file app/api/wmd/defense/route.ts
 * @created 2025-10-22
 * @overview WMD Defense API Endpoints
 * 
 * OVERVIEW:
 * Handles defense battery deployment, repair, interception, and management.
 * 
 * Features:
 * - GET: Fetch player's defense batteries
 * - POST: Deploy, repair, or attempt interception
 * - DELETE: Dismantle batteries
 * 
 * Authentication: JWT tokens via HttpOnly cookies
 * Dependencies: defenseService.ts, apiHelpers.ts
 */

import { NextRequest, NextResponse } from 'next/server';
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
import { BATTERY_CONFIGS, type BatteryType } from '@/types/wmd';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { getDatabase } from '@/lib/mongodb';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/wmd/defense
 * Fetch player's defense batteries or specific battery details
 * 
 * Query params:
 * - batteryId: string (optional) - Get specific battery details
 */
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
    
    // Get specific battery details
    if (batteryId) {
      const db = await getDatabase();
      const battery = await db.collection('wmd_defense_batteries').findOne({ batteryId });
      
      if (!battery) {
        return NextResponse.json(
          { error: 'Battery not found' },
          { status: 404 }
        );
      }
      
      // Verify ownership
      if (battery.ownerId !== auth.playerId) {
        return NextResponse.json(
          { error: 'Unauthorized - not your battery' },
          { status: 403 }
        );
      }
      
      return NextResponse.json({
        success: true,
        battery,
      });
    }
    
    // Get all player batteries
    const batteries = await getPlayerBatteries(auth.playerId);
    
    log.info('Defense batteries retrieved', { playerId: auth.playerId, batteryCount: batteries.length });
    return NextResponse.json({
      success: true,
      batteries,
    });
  } catch (error) {
    log.error('Failed to fetch batteries', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST /api/wmd/defense
 * Deploy battery, repair, or attempt interception
 * 
 * Body:
 * - action: 'deploy' | 'repair' | 'intercept'
 * - batteryType: string (for deploy)
 * - batteryId: string (for repair)
 * - missileId: string (for intercept)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { action } = body;
    
    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }
    
    // Deploy battery
    if (action === 'deploy') {
      const { batteryType } = body as { batteryType?: string };
      const batteryTypeKey = batteryType as BatteryType | undefined;

      if (!batteryTypeKey || !(batteryTypeKey in BATTERY_CONFIGS)) {
        return NextResponse.json(
          { error: 'Missing required field: batteryType' },
          { status: 400 }
        );
      }
      
      const result = await deployBattery(
        auth.playerId,
        auth.player.username || auth.player.email || 'Unknown',
        auth.player.clanId || '',
        batteryTypeKey
      );
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }
      
      // Broadcast battery deployment (config data is authoritative; deployBattery already persisted)
      try {
        if (result.batteryId) {
          const io = getIO();
          if (io) {
            await wmdHandlers.broadcastBatteryDeployed(io, {
              playerId: auth.playerId,
              batteryId: result.batteryId,
              batteryType: batteryTypeKey,
              interceptChance: BATTERY_CONFIGS[batteryTypeKey].interceptChance,
            });
          }
        }
      } catch (broadcastError) {
        console.error('Failed to broadcast battery deployment:', broadcastError);
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
        batteryId: result.batteryId,
      });
    }
    
    // Repair battery
    if (action === 'repair') {
      const { batteryId } = body;
      
      if (!batteryId) {
        return NextResponse.json(
          { error: 'Missing required field: batteryId' },
          { status: 400 }
        );
      }
      
      const result = await repairBattery(batteryId, auth.playerId, auth.player.username || auth.player.email || 'Unknown');
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    }
    
    // Attempt interception
    if (action === 'intercept') {
      const { missileId } = body;
      
      if (!missileId) {
        return NextResponse.json(
          { error: 'Missing required field: missileId' },
          { status: 400 }
        );
      }
      
      const result = await attemptInterception(missileId, auth.playerId);
      
      return NextResponse.json({
        success: result.success,
        message: result.message,
        result: result.result,
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use "deploy", "repair", or "intercept"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in defense API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wmd/defense
 * Dismantle battery
 * 
 * Query:
 * - batteryId: string
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const batteryId = searchParams.get('batteryId');
    
    if (!batteryId) {
      return NextResponse.json(
        { error: 'Missing required query param: batteryId' },
        { status: 400 }
      );
    }
    
    const result = await dismantleBattery(batteryId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Error dismantling battery:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
