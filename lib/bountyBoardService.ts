/**
 * Bounty Board Service — Supabase backend
 */
import { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { fromJsonb, toJsonb } from '@/lib/supabase/jsonb';

export interface PlayerBounties {
  lastRefresh: string | null;
  bounties: Record<string, unknown>[];
  unclaimedRewards?: number;
}

interface BountyBoardResult { success: boolean; message: string; bounties?: Record<string, unknown>[]; metalGained?: number; energyGained?: number; rewardsClaimed?: boolean }

function needsRefresh(lastRefresh: string | null | undefined): boolean {
  if (!lastRefresh) return true;
  const now = new Date();
  const diffMs = now.getTime() - new Date(lastRefresh).getTime();
  return diffMs > 24 * 60 * 60 * 1000;
}

export async function refreshBounties(username: string): Promise<BountyBoardResult> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('*').eq('username', username).single();
  if (!player) throw new Error('Player not found');

  const currentBounties = fromJsonb<PlayerBounties>(player.daily_bounties);
  if (!needsRefresh(currentBounties?.lastRefresh || null)) {
    return { success: false, message: 'Bounties already refreshed today', bounties: currentBounties?.bounties || [] };
  }

  const newBounties = { bounties: [], lastRefresh: new Date(), unclaimedRewards: 0 };
  await supabase.from('players').update({ daily_bounties: toJsonb(newBounties) }).eq('username', username);
  return { success: true, message: 'Bounties refreshed', bounties: [] };
}

export async function getBounties(username: string): Promise<PlayerBounties> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('daily_bounties').eq('username', username).single();
  return fromJsonb<PlayerBounties>(player?.daily_bounties) ?? { lastRefresh: null, bounties: [] };
}

export async function claimBounty(username: string, bountyId: string): Promise<BountyBoardResult> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('daily_bounties, resources_metal, resources_energy').eq('username', username).single();
  if (!player) return { success: false, message: 'Player not found' };

  const current = (player?.daily_bounties as unknown as PlayerBounties) || { lastRefresh: null, bounties: [] };
  const idx = current.bounties.findIndex(b => (b as Record<string, unknown>).id === bountyId);
  if (idx === -1) return { success: false, message: 'Bounty not found' };

  const bounty = current.bounties[idx] as Record<string, unknown>;
  const metalReward = (bounty.metalReward as number) || 5000;
  const energyReward = (bounty.energyReward as number) || 2500;

  current.bounties.splice(idx, 1);
  current.unclaimedRewards = (current.unclaimedRewards || 0) + 1;

  await supabase.from('players').update({
    daily_bounties: current as unknown as Json,
    resources_metal: (player.resources_metal || 0) + metalReward,
    resources_energy: (player.resources_energy || 0) + energyReward,
  }).eq('username', username);

  return { success: true, message: 'Bounty claimed', metalGained: metalReward, energyGained: energyReward, rewardsClaimed: true };
}

export async function addBounty(username: string, bounty: Record<string, unknown>): Promise<BountyBoardResult> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('daily_bounties').eq('username', username).single();
  const current = (player?.daily_bounties as unknown as PlayerBounties) || { lastRefresh: null, bounties: [], unclaimedRewards: 0 };
  current.bounties.push(bounty);
  await supabase.from('players').update({ daily_bounties: current as unknown as Json }).eq('username', username);
  return { success: true, message: 'Bounty added' };
}

export const claimBountyReward = claimBounty;

export async function getBountyStats(_username: string): Promise<Record<string, number>> {
  return { activeBounties: 0, completedBounties: 0, totalEarned: 0 };
}
