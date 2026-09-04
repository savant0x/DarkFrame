/**
 * @file lib/activityLogger.ts
 * @overview Player activity logging service for tracking and analytics.
 *
 * Rewritten to write the REAL Postgres `player_activity` table via drizzle. The previous
 * version inserted Mongo-shaped docs through the compat shim, which crashed on every
 * login (`null value in column "id"`) — the table requires an `id` PK the shim never
 * generated, and `userId`/`sessionId`/`metadata` had no columns.
 *
 * Row layout (see lib/db/schema/config.ts): id, player_id, action, timestamp,
 * details (jsonb, reserved for lib/activityLogService), plus nullable session_id and
 * metadata (jsonb) added by migration 0006 for this logger.
 */

import { db } from './db';
import { playerActivity } from './db/schema';
import { and, eq, gte, lt, desc, sql } from 'drizzle-orm';
import type { PlayerActivity, PlayerActionType, Resources } from '@/types';
import { generateId } from './utils';

// ============================================================
// ACTIVITY LOGGING FUNCTIONS
// ============================================================

/**
 * Log a player activity event.
 *
 * @param params.userId - Player's username
 * @param params.action - Type of action performed
 * @param params.sessionId - Session identifier from sessionTracker
 * @param params.metadata - Optional action-specific data
 */
export async function logActivity(params: {
  userId: string;
  action: PlayerActionType;
  sessionId: string;
  metadata?: PlayerActivity['metadata'];
}): Promise<void> {
  try {
    await db.insert(playerActivity).values({
      id: generateId(),
      playerId: params.userId,
      action: params.action,
      timestamp: new Date(),
      sessionId: params.sessionId,
      metadata: params.metadata ?? null,
    });

    console.log(`📊 Activity logged: ${params.userId} - ${params.action}`);
  } catch (error) {
    // Don't throw - logging failures shouldn't break game functionality
    console.error('⚠️ Activity logging failed:', error);
  }
}

/**
 * Log harvest action with resource gains and location.
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
 * Log attack action with target and outcome.
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
 * Log factory build or upgrade.
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
 * Log bank deposit or withdrawal.
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
 * Log tech tree unlock.
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
 * Log player movement.
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
 * Log auction house trade.
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
 * Log cave exploration.
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

/** Extract the mongo-parity metadata object from a raw row (full or projected). */
function rowMetadata(row: {
  metadata: PlayerActivity['metadata'] | null;
}): PlayerActivity['metadata'] {
  return row.metadata ?? undefined;
}

/**
 * Get player activity count for a time period.
 *
 * @param userId - Player username
 * @param hoursAgo - How many hours back to search
 */
export async function getActivityCount(
  userId: string,
  hoursAgo: number
): Promise<number> {
  try {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(playerActivity)
      .where(
        and(eq(playerActivity.playerId, userId), gte(playerActivity.timestamp, cutoffTime))
      );
    return Number(row?.count ?? 0);
  } catch (error) {
    console.error('Failed to get activity count:', error);
    return 0;
  }
}

/**
 * Get total resources gained in a time period.
 *
 * @param userId - Player username
 * @param hoursAgo - How many hours back to search
 */
export async function getTotalResourcesGained(
  userId: string,
  hoursAgo: number
): Promise<Resources> {
  try {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const rows = await db
      .select({ metadata: playerActivity.metadata })
      .from(playerActivity)
      .where(
        and(eq(playerActivity.playerId, userId), gte(playerActivity.timestamp, cutoffTime))
      );

    const total: Resources = { metal: 0, energy: 0 };
    for (const row of rows) {
      const gained = rowMetadata(row)?.resourcesGained;
      if (gained) {
        total.metal += gained.metal ?? 0;
        total.energy += gained.energy ?? 0;
      }
    }
    return total;
  } catch (error) {
    console.error('Failed to get total resources gained:', error);
    return { metal: 0, energy: 0 };
  }
}

/**
 * Get recent activities for a player.
 *
 * @param userId - Player username
 * @param limit - Maximum number of activities to return
 */
export async function getRecentActivities(
  userId: string,
  limit: number = 50
): Promise<PlayerActivity[]> {
  try {
    const rows = await db
      .select()
      .from(playerActivity)
      .where(eq(playerActivity.playerId, userId))
      .orderBy(desc(playerActivity.timestamp))
      .limit(limit);

    return rows.map((row) => ({
      userId: row.playerId,
      username: row.playerId,
      action: row.action as PlayerActionType,
      timestamp: row.timestamp,
      sessionId: row.sessionId ?? '',
      metadata: rowMetadata(row),
    }));
  } catch (error) {
    console.error('Failed to get recent activities:', error);
    return [];
  }
}

/**
 * Clean up old activity records (data retention).
 *
 * @param daysToKeep - How many days of data to retain (default: 90)
 * @returns Number of records deleted
 */
export async function cleanupOldActivities(
  daysToKeep: number = 90
): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(playerActivity)
      .where(lt(playerActivity.timestamp, cutoffDate));
    const count = deleted.rowCount ?? 0;
    if (count > 0) {
      console.log(`🧹 Cleaned up ${count} old activity records`);
    }
    return count;
  } catch (error) {
    console.error('Failed to cleanup old activities:', error);
    return 0;
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Writes go to the real pg `player_activity` table (no compat shim).
// - `details` (jsonb) stays reserved for lib/activityLogService's entries;
//   this logger writes its mongo-parity `metadata` column.
// - Logging functions are async but never throw: failures are logged, not raised.
// ============================================================
