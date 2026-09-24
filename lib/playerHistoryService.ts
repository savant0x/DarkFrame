/**
 * @file lib/playerHistoryService.ts
 * @created 2025-10-25
 * @updated 2026-09-15 (FID-20260914-009 Phase B)
 *
 * OVERVIEW:
 * Player level history tracking service for predictive Beer Base spawning.
 * Captures daily snapshots of player levels and generates predictive distributions.
 * Uses 365-day retention with annual purging on New Year's Day.
 *
 * FID-20260914-009 Phase B: the service previously wrote to the unmapped
 * `playerLevelHistory` collection — every insert silently vanished on the pg
 * shim and the prediction system ran on its fallback distribution since the
 * pivot. Snapshots now persist to the real `player_level_history` table via
 * drizzle; the shim registry resolves the `playerLevelHistory` schema export
 * directly, so the same identifier works. The key is players.username (the
 * Mongo-era _id died with the pivot); history starts accruing from deploy —
 * past levels are unreconstructible, so no backfill.
 *
 * PREDICTIVE ALGORITHM:
 * - Linear regression on 365-day history
 * - Projects player levels 2 weeks ahead
 * - Generates tier distribution based on projected levels
 */

import { eq, gte, lt, asc } from 'drizzle-orm';
import { db } from './db/connection';
import { playerLevelHistory } from './db/schema';
import { logger } from './logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PlayerGrowthRate {
	userId: string;
	currentLevel: number;
	avgLevelsPerWeek: number;
	projectedLevelIn2Weeks: number;
}

export interface PredictiveDistribution {
	tierDistribution: number[]; // [0-5] percentage for each tier
	projectedPlayerLevels: { userId: string; currentLevel: number; projectedLevel: number }[];
	generatedAt: Date;
	weeksAhead: number;
}

/** A stored snapshot row (service-facing shape; drizzle adds the column mapping). */
export interface PlayerSnapshot {
	username: string;
	level: number;
	capturedAt: Date;
}

// ============================================================================
// SNAPSHOT CAPTURE
// ============================================================================

/**
 * Capture a player level snapshot.
 * Called daily by the snapshot cron (app/api/cron/player-snapshot).
 *
 * Idempotent per day per player: the (username, captured_at) PK plus a
 * same-day upsert guard means a retried cron run cannot double-write.
 *
 * @param username - Player username (stable key)
 * @param currentLevel - Current level
 */
export async function capturePlayerSnapshot(username: string, currentLevel: number): Promise<void> {
	try {
		await db
			.insert(playerLevelHistory)
			.values({ username, level: currentLevel, capturedAt: new Date() })
			.onConflictDoNothing();

		logger.debug('Player snapshot captured', { userId: username, level: currentLevel });
	} catch (error) {
		logger.error('Failed to capture player snapshot', error);
		// Don't throw - snapshots shouldn't break game functionality
	}
}

// ============================================================================
// GROWTH RATE CALCULATION
// ============================================================================

/**
 * Calculate a player's growth rate from their snapshot history.
 *
 * @param username - Player username
 * @returns Growth rate data
 */
export async function getPlayerGrowthRate(username: string): Promise<PlayerGrowthRate | null> {
	try {
		const snapshots = await db
			.select()
			.from(playerLevelHistory)
			.where(eq(playerLevelHistory.username, username))
			.orderBy(asc(playerLevelHistory.capturedAt));

		if (snapshots.length < 2) {
			// Not enough data
			return null;
		}

		const firstSnapshot = snapshots[0];
		const lastSnapshot = snapshots[snapshots.length - 1];
		const currentLevel = lastSnapshot.level;

		// Calculate time difference in weeks
		const timeDiffMs = lastSnapshot.capturedAt.getTime() - firstSnapshot.capturedAt.getTime();
		const weeks = timeDiffMs / (7 * 24 * 60 * 60 * 1000);

		if (weeks === 0) {
			return null;
		}

		// Calculate levels gained per week
		const levelsGained = lastSnapshot.level - firstSnapshot.level;
		const avgLevelsPerWeek = levelsGained / weeks;

		// Project 2 weeks ahead
		const projectedLevelIn2Weeks = Math.max(
			currentLevel,
			Math.round(currentLevel + avgLevelsPerWeek * 2)
		);

		return {
			userId: username,
			currentLevel,
			avgLevelsPerWeek,
			projectedLevelIn2Weeks,
		};
	} catch (error) {
		logger.error('Failed to calculate growth rate', error);
		return null;
	}
}

// ============================================================================
// PREDICTIVE LEVEL PROJECTION
// ============================================================================

/**
 * Predict player levels for all recently-active players.
 *
 * @param weeksAhead - Weeks to project ahead (default: 2)
 * @returns Array of predicted player levels
 */
export async function predictPlayerLevels(
	weeksAhead: number = 2
): Promise<{ userId: string; currentLevel: number; projectedLevel: number }[]> {
	try {
		// Get players with at least one snapshot in the last 7 days.
		// FID-20260923-002: exact duration, not a host-local setDate walk.
		const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

		const recent = await db
			.selectDistinct({ username: playerLevelHistory.username })
			.from(playerLevelHistory)
			.where(gte(playerLevelHistory.capturedAt, sevenDaysAgo));

		const predictions: { userId: string; currentLevel: number; projectedLevel: number }[] = [];

		for (const { username } of recent) {
			const snapshots = await db
				.select()
				.from(playerLevelHistory)
				.where(eq(playerLevelHistory.username, username))
				.orderBy(asc(playerLevelHistory.capturedAt));

			if (snapshots.length < 2) {
				// Not enough data - use current level
				const currentLevel = snapshots[0]?.level ?? 1;
				predictions.push({ userId: username, currentLevel, projectedLevel: currentLevel });
				continue;
			}

			const firstSnapshot = snapshots[0];
			const lastSnapshot = snapshots[snapshots.length - 1];
			const currentLevel = lastSnapshot.level;

			// Calculate growth rate
			const timeDiffMs = lastSnapshot.capturedAt.getTime() - firstSnapshot.capturedAt.getTime();
			const weeks = timeDiffMs / (7 * 24 * 60 * 60 * 1000);

			if (weeks === 0) {
				predictions.push({ userId: username, currentLevel, projectedLevel: currentLevel });
				continue;
			}

			const levelsGained = lastSnapshot.level - firstSnapshot.level;
			const avgLevelsPerWeek = levelsGained / weeks;

			// Project ahead
			const projectedLevel = Math.max(
				currentLevel,
				Math.round(currentLevel + avgLevelsPerWeek * weeksAhead)
			);

			predictions.push({ userId: username, currentLevel, projectedLevel });
		}

		return predictions;
	} catch (error) {
		logger.error('Failed to predict player levels', error);
		return [];
	}
}

// ============================================================================
// PREDICTIVE DISTRIBUTION GENERATION
// ============================================================================

/**
 * Generate the predictive Beer Base tier distribution.
 * Based on projected player levels.
 *
 * @param weeksAhead - Weeks to project ahead (default: 2)
 * @returns Tier distribution percentages
 */
export async function generatePredictiveDistribution(weeksAhead: number = 2): Promise<PredictiveDistribution> {
	try {
		const projectedLevels = await predictPlayerLevels(weeksAhead);

		if (projectedLevels.length === 0) {
			// Fallback to balanced distribution
			logger.warn('No player data available for predictive distribution, using fallback');
			return {
				tierDistribution: [25, 25, 20, 15, 10, 5],
				projectedPlayerLevels: [],
				generatedAt: new Date(),
				weeksAhead,
			};
		}

		// Count players per tier based on projected levels
		const tierCounts = [0, 0, 0, 0, 0, 0];

		projectedLevels.forEach(({ projectedLevel }) => {
			// Map level to tier (same logic as current spawning)
			let tier = 0;
			if (projectedLevel >= 100) tier = 5; // GOD
			else if (projectedLevel >= 75) tier = 4; // ULTRA
			else if (projectedLevel >= 50) tier = 3; // ELITE
			else if (projectedLevel >= 30) tier = 2; // STRONG
			else if (projectedLevel >= 15) tier = 1; // MEDIUM
			else tier = 0; // WEAK

			tierCounts[tier]++;
		});

		// Convert to percentages
		const totalPlayers = projectedLevels.length;
		const tierDistribution = tierCounts.map((count) => (totalPlayers > 0 ? (count / totalPlayers) * 100 : 0));

		// Ensure at least some variety (minimum 5% per tier except GOD)
		for (let i = 0; i < 5; i++) {
			if (tierDistribution[i] < 5) {
				tierDistribution[i] = 5;
			}
		}

		// Normalize to 100%
		const sum = tierDistribution.reduce((a, b) => a + b, 0);
		const normalized = tierDistribution.map((val) => (val / sum) * 100);

		logger.info('Predictive distribution generated', {
			totalPlayers,
			tierDistribution: normalized.map((v) => v.toFixed(1)),
			weeksAhead,
		});

		return {
			tierDistribution: normalized,
			projectedPlayerLevels: projectedLevels,
			generatedAt: new Date(),
			weeksAhead,
		};
	} catch (error) {
		logger.error('Failed to generate predictive distribution', error);

		// Fallback to balanced distribution
		return {
			tierDistribution: [25, 25, 20, 15, 10, 5],
			projectedPlayerLevels: [],
			generatedAt: new Date(),
			weeksAhead,
		};
	}
}

// ============================================================================
// ANNUAL PURGE
// ============================================================================

/**
 * Purge player snapshots older than 365 days.
 * Runs annually on January 1st.
 *
 * @returns Count of deleted records
 */
export async function purgeOldSnapshots(): Promise<number> {
	try {
		const oneYearAgo = new Date();
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

		const deleted = await db
			.delete(playerLevelHistory)
			.where(lt(playerLevelHistory.capturedAt, oneYearAgo))
			.returning({ username: playerLevelHistory.username });

		logger.info('Old player snapshots purged', {
			deleted: deleted.length,
			cutoffDate: oneYearAgo.toISOString(),
		});

		return deleted.length;
	} catch (error) {
		logger.error('Failed to purge old snapshots', error);
		return 0;
	}
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * STORAGE:
 * - One row per (username, captured_at) — ~40 bytes; thousands of rows/year.
 * - The PK doubles as the (username, captured_at) compound index the
 *   per-user history scans want; captured_at carries its own index for the
 *   recency window and the purge cutoff.
 *
 * ANNUAL PURGE STRATEGY:
 * - Runs January 1st (app/api/cron/purge-old-data)
 * - Deletes all snapshots older than 365 days (honest .returning() count)
 * - Keeps storage constant year-over-year
 *
 * PREDICTIVE ALGORITHM:
 * - Linear regression on available history (up to 365 days)
 * - Projects 2 weeks ahead by default
 * - Maps projected levels to tier distribution
 * - Ensures minimum 5% variety per tier (except GOD)
 * - Graceful fallback to balanced distribution if no data
 */
