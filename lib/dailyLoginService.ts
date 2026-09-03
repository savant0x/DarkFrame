/**
 * @file lib/dailyLoginService.ts
 * @created 2025-10-20
 * @overview Daily Login Reward System with Streak Bonuses
 * 
 * OVERVIEW:
 * Manages daily login rewards including base RP awards and streak bonuses.
 * Tracks consecutive login days and awards increasing bonuses for maintaining
 * streaks. Resets streak if player misses a day (24+ hours since last login).
 * 
 * REWARD STRUCTURE:
 * - Base Daily RP: 100 RP per day
 * - Streak Bonus: +10 RP per consecutive day (capped at 7 days = +70 RP max)
 * - VIP Bonus: +50% on all daily login RP (applied via awardRP)
 * - Maximum Daily Login RP: 170 RP (255 RP for VIP with +50% bonus)
 * 
 * STREAK MECHANICS:
 * - Day 1: 100 RP base
 * - Day 2: 100 RP base + 10 RP streak = 110 RP
 * - Day 3: 100 RP base + 20 RP streak = 120 RP
 * - Day 7+: 100 RP base + 70 RP streak = 170 RP (capped)
 * - Miss 24 hours: Streak resets to 0
 * 
 * DATABASE SCHEMA:
 * Player.lastLoginDate: Date | undefined - Last time player logged in
 * Player.loginStreak: number - Consecutive days logged in (0-7+)
 * Player.lastStreakReward: Date | undefined - Last time streak reward claimed
 */

import { getCollection } from './mongodb';
import { Player } from '@/types';
import { awardRP } from './researchPointService';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Base RP awarded for daily login */
const BASE_DAILY_RP = 100;

/** RP bonus per consecutive day */
const STREAK_BONUS_PER_DAY = 10;

/** Maximum streak days for bonus calculation (7 days = +70 RP max) */
const MAX_STREAK_DAYS = 7;

/** Hours until streak breaks (24 hours = 1 day) */
const STREAK_BREAK_HOURS = 24;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Result of checking daily login
 */
export interface DailyLoginResult {
  success: boolean;
  message: string;
  rewardClaimed: boolean;
  rpAwarded?: number;
  vipBonusApplied?: boolean;
  currentStreak?: number;
  nextRewardIn?: number; // Hours until next reward available
  streakBroken?: boolean;
}

/**
 * Player's daily login status
 */
export interface LoginStatus {
  lastLogin: Date | null;
  currentStreak: number;
  lastRewardDate: Date | null;
  canClaimReward: boolean;
  hoursUntilNextReward: number;
  streakAtRisk: boolean; // True if within 4 hours of breaking streak
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Check and award daily login reward
 * Awards base RP plus streak bonus if eligible
 * Updates player's last login date and streak count
 * 
 * @param username - Player username
 * @returns Daily login result with RP award details
 * 
 * @example
 * const result = await checkDailyLogin('player123');
 * if (result.rewardClaimed) {
 *   console.log(`Claimed ${result.rpAwarded} RP! Current streak: ${result.currentStreak} days`);
 * }
 */
export async function checkDailyLogin(username: string): Promise<DailyLoginResult> {
  try {
    const playersCollection = await getCollection<Player>('players');
    
    // Get player data
    const player = await playersCollection.findOne({ username });
    
    if (!player) {
      return {
        success: false,
        message: 'Player not found',
        rewardClaimed: false
      };
    }

    const now = new Date();
    const lastLogin = player.lastLoginDate ? new Date(player.lastLoginDate) : null;
    const lastReward = player.lastStreakReward ? new Date(player.lastStreakReward) : null;
    
    // Calculate hours since last login
    const hoursSinceLastLogin = lastLogin 
      ? (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60)
      : Infinity;
    
    // Calculate hours since last reward
    const hoursSinceLastReward = lastReward
      ? (now.getTime() - lastReward.getTime()) / (1000 * 60 * 60)
      : Infinity;

    // Check if reward already claimed today
    if (hoursSinceLastReward < 24) {
      const hoursRemaining = 24 - hoursSinceLastReward;
      return {
        success: true,
        message: 'Daily reward already claimed',
        rewardClaimed: false,
        currentStreak: player.loginStreak || 0,
        nextRewardIn: hoursRemaining
      };
    }

    // Determine if streak continues or breaks
    let newStreak = player.loginStreak || 0;
    let streakBroken = false;

    if (hoursSinceLastLogin >= STREAK_BREAK_HOURS) {
      // Streak broken - reset to day 1
      if (newStreak > 0) {
        streakBroken = true;
        console.log(`⚠️ Login streak broken for ${username} (was ${newStreak} days)`);
      }
      newStreak = 1; // Start new streak
    } else {
      // Streak continues - increment
      newStreak += 1;
    }

    // Cap streak at maximum for bonus calculation
    const effectiveStreak = Math.min(newStreak, MAX_STREAK_DAYS);
    
    // Calculate RP reward: base + streak bonus
    const streakBonus = (effectiveStreak - 1) * STREAK_BONUS_PER_DAY; // Day 1 = 0 bonus
    const totalRP = BASE_DAILY_RP + streakBonus;

    // Award RP via researchPointService (applies VIP bonus automatically)
    const result = await awardRP(
      username,
      totalRP,
      'daily_login',
      `Daily login reward (${effectiveStreak} day streak)`,
      {
        streakDays: effectiveStreak,
        streakBonus,
        baseRP: BASE_DAILY_RP,
        streakBroken
      }
    );

    if (!result.success) {
      console.error('❌ Failed to award daily login RP:', result.message);
      return {
        success: false,
        message: 'Failed to award daily reward',
        rewardClaimed: false
      };
    }

    // Update player's login tracking
    await playersCollection.updateOne(
      { username },
      {
        $set: {
          lastLoginDate: now,
          lastStreakReward: now,
          loginStreak: newStreak
        }
      }
    );

    console.log(`🎁 Daily login! ${username} claimed ${result.rpAwarded} RP (streak: ${newStreak} days, VIP: ${result.vipBonusApplied})`);

    return {
      success: true,
      message: `Daily reward claimed! +${result.rpAwarded} RP`,
      rewardClaimed: true,
      rpAwarded: result.rpAwarded,
      vipBonusApplied: result.vipBonusApplied,
      currentStreak: newStreak,
      streakBroken
    };

  } catch (error) {
    console.error('❌ Error in checkDailyLogin:', error);
    return {
      success: false,
      message: 'Failed to process daily login',
      rewardClaimed: false
    };
  }
}

/**
 * Get player's current login status
 * Returns streak information and reward eligibility
 * 
 * @param username - Player username
 * @returns Login status with streak details
 * 
 * @example
 * const status = await getLoginStatus('player123');
 * if (status.canClaimReward) {
 *   console.log('Reward available!');
 * } else {
 *   console.log(`Next reward in ${status.hoursUntilNextReward} hours`);
 * }
 */
export async function getLoginStatus(username: string): Promise<LoginStatus> {
  try {
    const playersCollection = await getCollection<Player>('players');
    
    const player = await playersCollection.findOne({ username });
    
    if (!player) {
      return {
        lastLogin: null,
        currentStreak: 0,
        lastRewardDate: null,
        canClaimReward: true,
        hoursUntilNextReward: 0,
        streakAtRisk: false
      };
    }

    const now = new Date();
    const lastLogin = player.lastLoginDate ? new Date(player.lastLoginDate) : null;
    const lastReward = player.lastStreakReward ? new Date(player.lastStreakReward) : null;
    
    const hoursSinceLastLogin = lastLogin 
      ? (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60)
      : Infinity;
    
    const hoursSinceLastReward = lastReward
      ? (now.getTime() - lastReward.getTime()) / (1000 * 60 * 60)
      : Infinity;

    // Can claim if 24+ hours since last reward
    const canClaimReward = hoursSinceLastReward >= 24;
    const hoursUntilNextReward = canClaimReward ? 0 : Math.ceil(24 - hoursSinceLastReward);
    
    // Streak at risk if within 4 hours of breaking (20-24 hours since last login)
    const streakAtRisk = hoursSinceLastLogin >= 20 && hoursSinceLastLogin < 24;

    return {
      lastLogin,
      currentStreak: player.loginStreak || 0,
      lastRewardDate: lastReward,
      canClaimReward,
      hoursUntilNextReward,
      streakAtRisk
    };

  } catch (error) {
    console.error('❌ Error in getLoginStatus:', error);
    return {
      lastLogin: null,
      currentStreak: 0,
      lastRewardDate: null,
      canClaimReward: false,
      hoursUntilNextReward: 24,
      streakAtRisk: false
    };
  }
}

/**
 * Update player's last login timestamp
 * Call this on every session start to track login times
 * Does NOT award rewards - use checkDailyLogin for that
 * 
 * @param username - Player username
 * @returns Success status
 * 
 * @example
 * // Call on WebSocket connection or session initialization
 * await updateLastLogin('player123');
 */
export async function updateLastLogin(username: string): Promise<boolean> {
  try {
    const playersCollection = await getCollection<Player>('players');
    
    await playersCollection.updateOne(
      { username },
      {
        $set: {
          lastLoginDate: new Date()
        }
      }
    );

    return true;

  } catch (error) {
    console.error('❌ Error updating last login:', error);
    return false;
  }
}

/**
 * Reset player's login streak (admin use)
 * Useful for testing or correcting streak issues
 * 
 * @param username - Player username
 * @returns Success status
 */
export async function resetLoginStreak(username: string): Promise<boolean> {
  try {
    const playersCollection = await getCollection<Player>('players');
    
    await playersCollection.updateOne(
      { username },
      {
        $set: {
          loginStreak: 0
        }
      }
    );

    console.log(`🔄 Login streak reset for ${username}`);
    return true;

  } catch (error) {
    console.error('❌ Error resetting login streak:', error);
    return false;
  }
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * INTEGRATION POINTS:
 * 
 * 1. Session Initialization:
 *    - Call updateLastLogin() when player connects via WebSocket
 *    - Call getLoginStatus() to show reward availability in UI
 * 
 * 2. Daily Reward UI:
 *    - Create /app/game/daily-reward button/modal
 *    - Show current streak, next reward time, RP amount
 *    - Call checkDailyLogin() when player clicks "Claim Reward"
 * 
 * 3. Streak Notifications:
 *    - Show notification when streak at risk (20+ hours since last login)
 *    - Show celebration when reaching 7-day streak milestone
 *    - Show "streak broken" message if player misses a day
 * 
 * 4. Database Schema Updates Required:
 *    - Add lastLoginDate: Date field to Player schema
 *    - Add loginStreak: number field to Player schema
 *    - Add lastStreakReward: Date field to Player schema
 * 
 * 5. VIP Benefits:
 *    - VIP automatically gets +50% daily login RP via awardRP function
 *    - Example: 7-day streak = 170 RP base, 255 RP for VIP
 * 
 * FUTURE ENHANCEMENTS:
 * - Milestone rewards (7 days, 30 days, 90 days)
 * - Special event multipliers (2x RP weekends)
 * - Streak recovery tokens (VIP feature)
 * - Leaderboard for longest streaks
 */
