/**
 * Ranking Service
 * Created: 2025-10-17
 * Rewritten: 2026-09-19 (FID-20260917-017 slice 5: Mongo shim → direct drizzle/pg)
 *
 * OVERVIEW:
 * Core service for player ranking calculations based on effective power.
 * Effective power considers total military strength (STR + DEF) adjusted
 * by army balance multiplier. Rankings are sorted descending by effective power.
 *
 * RANKING FORMULA:
 * effectivePower = (totalStrength + totalDefense) × balanceMultiplier
 *
 * BALANCE MULTIPLIERS (effective bands — the ratio is min/max so it never
 * exceeds 1; band resolution lives in balanceService.getBalanceEffects,
 * the table below is a mirror, pinned by __tests__/lib/headerTruthPins.test.ts):
 * - Critical (ratio < 0.7): 0.5x
 * - Imbalanced (0.7-0.85): 0.8x
 * - Balanced (0.85-0.95): 1.0x
 * - Optimal (0.95-1.0): 1.1x
 *
 * KEY FEATURES:
 * - Efficient drizzle/pg queries for top N rankings (factory counts via one
 *   grouped COUNT — the former per-collection aggregate shim call)
 * - Player rank lookup by username
 * - Total player count for context
 * - Handles ties with consistent ordering
 */

import { db } from '@/lib/db';
import { players, factories } from '@/lib/db/schema';
import { count, eq, ne, inArray, and } from 'drizzle-orm';
import { calculateBalanceEffects } from '@/lib/balanceService';

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

/** Beer Base ladder entry (FID-20260912-069): special bases ranked by power. */
export interface RankedBeerBase {
  rank: number;
  username: string;
  level: number;
  totalStrength: number;
  totalDefense: number;
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
 *   totalStrength: 4000,
 *   totalDefense: 5000
 * });
 * // Returns: 7200 (9000 × 0.8 for imbalanced army, ratio 0.8)
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
 * The leaderboard ranking rows: bots are excluded (`isBot` smallint default 0 —
 * `ne(players.isBot, 1)` matches every non-bot including legacy NULLs).
 */
function rankablePlayers() {
  return db
    .select({
      username: players.username,
      totalStrength: players.totalStrength,
      totalDefense: players.totalDefense,
      level: players.level,
    })
    .from(players)
    .where(ne(players.isBot, 1));
}

/** Effective-power fields derived from a rankable row (pure, shared by all lookups). */
function powerFields(row: {
  totalStrength: number | null;
  totalDefense: number | null;
}) {
  const totalStrength = row.totalStrength || 0;
  const totalDefense = row.totalDefense || 0;
  const totalPower = totalStrength + totalDefense;
  const balanceEffects = calculateBalanceEffects(totalStrength, totalDefense);
  const effectivePower = Math.floor(totalPower * balanceEffects.powerMultiplier);
  return {
    totalStrength,
    totalDefense,
    totalPower,
    balanceMultiplier: balanceEffects.powerMultiplier,
    balanceStatus: balanceEffects.status,
    effectivePower,
  };
}

/** Deterministic tie-break: effective power desc, then username asc. */
function byPowerDesc(a: { effectivePower: number; username: string }, b: { effectivePower: number; username: string }): number {
  if (b.effectivePower !== a.effectivePower) {
    return b.effectivePower - a.effectivePower;
  }
  return a.username.localeCompare(b.username);
}

/** Factory counts per owner in one grouped query (pg COUNT — no aggregate shim). */
async function factoryCountsByOwner(usernames: string[]): Promise<Map<string, number>> {
  if (usernames.length === 0) return new Map();
  const rows = await db
    .select({ owner: factories.owner, count: count() })
    .from(factories)
    .where(inArray(factories.owner, usernames))
    .groupBy(factories.owner);
  return new Map(rows.map((r) => [r.owner as string, Number(r.count)]));
}

/**
 * Top Beer Bases (bots with bot_config.isSpecialBase = true), ranked by
 * raw power (STR+DEF — no balance multiplier; base garrisons are symmetric
 * by design). Shown as its own ladder on the rankings page so the world's
 * PvE targets are visible without polluting the human player ranking.
 */
export async function getTopBeerBases(limit: number = 25): Promise<RankedBeerBase[]> {
  const rows = await db
    .select({
      username: players.username,
      level: players.level,
      totalStrength: players.totalStrength,
      totalDefense: players.totalDefense,
    })
    .from(players)
    .where(and(eq(players.isBot, 1), eq(players.isSpecialBase, 1)));

  return rows
    .map((b) => ({
      username: b.username,
      level: b.level || 1,
      totalStrength: b.totalStrength || 0,
      totalDefense: b.totalDefense || 0,
    }))
    .sort((a, b) =>
      (b.totalStrength + b.totalDefense) - (a.totalStrength + a.totalDefense)
    )
    .slice(0, limit)
    .map((b, i) => ({ rank: i + 1, ...b }));
}

/**
 * Get top N players ranked by effective power
 * Uses pg for filtering; balance math stays JS-side (single source: balanceService).
 *
 * @param limit - Number of top players to return (default 100)
 * @returns Array of ranked players
 *
 * @example
 * const topPlayers = await getTopPlayers(100);
 * console.log(topPlayers[0]); // #1 ranked player
 */
export async function getTopPlayers(limit: number = 100): Promise<RankedPlayer[]> {
  const rows = await rankablePlayers();

  // Calculate effective power for each player
  const rankedPlayers = rows.map((row) => ({
    username: row.username,
    level: row.level || 1,
    ...powerFields(row),
  }));

  // Sort by effective power descending, username tie-break (same as before)
  rankedPlayers.sort(byPowerDesc);

  // Get factory counts for top players — one grouped COUNT
  const topRows = rankedPlayers.slice(0, limit);
  const factoryCountMap = await factoryCountsByOwner(topRows.map((p) => p.username));

  // Add ranks and factory counts to top N players
  return topRows.map((player, index) => ({
    rank: index + 1,
    username: player.username,
    effectivePower: player.effectivePower,
    totalPower: player.totalPower,
    balanceMultiplier: player.balanceMultiplier,
    balanceStatus: player.balanceStatus,
    totalStrength: player.totalStrength,
    totalDefense: player.totalDefense,
    factoriesOwned: factoryCountMap.get(player.username) || 0,
    level: player.level,
  }));
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
  const rows = await rankablePlayers();

  const rankedPlayers = rows.map((row) => ({
    username: row.username,
    ...powerFields(row),
  }));

  rankedPlayers.sort(byPowerDesc);

  // Find player's rank
  const rank = rankedPlayers.findIndex((p) => p.username === username);
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
  const [playerRow] = await db
    .select({ username: players.username })
    .from(players)
    .where(eq(players.username, username))
    .limit(1);
  if (!playerRow) return null;

  const rows = await rankablePlayers();

  const rankedPlayers = rows.map((row) => ({
    username: row.username,
    level: row.level || 1,
    ...powerFields(row),
  }));

  rankedPlayers.sort(byPowerDesc);

  // Find player's rank
  const playerIndex = rankedPlayers.findIndex((p) => p.username === username);
  if (playerIndex === -1) return null;

  const rank = playerIndex + 1;
  const currentPlayer = rankedPlayers[playerIndex];

  const toContext = (index: number, rankNumber: number): RankedPlayer => ({
    rank: rankNumber,
    username: rankedPlayers[index].username,
    effectivePower: rankedPlayers[index].effectivePower,
    totalPower: rankedPlayers[index].totalPower,
    balanceMultiplier: rankedPlayers[index].balanceMultiplier,
    balanceStatus: rankedPlayers[index].balanceStatus,
    totalStrength: rankedPlayers[index].totalStrength,
    totalDefense: rankedPlayers[index].totalDefense,
    factoriesOwned: 0, // Not fetched for context players
    level: rankedPlayers[index].level,
  });

  return {
    rank,
    totalPlayers: rankedPlayers.length,
    effectivePower: currentPlayer.effectivePower,
    playerAbove: playerIndex > 0 ? toContext(playerIndex - 1, playerIndex) : undefined,
    playerBelow: playerIndex < rankedPlayers.length - 1 ? toContext(playerIndex + 1, rank + 1) : undefined,
  };
}

/**
 * Get total number of players
 *
 * @returns Total player count
 */
export async function getTotalPlayerCount(): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(players)
    .where(ne(players.isBot, 1)); // Exclude bots
  return Number(row?.count ?? 0);
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
 *    - pg filtering + one grouped COUNT; balance math is pure JS
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
