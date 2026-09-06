/**
 * @file app/api/wmd/voting/route.ts
 * @created 2025-10-22
 * @updated 2025-10-23 - Added veto action for clan leaders
 * @overview WMD Clan Voting API Endpoints
 * 
 * OVERVIEW:
 * Handles clan voting system for WMD launch authorization and other
 * critical decisions requiring clan consensus.
 * 
 * Features:
 * - GET: Fetch clan votes and authorization status
 * - POST: Create votes, cast ballots, and veto (leader only)
 * 
 * Authentication: JWT tokens via HttpOnly cookies
 * Dependencies: clanVotingService.ts, apiHelpers.ts
 */

import { NextRequest, NextResponse } from 'next/server';
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
import { WMDVotingSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';
import { getAuthenticatedPlayer } from '@/lib/wmd/apiHelpers';
import {
  createClanVote,
  castVote,
  getClanVotes,
  hasLaunchAuthorization,
  vetoClanVote,
} from '@/lib/wmd/clanVotingService';
import { WarheadType } from '@/types/wmd/missile.types';
import { VoteType } from '@/lib/wmd/clanVotingService';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers';
import { getDatabase } from '@/lib/mongodb';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/wmd/voting
 * Fetch clan votes or check authorization
 * 
 * Query:
 * - action: 'list' | 'checkAuth'
 * - missileId: string (for checkAuth)
 */
export const GET = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('WMDVotingAPI');
  const endTimer = log.time('wmd-voting-get');
  
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }
    
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';
    
    // List clan votes
    if (action === 'list') {
      if (!auth.player.clanId) {
        return NextResponse.json(
          { error: 'Not in a clan' },
          { status: 400 }
        );
      }
      
      const votes = await getClanVotes(auth.player.clanId);
      return NextResponse.json({ success: true, votes });
    }
    
    // Check launch authorization
    if (action === 'checkAuth') {
      const missileId = searchParams.get('missileId');
      const warheadType = searchParams.get('warheadType');
      
      if (!missileId || !warheadType) {
        return NextResponse.json(
          { error: 'Missing required query params: missileId, warheadType' },
          { status: 400 }
        );
      }
      
      const authorized = await hasLaunchAuthorization(auth.playerId, warheadType as WarheadType);
      
      return NextResponse.json({
        success: true,
        authorized,
      });
    }
    
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
      message: 'Invalid action. Use "list" or "checkAuth"',
    });
  } catch (error) {
    log.error('Error in voting GET', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST /api/wmd/voting
 * Create vote or cast ballot
 * 
 * Body:
 * - action: 'create' | 'cast' | 'veto'
 * - voteType: string (for create)
 * - targetId: string (for create)
 * - description: string (for create)
 * - voteId: string (for cast/veto)
 * - vote: boolean (for cast)
 * - reason: string (for veto)
 */
export const POST = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('WMDVotingAPI');
  const endTimer = log.time('wmd-voting-post');
  
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }
    
    if (!auth.player.clanId) {
      return createErrorResponse(ErrorCode.CLAN_NOT_MEMBER, {
        message: 'Must be in a clan to vote',
      });
    }
    
    // Validate request with discriminated union schema
    const validated = WMDVotingSchema.parse(await req.json());
    
    // Create vote
    if (validated.action === 'create') {
      const { voteType, targetId, targetUsername, warheadType, resourceAmount } = validated;
      
      if (!voteType) {
        return NextResponse.json(
          { error: 'Missing required field: voteType' },
          { status: 400 }
        );
      }
      
      const result = await createClanVote(
        auth.player.clanId,
        auth.playerId,
        auth.username,
        voteType as VoteType,
        {
          targetId,
          targetUsername,
          warheadType: warheadType as WarheadType,
          resourceAmount,
        }
      );
      
      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: result.message,
        });
      }
      
      log.info('Clan vote created', { username: auth.username, voteType, voteId: result.voteId });
      
      return NextResponse.json({
        success: true,
        message: result.message,
        voteId: result.voteId,
      });
    }
    
    // Cast vote
    if (validated.action === 'cast') {
      const { voteId, vote } = validated;
      
      const result = await castVote(voteId, auth.username, vote);
      
      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: result.message,
        });
      }
      
      // Broadcast vote update to clan
      try {
        const db = await getDatabase();
        const voteData = await db.collection<{
          voteId: string;
          voteType: string;
          proposer: string;
          targetUsername?: string;
          status: string;
          votesFor: string[];
          votesAgainst: string[];
          requiredVotes: number;
        }>('wmd_clan_votes').findOne({ voteId });
        const io = getIO();
        if (voteData && io) {
          await wmdHandlers.broadcastClanVoteUpdate(io, {
            clanId: auth.player.clanId,
            voteId,
            voteType: voteData.voteType,
            proposer: voteData.proposer,
            targetName: voteData.targetUsername,
            status: result.voteStatus || voteData.status,
            votesFor: voteData.votesFor.length,
            votesAgainst: voteData.votesAgainst.length,
            requiredVotes: voteData.requiredVotes,
          });
        }
      } catch (broadcastError) {
        console.error('Failed to broadcast vote update:', broadcastError);
      }
      
      log.info('Vote cast', { username: auth.username, voteId, vote, status: result.voteStatus });
      
      return NextResponse.json({
        success: true,
        message: result.message,
        voteStatus: result.voteStatus,
      });
    }
    
    // Veto vote (leader only)
    if (validated.action === 'veto') {
      const { voteId, reason } = validated;
      
      const result = await vetoClanVote(voteId, auth.playerId, auth.username, reason);
      
      if (!result.success) {
        return createErrorResponse(ErrorCode.CLAN_INSUFFICIENT_PERMISSION, {
          message: result.message,
        });
      }
      
      // Broadcast veto to clan
      try {
        const db = await getDatabase();
        const voteData = await db.collection<{
          voteId: string;
          voteType: string;
          proposer: string;
          targetUsername?: string;
          status: string;
          votesFor: string[];
          votesAgainst: string[];
          requiredVotes: number;
        }>('wmd_clan_votes').findOne({ voteId });
        const io = getIO();
        if (voteData && io) {
          await wmdHandlers.broadcastClanVoteUpdate(io, {
            clanId: auth.player.clanId,
            voteId,
            voteType: voteData.voteType,
            proposer: voteData.proposer,
            targetName: voteData.targetUsername,
            status: 'VETOED',
            votesFor: voteData.votesFor.length,
            votesAgainst: voteData.votesAgainst.length,
            requiredVotes: voteData.requiredVotes,
          });
        }
      } catch (broadcastError) {
        log.error('Failed to broadcast veto', broadcastError instanceof Error ? broadcastError : new Error(String(broadcastError)));
      }
      
      log.info('Vote vetoed', { username: auth.username, voteId, reason });
      
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    }
    
    // Should never reach here due to discriminated union
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
      message: 'Invalid action',
    });
    
  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Error in voting POST', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
