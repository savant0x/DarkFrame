import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
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
  VoteType,
} from '@/lib/wmd/clanVotingService';
import type { WarheadType } from '@/types/wmd/missile.types';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

function mapVoteRow(row: Record<string, any>): Record<string, any> {
  const result = row.result || {};
  return {
    voteId: row.vote_id,
    clanId: row.clan_id,
    voteType: row.vote_type,
    proposerUsername: row.proposed_by,
    status: row.status || 'active',
    votesFor: [] as string[],
    votesAgainst: [] as string[],
    requiredVotes: row.total_eligible || 0,
    targetUsername: result.targetUsername || null,
    warheadType: result.warheadType || null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export const GET = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('WMDVotingAPI');
  const endTimer = log.time('wmd-voting-get');
  
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, { message: 'Authentication required' });
    }
    
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';
    
    if (action === 'list') {
      if (!auth.player.clan_id) {
        return NextResponse.json({ error: 'Not in a clan' }, { status: 400 });
      }
      
      const rawVotes = await getClanVotes(auth.player.clan_id);
      const votes = (rawVotes || []).map(mapVoteRow);
      return NextResponse.json({ success: true, votes });
    }
    
    if (action === 'checkAuth') {
      const warheadType = searchParams.get('warheadType');
      
      if (!warheadType) {
        return NextResponse.json({ error: 'Missing required query param: warheadType' }, { status: 400 });
      }
      
      const authorized = await hasLaunchAuthorization(auth.playerId, warheadType as unknown as WarheadType);
      
      return NextResponse.json({ success: true, authorized });
    }
    
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Invalid action. Use "list" or "checkAuth"' });
  } catch (error) {
    log.error('Error in voting GET', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

export const POST = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('WMDVotingAPI');
  const endTimer = log.time('wmd-voting-post');
  
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, { message: 'Authentication required' });
    }
    
    if (!auth.player.clan_id) {
      return createErrorResponse(ErrorCode.CLAN_NOT_MEMBER, { message: 'Must be in a clan to vote' });
    }
    
    const validated = WMDVotingSchema.parse(await req.json());
    
    if (validated.action === 'create') {
      const { voteType, targetId, targetUsername, warheadType, resourceAmount } = validated;
      
      if (!voteType) {
        return NextResponse.json({ error: 'Missing required field: voteType' }, { status: 400 });
      }
      
      const result = await createClanVote(
        auth.player.clan_id,
        auth.playerId,
        auth.username,
        voteType as unknown as VoteType,
        { targetId, targetUsername, warheadType: warheadType as unknown as WarheadType, resourceAmount }
      );
      
      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: result.message });
      }
      
      log.info('Clan vote created', { username: auth.username, voteType, voteId: result.voteId });
      
      return NextResponse.json({ success: true, message: result.message, voteId: result.voteId });
    }
    
    if (validated.action === 'cast') {
      const { voteId, vote } = validated;
      
      const result = await castVote(voteId, auth.username, vote);
      
      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: result.message });
      }
      
      try {
        const supabase = createServiceClient();
        const { data: voteData } = await supabase.from('wmd_clan_votes').select('*').eq('vote_id', voteId).single();
        const io = getIO();
        if (voteData && io) {
          await wmdHandlers.broadcastClanVoteUpdate(io, {
            clanId: auth.player.clan_id,
            voteId,
            voteType: voteData.vote_type,
            proposer: voteData.proposed_by,
            targetName: '',
            status: result.voteStatus || voteData.status,
            votesFor: voteData.votes_for,
            votesAgainst: voteData.votes_against,
            requiredVotes: voteData.total_eligible || 0,
          });
        }
      } catch (broadcastError) {
        console.error('Failed to broadcast vote update:', broadcastError);
      }
      
      log.info('Vote cast', { username: auth.username, voteId, vote, status: result.voteStatus });
      
      return NextResponse.json({ success: true, message: result.message, voteStatus: result.voteStatus });
    }
    
    if (validated.action === 'veto') {
      const { voteId, reason } = validated;
      
      const result = await vetoClanVote(voteId, auth.playerId, auth.username, reason);
      
      if (!result.success) {
        return createErrorResponse(ErrorCode.CLAN_INSUFFICIENT_PERMISSION, { message: result.message });
      }
      
      try {
        const supabase = createServiceClient();
        const { data: voteData } = await supabase.from('wmd_clan_votes').select('*').eq('vote_id', voteId).single();
        const io = getIO();
        if (voteData && io) {
          await wmdHandlers.broadcastClanVoteUpdate(io, {
            clanId: auth.player.clan_id,
            voteId,
            voteType: voteData.vote_type,
            proposer: voteData.proposed_by,
            targetName: '',
            status: 'VETOED',
            votesFor: voteData.votes_for,
            votesAgainst: voteData.votes_against,
            requiredVotes: voteData.total_eligible || 0,
          });
        }
      } catch (broadcastError) {
        log.error('Failed to broadcast veto', broadcastError instanceof Error ? broadcastError : new Error(String(broadcastError)));
      }
      
      log.info('Vote vetoed', { username: auth.username, voteId, reason });
      
      return NextResponse.json({ success: true, message: result.message });
    }
    
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Invalid action' });
    
  } catch (error) {
    if (error instanceof ZodError) return createValidationErrorResponse(error);
    log.error('Error in voting POST', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
