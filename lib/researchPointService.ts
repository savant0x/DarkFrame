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
 * - Track daily harvest progress toward 5 census-anchored milestones
 *   (FID-20260912-058 Milestones v2 — 20%→100% of harvestable tiles)
 * - Reset daily counters on map reset
 * - Query player RP stats and transaction history
 * - Validate and deduct RP for research/purchases
 * 
 * Economy design targets (Milestones v2 — anchored to the live tile census):
 * - Every milestone is reachable by a dedicated human (the old 10k/15k/22.5k
 *   rungs exceeded the ~5,300 harvests/period physical ceiling)
 * - Base envelope: 4,300 RP/day full sweep; ×1.5 VIP; ×2 flag-bearer stack
 *   → 12,900 RP/day best case (sinks sized in FID-20260912-057/058)
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq, and, gte,  sql } from 'drizzle-orm';
import type {  ResearchPointHistory } from '@/types/game.types';

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

/** Row shape of the dailyharvestprogress table as returned by raw SELECT *
 *  (Postgres folds the service's unquoted camelCase identifiers to lower-case
 *  — FID-20260911-045: the code must read the FOLDED spellings, not the
 *  camelCase it writes, or counts silently reset every harvest). */
interface DailyHarvestProgressRow {
  harvestcount?: number;
  totalrpearned?: number;
  milestonescompleted?: string | number[];
}

/** Row shape of the rpTransactions table as returned by raw SELECT * — keys are
 *  defensively read from both Postgres-folded (lower-case) and original spellings. */
interface RPTransactionRow {
  playerusername?: string;
  playerUsername?: string;
  amount?: number | string;
  source?: string;
  description?: string;
  timestamp?: string | Date;
  vipbonus?: boolean;
  vipBonus?: boolean;
  balanceafter?: number | string | null;
  balanceAfter?: number | string | null;
  metadata?: string | Record<string, unknown>;
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
 * Daily harvest milestones (Milestones v2 — FID-20260912-056 proposal, shipped
 * in FID-20260912-058). Resets per AM/PM half-day period.
 * Key: harvest count threshold — anchored to the live tile census
 * (~10,871 harvestable tiles split into two ~5.3k half-day periods; rungs at
 * 20/40/60/80/100% of a period's ceiling, so every rung is human-reachable —
 * the old 10k/15k/22.5k tiers were physically impossible).
 * Value: RP reward for reaching threshold.
 *
 * Envelope: 2,150 RP per half-day period → 4,300 RP/day base; up to ~12,900/day
 * for a VIP flag-bearer doing a full sweep (×1.5 VIP ×2 flag stack).
 * Replaces the doc-era "7,750 RP full-map" figure (FID-20260906-006 P4), whose
 * curve rewarded only AutoFarm (3 of 6 tiers unreachable by humans).
 */
export const DAILY_HARVEST_MILESTONES: Record<number, number> = {
  1000: 200,  // 20% of harvestable tiles — every active player touches this
  2000: 300,  // 40% — a focused play session
  3000: 400,  // 60% — dedicated daily play
  4000: 500,  // 80% — near-full sweep
  5000: 750,  // 100% completion bonus — the full-map crown
};

/**
 * VIP RP bonus multiplier
 * VIP players receive +50% RP from all sources
 */
export const VIP_RP_MULTIPLIER = 1.5;

// ============================================================================
// GLOBAL DAILY RP CAP (FID-20260912-062 B3 — safety backstop)
// ============================================================================

/**
 * Backstop cap on total base RP earned per player per UTC day, across ALL
 * award sources. Rationale (FID-20260912-060): milestone income is
 * census-anchored, but battle/login/level streams had no global bound — a
 * raid loop could out-earn the entire milestone envelope in minutes. This cap
 * is insurance against ANY current or future unbounded income stream.
 *
 * Mechanics:
 * - Applies to the BASE amount (pre-VIP, pre-flag) — stacking multipliers
 *   still apply to whatever passes the clamp.
 * - 'admin' bypasses (operators grant exact amounts).
 * - Spending is unaffected — the cap throttles income only.
 * - Fail-open: if the ledger is unreachable, awards proceed (log + no cap).
 * - Ledger: rp_daily_totals (migration 0026), UTC day key, idempotent upsert.
 */
export const DAILY_RP_CAP = 25000;

/**
 * UTC day key for the daily cap ledger (e.g. "2026-09-12").
 * UTC is deliberate: deterministic across server timezones and matches the
 * cap's role as a fair-use backstop rather than a gameplay reset (milestones
 * own the AM/PM gameplay rhythm).
 */
export function getRPDayKey(now: Date = new Date()): string {
  return now.toISOString().substring(0, 10);
}

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
  /** Present when the B3 backstop was involved: base RP remaining under the cap AFTER this award. */
  dailyCapRemaining?: number;
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

    // Calculate VIP bonus (read first — the at-cap return reports it)
    const isVIP = !!(player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date());

    // FID-20260912-062 B3: global daily cap on BASE earnings. The clamp is
    // applied BEFORE the VIP/flag multiplier stack, so multipliers apply to
    // the granted amount as normal. 'admin' bypasses entirely (operators
    // grant exact amounts).
    let dailyCapRemaining: number | undefined;
    let grantedBase = amount;
    if (source !== 'admin') {
      try {
        const dayKey = getRPDayKey();
        const usedRows = await db.execute(sql`
          SELECT baserpedtoday FROM rp_daily_totals
          WHERE playerusername = ${playerUsername} AND daykey = ${dayKey}
          LIMIT 1
        `);
        const baseUsed = Number(usedRows.rows[0]?.baserpedtoday || 0);
        dailyCapRemaining = Math.max(0, DAILY_RP_CAP - baseUsed);

        if (dailyCapRemaining <= 0) {
          return {
            success: false,
            message: `Daily RP cap reached (${DAILY_RP_CAP}/day). Resets 00:00 UTC.`,
            rpAwarded: 0,
            vipBonusApplied: isVIP,
            newBalance: Number(player.researchPoints || 0),
            dailyCapRemaining: 0,
          };
        }

        if (amount > dailyCapRemaining) {
          console.warn(
            `[researchPointService] Daily RP cap clamp: ${playerUsername} requested ${amount}, granted ${dailyCapRemaining} (${source})`
          );
          grantedBase = dailyCapRemaining;
        }
      } catch (capError) {
        // Fail-open: a ledger outage must never block gameplay rewards.
        console.error('[researchPointService] Daily RP cap check failed (failing open):', capError);
        dailyCapRemaining = undefined;
      }

      // Report the envelope AFTER this award consumed its share.
      if (typeof dailyCapRemaining === 'number') {
        dailyCapRemaining = Math.max(0, dailyCapRemaining - grantedBase);
      }
    }

    // Multiplier stack applies to the (possibly clamped) granted base.
    let finalAmount = isVIP ? Math.floor(grantedBase * VIP_RP_MULTIPLIER) : grantedBase;

    // FID-20260906-001 §5.4: Flag bearer earns +100% RP (doc bonus stack).
    // Admin source is excluded — operators grant exact amounts.
    if (source !== 'admin') {
      try {
        const { isFlagBearer } = await import('@/lib/flagBonusService');
        if (await isFlagBearer(playerUsername)) finalAmount *= 2;
      } catch {
        // Never fail the RP award because of the flag check.
      }
    }

    // Calculate new balance
    const currentRP = player.researchPoints || 0;
    const newBalance = currentRP + finalAmount;

    // Create transaction record — FID-20260911-044: carry `source` in the
    // embedded history too (the rpTransactions audit table always had it, but
    // the per-player rpHistory never did, so admin per-source analytics from
    // rpHistory showed every transaction as null-source).
    const transaction: ResearchPointHistory & { source: RPSource } = {
      amount: finalAmount,
      source,
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
        id, playerUsername, amount, source, description, timestamp, vipBonus, balanceAfter, metadata, bypassedDailyCap
      ) VALUES (
        ${transactionId}, ${playerUsername}, ${finalAmount}, ${source}, ${description},
        ${timestamp}, ${isVIP ? 1 : 0}, ${newBalance}, ${metadataJson}, ${source === 'admin' ? 1 : 0}
      )
    `);

    // FID-20260912-062 B3: record BASE earnings in the daily cap ledger.
    // Idempotent upsert; lastWrite wins under the theoretical concurrent-award
    // race (B3 is a backstop, not an accounting system of record).
    if (source !== 'admin') {
      try {
        await db.execute(sql`
          INSERT INTO rp_daily_totals (playerusername, daykey, baserpedtoday, updatedat)
          VALUES (${playerUsername}, ${getRPDayKey()}, ${grantedBase}, NOW())
          ON CONFLICT (playerusername, daykey)
          DO UPDATE SET baserpedtoday = rp_daily_totals.baserpedtoday + ${grantedBase}, updatedat = NOW()
        `);
      } catch (ledgerError) {
        // The award already succeeded; a ledger write failure must not fail it.
        console.error('[researchPointService] Daily RP ledger write failed (award stands):', ledgerError);
      }
    }

    return {
      success: true,
      message: `Awarded ${finalAmount} RP${isVIP ? ' (VIP bonus applied)' : ''} to ${playerUsername}`,
      rpAwarded: finalAmount,
      vipBonusApplied: isVIP,
      newBalance,
      dailyCapRemaining,
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
    // FID-20260911-045: identifiers are unquoted → Postgres folds to lowercase;
    // the physical table (migration 0024) is named accordingly.
    const existingRows = await db.execute(sql`
      SELECT * FROM dailyharvestprogress
      WHERE playerusername = ${playerUsername} AND date = ${date} AND resetperiod = ${period}
      LIMIT 1
    `);

    const existingProgress: DailyHarvestProgressRow | null = existingRows.rows[0] ?? null;

    const currentHarvestCount = (existingProgress?.harvestcount || 0) + 1;
    const completedMilestones: number[] = existingProgress?.milestonescompleted
      ? (typeof existingProgress.milestonescompleted === 'string'
        ? JSON.parse(existingProgress.milestonescompleted)
        : existingProgress.milestonescompleted)
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
        // FID-20260912-062: bookkeep the ACTUAL awarded amount — the B3 cap
        // can clamp the configured value, and totalRPEarned must reflect RP
        // really granted, not the table's nominal amount.
        rpAwarded = awardResult.success ? awardResult.rpAwarded : 0;

        // Update completed milestones
        completedMilestones.push(threshold);
        break; // Only award one milestone per harvest
      }
    }

    // Find next milestone
    const nextMilestone = milestoneThresholds.find(
      (threshold) => threshold > currentHarvestCount
    );

    // Upsert daily progress record (Postgres ON CONFLICT — the MySQL-era
    // ON DUPLICATE KEY UPDATE never ran on Postgres; table created in
    // migration 0024, FID-20260911-045).
    const now = new Date().toISOString();
    const milestonesJson = JSON.stringify(completedMilestones);
    const totalRPEarned = (existingProgress?.totalrpearned || 0) + (rpAwarded || 0);

    await db.execute(sql`
      INSERT INTO dailyharvestprogress (
        playerusername, date, resetperiod, harvestcount, milestonescompleted,
        totalrpearned, lastharvestat, updatedat, createdat
      ) VALUES (
        ${playerUsername}, ${date}, ${period}, ${currentHarvestCount}, ${milestonesJson}::jsonb,
        ${totalRPEarned}, ${now}, ${now}, ${now}
      )
      ON CONFLICT (playerusername, date, resetperiod) DO UPDATE SET
        harvestcount = EXCLUDED.harvestcount,
        milestonescompleted = EXCLUDED.milestonescompleted,
        totalrpearned = EXCLUDED.totalrpearned,
        lastharvestat = EXCLUDED.lastharvestat,
        updatedat = EXCLUDED.updatedat
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
        DELETE FROM dailyharvestprogress WHERE playerusername = ${playerUsername}
      `);
      return {
        success: true,
        message: `Daily progress reset for ${playerUsername}`,
        playersReset: result.rowCount ?? 0
      };
    } else {
      const result = await db.execute(sql`
        DELETE FROM dailyharvestprogress
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
      SELECT * FROM dailyharvestprogress
      WHERE playerusername = ${playerUsername} AND date = ${today}
      LIMIT 1
    `);

    const todayProgress: DailyHarvestProgressRow | null = todayProgressRows.rows[0] ?? null;

    const dailyEarnings = todayProgress?.totalrpearned || 0;
    const harvestCount = todayProgress?.harvestcount || 0;
    const milestonesCompleted: number[] = todayProgress?.milestonescompleted
      ? (typeof todayProgress.milestonescompleted === 'string'
        ? JSON.parse(todayProgress.milestonescompleted)
        : todayProgress.milestonescompleted)
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

    const recentTransactions: RPTransaction[] = (recentTxRows.rows as RPTransactionRow[]).map((row) => ({
      // FID-20260904-005 §5.2a: lower-case folded keys (see note above).
      playerUsername: row.playerusername ?? row.playerUsername ?? '',
      amount: Number(row.amount ?? 0),
      source: (row.source ?? 'other') as RPSource,
      description: row.description ?? '',
      timestamp: new Date(row.timestamp ?? Date.now()),
      vipBonus: Boolean(row.vipbonus ?? row.vipBonus),
      balanceAfter: row.balanceafter === null || row.balanceafter === undefined ? Number(row.balanceAfter ?? 0) : Number(row.balanceafter),
      metadata: row.metadata ? (typeof row.metadata === 'string' ? (JSON.parse(row.metadata) as Record<string, unknown>) : row.metadata) : undefined,
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
    const _updateResult = await db.update(players)
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

    const transactions: RPTransaction[] = (transactionsRows.rows as RPTransactionRow[]).map((row) => ({
      // FID-20260904-005 §5.2a: Postgres folds the raw SQL's unquoted identifiers to
      // lower-case, so SELECT * returns lower-case keys. Map defensively from both shapes.
      playerUsername: row.playerusername ?? row.playerUsername ?? '',
      amount: Number(row.amount ?? 0),
      source: (row.source ?? 'other') as RPSource,
      description: row.description ?? '',
      timestamp: new Date(row.timestamp ?? Date.now()),
      vipBonus: Boolean(row.vipbonus ?? row.vipBonus),
      balanceAfter: row.balanceafter === null || row.balanceafter === undefined ? Number(row.balanceAfter ?? 0) : Number(row.balanceafter),
      metadata: row.metadata ? (typeof row.metadata === 'string' ? (JSON.parse(row.metadata) as Record<string, unknown>) : row.metadata) : undefined,
    }));

    // Get total count for pagination using raw SQL
    const countRows = await db.execute(sql`
      SELECT COUNT(*) as total FROM rpTransactions ${sql.raw(whereClause)}
    `);

    const totalCount = Number((countRows.rows[0] as { total?: number | string } | undefined)?.total || 0);

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
