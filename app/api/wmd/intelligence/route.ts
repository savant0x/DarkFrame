/**
 * @file app/api/wmd/intelligence/route.ts
 * @created 2025-10-22
 * @overview WMD Intelligence API Endpoints
 * 
 * OVERVIEW:
 * Handles spy network operations including recruitment, missions, sabotage,
 * and counter-intelligence activities.
 * 
 * Features:
 * - GET: Fetch player's spies and missions
 * - POST: Recruit spies, start missions, execute sabotage
 * - PATCH: Train spies, complete missions
 * 
 * Authentication: JWT tokens via HttpOnly cookies
 * Dependencies: spyService.ts, apiHelpers.ts
 */

import { NextRequest, NextResponse } from 'next/server';
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
import { getSabotageTargets } from '@/lib/wmd/sabotageTargets';
import { isSabotageTargetType } from '@/lib/wmd/sabotageMath';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/wmd/intelligence
 * Fetch player's spies and missions
 * 
 * Query:
 * - type: 'spies' | 'missions'
 */
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
      const spies = await getPlayerSpies(auth.playerId, undefined, [auth.playerId]);
      return NextResponse.json({ success: true, spies });
    }
    
    if (type === 'missions') {
      const missions = await getPlayerMissions(auth.playerId);
      return NextResponse.json({ success: true, missions });
    }

    // FID-20260916-011: enumeration for the sabotage flow's target step.
    // Read-only; scoping + skill floor enforced inside the service, refusals
    // at fire time remain server-side in executeSabotage.
    if (type === 'sabotage-targets') {
      const spyId = searchParams.get('spyId');
      if (!spyId) {
        return NextResponse.json(
          { error: 'Missing required parameter: spyId' },
          { status: 400 }
        );
      }
      const result = await getSabotageTargets(spyId);
      if (!result.success) {
        return NextResponse.json(
          { error: result.message ?? 'Failed to enumerate sabotage targets' },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        missiles: result.missiles,
        batteries: result.batteries,
        research: result.research,
      });
    }

    return NextResponse.json(
      { error: 'Invalid type. Use "spies", "missions", or "sabotage-targets"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching intelligence data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch intelligence data' },
      { status: 500 }
    );
  } finally {
    endTimer();
  }
}));

/**
 * POST /api/wmd/intelligence
 * Recruit spy, start mission, execute sabotage, or counter-intel
 * 
 * Body:
 * - action: 'recruit' | 'mission' | 'sabotage' | 'counterIntel'
 * - specialization: string (for recruit)
 * - spyId: string (for mission/sabotage)
 * - missionType: string (for mission)
 * - targetId: string (for mission/sabotage)
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
    
    // Recruit spy
    if (action === 'recruit') {
      const { specialization } = body;
      
      if (!specialization) {
        return NextResponse.json(
          { error: 'Missing required field: specialization' },
          { status: 400 }
        );
      }
      
      if (!auth.player.clanId) {
        return NextResponse.json(
          { error: 'Spy recruitment requires clan membership (recruitment is funded by the clan treasury)' },
          { status: 400 }
        );
      }
      
      const result = await recruitSpy(
        auth.playerId,
        auth.username,
        specialization,
        auth.player.clanId
      );
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }
      
      // Broadcast spy recruitment
      try {
        if (result.spyId) {
          const io = getIO();
          if (io) {
            await wmdHandlers.broadcastSpyRecruited(io, {
              playerId: auth.playerId,
              spyId: result.spyId,
              spyName: result.codename ?? '',
              specialization,
            });
          }
        }
      } catch (broadcastError) {
        console.error('Failed to broadcast spy recruitment:', broadcastError);
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
        spyId: result.spyId,
      });
    }
    
    // Start mission
    if (action === 'mission') {
      const { spyId, missionType, targetId } = body;
      
      if (!spyId || !missionType || !targetId) {
        return NextResponse.json(
          { error: 'Missing required fields: spyId, missionType, targetId' },
          { status: 400 }
        );
      }
      
      const result = await startMission(
        spyId,
        missionType,
        targetId,
        auth.playerId
      );
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
        missionId: result.missionId,
      });
    }
    
    // Execute sabotage
    if (action === 'sabotage') {
      const { spyId, targetId, targetType } = body;
      
      if (!spyId || !targetId || !targetType) {
        return NextResponse.json(
          { error: 'Missing required fields: spyId, targetId, targetType' },
          { status: 400 }
        );
      }

      // FID-20260916-011: reject malformed type values up front so the
      // service's switch cannot be probed with arbitrary strings.
      if (!isSabotageTargetType(targetType)) {
        return NextResponse.json(
          { error: 'Invalid targetType. Use "MISSILE", "DEFENSE_BATTERY", or "RESEARCH"' },
          { status: 400 }
        );
      }
      
      // FID-20260916-007: the historical call passed (targetId, targetType)
      // transposed against executeSabotage's (targetType, targetId) signature —
      // the asset id landed in the type slot, the type string in the id slot,
      // and validateSabotageTarget's switch never matched (every live operation
      // refused "Invalid sabotage target"). Repaired to signature order; the
      // 4th arg is the OPERATOR (session caller) — the service derives the
      // victim from the target asset itself.
      const result = await executeSabotage(
        spyId,
        targetType,
        targetId,
        auth.playerId
      );
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
        damage: result.damage,
      });
    }
    
    // Counter-intelligence
    if (action === 'counterIntel') {
      const { targetArea } = body as { targetArea?: string };
      const area: 'FACILITIES' | 'COMMUNICATIONS' | 'PERSONNEL' | 'ALL' =
        targetArea === 'FACILITIES' || targetArea === 'COMMUNICATIONS' || targetArea === 'PERSONNEL'
          ? targetArea
          : 'ALL';
      const result = await counterIntelligenceSweep(
        auth.playerId,
        area
      );
      
      // Broadcast if spies detected
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
    
    return NextResponse.json(
      { error: 'Invalid action. Use "recruit", "mission", "sabotage", or "counterIntel"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in intelligence API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/wmd/intelligence
 * Train spy or complete mission
 * 
 * Body:
 * - action: 'train' | 'complete'
 * - spyId: string (for train)
 * - missionId: string (for complete)
 * - skillType: string (for train)
 */
export async function PATCH(req: NextRequest) {
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
    
    // Train spy
    if (action === 'train') {
      const { spyId, skillType, trainingIntensity } = body;
      
      if (!spyId || !skillType) {
        return NextResponse.json(
          { error: 'Missing required fields: spyId, skillType' },
          { status: 400 }
        );
      }
      
      const result = await trainSpy(
        spyId,
        skillType,
        trainingIntensity || 'BASIC'
      );
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
        newSkillLevel: result.newSkillLevel,
      });
    }
    
    // Complete mission
    if (action === 'complete') {
      const { missionId } = body;
      
      if (!missionId) {
        return NextResponse.json(
          { error: 'Missing required field: missionId' },
          { status: 400 }
        );
      }
      
      const result = await completeMission(missionId);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
        intelligence: result.intelligence,
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use "train" or "complete"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in intelligence PATCH:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
