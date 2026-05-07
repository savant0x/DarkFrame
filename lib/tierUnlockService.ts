/**
 * @file lib/tierUnlockService.ts
 * @overview Tier unlock service — Supabase backend with hybrid RP + metal costs
 */

import { createServiceClient } from '@/lib/supabase/server';
import { UnitTier, TIER_UNLOCK_REQUIREMENTS } from '@/types';

export interface TierRequirements {
  level: number;
  rp: number;
  metal: number;
}

export async function canUnlockTier(
  username: string,
  tier: UnitTier
): Promise<{ canUnlock: boolean; reason?: string; requirements?: TierRequirements }> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('*').eq('username', username).single();

  if (!player) return { canUnlock: false, reason: 'Player not found' };
  if (tier === UnitTier.Tier1) return { canUnlock: true };

  const requirements = TIER_UNLOCK_REQUIREMENTS[tier];

  if (player.unlocked_tiers?.includes(String(tier) as "1" | "2" | "3" | "4" | "5")) return { canUnlock: false, reason: 'Tier already unlocked' };
  if (player.level < requirements.level) return { canUnlock: false, reason: `Requires level ${requirements.level} (current: ${player.level})`, requirements };
  if (player.research_points < requirements.rp) return { canUnlock: false, reason: `Requires ${requirements.rp} RP (current: ${player.research_points})`, requirements };
  if ((player.resources_metal || 0) < requirements.metal) return { canUnlock: false, reason: `Requires ${requirements.metal.toLocaleString()} metal (current: ${(player.resources_metal || 0).toLocaleString()})`, requirements };

  return { canUnlock: true, requirements };
}

export async function unlockTier(
  username: string,
  tier: UnitTier
): Promise<{ success: boolean; message: string; tierUnlocked?: UnitTier; rpSpent?: number; metalSpent?: number; rpRemaining?: number; metalRemaining?: number; unlockedTiers?: UnitTier[] }> {
  const eligibility = await canUnlockTier(username, tier);
  if (!eligibility.canUnlock) return { success: false, message: eligibility.reason || 'Cannot unlock tier' };

  const requirements = TIER_UNLOCK_REQUIREMENTS[tier];
  const supabase = createServiceClient();

  const { data: player } = await supabase.from('players').select('research_points, resources_metal, unlocked_tiers').eq('username', username).single();
  if (!player) return { success: false, message: 'Player not found' };
  if ((player.research_points || 0) < requirements.rp) return { success: false, message: 'Insufficient RP' };
  if ((player.resources_metal || 0) < requirements.metal) return { success: false, message: 'Insufficient metal' };

  const newRp = (player.research_points || 0) - requirements.rp;
  const newMetal = (player.resources_metal || 0) - requirements.metal;
  const newTiers = [...(player.unlocked_tiers || [String(UnitTier.Tier1)]), String(tier)].filter((t, i, a) => a.indexOf(t) === i) as ("1" | "2" | "3" | "4" | "5")[];

  await supabase.from('players').update({
    research_points: newRp,
    resources_metal: newMetal,
    unlocked_tiers: newTiers,
  }).eq('username', username);

  await supabase.from('player_rp_history').insert({
    player_username: username,
    amount: -requirements.rp,
    reason: `Unlocked Tier ${tier}`,
    balance: newRp,
  });

  return {
    success: true,
    message: `Tier ${tier} unlocked!`,
    tierUnlocked: tier,
    rpSpent: requirements.rp,
    metalSpent: requirements.metal,
    rpRemaining: newRp,
    metalRemaining: newMetal,
    unlockedTiers: newTiers.map(Number) as UnitTier[],
  };
}

export async function getTierUnlockStatus(username: string): Promise<{
  playerLevel: number; currentRP: number; currentMetal: number; unlockedTiers: UnitTier[];
  availableTiers: Array<{ tier: UnitTier; isUnlocked: boolean; canUnlock: boolean; requirements: TierRequirements; reason?: string }>;
}> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('level, research_points, resources_metal, unlocked_tiers').eq('username', username).single();
  if (!player) throw new Error('Player not found');

  const unlockedTiers = (player.unlocked_tiers || [String(UnitTier.Tier1)]).map(Number) as UnitTier[];
  const availableTiers = await Promise.all(
    [UnitTier.Tier1, UnitTier.Tier2, UnitTier.Tier3, UnitTier.Tier4, UnitTier.Tier5].map(async (t) => {
      const req = TIER_UNLOCK_REQUIREMENTS[t];
      const isUnlocked = unlockedTiers.includes(t);
      const eligibility = await canUnlockTier(username, t);
      return { tier: t, isUnlocked, canUnlock: eligibility.canUnlock && !isUnlocked, requirements: req, reason: eligibility.reason };
    })
  );
  return { playerLevel: player.level, currentRP: player.research_points, currentMetal: player.resources_metal || 0, unlockedTiers, availableTiers };
}

export async function getPlayerAvailableUnits(username: string) {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('level, unlocked_tiers').eq('username', username).single();
  if (!player) throw new Error('Player not found');
  const { getAvailableUnits } = await import('@/types');
  return getAvailableUnits(player.level, (player.unlocked_tiers || [String(UnitTier.Tier1)]).map(Number) as UnitTier[]);
}
