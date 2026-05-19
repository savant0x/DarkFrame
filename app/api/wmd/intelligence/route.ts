import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedPlayer } from '@/lib/wmd/apiHelpers';
import {
  recruitSpy,
  trainSpy,
  startMission,
  completeMission,
  executeSabotage,
  counterIntelligenceSweep,
  getPlayerSpies,
  getPlayerMissions,
} from '@/lib/wmd/spyService';
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
  logger,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

function deriveRank(experience: number): string {
  if (experience >= 31) return 'Master';
  if (experience >= 16) return 'Operative';
  if (experience >= 6) return 'Agent';
  return 'Rookie';
}

function mapSpyRow(row: Record<string, any>): Record<string, any> {
  return {
    spyId: row.spy_id,
    codename: row.name || `Agent_${(row.spy_id || '').slice(-4)}`,
    rank: deriveRank(row.experience || 0),
    specialization: 'generalist',
    status: row.status || 'idle',
    experience: row.experience || 0,
    missionHistory: [],
  };
}

function mapMissionRow(row: Record<string, any>): Record<string, any> {
  return {
    missionId: row.mission_id,
    spyId: row.spy_id,
    missionType: row.mission_type || 'recon',
    targetId: row.target_player_id || '',
    status: row.status || 'pending',
    startedAt: row.started_at,
    completesAt: row.completed_at,
  };
}

export const GET = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('wmd-intelligence-get');
  const endTimer = log.time('intelligence-get');

  try {
    const auth = await getAuthenticatedPlayer(req);

    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'spies';

    if (type === 'spies') {
      const rawSpies = await getPlayerSpies(auth.playerId);
      const spies = (rawSpies || []).map(mapSpyRow);
      return NextResponse.json({ success: true, spies });
    }

    if (type === 'missions') {
      const rawMissions = await getPlayerMissions(auth.playerId);
      const missions = (rawMissions || []).map(mapMissionRow);
      return NextResponse.json({ success: true, missions });
    }

    return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid type. Use "spies" or "missions"');
  } catch (error) {
    // Intelligence GET error handled
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);

    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Missing required field: action');
    }

    if (action === 'recruit') {
      const { specialization } = body;

      if (!specialization) {
        return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Missing required field: specialization');
      }

      const result = await recruitSpy(
        auth.playerId,
        auth.username,
        specialization,
        auth.player.clan_id || ''
      );

      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, result.message);
      }

      try {
        if (result.spyId) {
          const supabase = createServiceClient();
          const { data: spy } = await supabase.from('wmd_spies').select('*').eq('spy_id', result.spyId).maybeSingle();
          const io = getIO();
          if (spy && io) {
            await wmdHandlers.broadcastSpyRecruited(io, {
              playerId: auth.playerId,
              spyId: result.spyId,
              spyName: spy.name || 'Spy',
              specialization,
            });
          }
        }
      } catch (broadcastError) {
        logger.error('Failed to broadcast spy recruitment:', broadcastError);
      }

      return NextResponse.json({ success: true, message: result.message, spyId: result.spyId });
    }

    if (action === 'mission') {
      const { spyId, missionType, targetId } = body;

      if (!spyId || !missionType || !targetId) {
        return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Missing required fields: spyId, missionType, targetId');
      }

      const result = await startMission(spyId, missionType, targetId);

      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, result.message);
      }

      return NextResponse.json({ success: true, message: result.message, missionId: result.missionId });
    }

    if (action === 'sabotage') {
      const { spyId, targetId, targetType } = body;

      if (!spyId || !targetId || !targetType) {
        return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Missing required fields: spyId, targetId, targetType');
      }

      const result = await executeSabotage(spyId, targetType, targetId, auth.playerId);

      return NextResponse.json({ success: result.success, message: result.message, damage: result.damage });
    }

    if (action === 'counterIntel') {
      const result = await counterIntelligenceSweep(auth.playerId, 'ALL');

      if (result.success && result.spiesDetected && result.spiesDetected.length > 0) {
        try {
          const io = getIO();
          if (io) {
            await wmdHandlers.broadcastCounterIntelDetection(io, {
              playerId: auth.playerId,
              spiesDetected: result.spiesDetected,
            });
          }
        } catch (broadcastError) {
          // Counter-intel broadcast error handled
        }
      }

      return NextResponse.json({
        success: result.success,
        message: result.message,
        threatsDetected: result.threatsDetected,
        spiesDetected: result.spiesDetected,
      });
    }

    return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid action');
  } catch (error) {
    // Intelligence API error handled
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);

    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Missing required field: action');
    }

    if (action === 'train') {
      const { spyId, skillType, trainingIntensity } = body;

      if (!spyId || !skillType) {
        return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Missing required fields: spyId, skillType');
      }

      const result = await trainSpy(spyId, skillType as 'stealth' | 'hacking' | 'sabotage' | 'intelligence', trainingIntensity || 'BASIC');

      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, result.message);
      }

      return NextResponse.json({ success: true, message: result.message, newSkillLevel: result.newSkillLevel });
    }

    if (action === 'complete') {
      const { missionId } = body;

      if (!missionId) {
        return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Missing required field: missionId');
      }

      const result = await completeMission(missionId);

      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, result.message);
      }

      return NextResponse.json({ success: true, message: result.message, intelligence: result.intelligence });
    }

    return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid action. Use "train" or "complete"');
  } catch (error) {
    // Intelligence PATCH error handled
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}
