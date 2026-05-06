/**
 * @file lib/wmd/jobs/voteExpirationCleaner.ts
 * @overview Background job to expire clan votes — Supabase backend
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers/wmdHandler';

export async function voteExpirationCleaner(): Promise<number> {
  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();

    const { data: expiredVotes } = await supabase
      .from('wmd_clan_votes')
      .select('*')
      .eq('status', 'active')
      .lte('expires_at', now);

    if (!expiredVotes || expiredVotes.length === 0) return 0;

    let processed = 0;
    for (const vote of expiredVotes) {
      const votesFor = typeof vote.votes_for === 'number' ? vote.votes_for : 0;
      const totalEligible = typeof vote.total_eligible === 'number' ? vote.total_eligible : 1;
      const passed = totalEligible > 0 && votesFor / totalEligible >= 0.5;

      await supabase.from('wmd_clan_votes').update({
        status: passed ? 'passed' : 'expired',
        closed_at: now,
      }).eq('vote_id', vote.vote_id);

      const io = getIO();
      if (io) {
        await wmdHandlers.broadcastClanVoteUpdate(io, {
          clanId: vote.clan_id,
          voteId: vote.vote_id,
          voteType: vote.vote_type || '',
          proposer: vote.proposed_by || '',
          status: passed ? 'passed' : 'expired',
          votesFor: votesFor,
          votesAgainst: typeof vote.votes_against === 'number' ? vote.votes_against : 0,
          requiredVotes: Math.floor(totalEligible * 0.5),
        });
      }

      processed++;
    }
    return processed;
  } catch (error) {
    console.error('[Vote Expiration Cleaner] Error:', error);
    return 0;
  }
}
