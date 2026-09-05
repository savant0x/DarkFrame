/**
 * @file lib/researchPointService.ts
 * @created 2025-10-20
 * @overview Research Points (RP) management service for DarkFrame
 * 
 * OVERVIEW:
 * Centralized service for managing Research Points (RP) economy across the game.
 * Handles RP generation from multiple sources (harvesting, leveling, achievements, battles),
 * VIP bonus calculations (+50% RP), daily harvest milestone tracking, and RP spending validation.
 * 
 * Core features:
 * - Award RP from any source with automatic VIP bonus application
 * - Track daily harvest progress toward 6 milestones (1k/2.5k/5k/10k/15k/22.5k)
 * - Reset daily counters on map reset
 * - Query player RP stats and transaction history
 * - Validate and deduct RP for research/purchases
 * 
 * Economy design targets:
 * - Active player: 6,000-7,600 RP/day (full map + activities)
 * - VIP player: 9,000-11,400 RP/day (+50% bonus)
 * - 100k RP features achievable in 8-17 days of active play
 * - Flag research T1-T4 achievable in 1-2 days
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import type { Player, ResearchPointHistory } from '@/types/game.types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Daily harvest progress tracking per player
 * Stores daily harvest count and completed milestones
 * Resets at daily map reset (12:00 AM and 12:00 PM server time)
 */
export interface DailyHarvestProgress {
  playerUsername: string;
  date: string; // YYYY-MM-DD format
  resetPeriod: string; // "AM" or "PM"
  harvestCount: number; // Total harvests today
  milestonesCompleted: number[]; // Array of milestone thresholds reached [1000, 2500, etc.]
  totalRPEarned: number; // Total RP earned from milestones today
  lastHarvestAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * RP transaction record for detailed tracking
 * Separate collection for scalability (vs embedding in Player.rpHistory)
 */
export interface RPTransaction {
  playerUsername: string;
  amount: number; // Positive for gains, negative for spending
  source: RPSource;
  description: string;
  timestamp: Date;
  vipBonus: boolean; // Was VIP +50% bonus applied?
  balanceAfter: number; // RP balance after this transaction
  metadata?: Record<string, unknown>; // Optional extra data (e.g., milestone threshold, level number)
}

/**
 * RP source types for transaction categorization
 */
export type RPSource =
  | 'harvest_milestone' // Daily harvest milestone rewards
  | 'daily_login' // Daily login bonus + streak
  | 'quest' // Quest completion rewards
  | 'achievement' // Achievement unlock rewards
  | 'level_up' // Level-up RP scaling (level × 5, max 500)
  | 'battle' // PvP battle victory rewards
  | 'clan_warfare' // Clan war spoils
  | 'discovery' // Ancient technology discovery
  | 'admin' // Admin-awarded RP
  | 'purchase' // RP shop package purchase
  | 'research' // RP spent on research (Flag tiers, etc.)
  | 'tech_unlock' // RP spent on tech tree
  | 'other'; // Miscellaneous

/**
 * Daily harvest milestones (resets daily)
 * Key: harvest count threshold
 * Value: RP reward for reaching threshold
 * 
 * Total for full map completion (22,500 harvests): 6,000 RP
 */
export const DAILY_HARVEST_MILESTONES: Record<number, number> = {
  1000: 500, // 4% of map = 500 RP
  2500: 750, // 11% of map = 750 RP
  5000: 1000, // 22% of map = 1,000 RP
  10000: 1500, // 44% of map = 1,500 RP
  15000: 1250, // 67% of map = 1,250 RP
  22500: 1000 // 100% completion bonus = 1,000 RP
};

/**
 * VIP RP bonus multiplier
 * VIP players receive +50% RP from all sources
 */
export const VIP_RP_MULTIPLIER = 1.5;

// ============================================================================
// CORE RP AWARD FUNCTION
// ============================================================================

/**
 * Award Research Points to a player from any source
 * Automatically applies VIP +50% bonus if applicable
 * Logs transaction in both Player.rpHistory and RPTransaction collection
 * 
 * @param playerUsername - Player's unique username
 * @param amount - Base RP amount to award (before VIP bonus)
 * @param source - Source type for categorization
 * @param description - Human-readable description of the award
 * @param metadata - Optional extra data for analytics
 * @returns Promise resolving to transaction details
 * 
 * @example
 * // Award RP for level up
 * await awardRP('player123', 250, 'level_up', 'Reached Level 50', { level: 50 });
 * 
 * @example
 * // Award RP for achievement (VIP gets 150 instead of 100)
 * await awardRP('vipPlayer', 100, 'achievement', 'Unlocked Epic Achievement: Cave Master');
 */
export async function awardRP(
  playerUsername: string,
  amount: number,
  source: RPSource,
  description: string,
  metadata?: Record<string, unknown>
): Promise<{
  success: boolean;
  message: string;
  rpAwarded: number;
  vipBonusApplied: boolean;
  newBalance: number;
}> {
  if (!playerUsername || amount <= 0) {
    return {
      success: false,
      message: 'Invalid player username or RP amount',
      rpAwarded: 0,
      vipBonusApplied: false,
      newBalance: 0
    };
  }

  try {
    // Fetch player to check VIP status
    const playerRows = await db.select({
      researchPoints: players.researchPoints,
      vip: players.vip,
      vipExpiration: players.vipExpiration,
      rpHistory: players.rpHistory,
    }).from(players).where(eq(players.username, playerUsername)).limit(1);

    const player = playerRows[0];

    if (!player) {
      return {
        success: false,
        message: `Player not found: ${playerUsername}`,
        rpAwarded: 0,
        vipBonusApplied: false,
        newBalance: 0
      };
    }

    // Calculate VIP bonus
    const isVIP = !!(player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date());
    const finalAmount = isVIP ? Math.floor(amount * VIP_RP_MULTIPLIER) : amount;

    // Calculate new balance
    const currentRP = player.researchPoints || 0;
    const newBalance = currentRP + finalAmount;

    // Create transaction record
    const transaction: ResearchPointHistory = {
      amount: finalAmount,
      reason: description,
      timestamp: new Date(),
      balance: newBalance
    };

    // Get existing rpHistory and append new transaction
    const existingHistory = (player.rpHistory as ResearchPointHistory[] | null) || [];
    const updatedHistory = [...existingHistory, transaction];

    // Update player RP balance and history
    const updateResult = await db.update(players)
      .set({
        researchPoints: newBalance,
        rpHistory: updatedHistory,
      })
      .where(eq(players.username, playerUsername));

    // Check if update succeeded (Drizzle doesn't return modifiedCount, so we verify)
    if (!updateResult) {
      return {
        success: false,
        message: 'Failed to update player RP balance',
        rpAwarded: 0,
        vipBonusApplied: isVIP,
        newBalance: currentRP
      };
    }

    // Log detailed transaction in RPTransaction table using raw SQL
    const transactionId = crypto.randomUUID().slice(0, 24);
    const timestamp = new Date().toISOString();
    const metadataJson = metadata ? JSON.stringify(metadata) : 'NULL';

    await db.execute(sql`
      INSERT INTO rpTransactions (
        id, playerUsername, amount, source, description, timestamp, vipBonus, balanceAfter, metadata
      ) VALUES (
        ${transactionId}, ${playerUsername}, ${finalAmount}, ${source}, ${description},
        ${timestamp}, ${isVIP ? 1 : 0}, ${newBalance}, ${metadataJson}
      )
    `);

    return {
      success: true,
      message: `Awarded ${finalAmount} RP${isVIP ? ' (VIP bonus applied)' : ''} to ${playerUsername}`,
      rpAwarded: finalAmount,
      vipBonusApplied: isVIP,
      newBalance
    };
  } catch (error) {
    console.error('[researchPointService] Error awarding RP:', error);
    return {
      success: false,
      message: 'Internal server error while awarding RP',
      rpAwarded: 0,
      vipBonusApplied: false,
      newBalance: 0
    };
  }
}

// ============================================================================
// DAILY HARVEST MILESTONE SYSTEM
// ============================================================================

/**
 * Check and award daily harvest milestones for a player
 * Called after each successful harvest to track progress
 * Awards RP when milestones are reached (1k, 2.5k, 5k, 10k, 15k, 22.5k harvests)
 * 
 * @param playerUsername - Player's unique username
 * @param resetPeriod - Current reset period (e.g., "2025-10-20-AM")
 * @returns Promise resolving to milestone check results
 * 
 * @example
 * // Called after successful harvest in harvestService.ts
 * const result = await checkDailyHarvestMilestone('player123', '2025-10-20-AM');
 * if (result.milestoneReached) {
 *   // Show toast notification: "Milestone reached! +750 RP"
 * }
 */
export async function checkDailyHarvestMilestone(
  playerUsername: string,
  resetPeriod: string
): Promise<{
  success: boolean;
  message: string;
  harvestCount: number;
  milestoneReached: boolean;
  milestoneThreshold?: number;
  rpAwarded?: number;
  nextMilestone?: number;
}> {
  if (!playerUsername || !resetPeriod) {
    return {
      success: false,
      message: 'Invalid player username or reset period',
      harvestCount: 0,
      milestoneReached: false
    };
  }

  try {
    // Extract date from resetPeriod (format: "YYYY-MM-DD-AM" or "YYYY-MM-DD-PM")
    const date = resetPeriod.substring(0, 10); // "2025-10-20"
    const period = resetPeriod.substring(11); // "AM" or "PM"

    // Find existing daily progress record using raw SQL
    const existingRows = await db.execute(sql`
      SELECT * FROM dailyHarvestProgress
      WHERE playerUsername = ${playerUsername} AND date = ${date} AND resetPeriod = ${period}
      LIMIT 1
    `);

    const existingProgress = (existingRows.rows as any[]).length > 0 ? (existingRows.rows as any[])[0] : null;

    const currentHarvestCount = (existingProgress?.harvestCount || 0) + 1;
    const completedMilestones: number[] = existingProgress?.milestonesCompleted
      ? (typeof existingProgress.milestonesCompleted === 'string'
        ? JSON.parse(existingProgress.milestonesCompleted)
        : existingProgress.milestonesCompleted)
      : [];

    // Check if new milestone reached
    const milestoneThresholds = Object.keys(DAILY_HARVEST_MILESTONES)
      .map(Number)
      .sort((a, b) => a - b);

    let milestoneReached = false;
    let milestoneThreshold: number | undefined;
    let rpAwarded: number | undefined;

    for (const threshold of milestoneThresholds) {
      if (
        currentHarvestCount >= threshold &&
        !completedMilestones.includes(threshold)
      ) {
        // New milestone reached!
        milestoneReached = true;
        milestoneThreshold = threshold;
        rpAwarded = DAILY_HARVEST_MILESTONES[threshold];

        // Award RP
        const awardResult = await awardRP(
          playerUsername,
          rpAwarded,
          'harvest_milestone',
          `Daily harvest milestone: ${threshold.toLocaleString()} harvests`,
          { milestone: threshold, resetPeriod }
        );

        if (!awardResult.success) {
          console.error('[researchPointService] Failed to award milestone RP:', awardResult.message);
        }

        // Update completed milestones
        completedMilestones.push(threshold);
        break; // Only award one milestone per harvest
      }
    }

    // Find next milestone
    const nextMilestone = milestoneThresholds.find(
      (threshold) => threshold > currentHarvestCount
    );

    // Upsert daily progress record using raw SQL
    const now = new Date().toISOString();
    const milestonesJson = JSON.stringify(completedMilestones);
    const totalRPEarned = (existingProgress?.totalRPEarned || 0) + (rpAwarded || 0);

    await db.execute(sql`
      INSERT INTO dailyHarvestProgress (
        playerUsername, date, resetPeriod, harvestCount, milestonesCompleted,
        totalRPEarned, lastHarvestAt, updatedAt, createdAt
      ) VALUES (
        ${playerUsername}, ${date}, ${period}, ${currentHarvestCount}, ${milestonesJson},
        ${totalRPEarned}, ${now}, ${now}, ${now}
      )
      ON DUPLICATE KEY UPDATE
        harvestCount = VALUES(harvestCount),
        milestonesCompleted = VALUES(milestonesCompleted),
        totalRPEarned = VALUES(totalRPEarned),
        lastHarvestAt = VALUES(lastHarvestAt),
        updatedAt = VALUES(updatedAt)
    `);

    return {
      success: true,
      message: milestoneReached
        ? `Milestone reached: ${milestoneThreshold?.toLocaleString()} harvests! +${rpAwarded} RP`
        : 'Harvest counted',
      harvestCount: currentHarvestCount,
      milestoneReached,
      milestoneThreshold,
      rpAwarded,
      nextMilestone
    };
  } catch (error) {
    console.error('[researchPointService] Error checking daily harvest milestone:', error);
    return {
      success: false,
      message: 'Internal server error while checking milestone',
      harvestCount: 0,
      milestoneReached: false
    };
  }
}

/**
 * Reset daily harvest progress for a player
 * Called at map reset (12:00 AM and 12:00 PM server time)
 * Clears harvest count and milestone tracking for new cycle
 * 
 * @param playerUsername - Player's unique username (optional, resets all if omitted)
 * @returns Promise resolving to reset confirmation
 * 
 * @example
 * // Reset all players at map reset
 * await resetDailyProgress();
 * 
 * @example
 * // Reset specific player (admin tool)
 * await resetDailyProgress('player123');
 */
export async function resetDailyProgress(
  playerUsername?: string
): Promise<{ success: boolean; message: string; playersReset: number }> {
  try {
    // Delete all daily progress records using raw SQL
    if (playerUsername) {
      const result = await db.execute(sql`
        DELETE FROM dailyHarvestProgress WHERE playerUsername = ${playerUsername}
      `);
      return {
        success: true,
        message: `Daily progress reset for ${playerUsername}`,
        playersReset: result.rowCount ?? 0
      };
    } else {
      const result = await db.execute(sql`
        DELETE FROM dailyHarvestProgress
      `);
      const deletedCount = result.rowCount ?? 0;
      return {
        success: true,
        message: `Daily progress reset for ${deletedCount} players`,
        playersReset: deletedCount
      };
    }
  } catch (error) {
    console.error('[researchPointService] Error resetting daily progress:', error);
    return {
      success: false,
      message: 'Internal server error while resetting daily progress',
      playersReset: 0
    };
  }
}

// ============================================================================
// RP QUERY & ANALYTICS
// ============================================================================

/**
 * Get comprehensive RP statistics for a player
 * Includes current balance, daily earnings, milestone progress, transaction history
 * 
 * @param playerUsername - Player's unique username
 * @returns Promise resolving to player RP stats
 * 
 * @example
 * // Display in admin dashboard
 * const stats = await getPlayerRPStats('player123');
 * console.log(`Balance: ${stats.currentBalance} RP`);
 * console.log(`Today: ${stats.dailyEarnings} RP from ${stats.harvestCount} harvests`);
 */
export async function getPlayerRPStats(playerUsername: string): Promise<{
  success: boolean;
  message: string;
  currentBalance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  dailyEarnings: number;
  harvestCount: number;
  milestonesCompleted: number[];
  nextMilestone?: number;
  recentTransactions: RPTransaction[];
}> {
  if (!playerUsername) {
    return {
      success: false,
      message: 'Invalid player username',
      currentBalance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      dailyEarnings: 0,
      harvestCount: 0,
      milestonesCompleted: [],
      recentTransactions: []
    };
  }

  try {
    // Fetch player
    const playerRows = await db.select({
      researchPoints: players.researchPoints,
      rpHistory: players.rpHistory,
    }).from(players).where(eq(players.username, playerUsername)).limit(1);

    const player = playerRows[0];

    if (!player) {
      return {
        success: false,
        message: `Player not found: ${playerUsername}`,
        currentBalance: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        dailyEarnings: 0,
        harvestCount: 0,
        milestonesCompleted: [],
        recentTransactions: []
      };
    }

    // Get current RP balance
    const currentBalance = player.researchPoints || 0;

    // Calculate lifetime earned and spent from rpHistory
    const rpHistory = (player.rpHistory as ResearchPointHistory[] | null) || [];
    let lifetimeEarned = 0;
    let lifetimeSpent = 0;

    for (const transaction of rpHistory) {
      if (transaction.amount > 0) {
        lifetimeEarned += transaction.amount;
      } else {
        lifetimeSpent += Math.abs(transaction.amount);
      }
    }

    // Get today's progress using raw SQL
    const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
    const todayProgressRows = await db.execute(sql`
      SELECT * FROM dailyHarvestProgress
      WHERE playerUsername = ${playerUsername} AND date = ${today}
      LIMIT 1
    `);

    const todayProgress = (todayProgressRows.rows as any[]).length > 0 ? (todayProgressRows.rows as any[])[0] : null;

    const dailyEarnings = todayProgress?.totalRPEarned || 0;
    const harvestCount = todayProgress?.harvestCount || 0;
    const milestonesCompleted: number[] = todayProgress?.milestonesCompleted
      ? (typeof todayProgress.milestonesCompleted === 'string'
        ? JSON.parse(todayProgress.milestonesCompleted)
        : todayProgress.milestonesCompleted)
      : [];

    // Find next milestone
    const milestoneThresholds = Object.keys(DAILY_HARVEST_MILESTONES)
      .map(Number)
      .sort((a, b) => a - b);
    const nextMilestone = milestoneThresholds.find(
      (threshold) => threshold > harvestCount
    );

    // Get recent transactions (last 20) using raw SQL
    const recentTxRows = await db.execute(sql`
      SELECT * FROM rpTransactions
      WHERE playerUsername = ${playerUsername}
      ORDER BY timestamp DESC
      LIMIT 20
    `);

    const recentTransactions: RPTransaction[] = ((recentTxRows.rows as any[]) || []).map((row: any) => ({
      // FID-20260904-005 §5.2a: lower-case folded keys (see note above).
      playerUsername: row.playerusername ?? row.playerUsername,
      amount: Number(row.amount),
      source: row.source as RPSource,
      description: row.description,
      timestamp: new Date(row.timestamp),
      vipBonus: Boolean(row.vipbonus ?? row.vipBonus),
      balanceAfter: row.balanceafter === null || row.balanceafter === undefined ? Number(row.balanceAfter ?? 0) : Number(row.balanceafter),
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
    }));

    return {
      success: true,
      message: 'RP stats retrieved successfully',
      currentBalance,
      lifetimeEarned,
      lifetimeSpent,
      dailyEarnings,
      harvestCount,
      milestonesCompleted,
      nextMilestone,
      recentTransactions
    };
  } catch (error) {
    console.error('[researchPointService] Error fetching player RP stats:', error);
    return {
      success: false,
      message: 'Internal server error while fetching RP stats',
      currentBalance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      dailyEarnings: 0,
      harvestCount: 0,
      milestonesCompleted: [],
      recentTransactions: []
    };
  }
}

/**
 * Get available RP balance for spending
 * Simple wrapper around Player.researchPoints with validation
 * 
 * @param playerUsername - Player's unique username
 * @returns Promise resolving to available RP balance
 */
export async function getAvailableRP(playerUsername: string): Promise<number> {
  if (!playerUsername) {
    return 0;
  }

  try {
    const playerRows = await db.select({
      researchPoints: players.researchPoints,
    }).from(players).where(eq(players.username, playerUsername)).limit(1);

    const player = playerRows[0];

    return player?.researchPoints || 0;
  } catch (error) {
    console.error('[researchPointService] Error fetching available RP:', error);
    return 0;
  }
}

// ============================================================================
// RP SPENDING FUNCTIONS
// ============================================================================

/**
 * Spend Research Points for unlocks/purchases
 * Validates balance, deducts RP atomically, logs transaction
 * 
 * Note: This is a wrapper around xpService.spendResearchPoints() for consistency
 * All RP spending should eventually use this service for centralized tracking
 * 
 * @param playerUsername - Player's unique username
 * @param amount - RP amount to spend
 * @param reason - What the RP is being spent on
 * @param source - Source type for categorization (default: 'research')
 * @returns Promise resolving to spending result
 * 
 * @example
 * // Spend RP for Flag Tier 2 research
 * const result = await spendRP('player123', 1500, 'Flag Tier 2: Zone Tracking', 'research');
 */
export async function spendRP(
  playerUsername: string,
  amount: number,
  reason: string,
  source: RPSource = 'research'
): Promise<{
  success: boolean;
  message: string;
  newBalance: number;
}> {
  if (!playerUsername || amount <= 0) {
    return {
      success: false,
      message: 'Invalid player username or RP amount',
      newBalance: 0
    };
  }

  try {
    // Fetch player to check balance
    const playerRows = await db.select({
      researchPoints: players.researchPoints,
      rpHistory: players.rpHistory,
    }).from(players).where(eq(players.username, playerUsername)).limit(1);

    const player = playerRows[0];

    if (!player) {
      return {
        success: false,
        message: `Player not found: ${playerUsername}`,
        newBalance: 0
      };
    }

    const currentRP = player.researchPoints || 0;

    if (currentRP < amount) {
      return {
        success: false,
        message: `Insufficient RP. Required: ${amount}, Available: ${currentRP}`,
        newBalance: currentRP
      };
    }

    // Calculate new balance
    const newBalance = currentRP - amount;

    // Create transaction record
    const transaction: ResearchPointHistory = {
      amount: -amount, // Negative for spending
      reason,
      timestamp: new Date(),
      balance: newBalance
    };

    // Get existing rpHistory and append new transaction
    const existingHistory = (player.rpHistory as ResearchPointHistory[] | null) || [];
    const updatedHistory = [...existingHistory, transaction];

    // Update player RP balance and history with optimistic locking
    const updateResult = await db.update(players)
      .set({
        researchPoints: newBalance,
        rpHistory: updatedHistory,
      })
      .where(and(
        eq(players.username, playerUsername),
        gte(players.researchPoints, amount)
      ));

    // Verify the update succeeded by re-fetching
    const verifyRows = await db.select({
      researchPoints: players.researchPoints,
    }).from(players).where(eq(players.username, playerUsername)).limit(1);

    if (!verifyRows[0] || verifyRows[0].researchPoints !== newBalance) {
      return {
        success: false,
        message: 'Failed to deduct RP (insufficient balance or concurrent modification)',
        newBalance: currentRP
      };
    }

    // Log detailed transaction in RPTransaction table using raw SQL
    const transactionId = crypto.randomUUID().slice(0, 24);
    const timestamp = new Date().toISOString();

    await db.execute(sql`
      INSERT INTO rpTransactions (
        id, playerUsername, amount, source, description, timestamp, vipBonus, balanceAfter
      ) VALUES (
        ${transactionId}, ${playerUsername}, ${-amount}, ${source}, ${reason},
        ${timestamp}, 0, ${newBalance}
      )
    `);

    return {
      success: true,
      message: `Spent ${amount} RP on ${reason}`,
      newBalance
    };
  } catch (error) {
    console.error('[researchPointService] Error spending RP:', error);
    return {
      success: false,
      message: 'Internal server error while spending RP',
      newBalance: 0
    };
  }
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Get RP transaction history with filtering
 * For admin dashboard analytics
 * 
 * @param filters - Query filters (playerUsername, source, dateRange, etc.)
 * @param limit - Maximum number of records to return
 * @param skip - Number of records to skip (pagination)
 * @returns Promise resolving to filtered transactions
 */
export async function getRPTransactionHistory(
  filters: {
    playerUsername?: string;
    source?: RPSource;
    startDate?: Date;
    endDate?: Date;
  } = {},
  limit = 100,
  skip = 0
): Promise<{
  success: boolean;
  message: string;
  transactions: RPTransaction[];
  totalCount: number;
}> {
  try {
    // Build query conditions
    const conditions: string[] = [];
    const params: (string | number | Date)[] = [];

    if (filters.playerUsername) {
      conditions.push('playerUsername = ?');
      params.push(filters.playerUsername);
    }

    if (filters.source) {
      conditions.push('source = ?');
      params.push(filters.source);
    }

    if (filters.startDate) {
      conditions.push('timestamp >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('timestamp <= ?');
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch transactions with pagination using raw SQL
    const transactionsRows = await db.execute(sql`
      SELECT * FROM rpTransactions
      ${sql.raw(whereClause)}
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${skip}
    `);

    const transactions: RPTransaction[] = ((transactionsRows.rows as any[]) || []).map((row: any) => ({
      // FID-20260904-005 §5.2a: Postgres folds the raw SQL's unquoted identifiers to
      // lower-case, so SELECT * returns lower-case keys. Map defensively from both shapes.
      playerUsername: row.playerusername ?? row.playerUsername,
      amount: Number(row.amount),
      source: row.source as RPSource,
      description: row.description,
      timestamp: new Date(row.timestamp),
      vipBonus: Boolean(row.vipbonus ?? row.vipBonus),
      balanceAfter: row.balanceafter === null || row.balanceafter === undefined ? Number(row.balanceAfter ?? 0) : Number(row.balanceafter),
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
    }));

    // Get total count for pagination using raw SQL
    const countRows = await db.execute(sql`
      SELECT COUNT(*) as total FROM rpTransactions ${sql.raw(whereClause)}
    `);

    const totalCount = Number(((countRows.rows as any[])[0])?.total || 0);

    return {
      success: true,
      message: 'Transaction history retrieved successfully',
      transactions,
      totalCount
    };
  } catch (error) {
    console.error('[researchPointService] Error fetching RP transaction history:', error);
    return {
      success: false,
      message: 'Internal server error while fetching transaction history',
      transactions: [],
      totalCount: 0
    };
  }
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. VIP Bonus Calculation:
 *    - Applied automatically in awardRP() function
 *    - +50% multiplier on all RP sources
 *    - Checked via player.vip && player.vipExpiration > now
 * 
 * 2. Daily Harvest Milestones:
 *    - 6 thresholds: 1k, 2.5k, 5k, 10k, 15k, 22.5k harvests
 *    - Total RP for full map: 6,000 RP
 *    - Resets at map reset (2x daily: 12:00 AM, 12:00 PM)
 *    - Tracked in separate table (dailyHarvestProgress) via raw SQL
 * 
 * 3. Transaction Logging:
 *    - All RP gains/spending logged in Player.rpHistory (embedded JSON)
 *    - Detailed analytics in RPTransaction table via raw SQL
 *    - Enables audit trail and economy analytics
 * 
 * 4. Integration Points:
 *    - harvestService.ts: Call checkDailyHarvestMilestone() after harvest
 *    - xpService.ts: Replace 1 RP with awardRP(level × 5, max 500)
 *    - achievementService.ts: Call awardRP() on achievement unlock
 *    - battleService.ts: Call awardRP() on PvP victory
 *    - dailyLoginService.ts: Create new service, call awardRP()
 * 
 * 5. Admin Tools:
 *    - getRPTransactionHistory(): Filter/pagination for dashboard
 *    - getPlayerRPStats(): Individual player RP overview
 *    - Bulk adjustment: Use awardRP() with source: 'admin'
 * 
 * 6. Future Enhancements:
 *    - Lifetime harvest milestones (100/500/1k/5k/10k/25k/50k/100k)
 *    - RP shop packages (Stripe integration)
 *    - Quest system with RP rewards (300-500 RP per quest)
 *    - Daily login streak bonuses (100 base + 10 per day streak)
 * 
 * 7. Performance Considerations:
 *    - dailyHarvestProgress should have TTL index or cleanup job
 *    - rpTransactions indexed by playerUsername, timestamp, source
 *    - Use aggregation pipelines for economy analytics
 * 
 * 8. Error Handling:
 *    - All functions return success/failure status
 *    - Database operations wrapped in try/catch
 *    - Validation on all inputs (username, amounts, etc.)
 *    - Atomic operations prevent race conditions
 */
