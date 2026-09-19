/**
 * @file lib/statTrackingService.ts
 * @created 2025-01-17
 * @rewritten 2026-09-19 (FID-20260917-017 batch 4: Mongo shim → direct drizzle/pg)
 * @overview Automatic stat tracking for achievement progress
 *
 * OVERVIEW:
 * Provides helper functions to track player statistics for achievement system.
 * Called automatically throughout the codebase when relevant actions occur.
 * Updates the players.stats jsonb fields which are checked against achievement
 * requirements.
 *
 * TRACKED STATS (players.stats jsonb):
 * - battlesWon: PvP victories
 * - totalUnitsBuilt: All units created
 * - totalResourcesGathered: Lifetime resource collection
 * - totalResourcesBanked: Lifetime bank deposits
 * - shrineTradeCount: Shrine trade completions
 * - cavesExplored: Cave and forest explorations
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

import { checkAchievements } from './achievementService';

/** The canonical zeroed stats shape (mirrors the achievements contract). */
const ZERO_STATS = {
  battlesWon: 0,
  totalUnitsBuilt: 0,
  totalResourcesGathered: 0,
  totalResourcesBanked: 0,
  shrineTradeCount: 0,
  cavesExplored: 0,
};

/**
 * Initialize stats object if it doesn't exist
 */
async function ensureStatsExist(playerId: string) {
  const [row] = await db
    .select({ stats: players.stats })
    .from(players)
    .where(eq(players.username, playerId))
    .limit(1);

  if (!row || row.stats) {
    return; // Stats already exist or player doesn't exist
  }

  await db
    .update(players)
    .set({ stats: ZERO_STATS })
    .where(eq(players.username, playerId));
}

/**
 * Increment one stats.<key> counter by `amount` (SQL delta on the jsonb path —
 * composes under concurrency, the shim's $inc 'stats.key' equivalent).
 */
async function incrementStat(playerId: string, key: keyof typeof ZERO_STATS, amount: number) {
  await db
    .update(players)
    .set({
      stats: sql`jsonb_set(COALESCE(${players.stats}, '{}'::jsonb), ARRAY[${key}], to_jsonb(COALESCE((${players.stats}->>${key})::numeric, 0) + ${amount}))`,
    })
    .where(eq(players.username, playerId));
}

/**
 * Track battle victory
 *
 * @param playerId - Player username
 */
export async function trackBattleWon(playerId: string) {
  await ensureStatsExist(playerId);
  await incrementStat(playerId, 'battlesWon', 1);

  // Check for achievement unlocks
  await checkAchievements(playerId);

  // FID-20260914-008 Phase 2: earnable mastery — every battle won grants
  // server-side mastery XP (never client-granted). Dynamic import: the
  // specialization service statically imports THIS module (triggerAchievementCheck).
  try {
    const { awardMasteryXP, MASTERY_XP_BATTLE_WON } = await import('./specializationService');
    await awardMasteryXP(playerId, MASTERY_XP_BATTLE_WON, 'battle won', {
      field: 'totalBattlesWon',
      by: 1,
    });
  } catch {
    // Mastery XP is never load-bearing for the battle result.
  }
}

/**
 * Track unit build
 *
 * @param playerId - Player username
 * @param quantity - Number of units built
 * @param unitCategory - Blueprint category of the built unit ('strength'/'defense')
 *   — mastery XP only accrues for units matching the player's doctrine (Offensive
 *   = strength, Defensive = defense, Tactical = balanced units, i.e. any build).
 */
export async function trackUnitBuilt(
  playerId: string,
  quantity: number = 1,
  unitCategory?: 'strength' | 'defense'
) {
  await ensureStatsExist(playerId);
  await incrementStat(playerId, 'totalUnitsBuilt', quantity);

  // Check for achievement unlocks
  await checkAchievements(playerId);

  // FID-20260914-008 Phase 2: earnable mastery — +10 per matching-category unit.
  // Tactical counts every build (balanced doctrine); matching is decided inside
  // the service so the doctrine table stays the single source of truth.
  try {
    const { awardBuildMasteryXP, MASTERY_XP_UNIT_BUILD } = await import('./specializationService');
    await awardBuildMasteryXP(playerId, quantity, MASTERY_XP_UNIT_BUILD, unitCategory);
  } catch {
    // Mastery XP is never load-bearing for the build result.
  }
}

/**
 * Track resource gathering
 *
 * @param playerId - Player username
 * @param amount - Total resources gathered (metal + energy)
 */
export async function trackResourcesGathered(playerId: string, amount: number) {
  await ensureStatsExist(playerId);
  await incrementStat(playerId, 'totalResourcesGathered', amount);

  // Check for achievement unlocks
  await checkAchievements(playerId);
}

/**
 * Track bank deposit
 *
 * @param playerId - Player username
 * @param amount - Total resources banked (metal + energy)
 */
export async function trackResourcesBanked(playerId: string, amount: number) {
  await ensureStatsExist(playerId);
  await incrementStat(playerId, 'totalResourcesBanked', amount);

  // Check for achievement unlocks
  await checkAchievements(playerId);
}

/**
 * Track shrine trade
 *
 * @param playerId - Player username
 */
export async function trackShrineTrade(playerId: string) {
  await ensureStatsExist(playerId);
  await incrementStat(playerId, 'shrineTradeCount', 1);

  // Check for achievement unlocks
  await checkAchievements(playerId);
}

/**
 * Track cave/forest exploration
 *
 * @param playerId - Player username
 */
export async function trackCaveExplored(playerId: string) {
  await ensureStatsExist(playerId);
  await incrementStat(playerId, 'cavesExplored', 1);

  // Check for achievement unlocks
  await checkAchievements(playerId);
}

/**
 * Manually trigger achievement check
 * Called after level-ups or specialization mastery changes
 *
 * @param playerId - Player username
 * @returns Newly unlocked achievements
 */
export async function triggerAchievementCheck(playerId: string) {
  await ensureStatsExist(playerId);
  return await checkAchievements(playerId);
}
