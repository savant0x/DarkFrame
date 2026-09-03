/**
 * @file lib/sessionTracker.ts
 * @created 2025-10-18
 * @overview Session tracking middleware for login/logout and duration analytics
 * 
 * OVERVIEW:
 * Manages player sessions from login to logout, tracking duration, activity counts,
 * and resource gains per session. Used for analytics, anti-cheat detection, and
 * admin monitoring of player engagement patterns.
 * 
 * Features:
 * - Automatic session creation on login
 * - Session update on activity
 * - Session closure on logout
 * - Idle session timeout handling
 * - Session analytics queries
 */

import { getCollection } from './mongodb';
import { PlayerSession, Resources } from '@/types';
import { randomBytes } from 'node:crypto';

// ============================================================
// SESSION MANAGEMENT FUNCTIONS
// ============================================================

/**
 * Generate unique session ID
 * 
 * @returns Unique session identifier
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Start a new player session
 * Called on login to create session record
 * 
 * @param userId - Player username
 * @param ipAddress - Client IP address (optional, for multi-account detection)
 * @returns Session ID for use in subsequent requests
 * 
 * @example
 * const sessionId = await startSession('PlayerOne', req.ip);
 * // Store sessionId in cookie or response
 */
export async function startSession(
  userId: string,
  ipAddress?: string
): Promise<string> {
  try {
    const sessionCollection = await getCollection<PlayerSession>('playerSessions');
    const sessionId = generateSessionId();

    const session: PlayerSession = {
      userId,
      username: userId,
      sessionId,
      startTime: new Date(),
      actionsCount: 0,
      resourcesGained: { metal: 0, energy: 0 },
      ipAddress,
    };

    await sessionCollection.insertOne(session);

    console.log(`🎮 Session started: ${userId} - ${sessionId}`);
    return sessionId;
  } catch (error) {
    console.error('Failed to start session:', error);
    // Return fallback session ID even on error
    return generateSessionId();
  }
}

/**
 * Update session with activity
 * Called after each player action to track activity count and resources
 * 
 * @param sessionId - Session identifier
 * @param resourcesGained - Resources gained in this action (optional)
 * 
 * @example
 * await updateSession(sessionId, { metal: 500 });
 */
export async function updateSession(
  sessionId: string,
  resourcesGained?: Partial<Resources>
): Promise<void> {
  try {
    const sessionCollection = await getCollection<PlayerSession>('playerSessions');

    const update: any = {
      $inc: { actionsCount: 1 },
    };

    // Add resources if provided
    if (resourcesGained) {
      if (resourcesGained.metal) {
        update.$inc['resourcesGained.metal'] = resourcesGained.metal;
      }
      if (resourcesGained.energy) {
        update.$inc['resourcesGained.energy'] = resourcesGained.energy;
      }
    }

    await sessionCollection.updateOne(
      { sessionId, endTime: { $exists: false } }, // Only update active sessions
      update
    );
  } catch (error) {
    console.error('Failed to update session:', error);
  }
}

/**
 * End a player session
 * Called on logout to finalize session duration and mark as complete
 * 
 * @param sessionId - Session identifier
 * 
 * @example
 * await endSession(sessionId);
 */
export async function endSession(sessionId: string): Promise<void> {
  try {
    const sessionCollection = await getCollection<PlayerSession>('playerSessions');

    const session = await sessionCollection.findOne({
      sessionId,
      endTime: { $exists: false },
    });

    if (!session) {
      console.warn(`Session not found or already ended: ${sessionId}`);
      return;
    }

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

    await sessionCollection.updateOne(
      { sessionId },
      {
        $set: {
          endTime,
          duration,
        },
      }
    );

    console.log(`🛑 Session ended: ${session.userId} - Duration: ${duration}s`);
  } catch (error) {
    console.error('Failed to end session:', error);
  }
}

/**
 * Get active session for a user
 * Used to check if user has an ongoing session
 * 
 * @param userId - Player username
 * @returns Active session or null
 * 
 * @example
 * const activeSession = await getActiveSession('PlayerOne');
 * if (activeSession) {
 *   console.log(`Active session: ${activeSession.sessionId}`);
 * }
 */
export async function getActiveSession(
  userId: string
): Promise<PlayerSession | null> {
  try {
    const sessionCollection = await getCollection<PlayerSession>('playerSessions');

    const session = await sessionCollection.findOne({
      userId,
      endTime: { $exists: false },
    });

    return session;
  } catch (error) {
    console.error('Failed to get active session:', error);
    return null;
  }
}

/**
 * Close idle sessions (sessions with no activity for X hours)
 * Should be run periodically (e.g., hourly cron job)
 * 
 * @param idleHours - Hours of inactivity before closing (default: 4)
 * @returns Number of sessions closed
 * 
 * @example
 * const closed = await closeIdleSessions(4);
 * console.log(`Closed ${closed} idle sessions`);
 */
export async function closeIdleSessions(idleHours: number = 4): Promise<number> {
  try {
    const sessionCollection = await getCollection<PlayerSession>('playerSessions');
    const cutoffTime = new Date(Date.now() - idleHours * 60 * 60 * 1000);

    // Find sessions started before cutoff and not yet ended
    const idleSessions = await sessionCollection
      .find({
        startTime: { $lt: cutoffTime },
        endTime: { $exists: false },
      })
      .toArray();

    let closedCount = 0;

    for (const session of idleSessions) {
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

      await sessionCollection.updateOne(
        { sessionId: session.sessionId },
        {
          $set: {
            endTime,
            duration,
          },
        }
      );

      closedCount++;
    }

    if (closedCount > 0) {
      console.log(`🧹 Closed ${closedCount} idle sessions`);
    }

    return closedCount;
  } catch (error) {
    console.error('Failed to close idle sessions:', error);
    return 0;
  }
}

// ============================================================
// SESSION ANALYTICS QUERIES
// ============================================================

/**
 * Get total session time for a player in time period
 * 
 * @param userId - Player username
 * @param hoursAgo - How many hours back to search
 * @returns Total session time in seconds
 * 
 * @example
 * const totalTime = await getTotalSessionTime('PlayerOne', 24);
 * const hours = Math.floor(totalTime / 3600);
 * console.log(`Played ${hours} hours in last 24h`);
 */
export async function getTotalSessionTime(
  userId: string,
  hoursAgo: number
): Promise<number> {
  try {
    const sessionCollection = await getCollection<PlayerSession>('playerSessions');
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const sessions = await sessionCollection
      .find({
        userId,
        startTime: { $gte: cutoffTime },
        duration: { $exists: true },
      })
      .toArray();

    const totalSeconds = sessions.reduce((sum: any, session: any) => sum + (session.duration || 0), 0);
    return totalSeconds;
  } catch (error) {
    console.error('Failed to get total session time:', error);
    return 0;
  }
}

/**
 * Get session count for a player in time period
 * 
 * @param userId - Player username
 * @param hoursAgo - How many hours back to search
 * @returns Number of sessions
 * 
 * @example
 * const sessions = await getSessionCount('PlayerOne', 168); // Last week
 */
export async function getSessionCount(
  userId: string,
  hoursAgo: number
): Promise<number> {
  try {
    const sessionCollection = await getCollection<PlayerSession>('playerSessions');
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const count = await sessionCollection.countDocuments({
      userId,
      startTime: { $gte: cutoffTime },
    });

    return count;
  } catch (error) {
    console.error('Failed to get session count:', error);
    return 0;
  }
}

/**
 * Get average session duration for a player
 * 
 * @param userId - Player username
 * @param hoursAgo - How many hours back to search
 * @returns Average session duration in seconds
 * 
 * @example
 * const avgDuration = await getAverageSessionDuration('PlayerOne', 168);
 * console.log(`Average session: ${Math.floor(avgDuration / 60)} minutes`);
 */
export async function getAverageSessionDuration(
  userId: string,
  hoursAgo: number
): Promise<number> {
  try {
    const sessionCollection = await getCollection<PlayerSession>('playerSessions');
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const sessions = await sessionCollection
      .find({
        userId,
        startTime: { $gte: cutoffTime },
        duration: { $exists: true },
      })
      .toArray();

    if (sessions.length === 0) return 0;

    const totalSeconds = sessions.reduce((sum: any, session: any) => sum + (session.duration || 0), 0);
    return Math.floor(totalSeconds / sessions.length);
  } catch (error) {
    console.error('Failed to get average session duration:', error);
    return 0;
  }
}

/**
 * Get recent sessions for a player
 * 
 * @param userId - Player username
 * @param limit - Maximum number of sessions to return
 * @returns Array of recent sessions
 * 
 * @example
 * const recentSessions = await getRecentSessions('PlayerOne', 10);
 */
export async function getRecentSessions(
  userId: string,
  limit: number = 10
): Promise<PlayerSession[]> {
  try {
    const sessionCollection = await getCollection<PlayerSession>('playerSessions');

    const sessions = await sessionCollection
      .find({ userId })
      .sort({ startTime: -1 })
      .limit(limit)
      .toArray();

    return sessions;
  } catch (error) {
    console.error('Failed to get recent sessions:', error);
    return [];
  }
}

/**
 * Get all currently active sessions (for admin monitoring)
 * 
 * @returns Array of active sessions across all players
 * 
 * @example
 * const activeSessions = await getAllActiveSessions();
 * console.log(`${activeSessions.length} players online`);
 */
export async function getAllActiveSessions(): Promise<PlayerSession[]> {
  try {
    const sessionCollection = await getCollection<PlayerSession>('playerSessions');

    const sessions = await sessionCollection
      .find({ endTime: { $exists: false } })
      .sort({ startTime: -1 })
      .toArray();

    return sessions;
  } catch (error) {
    console.error('Failed to get all active sessions:', error);
    return [];
  }
}

/**
 * Clean up old session records (data retention)
 * Should be run periodically (e.g., daily cron job)
 * 
 * @param daysToKeep - How many days of data to retain (default: 90)
 * @returns Number of records deleted
 * 
 * @example
 * const deleted = await cleanupOldSessions(90);
 * console.log(`Cleaned up ${deleted} old session records`);
 */
export async function cleanupOldSessions(daysToKeep: number = 90): Promise<number> {
  try {
    const sessionCollection = await getCollection<PlayerSession>('playerSessions');
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await sessionCollection.deleteMany({
      startTime: { $lt: cutoffDate },
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} old session records`);
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Failed to cleanup old sessions:', error);
    return 0;
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Session IDs are cryptographically unique to prevent collisions
// - Active sessions have no endTime field (null/undefined)
// - Session updates are non-blocking to avoid impacting gameplay
// - Idle session cleanup prevents database bloat from disconnects
// - IP address tracking enables multi-account detection
// - All timestamps use UTC for consistency across timezones
// - Session analytics support admin dashboard metrics
// ============================================================
