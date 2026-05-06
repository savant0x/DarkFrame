import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedPlayer } from '@/lib/wmd/apiHelpers';
import {
  createMissile,
  assembleComponent,
  launchMissile,
  getPlayerMissiles,
  dismantleMissile,
} from '@/lib/wmd/missileService';
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

async function mapMissileRow(supabase: ReturnType<typeof createServiceClient>, row: Record<string, any>): Promise<Record<string, any>> {
  const { data: warhead } = await supabase
    .from('wmd_missile_warheads')
    .select('warhead_type')
    .eq('missile_id', row.id)
    .maybeSingle();

  return {
    missileId: row.missile_id,
    ownerId: row.owner_id,
    warheadType: warhead?.warhead_type || 'unknown',
    status: row.status || 'preparing',
    components: {
      warhead: false,
      propulsion: false,
      guidance: false,
      payload: false,
      stealth: false,
    },
    createdAt: row.created_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const missileId = searchParams.get('missileId');
    
    if (missileId) {
      const { data: missile } = await supabase.from('wmd_missiles').select('*').eq('missile_id', missileId).single();
      
      if (!missile) {
        return NextResponse.json({ error: 'Missile not found' }, { status: 404 });
      }
      
      if (missile.owner_id !== auth.playerId) {
        return NextResponse.json({ error: 'Unauthorized - not your missile' }, { status: 403 });
      }
      
      const mapped = await mapMissileRow(supabase, missile);
      return NextResponse.json({ success: true, missile: mapped });
    }
    
    const rows = await getPlayerMissiles(auth.playerId);
    const missiles = await Promise.all((rows || []).map(r => mapMissileRow(supabase, r)));
    
    return NextResponse.json({ success: true, missiles });
  } catch (error) {
    console.error('Error fetching missiles:', error);
    return NextResponse.json({ error: 'Failed to fetch missiles' }, { status: 500 });
  }
}

export const POST = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('WMDMissilesAPI');
  const endTimer = log.time('POST /api/wmd/missiles');
  
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      log.warn('Unauthorized WMD missile operation attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, { context: 'WMD operations require authentication' });
    }
    
    const validated = MissileOperationSchema.parse(await req.json());
    
    log.debug('WMD missile operation', {
      action: validated.action,
      playerId: auth.playerId,
      username: auth.username,
    });
    
    if (validated.action === 'create') {
      log.info('Creating missile', { warheadType: validated.warheadType, playerId: auth.playerId });
      
      const result = await createMissile(
        auth.playerId,
        auth.username,
        auth.player.clan_id || '',
        validated.warheadType as WarheadType
      );
      
      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, { context: result.message || 'Failed to create missile' });
      }
      
      log.info('Missile created successfully', { missileId: result.missileId });
      
      return NextResponse.json({ success: true, message: result.message, missileId: result.missileId });
    }
    
    if (validated.action === 'assemble') {
      log.info('Assembling missile component', { missileId: validated.missileId, component: validated.component });
      
      const result = await assembleComponent(
        validated.missileId,
        validated.component as MissileComponent,
        auth.playerId,
        auth.player.username || auth.player.email || 'Unknown'
      );
      
      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, { context: result.message || 'Failed to assemble component' });
      }
      
      log.info('Component assembled successfully', { missileId: validated.missileId, component: validated.component });
      
      return NextResponse.json({ success: true, message: result.message });
    }
    
    // Launch missile
    log.info('Launching missile', { missileId: validated.missileId, targetId: validated.targetId, launcherId: auth.playerId });
    
    const supabase = createServiceClient();
    const { data: targetPlayer } = await supabase.from('players').select('username').eq('username', validated.targetId).single();
    
    const result = await launchMissile(validated.missileId, validated.targetId, auth.username);
    
    if (!result.success) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { context: result.message || 'Failed to launch missile' });
    }
    
    // Broadcast missile launch
    try {
      const { data: missile } = await supabase.from('wmd_missiles').select('*').eq('missile_id', validated.missileId).single();
      const io = getIO();
      if (missile && io) {
        await wmdHandlers.broadcastMissileLaunch(io, {
          missileId: validated.missileId,
          launcherId: auth.playerId,
          launcherName: auth.username,
          targetId: validated.targetId,
          targetName: targetPlayer?.username || 'Unknown',
          warheadType: String(missile.status),
          impactAt: missile.launched_at as unknown as Date,
        });
      }
    } catch (broadcastError) {
      log.error('Failed to broadcast missile launch', broadcastError as Error);
    }
    
    log.info('Missile launched successfully', { missileId: validated.missileId, targetId: validated.targetId });
    
    return NextResponse.json({ success: true, message: result.message });
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

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const missileId = searchParams.get('missileId');
    
    if (!missileId) {
      return NextResponse.json({ error: 'Missing required query param: missileId' }, { status: 400 });
    }
    
    const result = await dismantleMissile(missileId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    console.error('Error dismantling missile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
