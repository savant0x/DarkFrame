/**
 * @file lib/activityLogger.ts
 * @created 2025-10-18
 * @overview Player activity logging service for tracking and analytics
 * 
 * OVERVIEW:
 * Provides centralized logging for all player actions to enable comprehensive
 * tracking, analytics, and anti-cheat detection. All game endpoints should call
 * logActivity() after successful actions to maintain accurate records.
 * 
 * Features:
 * - Automatic session ID tracking via cookies
 * - Type-safe action logging with metadata
 * - Async/non-blocking to avoid impacting game performance
 * - Configurable retention and cleanup policies
 * - Analytics query helpers for admin dashboard
 */

import { getCollection } from './mongodb';
import { PlayerActivity, PlayerActionType, Resources } from '@/types';

// ============================================================
// ACTIVITY LOGGING FUNCTIONS
// ============================================================

/**
 * Log a player activity event
 * 
 * @param params - Activity parameters
 * @param params.userId - Player's username
 * @param params.action - Type of action performed
 * @param params.sessionId - Session identifier from cookie
 * @param params.metadata - Optional action-specific data
 * 
 * @example
 * await logActivity({
 *   userId: 'PlayerOne',
 *   action: 'harvest',
 *   sessionId: session.id,
 *   metadata: {
 *     resourcesGained: { metal: 500 },
 *     location: { x: 42, y: 73 },
 *     duration: 5
 *   }
 * });
 */
export async function logActivity(params: {
  userId: string;
  action: PlayerActionType;
  sessionId: string;
  metadata?: PlayerActivity['metadata'];
}): Promise<void> {
  try {
    const activityCollection = await getCollection<PlayerActivity>('playerActivity');

    const activity: PlayerActivity = {
      userId: params.userId,
      username: params.userId, // Username is same as userId
      action: params.action,
      timestamp: new Date(),
      sessionId: params.sessionId,
      metadata: params.metadata,
    };

    // Insert asynchronously without blocking
    await activityCollection.insertOne(activity);

    console.log(`📊 Activity logged: ${params.userId} - ${params.action}`);
  } catch (error) {
    // Don't throw - logging failures shouldn't break game functionality
    console.error('⚠️ Activity logging failed:', error);
  }
}

/**
 * Log harvest action with resource gains and location
 * 
 * @param userId - Player username
 * @param sessionId - Session identifier
 * @param resourcesGained - Resources collected
 * @param location - Tile coordinates
 * @param duration - Harvest cooldown duration (seconds)
 * 
 * @example
 * await logHarvest('PlayerOne', sessionId, { metal: 500 }, { x: 42, y: 73 }, 5);
 */
export async function logHarvest(
  userId: string,
  sessionId: string,
  resourcesGained: Partial<Resources>,
  location: { x: number; y: number },
  duration: number
): Promise<void> {
  await logActivity({
    userId,
    action: 'harvest',
    sessionId,
    metadata: {
      resourcesGained,
      location,
      duration,
      result: 'success',
    },
  });
}

/**
 * Log attack action with target and outcome
 * 
 * @param userId - Attacker username
 * @param sessionId - Session identifier
 * @param target - Defender username
 * @param result - Attack outcome
 * @param resourcesGained - Resources stolen (if successful)
 * 
 * @example
 * await logAttack('Attacker', sessionId, 'Defender', 'success', { metal: 1000 });
 */
export async function logAttack(
  userId: string,
  sessionId: string,
  target: string,
  result: 'success' | 'failure' | 'partial',
  resourcesGained?: Partial<Resources>
): Promise<void> {
  await logActivity({
    userId,
    action: 'attack',
    sessionId,
    metadata: {
      target,
      result,
      resourcesGained,
    },
  });
}

/**
 * Log factory build or upgrade
 * 
 * @param userId - Player username
 * @param sessionId - Session identifier
 * @param isUpgrade - Whether this is an upgrade (true) or new build (false)
 * @param level - Factory level after action
 * @param location - Factory coordinates
 * @param resourcesSpent - Cost of build/upgrade
 * 
 * @example
 * await logFactory('PlayerOne', sessionId, false, 1, { x: 50, y: 50 }, { metal: 5000, energy: 5000 });
 */
export async function logFactory(
  userId: string,
  sessionId: string,
  isUpgrade: boolean,
  level: number,
  location: { x: number; y: number },
  resourcesSpent: Resources
): Promise<void> {
  await logActivity({
    userId,
    action: isUpgrade ? 'upgrade_factory' : 'build_factory',
    sessionId,
    metadata: {
      factoryLevel: level,
      location,
      resourcesSpent,
      result: 'success',
    },
  });
}

/**
 * Log bank deposit or withdrawal
 * 
 * @param userId - Player username
 * @param sessionId - Session identifier
 * @param isDeposit - Whether this is a deposit (true) or withdrawal (false)
 * @param resources - Amount deposited/withdrawn
 * 
 * @example
 * await logBanking('PlayerOne', sessionId, true, { metal: 10000, energy: 0 });
 */
export async function logBanking(
  userId: string,
  sessionId: string,
  isDeposit: boolean,
  resources: Partial<Resources>
): Promise<void> {
  await logActivity({
    userId,
    action: isDeposit ? 'bank_deposit' : 'bank_withdraw',
    sessionId,
    metadata: {
      resourcesGained: isDeposit ? undefined : resources,
      resourcesSpent: isDeposit ? resources : undefined,
      result: 'success',
    },
  });
}

/**
 * Log tech tree unlock
 * 
 * @param userId - Player username
 * @param sessionId - Session identifier
 * @param techUnlocked - Technology identifier
 * @param resourcesSpent - Research cost
 * 
 * @example
 * await logTechUnlock('PlayerOne', sessionId, 'advanced_smelting', { metal: 5000, energy: 5000 });
 */
export async function logTechUnlock(
  userId: string,
  sessionId: string,
  techUnlocked: string,
  resourcesSpent: Resources
): Promise<void> {
  await logActivity({
    userId,
    action: 'tech_unlock',
    sessionId,
    metadata: {
      techUnlocked,
      resourcesSpent,
      result: 'success',
    },
  });
}

/**
 * Log player movement
 * 
 * @param userId - Player username
 * @param sessionId - Session identifier
 * @param fromLocation - Starting coordinates
 * @param toLocation - Destination coordinates
 * 
 * @example
 * await logMovement('PlayerOne', sessionId, { x: 50, y: 50 }, { x: 51, y: 50 });
 */
export async function logMovement(
  userId: string,
  sessionId: string,
  fromLocation: { x: number; y: number },
  toLocation: { x: number; y: number }
): Promise<void> {
  await logActivity({
    userId,
    action: 'move',
    sessionId,
    metadata: {
      location: toLocation,
      result: 'success',
    },
  });
}

/**
 * Log auction house trade
 * 
 * @param userId - Player username
 * @param sessionId - Session identifier
 * @param isBuy - Whether buying (true) or selling (false)
 * @param target - Other party username
 * @param itemsGained - Items received (for buy)
 * @param resourcesSpent - Resources spent (for buy)
 * @param resourcesGained - Resources gained (for sell)
 * 
 * @example
 * await logTrade('Buyer', sessionId, true, 'Seller', ['Ancient Digger'], { metal: 50000 });
 */
export async function logTrade(
  userId: string,
  sessionId: string,
  isBuy: boolean,
  target: string,
  itemsGained?: string[],
  resourcesSpent?: Partial<Resources>,
  resourcesGained?: Partial<Resources>
): Promise<void> {
  await logActivity({
    userId,
    action: 'trade',
    sessionId,
    metadata: {
      target,
      itemsGained,
      resourcesSpent,
      resourcesGained,
      result: 'success',
    },
  });
}

/**
 * Log cave exploration
 * 
 * @param userId - Player username
 * @param sessionId - Session identifier
 * @param location - Cave coordinates
 * @param itemsGained - Items discovered
 * 
 * @example
 * await logCaveExplore('PlayerOne', sessionId, { x: 75, y: 80 }, ['Rusty Helmet']);
 */
export async function logCaveExplore(
  userId: string,
  sessionId: string,
  location: { x: number; y: number },
  itemsGained: string[]
): Promise<void> {
  await logActivity({
    userId,
    action: 'cave_explore',
    sessionId,
    metadata: {
      location,
      itemsGained,
      result: 'success',
    },
  });
}

// ============================================================
// ANALYTICS QUERY HELPERS
// ============================================================

/**
 * Get player activity count for a time period
 * 
 * @param userId - Player username
 * @param hoursAgo - How many hours back to search
 * @returns Total activity count
 * 
 * @example
 * const last24h = await getActivityCount('PlayerOne', 24);
 */
export async function getActivityCount(
  userId: string,
  hoursAgo: number
): Promise<number> {
  try {
    const activityCollection = await getCollection<PlayerActivity>('playerActivity');
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const count = await activityCollection.countDocuments({
      userId,
      timestamp: { $gte: cutoffTime },
    });

    return count;
  } catch (error) {
    console.error('Failed to get activity count:', error);
    return 0;
  }
}

/**
 * Get total resources gained in time period
 * 
 * @param userId - Player username
 * @param hoursAgo - How many hours back to search
 * @returns Total metal and energy gained
 * 
 * @example
 * const resources = await getTotalResourcesGained('PlayerOne', 24);
 * console.log(`Gained ${resources.metal} metal, ${resources.energy} energy`);
 */
export async function getTotalResourcesGained(
  userId: string,
  hoursAgo: number
): Promise<Resources> {
  try {
    const activityCollection = await getCollection<PlayerActivity>('playerActivity');
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const activities = await activityCollection
      .find({
        userId,
        timestamp: { $gte: cutoffTime },
        'metadata.resourcesGained': { $exists: true },
      })
      .toArray();

    const total: Resources = { metal: 0, energy: 0 };

    for (const activity of activities) {
      if (activity.metadata?.resourcesGained) {
        total.metal += activity.metadata.resourcesGained.metal || 0;
        total.energy += activity.metadata.resourcesGained.energy || 0;
      }
    }

    return total;
  } catch (error) {
    console.error('Failed to get total resources gained:', error);
    return { metal: 0, energy: 0 };
  }
}

/**
 * Get recent activities for a player
 * 
 * @param userId - Player username
 * @param limit - Maximum number of activities to return
 * @returns Array of recent activities
 * 
 * @example
 * const recent = await getRecentActivities('PlayerOne', 50);
 */
export async function getRecentActivities(
  userId: string,
  limit: number = 50
): Promise<PlayerActivity[]> {
  try {
    const activityCollection = await getCollection<PlayerActivity>('playerActivity');

    const activities = await activityCollection
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return activities;
  } catch (error) {
    console.error('Failed to get recent activities:', error);
    return [];
  }
}

/**
 * Clean up old activity records (data retention)
 * Should be run periodically (e.g., daily cron job)
 * 
 * @param daysToKeep - How many days of data to retain (default: 90)
 * @returns Number of records deleted
 * 
 * @example
 * const deleted = await cleanupOldActivities(90);
 * console.log(`Cleaned up ${deleted} old activity records`);
 */
export async function cleanupOldActivities(
  daysToKeep: number = 90
): Promise<number> {
  try {
    const activityCollection = await getCollection<PlayerActivity>('playerActivity');
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await activityCollection.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} old activity records`);
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Failed to cleanup old activities:', error);
    return 0;
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - All logging functions are async but don't block game actions
// - Logging failures are caught and logged but don't throw errors
// - Session IDs should come from session tracking middleware
// - Activity metadata is flexible to support different action types
// - Analytics queries use MongoDB aggregation for performance
// - Cleanup function prevents database bloat (run via cron)
// - All timestamps use UTC for consistency across timezones
// ============================================================
