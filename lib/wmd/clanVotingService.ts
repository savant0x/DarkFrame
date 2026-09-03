import { eq, and, gt, lt, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { wmdClanVotes, wmdLaunchAuthorizations, wmdResourcePools, wmdDefenseGrids, players, clans } from '@/lib/db/schema';
import { WarheadType } from '@/types/wmd';

export enum VoteStatus {
  ACTIVE = 'ACTIVE',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  VETOED = 'VETOED',
}

export enum VoteType {
  LAUNCH_AUTHORIZATION = 'LAUNCH_AUTHORIZATION',
  RESOURCE_POOLING = 'RESOURCE_POOLING',
  DEFENSE_GRID = 'DEFENSE_GRID',
  ALLIANCE_STRIKE = 'ALLIANCE_STRIKE',
}

export interface ClanVote {
  voteId: string;
  clanId: string;
  proposerId: string;
  proposerUsername: string;
  voteType: VoteType;
  status: VoteStatus;
  targetId?: string;
  targetUsername?: string;
  warheadType?: WarheadType;
  resourceAmount?: number;
  votesFor: string[];
  votesAgainst: string[];
  requiredVotes: number;
  createdAt: Date;
  expiresAt: Date;
  resolvedAt?: Date;
}

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
    const memberCount = await getClanMemberCount(clanId);
    
    let approvalThreshold = 0.75;
    
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
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    
    await db.insert(wmdClanVotes).values({
      id: `cv_${Date.now()}`,
      voteId,
      clanId,
      proposerId,
      proposerUsername,
      voteType,
      status: VoteStatus.ACTIVE,
      targetId: details.targetId || null,
      targetUsername: details.targetUsername || null,
      warheadType: details.warheadType || null,
      votesFor: [proposerId],
      votesAgainst: [],
      requiredVotes,
      createdAt: now,
      expiresAt,
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

export async function castVote(
  voteId: string,
  voterId: string,
  voteFor: boolean
): Promise<{ success: boolean; message: string; voteStatus?: VoteStatus }> {
  try {
    const voteRow = await db.select().from(wmdClanVotes).where(eq(wmdClanVotes.voteId, voteId)).limit(1);
    const vote = voteRow[0];
    
    if (!vote) {
      return { success: false, message: 'Vote not found' };
    }
    
    if (vote.status !== VoteStatus.ACTIVE) {
      return { success: false, message: 'Vote is no longer active' };
    }
    
    const votesFor = (vote.votesFor as string[]) || [];
    const votesAgainst = (vote.votesAgainst as string[]) || [];
    
    if (votesFor.includes(voterId) || votesAgainst.includes(voterId)) {
      return { success: false, message: 'You have already voted' };
    }
    
    const currentArray = voteFor ? votesFor : votesAgainst;
    const newValues = [...currentArray, voterId];
    
    await db.update(wmdClanVotes).set({
      ...(voteFor ? { votesFor: newValues } : {}),
      ...(!voteFor ? { votesAgainst: newValues } : {}),
    }).where(eq(wmdClanVotes.voteId, voteId));
    
    const updatedVoteRow = await db.select().from(wmdClanVotes).where(eq(wmdClanVotes.voteId, voteId)).limit(1);
    if (updatedVoteRow[0]) {
      const updatedVote: ClanVote = {
        voteId: updatedVoteRow[0].voteId,
        clanId: updatedVoteRow[0].clanId,
        proposerId: updatedVoteRow[0].proposerId,
        proposerUsername: updatedVoteRow[0].proposerUsername,
        voteType: updatedVoteRow[0].voteType as VoteType,
        status: updatedVoteRow[0].status as VoteStatus,
        targetId: updatedVoteRow[0].targetId || undefined,
        targetUsername: updatedVoteRow[0].targetUsername || undefined,
        warheadType: (updatedVoteRow[0].warheadType as WarheadType) || undefined,
        votesFor: (updatedVoteRow[0].votesFor as string[]) || [],
        votesAgainst: (updatedVoteRow[0].votesAgainst as string[]) || [],
        requiredVotes: updatedVoteRow[0].requiredVotes,
        createdAt: updatedVoteRow[0].createdAt,
        expiresAt: updatedVoteRow[0].expiresAt,
        resolvedAt: updatedVoteRow[0].resolvedAt || undefined,
      };
      const status = checkVoteStatus(updatedVote);
      if (status !== VoteStatus.ACTIVE) {
        await resolveVote(voteId, status);
        return {
          success: true,
          message: `Vote ${status.toLowerCase()}!`,
          voteStatus: status,
        };
      }
    }
    
    return { success: true, message: 'Vote cast successfully' };
    
  } catch (error) {
    console.error('Error casting vote:', error);
    return { success: false, message: 'Failed to cast vote' };
  }
}

export async function vetoClanVote(
  voteId: string,
  playerId: string,
  playerUsername: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const voteRow = await db.select().from(wmdClanVotes).where(eq(wmdClanVotes.voteId, voteId)).limit(1);
    const vote = voteRow[0];
    
    if (!vote) {
      return { success: false, message: 'Vote not found' };
    }
    
    if (vote.status !== VoteStatus.ACTIVE) {
      return { success: false, message: `Cannot veto: Vote is already ${vote.status.toLowerCase()}` };
    }
    
    const clanRow = await db.select().from(clans).where(eq(clans.id, vote.clanId)).limit(1);
    const clan = clanRow[0];
    
    if (!clan) {
      return { success: false, message: 'Clan not found' };
    }
    
    if (clan.leaderId !== playerId) {
      return { success: false, message: 'Only the clan leader can veto votes' };
    }
    
    await db.update(wmdClanVotes).set({
      status: VoteStatus.VETOED,
      resolvedAt: new Date(),
    }).where(eq(wmdClanVotes.voteId, voteId));
    
    console.log(`Vote ${voteId} VETOED by clan leader ${playerUsername}. Reason: ${reason || 'No reason provided'}`);
    
    const { wmdHandlers } = await import('@/lib/websocket/handlers/wmdHandler');
    const { getIO } = await import('@/lib/websocket/server');
    const io = getIO();
    
    if (io) {
      await wmdHandlers.broadcastClanVoteUpdate(io, {
        clanId: vote.clanId,
        voteId,
        voteType: vote.voteType.toString(),
        proposer: vote.proposerUsername,
        targetName: vote.targetUsername || '',
        status: 'VETOED',
        votesFor: ((vote.votesFor as string[]) || []).length,
        votesAgainst: ((vote.votesAgainst as string[]) || []).length,
        requiredVotes: vote.requiredVotes,
      });
    }
    
    return {
      success: true,
      message: `Vote vetoed by clan leader ${playerUsername}. Reason: ${reason || 'No reason provided'}`,
    };
    
  } catch (error) {
    console.error('Error vetoing clan vote:', error);
    return { success: false, message: 'Failed to veto vote' };
  }
}

function checkVoteStatus(vote: ClanVote): VoteStatus {
  if (new Date() > vote.expiresAt) {
    return VoteStatus.EXPIRED;
  }
  
  if (vote.votesFor.length >= vote.requiredVotes) {
    return VoteStatus.PASSED;
  }
  
  const totalMembers = vote.votesFor.length + vote.votesAgainst.length;
  const remainingVotes = totalMembers - vote.votesFor.length;
  if (vote.votesFor.length + remainingVotes < vote.requiredVotes) {
    return VoteStatus.FAILED;
  }
  
  return VoteStatus.ACTIVE;
}

async function resolveVote(
  voteId: string,
  status: VoteStatus
): Promise<void> {
  try {
    await db.update(wmdClanVotes).set({
      status,
      resolvedAt: new Date(),
    }).where(eq(wmdClanVotes.voteId, voteId));
    
    if (status === VoteStatus.PASSED) {
      const voteRow = await db.select().from(wmdClanVotes).where(eq(wmdClanVotes.voteId, voteId)).limit(1);
      if (voteRow[0]) {
        const vote: ClanVote = {
          voteId: voteRow[0].voteId,
          clanId: voteRow[0].clanId,
          proposerId: voteRow[0].proposerId,
          proposerUsername: voteRow[0].proposerUsername,
          voteType: voteRow[0].voteType as VoteType,
          status: voteRow[0].status as VoteStatus,
          targetId: voteRow[0].targetId || undefined,
          targetUsername: voteRow[0].targetUsername || undefined,
          warheadType: (voteRow[0].warheadType as WarheadType) || undefined,
          votesFor: (voteRow[0].votesFor as string[]) || [],
          votesAgainst: (voteRow[0].votesAgainst as string[]) || [],
          requiredVotes: voteRow[0].requiredVotes,
          createdAt: voteRow[0].createdAt,
          expiresAt: voteRow[0].expiresAt,
          resolvedAt: voteRow[0].resolvedAt || undefined,
        };
        await executeVoteAction(vote);
      }
    }
    
  } catch (error) {
    console.error('Error resolving vote:', error);
  }
}

async function executeVoteAction(vote: ClanVote): Promise<void> {
  try {
    switch (vote.voteType) {
      case VoteType.LAUNCH_AUTHORIZATION:
        await db.insert(wmdLaunchAuthorizations).values({
          id: `auth_${Date.now()}`,
          authId: `auth_${Date.now()}`,
          playerId: vote.proposerId,
          clanId: vote.clanId,
          warheadType: vote.warheadType || null,
          targetId: vote.targetId || null,
          grantedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        break;
        
      case VoteType.RESOURCE_POOLING:
        await db.insert(wmdResourcePools).values({
          id: `pool_${Date.now()}`.slice(0, 24),
          poolId: `pool_${Date.now()}`.slice(0, 50),
          clanId: vote.clanId,
          resourceAmount: vote.resourceAmount ?? 0,
          contributorsAllowed: vote.votesFor.length,
          createdAt: new Date(),
        });
        break;
        
      case VoteType.DEFENSE_GRID:
        await db.insert(wmdDefenseGrids).values({
          id: `grid_${Date.now()}`,
          gridId: `grid_${Date.now()}`,
          clanId: vote.clanId,
          isActive: 1,
          activatedAt: new Date(),
        });
        break;
    }
    
  } catch (error) {
    console.error('Error executing vote action:', error);
  }
}

export async function getClanVotes(
  clanId: string,
  activeOnly: boolean = true
): Promise<ClanVote[]> {
  try {
    let query = db.select().from(wmdClanVotes).where(eq(wmdClanVotes.clanId, clanId));
    
    if (activeOnly) {
      query = db.select().from(wmdClanVotes).where(and(eq(wmdClanVotes.clanId, clanId), eq(wmdClanVotes.status, VoteStatus.ACTIVE)));
    }
    
    const rows = await query.orderBy(desc(wmdClanVotes.createdAt));
    
    return rows.map(row => ({
      voteId: row.voteId,
      clanId: row.clanId,
      proposerId: row.proposerId,
      proposerUsername: row.proposerUsername,
      voteType: row.voteType as VoteType,
      status: row.status as VoteStatus,
      targetId: row.targetId || undefined,
      targetUsername: row.targetUsername || undefined,
      warheadType: (row.warheadType as WarheadType) || undefined,
      votesFor: (row.votesFor as string[]) || [],
      votesAgainst: (row.votesAgainst as string[]) || [],
      requiredVotes: row.requiredVotes,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      resolvedAt: row.resolvedAt || undefined,
    }));
    
  } catch (error) {
    console.error('Error getting clan votes:', error);
    return [];
  }
}

export async function hasLaunchAuthorization(
  playerId: string,
  warheadType: WarheadType
): Promise<boolean> {
  try {
    const authRow = await db.select().from(wmdLaunchAuthorizations).where(
      and(
        eq(wmdLaunchAuthorizations.playerId, playerId),
        eq(wmdLaunchAuthorizations.warheadType, warheadType),
        gt(wmdLaunchAuthorizations.expiresAt, new Date())
      )
    ).limit(1);
    
    return !!authRow[0];
    
  } catch (error) {
    console.error('Error checking launch authorization:', error);
    return false;
  }
}

async function getClanMemberCount(clanId: string): Promise<number> {
  try {
    const result = await db.select({ count: sql<number>`COUNT(*)` }).from(players).where(eq(players.clanId, clanId));
    return Number(result[0]?.count || 0);
  } catch (error) {
    console.error('Error getting clan member count:', error);
    return 1;
  }
}

export async function expireOldVotes(): Promise<number> {
  try {
    // Select-then-update: drizzle update() reports rowCount on the pg driver only,
    // so count the expiring rows explicitly.
    const expiring = await db.select({ id: wmdClanVotes.id }).from(wmdClanVotes).where(
      and(
        eq(wmdClanVotes.status, VoteStatus.ACTIVE),
        lt(wmdClanVotes.expiresAt, new Date())
      )
    );
    
    if (expiring.length === 0) return 0;
    
    await db.update(wmdClanVotes).set({
      status: VoteStatus.EXPIRED,
      resolvedAt: new Date(),
    }).where(
      and(
        eq(wmdClanVotes.status, VoteStatus.ACTIVE),
        lt(wmdClanVotes.expiresAt, new Date())
      )
    );
    
    return expiring.length;
    
  } catch (error) {
    console.error('Error expiring old votes:', error);
    return 0;
  }
}
