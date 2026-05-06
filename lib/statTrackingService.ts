/**
 * @file lib/statTrackingService.ts
 * @created 2025-01-17
 * @overview Automatic stat tracking for achievement progress — Supabase backend
 */

import { createServiceClient } from '@/lib/supabase/server';
import { checkAchievements } from './achievementService';

export async function trackBattleWon(username: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('stat_battles_won').eq('username', username).single();
  if (!player) return;
  await supabase.from('players').update({ stat_battles_won: (player.stat_battles_won || 0) + 1 }).eq('username', username);
  await checkAchievements(username);
}

export async function trackUnitBuilt(username: string, quantity: number = 1): Promise<void> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('stat_total_units_built').eq('username', username).single();
  if (!player) return;
  await supabase.from('players').update({ stat_total_units_built: (player.stat_total_units_built || 0) + quantity }).eq('username', username);
  await checkAchievements(username);
}

export async function trackResourcesGathered(username: string, amount: number): Promise<void> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('stat_total_resources_gathered').eq('username', username).single();
  if (!player) return;
  await supabase.from('players').update({ stat_total_resources_gathered: (player.stat_total_resources_gathered || 0) + amount }).eq('username', username);
  await checkAchievements(username);
}

export async function trackResourcesBanked(username: string, amount: number): Promise<void> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('stat_total_resources_banked').eq('username', username).single();
  if (!player) return;
  await supabase.from('players').update({ stat_total_resources_banked: (player.stat_total_resources_banked || 0) + amount }).eq('username', username);
  await checkAchievements(username);
}

export async function trackShrineTrade(username: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('stat_shrine_trade_count').eq('username', username).single();
  if (!player) return;
  await supabase.from('players').update({ stat_shrine_trade_count: (player.stat_shrine_trade_count || 0) + 1 }).eq('username', username);
  await checkAchievements(username);
}

export async function trackCaveExplored(username: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('stat_caves_explored').eq('username', username).single();
  if (!player) return;
  await supabase.from('players').update({ stat_caves_explored: (player.stat_caves_explored || 0) + 1 }).eq('username', username);
  await checkAchievements(username);
}

export async function triggerAchievementCheck(username: string): Promise<void> {
  await checkAchievements(username);
}
