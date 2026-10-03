/**
 * Experience & Leveling Service
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * Core service for player progression through experience points (XP) and levels.
 * Handles XP awards, level calculations, research point (RP) rewards, and level-up
 * notifications. Integrates with all game systems to provide continuous progression.
 * 
 * LEVELING FORMULA:
 * level = Math.floor(totalXP / 1000) + 1
 * XP required for next level = currentLevel * 1000
 * 
 * REWARDS:
 * - 1 Research Point (RP) per level gained
 * - Future: Unlock special abilities, units, features
 * 
 * XP AWARD TABLE:
 * - Harvest (Metal/Energy): +10 XP
 * - Cave exploration: +15 XP
 * - Cave item (rare): +25 XP
 * - Cave item (legendary): +50 XP
 * - Factory capture: +100 XP
 * - Factory upgrade: +50 XP
 * - Unit building: +5 XP per unit
 * - Shrine sacrifice: +20 XP
 * - Infantry attack win: +150 XP
 * - Infantry attack loss: +25 XP
 * - Base attack win: +200 XP
 * - Base attack loss: +30 XP
 * - Defense success: +75 XP
 * - Factory defense: +50 XP
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { triggerAchievementCheck } from '@/lib/statTrackingService';
import { withTransactionRetry, lockPlayerRow } from '@/lib/db/treasuryLock';
import type { TreasuryTx } from '@/lib/db/treasuryLock';

/**
 * XP action types for logging and tracking
 */
export enum XPAction {
  // Resource gathering
  HARVEST_RESOURCE = 'harvest_resource',
  CAVE_EXPLORATION = 'cave_exploration',
  CAVE_ITEM_RARE = 'cave_item_rare',
  CAVE_ITEM_LEGENDARY = 'cave_item_legendary',
  
  // Factory actions
  FACTORY_CAPTURE = 'factory_capture',
  FACTORY_UPGRADE = 'factory_upgrade',
  FACTORY_ABANDON = 'factory_abandon',
  
  // Unit actions
  UNIT_BUILD = 'unit_build',
  
  // Shrine actions
  SHRINE_SACRIFICE = 'shrine_sacrifice',
  
  // Combat actions
  INFANTRY_ATTACK_WIN = 'infantry_attack_win',
  INFANTRY_ATTACK_LOSS = 'infantry_attack_loss',
  BASE_ATTACK_WIN = 'base_attack_win',
  BASE_ATTACK_LOSS = 'base_attack_loss',
  DEFENSE_SUCCESS = 'defense_success',
  FACTORY_DEFENSE = 'factory_defense',
  
  // Special events
  FIRST_LOGIN = 'first_login',
  DAILY_LOGIN = 'daily_login',

  // System (no reward value — used to bypass gameplay multipliers)
  ADMIN = 'admin'
}

/**
 * XP amounts for each action type
 * UPDATED: Doubled combat and factory XP for active gameplay encouragement
 */
export const XP_REWARDS: Record<XPAction, number> = {
  [XPAction.HARVEST_RESOURCE]: 20,              // Doubled from 10 (harvest metal/energy tile)
  [XPAction.CAVE_EXPLORATION]: 30,              // Doubled from 15 (explore cave)
  [XPAction.CAVE_ITEM_RARE]: 50,                // Doubled from 25 (find rare cave item)
  [XPAction.CAVE_ITEM_LEGENDARY]: 100,          // Doubled from 50 (find legendary cave item)
  
  [XPAction.FACTORY_CAPTURE]: 200,              // Doubled from 100 (capture neutral factory)
  [XPAction.FACTORY_UPGRADE]: 100,              // Doubled from 50 (upgrade factory level)
  [XPAction.FACTORY_ABANDON]: 0,                // No reward for abandoning
  
  [XPAction.UNIT_BUILD]: 10,                    // Doubled from 5 (per unit built)
  
  [XPAction.SHRINE_SACRIFICE]: 40,              // Doubled from 20 (shrine trade)
  
  [XPAction.INFANTRY_ATTACK_WIN]: 300,          // Doubled from 150 (win player vs player combat)
  [XPAction.INFANTRY_ATTACK_LOSS]: 50,          // Doubled from 25 (lose player vs player combat)
  [XPAction.BASE_ATTACK_WIN]: 400,              // Doubled from 200 (successful base raid)
  [XPAction.BASE_ATTACK_LOSS]: 60,              // Doubled from 30 (failed base raid)
  [XPAction.DEFENSE_SUCCESS]: 150,              // Doubled from 75 (successfully defend against attack)
  [XPAction.FACTORY_DEFENSE]: 100,              // Doubled from 50 (defend factory)
  
  [XPAction.FIRST_LOGIN]: 200,                  // Doubled from 100 (first time login bonus)
  [XPAction.DAILY_LOGIN]: 20,                   // Doubled from 10 (daily login bonus)

  [XPAction.ADMIN]: 0                           // Direct admin grant — bypasses flag multiplier
};

/**
 * Player XP statistics
 */
export interface PlayerXPStats {
  username: string;
  totalXP: number;
  level: number;
  currentLevelXP: number;
  xpForNextLevel: number;
  progressPercent: number;
  researchPoints: number;
  totalLevelsGained: number;
}

/**
 * Level-up result
 */
export interface LevelUpResult {
  levelsGained: number;
  newLevel: number;
  rpAwarded: number;
  totalRP: number;
}

/**
 * Calculate player level from total XP
 * Formula (FID-20260906-006 P1/P2):
 *   Levels 1-29:  floor(500 × level^1.35) per level  — anchors L10≈11.2k, L29≈45.5k
 *   Levels 30+:   50,000 base × 1.15 per level       — endgame properly steep
 *   Boundary is monotonic: L29 cost (45,530) < L30 cost (50,000).
 *
 * @param totalXP - Total experience points
 * @returns Player level (minimum 1)
 *
 * @example
 * calculateLevel(0);      // Returns 1
 * calculateLevel(499);    // Returns 1 (L1 needs 500)
 * calculateLevel(500);    // Returns 2
 * calculateLevel(16099);  // Returns 29 (cumulative through L29 = 160,990... see getXPForNextLevel)
 * calculateLevel(CUM30);  // Returns 30 (linear/power cap)
 *
 * UPDATED (P1/P2): power curve midgame + 15%-per-level endgame per balance audit
 */
export function calculateLevel(totalXP: number): number {
  if (totalXP < 0) return 1;

  let level = 1;
  let remaining = totalXP;

  // Power-curve segment (levels 1-29)
  while (level < 30) {
    const need = getXPForNextLevel(level);
    if (remaining < need) return level;
    remaining -= need;
    level++;
  }

  // Exponential segment (level 30+)
  let need = getXPForNextLevel(30); // 50,000
  while (remaining >= need) {
    remaining -= need;
    level++;
    need = Math.floor(need * 1.15);
  }

  return level;
}

/**
 * Calculate XP required for next level
 * Formula (FID-20260906-006 P1/P2):
 *   Levels < 30:  floor(500 × level^1.35)  — smooth power curve, kills the L29 cliff
 *   Levels >= 30: 50,000 × 1.15 per step   — endgame properly expensive
 *
 * @param currentLevel - Current player level
 * @returns XP needed to reach next level
 *
 * @example
 * getXPForNextLevel(1);  // Returns 500
 * getXPForNextLevel(10); // Returns 11,195
 * getXPForNextLevel(29); // Returns 45,530 (last power-curve level)
 * getXPForNextLevel(30); // Returns 50,000 (first exponential level — monotonic boundary)
 * getXPForNextLevel(40); // Returns ~202,315 (exponential scaling)
 *
 * UPDATED (P1/P2): power-curve midgame, 15%-per-level endgame per balance audit
 */
export function getXPForNextLevel(currentLevel: number): number {
  // Power-curve progression up to Level 30
  if (currentLevel < 30) {
    return Math.floor(500 * Math.pow(currentLevel, 1.35));
  }

  // Exponential progression after Level 30
  // Level 30→31: 50,000 XP (monotonic over L29→30's 45,530)
  // Each subsequent level: previous × 1.15
  let xpRequired = 50000; // Base XP for Level 30→31

  for (let level = 31; level <= currentLevel; level++) {
    xpRequired = Math.floor(xpRequired * 1.15); // 15% increase per level
  }

  return xpRequired;
}

/**
 * Calculate XP progress within current level
 * 
 * @param totalXP - Total experience points
 * @returns Object with current level XP and progress percentage
 * 
 * @example
 * getXPProgress(1234);
 * // Returns: { currentLevelXP: 234, progressPercent: 23.4, xpForNextLevel: 1000 }
 * 
 * UPDATED: Works with exponential XP scaling after Level 30
 */
export function getXPProgress(totalXP: number): {
  currentLevelXP: number;
  progressPercent: number;
  xpForNextLevel: number;
} {
  // Clamp hostile/negative input so the returned progress can never go negative.
  const safeTotal = Math.max(0, Math.floor(totalXP));
  const level = calculateLevel(safeTotal);
  
  // XP at the start of the current level = the sum of the REAL per-level costs
  // below it — the exact accumulation calculateLevel performs to find the level.
  // Deriving it from the same single source of truth (getXPForNextLevel) makes
  // the two functions mathematically incapable of disagreeing.
  // (FID-20260908-002: the retired linear branch ((level−1)×1000) and the retired
  // 30,000/×1.10 exponential branch produced the impossible 129,972/21,112 bar.)
  let xpAtLevelStart = 0;
  for (let lv = 1; lv < level; lv++) {
    xpAtLevelStart += getXPForNextLevel(lv);
  }
  
  const currentLevelXP = safeTotal - xpAtLevelStart;
  const xpForNextLevel = getXPForNextLevel(level);
  const progressPercent = (currentLevelXP / xpForNextLevel) * 100;
  
  return {
    currentLevelXP,
    progressPercent: Math.min(progressPercent, 100),
    xpForNextLevel
  };
}

/**
 * Award XP to a player and handle level-ups
 *
 * FID-20261002-002 §5.4: the previous implementation updated the XP/level row
 * and then awarded level-up RP through a SEPARATE awardRP transaction (with a
 * silent 1-RP-per-level fallback on failure), so a transport retry or a
 * mid-operation failure could duplicate or strand the level reward. The whole
 * operation now runs in ONE transaction: the player row is locked FOR UPDATE,
 * XP/level are recomputed against the locked row and written with relative
 * SQL, and level-up RP is granted through the transaction-aware awardRP
 * writer against the SAME transaction — an error anywhere rolls everything
 * back and the operation can retry as a unit. Level thresholds, action
 * tables, flag-bearer doubling and ordinary repeated-reward eligibility are
 * unchanged.
 *
 * @param playerId - Player ID or username
 * @param action - XP action type
 * @param multiplier - XP multiplier (default 1, for quantity-based awards)
 * @param tx - Optional caller-supplied transaction (composed operations)
 * @returns Updated player XP stats and level-up info
 *
 * @example
 * await awardXP('player123', XPAction.HARVEST_RESOURCE);
 * await awardXP('player123', XPAction.UNIT_BUILD, 10); // 10 units = 50 XP
 */
export async function awardXP(
  playerId: string,
  action: XPAction,
  multiplier: number = 1,
  tx?: TreasuryTx
): Promise<{
  xpAwarded: number;
  totalXP: number;
  oldLevel: number;
  newLevel: number;
  levelUp: boolean;
  levelUpResult?: LevelUpResult;
}> {
  const run = async (txHandle: TreasuryTx): Promise<{
    xpAwarded: number;
    totalXP: number;
    oldLevel: number;
    newLevel: number;
    levelUp: boolean;
    levelUpResult?: LevelUpResult;
  }> => {
    // Calculate XP to award
    const baseXP = XP_REWARDS[action] || 0;
    let xpAwarded = baseXP * multiplier;

    // FID-20260906-001 §5.4: Flag bearer earns +100% XP (doc bonus stack).
    // Admin source is excluded — operators grant exact amounts.
    if (action !== XPAction.ADMIN && playerId) {
      try {
        const { isFlagBearer } = await import('@/lib/flagBonusService');
        if (await isFlagBearer(playerId)) xpAwarded *= 2;
      } catch {
        // Never fail the XP award because of the flag check.
      }
    }

    // Lock the player row: XP, level and balance decisions all re-validate
    // against the LOCKED row (FID-20261002-002 §5.1).
    const player = await lockPlayerRow(txHandle, playerId);

    // FID-20260906-006 P3: harvest XP scales with level (+2 XP per level) so the
    // XP curve's midgame stays reachable as unit/factory costs scale. Applied after
    // the flag-bearer multiplier so bearers double the scaled value.
    if (action === XPAction.HARVEST_RESOURCE) {
      xpAwarded += Math.max(0, (player.level || 1) - 1) * 2;
    }

    // Get current stats from the locked row
    const currentXP = player.xp || 0;
    const currentLevel = player.level || 1;

    // Calculate new stats
    const newTotalXP = currentXP + xpAwarded;
    const newLevel = calculateLevel(newTotalXP);
    const levelUp = newLevel > currentLevel;

    // Relative XP/level write on the locked row.
    await txHandle
      .update(players)
      .set({
        xp: sql`${players.xp} + ${xpAwarded}`,
        level: newLevel,
        lastXPAward: new Date(),
      })
      .where(eq(players.username, playerId));

    let levelUpResult: LevelUpResult | undefined;

    // Handle level-up rewards INSIDE the same transaction (FID-20261002-002
    // §5.4): transaction-aware awardRP commits level RP with the XP movement.
    // No fallback path exists: an RP failure rolls back the whole operation,
    // so a retry never double-awards the level (the level write rolls back
    // with it).
    if (levelUp) {
      const levelsGained = newLevel - currentLevel;

      const { awardRP } = await import('./researchPointService');

      let totalRPAwarded = 0;
      for (let i = 0; i < levelsGained; i++) {
        const level = currentLevel + i + 1;
        const rpForLevel = Math.min(level * 5, 500); // Scale: level × 5, cap at 500

        const result = await awardRP(
          playerId,
          rpForLevel,
          'level_up',
          `Reached Level ${level}`,
          { level },
          txHandle
        );

        if (!result.success) {
          // Fail the whole operation (rollback includes the XP/level write):
          // a level-up whose RP could not be committed did not happen.
          throw new Error(`Level-up RP award failed for ${playerId}: ${result.message}`);
        }
        totalRPAwarded += result.rpAwarded;
        console.log(`🎉 Level up! ${playerId} reached Level ${level} and earned ${result.rpAwarded} RP`);
      }

      await txHandle
        .update(players)
        .set({ lastLevelUp: new Date() })
        .where(eq(players.username, playerId));

      levelUpResult = {
        levelsGained,
        newLevel,
        rpAwarded: totalRPAwarded,
        totalRP: (player.researchPoints || 0) + totalRPAwarded
      };
    }

    return {
      xpAwarded,
      totalXP: newTotalXP,
      oldLevel: currentLevel,
      newLevel,
      levelUp,
      levelUpResult
    };
  };

  // No caller transaction: open one, with bounded whole-operation retries.
  if (tx) return await run(tx);
  return await withTransactionRetry(`awardXP(${playerId})`, async () =>
    db.transaction(async (standaloneTx) => run(standaloneTx as TreasuryTx))
  ).then(async (result) => {
    // Check achievements if player leveled up — strictly AFTER commit
    // (FID-20261002-002 §5.6: post-commit side effects cannot convert a
    // committed success into a retryable failure).
    if (result.levelUp) {
      await triggerAchievementCheck(playerId);
    }
    return result;
  });
}

/**
 * Get detailed XP statistics for a player
 * 
 * @param playerId - Player ID or username
 * @returns Complete XP stats
 * 
 * @example
 * const stats = await getPlayerXPStats('JohnDoe');
 * console.log(`Level ${stats.level} (${stats.progressPercent}%)`);
 */
export async function getPlayerXPStats(playerId: string): Promise<PlayerXPStats | null> {
  const playerResult = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
  const player = playerResult[0] ?? null;
  
  if (!player) {
    return null;
  }
  
  const totalXP = player.xp || 0;
  const level = player.level || 1;
  const progress = getXPProgress(totalXP);
  
  return {
    username: player.username,
    totalXP,
    level,
    currentLevelXP: progress.currentLevelXP,
    xpForNextLevel: progress.xpForNextLevel,
    progressPercent: progress.progressPercent,
    researchPoints: player.researchPoints || 0,
    totalLevelsGained: level - 1
  };
}

/**
 * Get top players by XP for leaderboard
 * 
 * @param limit - Number of players to return
 * @returns Sorted list of players by XP
 */
export async function getTopPlayersByXP(limit: number = 100): Promise<Array<{
  rank: number;
  username: string;
  totalXP: number;
  level: number;
  researchPoints: number;
}>> {
  const allPlayers = await db.select({
    username: players.username,
    xp: players.xp,
    level: players.level,
    researchPoints: players.researchPoints
  }).from(players).orderBy(desc(players.xp));
  
  // Sort by XP descending
  const sorted = allPlayers
    .map(p => ({
      username: p.username,
      totalXP: p.xp || 0,
      level: p.level || 1,
      researchPoints: p.researchPoints || 0
    }))
    .sort((a, b) => {
      // Primary: XP descending
      if (b.totalXP !== a.totalXP) {
        return b.totalXP - a.totalXP;
      }
      // Tie-breaker: username ascending
      return a.username.localeCompare(b.username);
    });
  
  // Add ranks
  return sorted.slice(0, limit).map((player, index) => ({
    rank: index + 1,
    ...player
  }));
}

/**
 * Spend research points to unlock features
 *
 * FID-20261002-002 §5 (source-audit correction): this is now a transaction-
 * aware adapter to the SAME audited RP writer as spendRP (researchPointService)
 * — one writer, one truth. The previous local copy read a snapshot balance,
 * computed the new balance in JS and wrote it absolutely, so two concurrent
 * spends could both succeed against the same starting balance. Pass `tx` to
 * compose the debit into a larger operation (tech-unlock + debit in one
 * transaction); without `tx` the writer opens its own.
 *
 * @param playerId - Player ID or username
 * @param amount - RP to spend
 * @param reason - What the RP was spent on
 * @param tx - Optional caller-supplied transaction
 * @returns Updated RP balance
 *
 * @example
 * await spendResearchPoints('player123', 5, 'Unlock Tier 2 Units');
 */
export async function spendResearchPoints(
  playerId: string,
  amount: number,
  reason: string,
  tx?: TreasuryTx
): Promise<{
  success: boolean;
  newBalance: number;
  message: string;
}> {
  const { spendRP } = await import('./researchPointService');
  const result = await spendRP(playerId, amount, reason, 'tech_unlock', tx);
  return {
    success: result.success,
    newBalance: result.newBalance,
    message: result.message,
  };
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Level Progression:
 *    - Linear XP requirement (1000 per level)
 *    - Simple formula for easy calculation
 *    - No level cap (infinite progression)
 *    - Future: Could add exponential scaling for higher levels
 * 
 * 2. Research Points:
 *    - 1 RP per level gained
 *    - Used to unlock unit tiers, features, abilities
 *    - Spending tracked in rpHistory array
 *    - Cannot go negative
 * 
 * 3. XP Awards:
 *    - Balanced for typical gameplay loops
 *    - Combat awards significantly more than gathering
 *    - Quantity-based multiplier for bulk actions
 *    - All awards logged for analytics
 * 
 * 4. Performance:
 *    - Atomic updates prevent race conditions
 *    - Efficient level calculation (no loops)
 *    - Indexed queries on username and xp fields
 *    - Future: Cache top 100 with Redis
 * 
 * 5. Future Enhancements:
 *    - XP boost items (temporary multipliers)
 *    - Double XP events (weekends, special occasions)
 *    - XP penalties for deaths/losses
 *    - Prestige system (reset level for bonuses)
 *    - Level-based unlock notifications
 *    - XP history tracking per action type
 */
