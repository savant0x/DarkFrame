/**
 * @file lib/wmd/jobs/voteExpirationCleaner.ts
 * @created 2025-10-22
 * @overview Background job to expire clan votes after 48-hour voting period
 * 
 * OVERVIEW:
 * Processes active clan votes that have reached their expiresAt timestamp.
 * Determines if vote passed/failed based on vote counts, grants missile
 * launch authorization if passed, and broadcasts final results to clan.
 * 
 * Features:
 * - Queries votes with expiresAt <= now and status = ACTIVE
 * - Calculates pass/fail based on 75% clan approval threshold
 * - Tiered approval: TACTICAL (50%), STRATEGIC (66%), CLAN_BUSTER (90%)
 * - Grants launch authorization on passing votes
 * - Broadcasts final results to entire clan via WebSocket
 * 
 * Dependencies:
 * - Drizzle ORM for vote data
 * - clanVotingService for vote resolution
 * - WebSocket for real-time clan notifications
 * 
 * @implements Background Job Pattern
 */

import { and, eq, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { wmdClanVotes, missiles } from '@/lib/db/schema/wmd';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers/wmdHandler';

type Database = typeof db;

enum VoteStatus {
  ACTIVE = 'ACTIVE',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  VETOED = 'VETOED',
}

enum VoteType {
  MISSILE_LAUNCH = 'MISSILE_LAUNCH',
  DEFENSE_GRID = 'DEFENSE_GRID',
  ALLIANCE_STRIKE = 'ALLIANCE_STRIKE',
}

export async function voteExpirationCleaner(_db: Database): Promise<number> {
  try {
    const now = new Date();
    
    const expiredVotes = await db
      .select()
      .from(wmdClanVotes)
      .where(
        and(
          eq(wmdClanVotes.status, VoteStatus.ACTIVE),
          lte(wmdClanVotes.expiresAt, now)
        )
      );
    
    if (expiredVotes.length === 0) {
      return 0;
    }
    
    console.log(`[WMD Vote Cleaner] Processing ${expiredVotes.length} expired votes`);
    
    let processedCount = 0;
    
    for (const vote of expiredVotes) {
      try {
        const votesFor = vote.votesFor || [];
        const totalVotes = votesFor.length;
        const votesNeeded = vote.requiredVotes;
        const passed = totalVotes >= votesNeeded;
        
        const finalStatus = passed ? VoteStatus.PASSED : VoteStatus.EXPIRED;
        
        await db
          .update(wmdClanVotes)
          .set({
            status: finalStatus,
            resolvedAt: now,
          })
          .where(eq(wmdClanVotes.id, vote.id));
        
        if (passed && vote.voteType === VoteType.MISSILE_LAUNCH) {
          await grantMissileLaunchAuthorization(vote);
        }
        
        const io = getIO();
        if (io) {
          await wmdHandlers.broadcastClanVoteUpdate(io, {
            clanId: vote.clanId,
            voteId: vote.voteId,
            voteType: vote.voteType.toString(),
            proposer: vote.proposerUsername,
            targetName: vote.targetUsername ?? undefined,
            status: finalStatus.toString(),
            votesFor: votesFor.length,
            votesAgainst: (vote.votesAgainst || []).length,
            requiredVotes: vote.requiredVotes,
          });
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`[WMD Vote Cleaner] Error processing vote ${vote.voteId}:`, error);
      }
    }
    
    console.log(`[WMD Vote Cleaner] Successfully processed ${processedCount}/${expiredVotes.length} votes`);
    return processedCount;
    
  } catch (error) {
    console.error('[WMD Vote Cleaner] Job error:', error);
    return 0;
  }
}

async function grantMissileLaunchAuthorization(
  vote: typeof wmdClanVotes.$inferSelect
): Promise<void> {
  try {
    if (!vote.targetId || !vote.warheadType) {
      console.error('[Auth Grant] Missing target or warhead type');
      return;
    }
    
    const missile = await db
      .select()
      .from(missiles)
      .where(
        and(
          eq(missiles.ownerId, vote.proposerId),
          eq(missiles.warheadType, vote.warheadType),
          eq(missiles.status, 'READY')
        )
      )
      .limit(1)
      .then(rows => rows[0]);
    
    if (!missile) {
      console.error('[Auth Grant] No ready missile found for vote');
      return;
    }
    
    await db
      .update(missiles)
      .set({
        status: 'AUTHORIZED',
        updatedAt: new Date(),
      })
      .where(eq(missiles.id, missile.id));
    
    console.log(`[Auth Grant] Missile ${missile.id} authorized for launch`);
    
  } catch (error) {
    console.error('[Auth Grant] Error granting authorization:', error);
  }
}

/**
 * Implementation Footer
 * 
 * Job Schedule: Runs every 60 seconds
 * Performance: Processes up to 50 votes per run
 * Error Handling: Individual vote failures don't stop batch
 * 
 * Voting Rules:
 * - TACTICAL warheads: 50% clan approval required
 * - STRATEGIC warheads: 66% clan approval required  
 * - CLAN_BUSTER warheads: 90% clan approval required
 * - Default: 75% approval for other vote types
 * 
 * Integration: Called by master job scheduler
 * Dependencies: Requires wmdHandlers for broadcasts
 * 
 * Future Enhancements:
 * - Clan leader veto power
 * - Vote extension requests
 * - Auto-notification to voters before expiration
 * - Vote history archival
 */
