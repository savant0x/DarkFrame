/**
 * @file lib/statTrackingService.ts
 * @created 2025-01-17
 * @overview Automatic stat tracking for achievement progress
 * 
 * OVERVIEW:
 * Provides helper functions to track player statistics for achievement system.
 * Called automatically throughout the codebase when relevant actions occur.
 * Updates PlayerStats fields which are checked against achievement requirements.
 * 
 * TRACKED STATS:
 * - battlesWon: PvP victories
 * - totalUnitsBuilt: All units created
 * - totalResourcesGathered: Lifetime resource collection
 * - totalResourcesBanked: Lifetime bank deposits
 * - shrineTradeCount: Shrine trade completions
 * - cavesExplored: Cave and forest explorations
 */

import { getCollection } from './mongodb';
import { logger } from './logger';
import { checkAchievements } from './achievementService';

/**
 * Initialize stats object if it doesn't exist
 */
async function ensureStatsExist(playerId: string) {
  const playersCollection = await getCollection('players');
  const player = await playersCollection.findOne({ username: playerId });

  if (!player || player.stats) {
    return; // Stats already exist or player doesn't exist
  }

  await playersCollection.updateOne(
    { username: playerId },
    {
      $set: {
        stats: {
          battlesWon: 0,
          totalUnitsBuilt: 0,
          totalResourcesGathered: 0,
          totalResourcesBanked: 0,
          shrineTradeCount: 0,
          cavesExplored: 0
        }
      } as any
    }
  );
}

/**
 * Track battle victory
 * 
 * @param playerId - Player username
 */
export async function trackBattleWon(playerId: string) {
  await ensureStatsExist(playerId);
  
  const playersCollection = await getCollection('players');
  await playersCollection.updateOne(
    { username: playerId },
    { $inc: { 'stats.battlesWon': 1 } as any }
  );

  // Check for achievement unlocks
  await checkAchievements(playerId);
}

/**
 * Track unit build
 * 
 * @param playerId - Player username
 * @param quantity - Number of units built
 */
export async function trackUnitBuilt(playerId: string, quantity: number = 1) {
  await ensureStatsExist(playerId);
  
  const playersCollection = await getCollection('players');
  await playersCollection.updateOne(
    { username: playerId },
    { $inc: { 'stats.totalUnitsBuilt': quantity } as any }
  );

  // Check for achievement unlocks
  await checkAchievements(playerId);
}

/**
 * Track resource gathering
 * 
 * @param playerId - Player username
 * @param amount - Total resources gathered (metal + energy)
 */
export async function trackResourcesGathered(playerId: string, amount: number) {
  await ensureStatsExist(playerId);
  
  const playersCollection = await getCollection('players');
  await playersCollection.updateOne(
    { username: playerId },
    { $inc: { 'stats.totalResourcesGathered': amount } as any }
  );

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
  
  const playersCollection = await getCollection('players');
  await playersCollection.updateOne(
    { username: playerId },
    { $inc: { 'stats.totalResourcesBanked': amount } as any }
  );

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
  
  const playersCollection = await getCollection('players');
  await playersCollection.updateOne(
    { username: playerId },
    { $inc: { 'stats.shrineTradeCount': 1 } as any }
  );

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
  
  const playersCollection = await getCollection('players');
  await playersCollection.updateOne(
    { username: playerId },
    { $inc: { 'stats.cavesExplored': 1 } as any }
  );

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
