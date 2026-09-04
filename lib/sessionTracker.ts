/**
 * @file lib/sessionTracker.ts
 * @overview Session tracking for login/logout and duration analytics.
 *
 * Rewritten to write the REAL Postgres `player_sessions` table via drizzle. The previous
 * version inserted Mongo-shaped docs through the compat shim, which crashed on every
 * login (`null value in column "id"`) because the table requires an `id` PK the shim
 * never generated and the doc carried no `token`/`expires_at` values.
 *
 * Row layout (see lib/db/schema/config.ts): legacy auth-token rows keep the required
 * columns (id, user_id, token, expires_at, created_at); analytics tracking adds the
 * nullable session_id/start/end/duration/actions/resources/ip columns.
 */

import { db } from './db';
import { playerSessions } from './db/schema';
import { and, eq, isNull, isNotNull, lt, gte, desc, sql } from 'drizzle-orm';
import type { PlayerSession, Resources } from '@/types';
import { generateId } from './utils';
import { randomBytes } from 'node:crypto';

/** One day, for the required `expires_at` column on tracker rows. */
const TRACKER_ROW_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Generate unique session ID (`session_<ts>_<hex>`, fits varchar(64)).
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/** Map a row of `player_sessions` to the domain PlayerSession shape. */
function mapRow(row: typeof playerSessions.$inferSelect): PlayerSession {
  return {
    userId: row.userId,
    username: row.userId,
    sessionId: row.sessionId ?? row.token,
    startTime: row.startTime ?? row.createdAt,
    endTime: row.endTime ?? undefined,
    duration: row.duration ?? undefined,
    actionsCount: row.actionsCount ?? 0,
    resourcesGained: {
      metal: row.resourcesGainedMetal ?? 0,
      energy: row.resourcesGainedEnergy ?? 0,
    },
    ipAddress: row.ipAddress ?? undefined,
  };
}

/**
 * Start a new player session. Called on login.
 *
 * @param userId - Player username
 * @param ipAddress - Client IP address (optional, for multi-account detection)
 * @returns Session ID for use in subsequent requests
 */
export async function startSession(
  userId: string,
  ipAddress?: string
): Promise<string> {
  try {
    const sessionId = generateSessionId();
    const now = new Date();

    await db.insert(playerSessions).values({
      id: generateId(),
      userId,
      token: sessionId, // tracker rows double the session id as their token value
      expiresAt: new Date(now.getTime() + TRACKER_ROW_TTL_MS),
      createdAt: now,
      sessionId,
      startTime: now,
      actionsCount: 0,
      resourcesGainedMetal: 0,
      resourcesGainedEnergy: 0,
      ipAddress: ipAddress ?? null,
    });

    console.log(`🎮 Session started: ${userId} - ${sessionId}`);
    return sessionId;
  } catch (error) {
    // Non-fatal: analytics must never break login.
    console.error('Failed to start session:', error);
    return generateSessionId();
  }
}

/**
 * Update session with activity (action count + optional resource gains).
 *
 * @param sessionId - Session identifier
 * @param resourcesGained - Resources gained in this action (optional)
 */
export async function updateSession(
  sessionId: string,
  resourcesGained?: Partial<Resources>
): Promise<void> {
  try {
    await db
      .update(playerSessions)
      .set({
        actionsCount: sql`coalesce(${playerSessions.actionsCount}, 0) + 1`,
        ...(resourcesGained?.metal
          ? {
              resourcesGainedMetal: sql`coalesce(${playerSessions.resourcesGainedMetal}, 0) + ${Math.floor(resourcesGained.metal)}`,
            }
          : {}),
        ...(resourcesGained?.energy
          ? {
              resourcesGainedEnergy: sql`coalesce(${playerSessions.resourcesGainedEnergy}, 0) + ${Math.floor(resourcesGained.energy)}`,
            }
          : {}),
      })
      .where(
        and(eq(playerSessions.sessionId, sessionId), isNull(playerSessions.endTime))
      );
  } catch (error) {
    console.error('Failed to update session:', error);
  }
}

/**
 * End a player session (logout): finalize duration.
 *
 * @param sessionId - Session identifier
 */
export async function endSession(sessionId: string): Promise<void> {
  try {
    const [session] = await db
      .select()
      .from(playerSessions)
      .where(
        and(eq(playerSessions.sessionId, sessionId), isNull(playerSessions.endTime))
      )
      .limit(1);

    if (!session) {
      console.warn(`Session not found or already ended: ${sessionId}`);
      return;
    }

    const endTime = new Date();
    const duration = Math.floor(
      (endTime.getTime() - (session.startTime ?? session.createdAt).getTime()) / 1000
    );

    await db
      .update(playerSessions)
      .set({ endTime, duration })
      .where(eq(playerSessions.id, session.id));

    console.log(`🛑 Session ended: ${session.userId} - Duration: ${duration}s`);
  } catch (error) {
    console.error('Failed to end session:', error);
  }
}

/**
 * Get the active (not yet ended) session for a user, if any.
 *
 * @param userId - Player username
 */
export async function getActiveSession(
  userId: string
): Promise<PlayerSession | null> {
  try {
    const [row] = await db
      .select()
      .from(playerSessions)
      .where(and(eq(playerSessions.userId, userId), isNull(playerSessions.endTime)))
      .orderBy(desc(playerSessions.startTime))
      .limit(1);
    return row ? mapRow(row) : null;
  } catch (error) {
    console.error('Failed to get active session:', error);
    return null;
  }
}

/**
 * Close idle sessions (no activity for `idleHours` hours).
 *
 * @param idleHours - Hours of inactivity before closing (default: 4)
 * @returns Number of sessions closed
 */
export async function closeIdleSessions(idleHours: number = 4): Promise<number> {
  try {
    const cutoffTime = new Date(Date.now() - idleHours * 60 * 60 * 1000);

    const idleRows = await db
      .select()
      .from(playerSessions)
      .where(
        and(
          lt(playerSessions.startTime, cutoffTime),
          isNull(playerSessions.endTime)
        )
      );

    for (const row of idleRows) {
      const endTime = new Date();
      const duration = Math.floor(
        (endTime.getTime() - (row.startTime ?? row.createdAt).getTime()) / 1000
      );
      await db
        .update(playerSessions)
        .set({ endTime, duration })
        .where(eq(playerSessions.id, row.id));
    }

    if (idleRows.length > 0) {
      console.log(`🧹 Closed ${idleRows.length} idle sessions`);
    }
    return idleRows.length;
  } catch (error) {
    console.error('Failed to close idle sessions:', error);
    return 0;
  }
}

// ============================================================
// SESSION ANALYTICS QUERIES
// ============================================================

/**
 * Total session time (seconds) for a player within the last `hoursAgo` hours.
 */
export async function getTotalSessionTime(
  userId: string,
  hoursAgo: number
): Promise<number> {
  try {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(${playerSessions.duration}), 0)`,
      })
      .from(playerSessions)
      .where(
        and(
          eq(playerSessions.userId, userId),
          gte(playerSessions.startTime, cutoffTime),
          isNotNull(playerSessions.duration)
        )
      );
    return Number(row?.total ?? 0);
  } catch (error) {
    console.error('Failed to get total session time:', error);
    return 0;
  }
}

/**
 * Number of sessions for a player within the last `hoursAgo` hours.
 */
export async function getSessionCount(
  userId: string,
  hoursAgo: number
): Promise<number> {
  try {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(playerSessions)
      .where(
        and(eq(playerSessions.userId, userId), gte(playerSessions.startTime, cutoffTime))
      );
    return Number(row?.count ?? 0);
  } catch (error) {
    console.error('Failed to get session count:', error);
    return 0;
  }
}

/**
 * Average session duration (seconds) within the last `hoursAgo` hours.
 */
export async function getAverageSessionDuration(
  userId: string,
  hoursAgo: number
): Promise<number> {
  try {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const [row] = await db
      .select({
        avg: sql<number>`coalesce(avg(${playerSessions.duration}), 0)`,
      })
      .from(playerSessions)
      .where(
        and(
          eq(playerSessions.userId, userId),
          gte(playerSessions.startTime, cutoffTime),
          isNotNull(playerSessions.duration)
        )
      );
    return Math.floor(Number(row?.avg ?? 0));
  } catch (error) {
    console.error('Failed to get average session duration:', error);
    return 0;
  }
}

/**
 * Most recent sessions for a player.
 *
 * @param userId - Player username
 * @param limit - Maximum number of sessions to return
 */
export async function getRecentSessions(
  userId: string,
  limit: number = 10
): Promise<PlayerSession[]> {
  try {
    const rows = await db
      .select()
      .from(playerSessions)
      .where(eq(playerSessions.userId, userId))
      .orderBy(desc(playerSessions.startTime))
      .limit(limit);
    return rows.map(mapRow);
  } catch (error) {
    console.error('Failed to get recent sessions:', error);
    return [];
  }
}

/**
 * All currently active sessions across all players (admin monitoring).
 */
export async function getAllActiveSessions(): Promise<PlayerSession[]> {
  try {
    const rows = await db
      .select()
      .from(playerSessions)
      .where(isNull(playerSessions.endTime))
      .orderBy(desc(playerSessions.startTime));
    return rows.map(mapRow);
  } catch (error) {
    console.error('Failed to get all active sessions:', error);
    return [];
  }
}

/**
 * Delete session records older than `daysToKeep` days (data retention).
 *
 * @returns Number of records deleted
 */
export async function cleanupOldSessions(daysToKeep: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(playerSessions)
      .where(lt(playerSessions.startTime, cutoffDate));
    const count = deleted.rowCount ?? 0;
    if (count > 0) {
      console.log(`🧹 Cleaned up ${count} old session records`);
    }
    return count;
  } catch (error) {
    console.error('Failed to cleanup old sessions:', error);
    return 0;
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Writes go to the real pg `player_sessions` table (no compat shim).
// - Tracker rows are distinct from the auth-session rows the login flow's
//   `token`/`expires_at` columns were designed for; both coexist via the
//   nullable analytics columns (migration 0006).
// - All updates are non-fatal: analytics failures must not break gameplay.
// ============================================================
