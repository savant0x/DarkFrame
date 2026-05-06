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
    
    return NextResponse.json({ error: 'Invalid type. Use "spies" or "missions"' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching intelligence data:', error);
    return NextResponse.json({ error: 'Failed to fetch intelligence data' }, { status: 500 });
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
    
    if (action === 'recruit') {
      const { specialization } = body;
      
      if (!specialization) {
        return NextResponse.json({ error: 'Missing required field: specialization' }, { status: 400 });
      }
      
      const result = await recruitSpy(
        auth.playerId,
        auth.username,
        specialization,
        auth.player.clan_id || ''
      );

      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      
      try {
        if (result.spyId) {
          const supabase = createServiceClient();
          const { data: spy } = await supabase.from('wmd_spies').select('*').eq('spy_id', result.spyId).single();
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
        console.error('Failed to broadcast spy recruitment:', broadcastError);
      }
      
      return NextResponse.json({ success: true, message: result.message, spyId: result.spyId });
    }
    
    if (action === 'mission') {
      const { spyId, missionType, targetId } = body;
      
      if (!spyId || !missionType || !targetId) {
        return NextResponse.json({ error: 'Missing required fields: spyId, missionType, targetId' }, { status: 400 });
      }
      
      const result = await startMission(spyId, missionType, targetId);
      
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      
      return NextResponse.json({ success: true, message: result.message, missionId: result.missionId });
    }
    
    if (action === 'sabotage') {
      const { spyId, targetId, targetType } = body;
      
      if (!spyId || !targetId || !targetType) {
        return NextResponse.json({ error: 'Missing required fields: spyId, targetId, targetType' }, { status: 400 });
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
          console.error('Failed to broadcast counter-intel detection:', broadcastError);
        }
      }
      
      return NextResponse.json({
        success: result.success,
        message: result.message,
        threatsDetected: result.threatsDetected,
        spiesDetected: result.spiesDetected,
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in intelligence API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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
    
    if (action === 'train') {
      const { spyId, skillType, trainingIntensity } = body;
      
      if (!spyId || !skillType) {
        return NextResponse.json({ error: 'Missing required fields: spyId, skillType' }, { status: 400 });
      }
      
      const result = await trainSpy(spyId, skillType as 'stealth' | 'hacking' | 'sabotage' | 'intelligence', trainingIntensity || 'BASIC');
      
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      
      return NextResponse.json({ success: true, message: result.message, newSkillLevel: result.newSkillLevel });
    }
    
    if (action === 'complete') {
      const { missionId } = body;
      
      if (!missionId) {
        return NextResponse.json({ error: 'Missing required field: missionId' }, { status: 400 });
      }
      
      const result = await completeMission(missionId);
      
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      
      return NextResponse.json({ success: true, message: result.message, intelligence: result.intelligence });
    }
    
    return NextResponse.json({ error: 'Invalid action. Use "train" or "complete"' }, { status: 400 });
  } catch (error) {
    console.error('Error in intelligence PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
