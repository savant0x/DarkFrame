/**
 * @file lib/dailyLoginService.ts
 * @overview Daily Login Reward System — Supabase backend
 */

import { createServiceClient } from '@/lib/supabase/server';
import { awardRP } from './researchPointService';

export interface DailyLoginResult {
  success: boolean;
  message: string;
  rewardClaimed: boolean;
  rpAwarded?: number;
  vipBonusApplied?: boolean;
  currentStreak?: number;
  nextRewardIn?: number;
  streakBroken?: boolean;
}

export interface LoginStatus {
  lastLogin: Date | null;
  currentStreak: number;
  lastRewardDate: Date | null;
  canClaimReward: boolean;
  hoursUntilNextReward: number;
  streakAtRisk: boolean;
}

const BASE_DAILY_RP = 30;
const STREAK_BONUS_PER_DAY = 5;
const MAX_STREAK_DAYS = 7;
const STREAK_BREAK_HOURS = 24;

function playerColumns() { return 'username, last_login_date, last_streak_reward, login_streak, is_vip, vip_expiration' as const; }

export async function checkDailyLogin(username: string): Promise<DailyLoginResult> {
  try {
    const supabase = createServiceClient();
    const { data: player } = await supabase.from('players').select(playerColumns()).eq('username', username).single();
    if (!player) return { success: false, message: 'Player not found', rewardClaimed: false };

    const now = new Date();
    const lastLogin = player.last_login_date ? new Date(player.last_login_date) : null;
    const lastReward = player.last_streak_reward ? new Date(player.last_streak_reward) : null;
    const hoursSinceLastLogin = lastLogin ? (now.getTime() - lastLogin.getTime()) / 3600000 : Infinity;
    const hoursSinceLastReward = lastReward ? (now.getTime() - lastReward.getTime()) / 3600000 : Infinity;

    if (hoursSinceLastReward < 24) return { success: true, message: 'Daily reward already claimed', rewardClaimed: false, currentStreak: player.login_streak || 0, nextRewardIn: Math.ceil(24 - hoursSinceLastReward) };

    let newStreak = player.login_streak || 0;
    let streakBroken = false;
    if (hoursSinceLastLogin > STREAK_BREAK_HOURS) { streakBroken = newStreak > 0; newStreak = 1; }
    else { newStreak += 1; }

    const effectiveStreak = Math.min(newStreak, MAX_STREAK_DAYS);
    const streakBonus = (effectiveStreak - 1) * STREAK_BONUS_PER_DAY;
    const totalRP = BASE_DAILY_RP + streakBonus;

    const result = await awardRP(username, totalRP, 'daily_login', `Daily login reward (${effectiveStreak} day streak)`, { streakDays: effectiveStreak, streakBonus, baseRP: BASE_DAILY_RP, streakBroken });

    if (!result.success) return { success: false, message: 'Failed to award daily reward', rewardClaimed: false };

    await supabase.from('players').update({ last_login_date: now.toISOString(), last_streak_reward: now.toISOString(), login_streak: newStreak }).eq('username', username);

    return { success: true, message: `Daily reward claimed! +${result.rpAwarded} RP`, rewardClaimed: true, rpAwarded: result.rpAwarded, vipBonusApplied: result.vipBonusApplied, currentStreak: newStreak, streakBroken };
  } catch (error) {
    console.error('checkDailyLogin error:', error);
    return { success: false, message: 'Failed to process daily login', rewardClaimed: false };
  }
}

export async function getLoginStatus(username: string): Promise<LoginStatus> {
  try {
    const supabase = createServiceClient();
    const { data: player } = await supabase.from('players').select(playerColumns()).eq('username', username).single();
    if (!player) return { lastLogin: null, currentStreak: 0, lastRewardDate: null, canClaimReward: true, hoursUntilNextReward: 0, streakAtRisk: false };

    const now = new Date();
    const lastLogin = player.last_login_date ? new Date(player.last_login_date) : null;
    const lastReward = player.last_streak_reward ? new Date(player.last_streak_reward) : null;
    const hoursSinceLastReward = lastReward ? (now.getTime() - lastReward.getTime()) / 3600000 : Infinity;
    const hoursSinceLastLogin = lastLogin ? (now.getTime() - lastLogin.getTime()) / 3600000 : Infinity;

    return { lastLogin, currentStreak: player.login_streak || 0, lastRewardDate: lastReward, canClaimReward: hoursSinceLastReward >= 24, hoursUntilNextReward: hoursSinceLastReward >= 24 ? 0 : Math.ceil(24 - hoursSinceLastReward), streakAtRisk: hoursSinceLastLogin >= 20 && hoursSinceLastLogin < 24 };
  } catch (error) {
    console.error('getLoginStatus error:', error);
    return { lastLogin: null, currentStreak: 0, lastRewardDate: null, canClaimReward: false, hoursUntilNextReward: 24, streakAtRisk: false };
  }
}

export async function updateLastLogin(username: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    await supabase.from('players').update({ last_login_date: new Date().toISOString() }).eq('username', username);
    return true;
  } catch (error) { console.error('updateLastLogin error:', error); return false; }
}

export async function resetLoginStreak(username: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    await supabase.from('players').update({ login_streak: 0 }).eq('username', username);
    return true;
  } catch (error) { console.error('resetLoginStreak error:', error); return false; }
}
