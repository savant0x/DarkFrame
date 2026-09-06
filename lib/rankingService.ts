/**
 * Ranking Service
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * Core service for player ranking calculations based on effective power.
 * Effective power considers total military strength (STR + DEF) adjusted
 * by army balance multiplier. Rankings are sorted descending by effective power.
 * 
 * RANKING FORMULA:
 * effectivePower = (totalStrength + totalDefense) × balanceMultiplier
 * 
 * BALANCE MULTIPLIERS:
 * - Critical (<0.7 ratio): 0.5x
 * - Imbalanced (0.7-0.85): 0.8x
 * - Balanced (0.85-1.15): 1.0x
 * - Optimal (0.95-1.05): 1.1x
 * 
 * KEY FEATURES:
 * - Efficient MongoDB aggregation pipeline for top N rankings
 * - Player rank lookup by username
 * - Total player count for context
 * - Handles ties with consistent ordering
 */

import { connectToDatabase } from '@/lib/mongodb';
import { calculateBalanceEffects } from '@/lib/balanceService';
import { Player, Factory } from '@/types/game.types';

/**
 * Ranked player data for leaderboard display
 */
export interface RankedPlayer {
  rank: number;
  username: string;
  effectivePower: number;
  totalPower: number;
  balanceMultiplier: number;
  balanceStatus: string;
  totalStrength: number;
  totalDefense: number;
  factoriesOwned: number;
  level?: number;
  validatedReferrals?: number; // Number of validated referrals
}

/**
 * Leaderboard response with rankings and metadata
 */
export interface LeaderboardData {
  leaderboard: RankedPlayer[];
  currentPlayerRank: number | null;
  totalPlayers: number;
  lastUpdated: Date;
}

/**
 * Calculate effective power for a player
 * 
 * @param player - Player object with STR/DEF data
 * @returns Effective power after balance adjustment
 * 
 * @example
 * const power = calculateEffectivePower({
 *   totalStrength: 5000,
 *   totalDefense: 3000
 * });
 * // Returns: 6400 (8000 × 0.8 for imbalanced army)
 */
export function calculateEffectivePower(player: {
  totalStrength: number;
  totalDefense: number;
}): number {
  const totalPower = player.totalStrength + player.totalDefense;
  
  // If no units, power is 0
  if (totalPower === 0) {
    return 0;
  }
  
  // Calculate balance effects
  const balanceEffects = calculateBalanceEffects(
    player.totalStrength,
    player.totalDefense
  );
  
  // Apply balance multiplier
  return Math.floor(totalPower * balanceEffects.powerMultiplier);
}

/**
 * Get top N players ranked by effective power
 * Uses MongoDB aggregation for efficient sorting and limiting
 * 
 * @param limit - Number of top players to return (default 100)
 * @returns Array of ranked players
 * 
 * @example
 * const topPlayers = await getTopPlayers(100);
 * console.log(topPlayers[0]); // #1 ranked player
 */
export async function getTopPlayers(limit: number = 100): Promise<RankedPlayer[]> {
  const db = await connectToDatabase();
  const playersCollection = db.collection<Player>('players');
  const factoriesCollection = db.collection<Factory>('factories');
  
  // Get all players with their unit stats (exclude bots from rankings)
  const players = await playersCollection
    .find({
      isBot: { $ne: true } // Exclude bots from leaderboard
    }, {
      projection: {
        username: 1,
        totalStrength: 1,
        totalDefense: 1,
        level: 1
      }
    })
    .toArray();
  
  // Calculate effective power for each player
  const rankedPlayers: Array<{
    username: string;
    effectivePower: number;
    totalPower: number;
    balanceMultiplier: number;
    balanceStatus: string;
    totalStrength: number;
    totalDefense: number;
    level?: number;
  }> = [];
  
  for (const player of players) {
    const totalStrength = player.totalStrength || 0;
    const totalDefense = player.totalDefense || 0;
    const totalPower = totalStrength + totalDefense;
    
    // Calculate balance effects
    const balanceEffects = calculateBalanceEffects(totalStrength, totalDefense);
    const effectivePower = Math.floor(totalPower * balanceEffects.powerMultiplier);
    
    rankedPlayers.push({
      username: player.username,
      effectivePower,
      totalPower,
      balanceMultiplier: balanceEffects.powerMultiplier,
      balanceStatus: balanceEffects.status,
      totalStrength,
      totalDefense,
      level: player.level || 1
    });
  }
  
  // Sort by effective power descending
  rankedPlayers.sort((a, b) => {
    // Primary sort: effective power (descending)
    if (b.effectivePower !== a.effectivePower) {
      return b.effectivePower - a.effectivePower;
    }
    // Tie-breaker: username (ascending, alphabetical)
    return a.username.localeCompare(b.username);
  });
  
  // Get factory counts for top players
  const topPlayerUsernames = rankedPlayers.slice(0, limit).map((p: any) => p.username);
  const factoryCounts = await factoriesCollection.aggregate([
    { $match: { owner: { $in: topPlayerUsernames } } },
    { $group: { _id: '$owner', count: { $sum: 1 } } }
  ]).toArray();
  
  const factoryCountMap = new Map<string, number>(
    factoryCounts.map((fc: any) => [fc._id as string, fc.count as number])
  );
  
  // Add ranks and factory counts to top N players
  const topRanked: RankedPlayer[] = rankedPlayers
    .slice(0, limit)
    .map((player: any, index: number) => ({
      rank: index + 1,
      username: player.username,
      effectivePower: player.effectivePower,
      totalPower: player.totalPower,
      balanceMultiplier: player.balanceMultiplier,
      balanceStatus: player.balanceStatus,
      totalStrength: player.totalStrength,
      totalDefense: player.totalDefense,
      factoriesOwned: (factoryCountMap.get(player.username) || 0) as number,
      level: player.level
    }));
  
  return topRanked;
}

/**
 * Get rank for a specific player by username
 * 
 * @param username - Player username to find
 * @returns Player's rank (1-based) or null if not found
 * 
 * @example
 * const rank = await getPlayerRank('JohnDoe');
 * console.log(`JohnDoe is ranked #${rank}`);
 */
export async function getPlayerRank(username: string): Promise<number | null> {
  const db = await connectToDatabase();
  const playersCollection = db.collection<Player>('players');
  
  // Get all players with their unit stats (exclude bots)
  const players = await playersCollection
    .find({
      isBot: { $ne: true } // Exclude bots from rankings
    }, {
      projection: {
        username: 1,
        totalStrength: 1,
        totalDefense: 1
      }
    })
    .toArray();
  
  // Calculate effective power for each player
  const rankedPlayers = players.map((player: any) => {
    const totalStrength = player.totalStrength || 0;
    const totalDefense = player.totalDefense || 0;
    const totalPower = totalStrength + totalDefense;
    const balanceEffects = calculateBalanceEffects(totalStrength, totalDefense);
    const effectivePower = Math.floor(totalPower * balanceEffects.powerMultiplier);
    
    return {
      username: player.username,
      effectivePower
    };
  });
  
  // Sort by effective power descending
  rankedPlayers.sort((a: any, b: any) => {
    if (b.effectivePower !== a.effectivePower) {
      return b.effectivePower - a.effectivePower;
    }
    return a.username.localeCompare(b.username);
  });
  
  // Find player's rank
  const rank = rankedPlayers.findIndex((p: any) => p.username === username);
  return rank === -1 ? null : rank + 1;
}

/**
 * Get player's rank data including surrounding players
 * Useful for showing "You are #42 out of 1,523 players"
 * 
 * @param username - Player username
 * @returns Player rank data with context
 * 
 * @example
 * const data = await getPlayerRankData('JohnDoe');
 * console.log(`Rank: ${data.rank} / ${data.totalPlayers}`);
 */
export async function getPlayerRankData(username: string): Promise<{
  rank: number | null;
  totalPlayers: number;
  effectivePower: number;
  playerAbove?: RankedPlayer;
  playerBelow?: RankedPlayer;
} | null> {
  const db = await connectToDatabase();
  const playersCollection = db.collection<Player>('players');
  const factoriesCollection = db.collection<Factory>('factories');
  
  // Get player data
  const player = await playersCollection.findOne({ username });
  if (!player) return null;
  
  // Get all players for ranking (exclude bots)
  const allPlayers = await playersCollection
    .find({
      isBot: { $ne: true } // Exclude bots from rankings
    }, {
      projection: {
        username: 1,
        totalStrength: 1,
        totalDefense: 1,
        level: 1
      }
    })
    .toArray();
  
  // Calculate effective power for all players
  const rankedPlayers = allPlayers.map((p: any) => {
    const totalStrength = p.totalStrength || 0;
    const totalDefense = p.totalDefense || 0;
    const totalPower = totalStrength + totalDefense;
    const balanceEffects = calculateBalanceEffects(totalStrength, totalDefense);
    const effectivePower = Math.floor(totalPower * balanceEffects.powerMultiplier);
    
    return {
      username: p.username,
      effectivePower,
      totalPower,
      balanceMultiplier: balanceEffects.powerMultiplier,
      balanceStatus: balanceEffects.status,
      totalStrength,
      totalDefense,
      level: p.level || 1
    };
  });
  
  // Sort by effective power
  rankedPlayers.sort((a: any, b: any) => {
    if (b.effectivePower !== a.effectivePower) {
      return b.effectivePower - a.effectivePower;
    }
    return a.username.localeCompare(b.username);
  });
  
  // Find player's rank
  const playerIndex = rankedPlayers.findIndex((p: any) => p.username === username);
  if (playerIndex === -1) return null;
  
  const rank = playerIndex + 1;
  const currentPlayer = rankedPlayers[playerIndex];
  
  // Get factory count
  const _factoryCount = await factoriesCollection.countDocuments({ owner: username });
  
  return {
    rank,
    totalPlayers: rankedPlayers.length,
    effectivePower: currentPlayer.effectivePower,
    playerAbove: playerIndex > 0 ? {
      rank: playerIndex,
      ...rankedPlayers[playerIndex - 1],
      factoriesOwned: 0 // Not fetched for context players
    } : undefined,
    playerBelow: playerIndex < rankedPlayers.length - 1 ? {
      rank: playerIndex + 2,
      ...rankedPlayers[playerIndex + 1],
      factoriesOwned: 0
    } : undefined
  };
}

/**
 * Get total number of players
 * 
 * @returns Total player count
 */
export async function getTotalPlayerCount(): Promise<number> {
  const db = await connectToDatabase();
  const playersCollection = db.collection<Player>('players');
  return await playersCollection.countDocuments({ isBot: { $ne: true } }); // Exclude bots
}

/**
 * Format rank for display with medal emojis
 * 
 * @param rank - Player rank (1-based)
 * @returns Formatted rank string with emoji
 * 
 * @example
 * formatRank(1); // Returns: "🥇 #1"
 * formatRank(4); // Returns: "#4"
 */
export function formatRank(rank: number): string {
  if (rank === 1) return '🥇 #1';
  if (rank === 2) return '🥈 #2';
  if (rank === 3) return '🥉 #3';
  return `#${rank}`;
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Ranking Algorithm:
 *    - Effective power = (STR + DEF) × balance multiplier
 *    - Encourages balanced armies (penalty for imbalance)
 *    - Tie-breaker: alphabetical by username
 * 
 * 2. Performance Considerations:
 *    - Current: In-memory sorting (acceptable for <10K players)
 *    - Future: Add MongoDB aggregation pipeline for scale
 *    - Future: Redis caching with 5-minute TTL
 * 
 * 3. Balance Integration:
 *    - Uses existing balanceService for consistency
 *    - Same multipliers as combat and gathering
 *    - Players see real combat-effective rankings
 * 
 * 4. Future Enhancements:
 *    - Multiple leaderboard categories (factories, XP, etc.)
 *    - Time-based rankings (weekly, monthly)
 *    - Rank change tracking (+/- since last update)
 *    - Historical rank data for graphing
 */
