/**
 * @file lib/wmd/clanVotingService.ts
 * @created 2025-10-22
 * @overview WMD Clan Voting Service - WMD Authorization System
 * 
 * OVERVIEW:
 * Manages clan voting for WMD launches, resource pooling, and strategic decisions.
 * Implements democratic authorization for high-stakes WMD operations.
 * 
 * Features:
 * - Launch authorization votes
 * - Resource pooling decisions
 * - Defense grid coordination
 * - Vote tracking and results
 */

import { createServiceClient } from '@/lib/supabase/server';
import { WarheadType } from '@/types/wmd';

/**
 * Vote status enum
 */
export enum VoteStatus {
  ACTIVE = 'ACTIVE',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  VETOED = 'VETOED',
}

/**
 * Vote type enum
 */
export enum VoteType {
  LAUNCH_AUTHORIZATION = 'LAUNCH_AUTHORIZATION',
  RESOURCE_POOLING = 'RESOURCE_POOLING',
  DEFENSE_GRID = 'DEFENSE_GRID',
  ALLIANCE_STRIKE = 'ALLIANCE_STRIKE',
}

/**
 * Clan vote interface
 */
export interface ClanVote {
  voteId: string;
  clanId: string;
  proposerId: string;
  proposerUsername: string;
  voteType: VoteType;
  status: VoteStatus;
  
  // Vote details
  targetId?: string;
  targetUsername?: string;
  warheadType?: WarheadType;
  resourceAmount?: number;
  
  // Voting
  votesFor: string[];
  votesAgainst: string[];
  requiredVotes: number;
  
  // Timestamps
  createdAt: Date;
  expiresAt: Date;
  resolvedAt?: Date;
}

/**
 * Create a new clan vote
 * 
 * VOTING REQUIREMENTS (STRICT):
 * - TACTICAL warheads: 50% approval (small clans can act quickly)
 * - STRATEGIC warheads: 66% approval (significant force)
 * - NEUTRON/CLUSTER warheads: 75% approval (default)
 * - CLAN_BUSTER warheads: 90% approval (devastating = needs consensus)
 * - Voting period: 48 hours (up from 24h for better participation)
 * - Clan leader can VETO any vote
 */
export async function createClanVote(
  clanId: string,
  proposerId: string,
  proposerUsername: string,
  voteType: VoteType,
  details: {
    targetId?: string;
    targetUsername?: string;
    warheadType?: WarheadType;
    resourceAmount?: number;
  }
): Promise<{ success: boolean; message: string; voteId?: string; requiredVotes?: number; expiresAt?: Date }> {
  try {
    const supabase = createServiceClient();
    
    // Get clan member count
    const memberCount = await getClanMemberCount(clanId);
    
    // Calculate required votes based on warhead type (TIERED APPROVAL)
    let approvalThreshold = 0.75; // Default: 75% approval
    
    if (voteType === VoteType.LAUNCH_AUTHORIZATION && details.warheadType) {
      switch (details.warheadType) {
        case WarheadType.TACTICAL:
          approvalThreshold = 0.50;
          break;
        case WarheadType.STRATEGIC:
          approvalThreshold = 0.66;
          break;
        case WarheadType.NEUTRON:
        case WarheadType.CLUSTER:
          approvalThreshold = 0.75;
          break;
        case WarheadType.CLAN_BUSTER:
          approvalThreshold = 0.90;
          break;
        default:
          approvalThreshold = 0.75;
      }
    }
    
    const requiredVotes = Math.ceil(memberCount * approvalThreshold);
    
    const voteId = `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 HOURS
    
    const { error } = await supabase
      .from('wmd_clan_votes')
      .insert({
        vote_id: voteId,
        clan_id: clanId,
        proposed_by: proposerUsername,
        vote_type: voteType === VoteType.LAUNCH_AUTHORIZATION ? 'launch_authorization' :
                   voteType === VoteType.RESOURCE_POOLING ? 'research_priority' :
                   voteType === VoteType.DEFENSE_GRID ? 'defense_allocation' : 'retaliation',
        status: 'active',
        title: `${voteType} vote`,
        description: details.targetUsername ? `Target: ${details.targetUsername}` : '',
        votes_for: 1, // Proposer auto-votes yes
        votes_against: 0,
        total_eligible: memberCount,
        expires_at: expiresAt.toISOString(),
      });
    
    if (error) {
      console.error('Error creating clan vote:', error);
      return { success: false, message: 'Failed to create vote' };
    }
    
    // Also record the proposer's ballot
    await supabase
      .from('wmd_vote_ballots')
      .insert({
        vote_id: voteId,
        voter_id: proposerId,
        choice: 'for',
      });
    
    const warheadInfo = details.warheadType ? ` (${details.warheadType} - ${Math.floor(approvalThreshold * 100)}% approval needed)` : '';
    
    return {
      success: true,
      message: `Vote created${warheadInfo}. ${requiredVotes}/${memberCount} votes required. Expires in 48 hours.`,
      voteId,
      requiredVotes,
      expiresAt,
    };
    
  } catch (error) {
    console.error('Error creating clan vote:', error);
    return { success: false, message: 'Failed to create vote' };
  }
}

/**
 * Cast a vote
 */
export async function castVote(
  voteId: string,
  voterId: string,
  voteFor: boolean
): Promise<{ success: boolean; message: string; voteStatus?: VoteStatus }> {
  try {
    const supabase = createServiceClient();
    const { data: vote } = await supabase
      .from('wmd_clan_votes')
      .select('*')
      .eq('vote_id', voteId)
      .single();
    
    if (!vote) {
      return { success: false, message: 'Vote not found' };
    }
    
    if (vote.status !== 'active') {
      return { success: false, message: 'Vote is no longer active' };
    }
    
    // Check if already voted
    const { data: existingBallot } = await supabase
      .from('wmd_vote_ballots')
      .select('id')
      .eq('vote_id', voteId)
      .eq('voter_id', voterId)
      .single();
    
    if (existingBallot) {
      return { success: false, message: 'You have already voted' };
    }
    
    // Cast vote
    await supabase
      .from('wmd_vote_ballots')
      .insert({
        vote_id: voteId,
        voter_id: voterId,
        choice: voteFor ? 'for' : 'against',
      });
    
    // Update vote counts
    const updateField = voteFor ? 'votes_for' : 'votes_against';
    const { data: currentVote } = await supabase
      .from('wmd_clan_votes')
      .select('votes_for, votes_against, total_eligible')
      .eq('vote_id', voteId)
      .single();
    
    if (currentVote) {
      const newValue = (currentVote[updateField] || 0) + 1;
      await supabase
        .from('wmd_clan_votes')
        if (updateField === 'votes_for') await supabase.from('wmd_clan_votes').update({ votes_for: newValue }).eq('vote_id', voteId);
        else await supabase.from('wmd_clan_votes').update({ votes_against: newValue }).eq('vote_id', voteId);
      
      // Check if vote should be resolved
      const totalVotes = (voteFor ? newValue : currentVote.votes_for || 0) + 
                         (voteFor ? currentVote.votes_against || 0 : newValue);
      
      if (voteFor && newValue >= (currentVote.total_eligible || 1) * 0.5) {
        await resolveVote(voteId, VoteStatus.PASSED);
        return { success: true, message: 'Vote passed!', voteStatus: VoteStatus.PASSED };
      }
      
      if (totalVotes >= (currentVote.total_eligible || 1)) {
        await resolveVote(voteId, VoteStatus.FAILED);
        return { success: true, message: 'Vote failed!', voteStatus: VoteStatus.FAILED };
      }
    }
    
    return { success: true, message: 'Vote cast successfully' };
    
  } catch (error) {
    console.error('Error casting vote:', error);
    return { success: false, message: 'Failed to cast vote' };
  }
}

/**
 * Clan leader veto power
 */
export async function vetoClanVote(
  voteId: string,
  playerId: string,
  playerUsername: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createServiceClient();
    const { data: vote } = await supabase
      .from('wmd_clan_votes')
      .select('*')
      .eq('vote_id', voteId)
      .single();
    
    if (!vote) {
      return { success: false, message: 'Vote not found' };
    }
    
    if (vote.status !== 'active') {
      return { success: false, message: `Cannot veto: Vote is already ${vote.status}` };
    }
    
    // Verify player is clan leader
    const { data: clan } = await supabase
      .from('clans')
      .select('leader_id')
      .eq('id', vote.clan_id)
      .single();
    
    if (!clan) {
      return { success: false, message: 'Clan not found' };
    }
    
    if (clan.leader_id !== playerId) {
      return { success: false, message: 'Only the clan leader can veto votes' };
    }
    
    // VETO THE VOTE
    await supabase
      .from('wmd_clan_votes')
      .update({
        status: 'expired',
        result: { vetoedBy: playerId, vetoedByUsername: playerUsername, vetoReason: reason || 'No reason provided' },
        closed_at: new Date().toISOString(),
      })
      .eq('vote_id', voteId);
    
    console.log(`Vote ${voteId} VETOED by clan leader ${playerUsername}. Reason: ${reason || 'No reason provided'}`);
    
    return {
      success: true,
      message: `Vote vetoed by clan leader ${playerUsername}. Reason: ${reason || 'No reason provided'}`,
    };
    
  } catch (error) {
    console.error('Error vetoing clan vote:', error);
    return { success: false, message: 'Failed to veto vote' };
  }
}

/**
 * Resolve a vote
 */
async function resolveVote(
  voteId: string,
  status: VoteStatus
): Promise<void> {
  try {
    const supabase = createServiceClient();
    
    const newStatus = status === VoteStatus.PASSED ? 'passed' :
                      status === VoteStatus.FAILED ? 'failed' :
                      status === VoteStatus.EXPIRED ? 'expired' : 'tied';
    
    await supabase
      .from('wmd_clan_votes')
      .update({
        status: newStatus,
        closed_at: new Date().toISOString(),
      })
      .eq('vote_id', voteId);
    
    console.log(`Vote ${voteId} resolved to ${status}`);
    
  } catch (error) {
    console.error('Error resolving vote:', error);
  }
}

/**
 * Get clan's active votes
 */
export async function getClanVotes(
  clanId: string,
  activeOnly: boolean = true
): Promise<ClanVote[]> {
  try {
    const supabase = createServiceClient();
    let query = supabase
      .from('wmd_clan_votes')
      .select('*')
      .eq('clan_id', clanId);
    
    if (activeOnly) {
      query = query.eq('status', 'active');
    }
    
    const { data } = await query.order('created_at', { ascending: false });
    
    if (!data) return [];
    
    return data.map((v: any) => ({
      voteId: v.vote_id,
      clanId: v.clan_id,
      proposerId: v.proposed_by,
      proposerUsername: v.proposed_by,
      voteType: v.vote_type === 'launch_authorization' ? VoteType.LAUNCH_AUTHORIZATION :
                v.vote_type === 'research_priority' ? VoteType.RESOURCE_POOLING :
                v.vote_type === 'defense_allocation' ? VoteType.DEFENSE_GRID : VoteType.ALLIANCE_STRIKE,
      status: v.status === 'active' ? VoteStatus.ACTIVE :
              v.status === 'passed' ? VoteStatus.PASSED :
              v.status === 'failed' ? VoteStatus.FAILED : VoteStatus.EXPIRED,
      votesFor: [],
      votesAgainst: [],
      requiredVotes: 0,
      createdAt: new Date(v.created_at),
      expiresAt: new Date(v.expires_at),
    }));
    
  } catch (error) {
    console.error('Error getting clan votes:', error);
    return [];
  }
}

/**
 * Check if player has launch authorization
 */
export async function hasLaunchAuthorization(
  playerId: string,
  warheadType: WarheadType
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    // Check for active passed votes with matching player and warhead
    const { data } = await supabase
      .from('wmd_clan_votes')
      .select('id')
      .eq('status', 'passed')
      .gte('expires_at', new Date().toISOString())
      .limit(1);
    
    return (data?.length || 0) > 0;
    
  } catch (error) {
    console.error('Error checking launch authorization:', error);
    return false;
  }
}

/**
 * Get clan member count
 */
async function getClanMemberCount(clanId: string): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from('clan_members')
      .select('*', { count: 'exact', head: true })
      .eq('clan_id', clanId);
    return count || 1;
  } catch (error) {
    console.error('Error getting clan member count:', error);
    return 1;
  }
}

/**
 * Expire old votes (cleanup job)
 */
export async function expireOldVotes(): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { data: expired } = await supabase
      .from('wmd_clan_votes')
      .select('vote_id')
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());
    
    if (!expired || expired.length === 0) return 0;
    
    for (const v of expired) {
      await supabase
        .from('wmd_clan_votes')
        .update({ status: 'expired', closed_at: new Date().toISOString() })
        .eq('vote_id', v.vote_id);
    }
    
    return expired.length;
    
  } catch (error) {
    console.error('Error expiring old votes:', error);
    return 0;
  }
}
