/**
 * @file app/api/wmd/missiles/route.ts
 * @created 2025-10-22
 * @overview WMD Missile API Endpoints
 * 
 * OVERVIEW:
 * Handles missile creation, assembly, launch, and management operations.
 * 
 * Features:
 * - GET: Fetch player's missiles
 * - POST: Create, assemble, or launch missiles
 * - DELETE: Dismantle missiles
 * 
 * Authentication: JWT tokens via HttpOnly cookies
 * Dependencies: missileService.ts, apiHelpers.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/wmd/apiHelpers';
import {
  createMissile,
  assembleComponent,
  launchMissile,
  getPlayerMissiles,
  dismantleMissile,
} from '@/lib/wmd/missileService';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { missiles } from '@/lib/db/schema/wmd';
import { eq } from 'drizzle-orm';
import { ensureWmdJobsTicked } from '@/lib/wmd/jobs/missileTracker';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createValidationErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { MissileOperationSchema } from '@/lib/validation/schemas';
import { WarheadType, MissileComponent } from '@/types/wmd/missile.types';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/wmd/missiles
 * Fetch player's missiles or specific missile details
 * 
 * Query params:
 * - missileId: string (optional) - Get specific missile details
 */
export async function GET(req: NextRequest) {
  try {
    // G6: lazy self-tick so missile impacts fire even without the server.ts scheduler.
    void ensureWmdJobsTicked();

    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const missileId = searchParams.get('missileId');
    
    // Get specific missile details
    if (missileId) {
      // FID-20260906-002 G3: drizzle seam replaces the Mongo-shim read.
      const missileRows = await db
        .select()
        .from(missiles)
        .where(eq(missiles.missileId, missileId))
        .limit(1);
      const missileDetail = missileRows[0];
      
      if (!missileDetail) {
        return NextResponse.json(
          { error: 'Missile not found' },
          { status: 404 }
        );
      }
      
      // Verify ownership
      if (missileDetail.ownerId !== auth.playerId) {
        return NextResponse.json(
          { error: 'Unauthorized - not your missile' },
          { status: 403 }
        );
      }
      
      return NextResponse.json({
        success: true,
        missile: missileDetail,
      });
    }
    
    // Get all player missiles (renamed to avoid shadowing the drizzle `missiles` table)
    const playerMissiles = await getPlayerMissiles(auth.playerId);
    
    return NextResponse.json({
      success: true,
      missiles: playerMissiles,
    });
  } catch (error) {
    console.error('Error fetching missiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missiles' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wmd/missiles
 * Create, assemble, or launch missile
 * 
 * Body:
 * - action: 'create' | 'assemble' | 'launch'
 * - warheadType: string (for create)
 * - missileId: string (for assemble/launch)
 * - component: string (for assemble)
 * - targetId: string (for launch)
 */
export const POST = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('WMDMissilesAPI');
  const endTimer = log.time('POST /api/wmd/missiles');
  
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      log.warn('Unauthorized WMD missile operation attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        context: 'WMD operations require authentication'
      });
    }
    
    // Validate request body with discriminated union schema
    const validated = MissileOperationSchema.parse(await req.json());
    
    log.debug('WMD missile operation', {
      action: validated.action,
      playerId: auth.playerId,
      username: auth.username,
    });
    
    // Create new missile
    if (validated.action === 'create') {
      log.info('Creating missile', {
        warheadType: validated.warheadType,
        playerId: auth.playerId,
        username: auth.username,
      });
      
      const result = await createMissile(
        auth.playerId,
        auth.username,
        auth.player.clanId || '',
        validated.warheadType as WarheadType
      );
      
      if (!result.success) {
        log.warn('Failed to create missile', {
          details: { message: result.message, playerId: auth.playerId }
        });
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          context: result.message || 'Failed to create missile'
        });
      }
      
      log.info('Missile created successfully', { missileId: result.missileId });
      
      return NextResponse.json({
        success: true,
        message: result.message,
        missileId: result.missileId,
      });
    }
    
    // Assemble component
    if (validated.action === 'assemble') {
      log.info('Assembling missile component', {
        missileId: validated.missileId,
        component: validated.component,
        playerId: auth.playerId,
      });
      
      const result = await assembleComponent(
        validated.missileId, 
        validated.component as MissileComponent, 
        auth.playerId, 
        auth.player.username || auth.player.email || 'Unknown'
      );
      
      if (!result.success) {
        log.warn('Failed to assemble component', {
          details: {
            message: result.message,
            missileId: validated.missileId,
            component: validated.component,
          }
        });
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          context: result.message || 'Failed to assemble component'
        });
      }
      
      log.info('Component assembled successfully', {
        missileId: validated.missileId,
        component: validated.component,
      });
      
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    }
    
    // Launch missile (validated.action === 'launch')
    log.info('Launching missile', {
      missileId: validated.missileId,
      targetId: validated.targetId,
      launcherId: auth.playerId,
    });
    
    // Get target player name for broadcast
    // FID-20260906-002 G3: drizzle seam; players are username-keyed, so the
    // targetId is matched against players.username (the old shim lookup by a
    // `playerId` field never matched and silently degraded the broadcast).
    const targetRows = await db
      .select({ username: players.username, clanId: players.clanId })
      .from(players)
      .where(eq(players.username, validated.targetId))
      .limit(1);
    const targetPlayer = targetRows[0] ?? null;
    
    const result = await launchMissile(validated.missileId, validated.targetId, auth.username);
    
    if (!result.success) {
      log.warn('Failed to launch missile', {
        details: {
          message: result.message,
          missileId: validated.missileId,
          targetId: validated.targetId,
        }
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        context: result.message || 'Failed to launch missile'
      });
    }
    
    // Broadcast missile launch to launcher and target
    try {
      // FID-20260906-002 G3: drizzle seam replaces the Mongo-shim read.
      const launchedRows = await db
        .select({ warheadType: missiles.warheadType, impactAt: missiles.impactAt })
        .from(missiles)
        .where(eq(missiles.missileId, validated.missileId))
        .limit(1);
      const launched = launchedRows[0];
      const io = getIO();
      if (launched && io) {
        await wmdHandlers.broadcastMissileLaunch(io, {
          missileId: validated.missileId,
          launcherId: auth.playerId,
          launcherName: auth.username,
          targetId: validated.targetId,
          targetName: targetPlayer?.username || 'Unknown',
          warheadType: launched.warheadType ?? WarheadType.TACTICAL,
          impactAt: launched.impactAt ?? new Date(),
        });
        
        log.info('Missile launch broadcasted', {
          missileId: validated.missileId,
          targetName: targetPlayer?.username || 'Unknown',
        });
      }
    } catch (broadcastError) {
      log.error('Failed to broadcast missile launch', broadcastError as Error);
      // Continue execution - broadcast failure shouldn't fail the API
    }
    
    log.info('Missile launched successfully', {
      missileId: validated.missileId,
      targetId: validated.targetId,
    });
    
    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Validation error in WMD missile operation');
      return createValidationErrorResponse(error);
    }
    
    log.error('Unexpected error in WMD missile operation', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * DELETE /api/wmd/missiles
 * Dismantle missile
 * 
 * Query:
 * - missileId: string
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const missileId = searchParams.get('missileId');
    
    if (!missileId) {
      return NextResponse.json(
        { error: 'Missing required query param: missileId' },
        { status: 400 }
      );
    }
    
    const result = await dismantleMissile(missileId);
    
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
    console.error('Error dismantling missile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
