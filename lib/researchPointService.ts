/**
 * @file lib/researchPointService.ts
 * @overview Research Points management — Supabase backend
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/types/database';

const DAILY_HARVEST_MILESTONES: Record<number, number> = { 1000: 500, 2500: 750, 5000: 1000, 10000: 1500, 15000: 1250, 22500: 1000 };

function toISO(d: Date): string { return d.toISOString(); }

export async function awardRP(
  username: string, amount: number, source: string, reason: string, metadata?: Record<string, unknown>
): Promise<{ success: boolean; message: string; rpAwarded?: number; vipBonusApplied?: boolean; newBalance?: number }> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('research_points, is_vip, vip_tier').eq('username', username).single();
  if (!player) return { success: false, message: 'Player not found' };

  const vipMultiplier = player.is_vip && player.vip_tier ? 1.5 : 1.0;
  const finalAmount = Math.floor(amount * vipMultiplier);

  await supabase.from('players').update({ research_points: (player.research_points || 0) + finalAmount }).eq('username', username);
  await supabase.from('player_rp_history').insert({ player_username: username, amount: finalAmount, reason, balance: (player.research_points || 0) + finalAmount });

  return { success: true, message: `Awarded ${finalAmount} RP`, rpAwarded: finalAmount, vipBonusApplied: vipMultiplier > 1, newBalance: (player.research_points || 0) + finalAmount };
}

export async function trackDailyHarvest(
  username: string, resetPeriod: string
): Promise<{ success: boolean; message: string; harvestCount: number; milestoneReached: boolean; rpAwarded?: number; milestoneThreshold?: number }> {
  const supabase = createServiceClient();
  const date = resetPeriod.substring(0, 10);

  const { data: rows } = await supabase.from('daily_harvest_progress').select('*').eq('username', username).eq('harvest_date', date);

  const existing = rows?.[0];
  const currentCount = (existing?.harvest_count || 0) + 1;
  const completedMilestones: number[] = existing?.milestones_completed || [];

  const thresholds = Object.keys(DAILY_HARVEST_MILESTONES).map(Number).sort((a, b) => a - b);
  let milestoneReached = false;
  let rpAwarded: number | undefined;
  let reachedThreshold: number | undefined;

  for (const threshold of thresholds) {
    if (currentCount >= threshold && !completedMilestones.includes(threshold)) {
      rpAwarded = DAILY_HARVEST_MILESTONES[threshold];
      reachedThreshold = threshold;
      await awardRP(username, rpAwarded, 'harvest_milestone', `Milestone: ${threshold} harvests`);
      completedMilestones.push(threshold);
      milestoneReached = true;
      break;
    }
  }

  if (existing) {
    await supabase.from('daily_harvest_progress').update({ harvest_count: currentCount, milestones_completed: completedMilestones, total_rp_earned: (existing.total_rp_earned || 0) + (rpAwarded || 0) }).eq('id', existing.id);
  } else {
    await supabase.from('daily_harvest_progress').insert({ username, harvest_date: date, harvest_count: currentCount, milestones_completed: completedMilestones, total_rp_earned: rpAwarded || 0 });
  }

  return { success: true, message: 'Harvest tracked', harvestCount: currentCount, milestoneReached, rpAwarded, milestoneThreshold: reachedThreshold };
}

export async function getDailyHarvestProgress(username: string): Promise<{ harvestCount: number; milestones: number[] }> {
  const supabase = createServiceClient();
  const today = new Date().toISOString().substring(0, 10);
  const { data } = await supabase.from('daily_harvest_progress').select('*').eq('username', username).eq('harvest_date', today);
  const progress = data?.[0];
  return { harvestCount: progress?.harvest_count || 0, milestones: progress?.milestones_completed || [] };
}

export const checkDailyHarvestMilestone = trackDailyHarvest;

export async function spendRP(username: string, amount: number, reason: string): Promise<{ success: boolean; message: string; newBalance?: number }> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('research_points').eq('username', username).single();
  if (!player || (player.research_points || 0) < amount) return { success: false, message: 'Insufficient RP' };
  const newBal = player.research_points - amount;
  await supabase.from('players').update({ research_points: newBal }).eq('username', username);
  await supabase.from('player_rp_history').insert({ player_username: username, amount: -amount, reason, balance: newBal });
  return { success: true, message: `Spent ${amount} RP`, newBalance: newBal };
}
