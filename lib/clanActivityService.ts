/**
 * Clan Activity Service - Activity Logging & Feed
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages clan activity logging and activity feed generation.
 * Integrates with the P6 activity logging system to track all clan-related events.
 * Provides filtered views of clan activities for members and analytics.
 * 
 * Key Features:
 * - Log all clan activities (member changes, research, wars, banking, etc.)
 * - Retrieve activity feed with filtering and pagination
 * - Activity type filtering (show only specific types)
 * - Time-based queries (last 24 hours, last week, etc.)
 * - Player-specific activity tracking
 * - Integration with general activity logging system
 * 
 * Dependencies:
 * - Drizzle ORM database connection
 * - types/clan.types.ts for activity types
 * - lib/activityLogService.ts for general activity logging
 */

import { db } from '@/lib/db';
import { players, clans } from '@/lib/db/schema';
import { eq, and, inArray, desc, gt, lt, gte, lte, sql, asc, type SQL } from 'drizzle-orm';
import {
  ClanActivity,
  ClanActivityType,
} from '@/types/clan.types';

export async function logClanActivity(
  clanId: string,
  activityType: ClanActivityType,
  playerId?: string,
  details?: Record<string, any>
): Promise<ClanActivity> {
  let username: string | undefined;
  if (playerId) {
    const playerRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
    username = playerRows[0]?.username || playerId;
  }
  
  const activity: Omit<ClanActivity, '_id'> = {
    clanId,
    activityType,
    playerId,
    username,
    details: details || {},
    timestamp: new Date(),
  };
  
  // pg node-postgres: rows come back under .rows; RETURNING supplies the insert id
  // (MySQL insertId does not exist on Postgres).
  const result = await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, player_id, username, details, timestamp)
    VALUES (${clanId}, ${activityType}, ${playerId || null}, ${username || null},
            ${JSON.stringify(activity.details)}, ${activity.timestamp})
    RETURNING id
  `);
  const insertRow = result.rows[0] as { id: number | string } | undefined;

  const createdActivity = {
    ...activity,
    _id: insertRow?.id?.toString(),
  } as ClanActivity;
  
  try {
    await db.execute(sql`
      INSERT INTO activity_logs
      (player_id, username, activity_type, metadata, timestamp)
      VALUES (${playerId || null}, ${username || null}, ${`CLAN_${activityType}`},
              ${JSON.stringify({ clanId, ...details })}, ${new Date()})
    `);
  } catch (error) {
    console.error('Failed to log to general activity system:', error);
  }
  
  return createdActivity;
}

export async function getClanActivityFeed(
  clanId: string,
  options: {
    limit?: number;
    offset?: number;
    activityTypes?: ClanActivityType[];
    playerId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<ClanActivity[]> {
  const {
    limit = 100,
    offset = 0,
    activityTypes,
    playerId,
    startDate,
    endDate,
  } = options;
  
  // Compose the query as a drizzle sql template so every filter is a bound
  // parameter (the previous '?'-placeholder string was never actually bound).
  const conditions: SQL[] = [sql`clan_id = ${clanId}`];

  if (activityTypes && activityTypes.length > 0) {
    conditions.push(sql`activity_type IN (${sql.join(activityTypes.map((t) => sql`${t}`), sql`, `)})`);
  }
  if (playerId) {
    conditions.push(sql`player_id = ${playerId}`);
  }
  if (startDate) {
    conditions.push(sql`timestamp >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`timestamp <= ${endDate}`);
  }

  const result = await db.execute(sql`
    SELECT * FROM clan_activities
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY timestamp DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return (result.rows as any[]).map((row: any) => ({
    _id: row.id,
    clanId: row.clan_id,
    activityType: row.activity_type,
    playerId: row.player_id,
    username: row.username,
    details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
    timestamp: new Date(row.timestamp),
  }));
}

export async function getActivityStats(
  clanId: string,
  startDate?: Date,
  endDate?: Date
): Promise<Record<ClanActivityType, number>> {
  const conditions = ['clan_id = ?'];
  const values: any[] = [clanId];
  
  if (startDate) {
    conditions.push('timestamp >= ?');
    values.push(startDate);
  }
  if (endDate) {
    conditions.push('timestamp <= ?');
    values.push(endDate);
  }
  
  const statResult = await db.execute(sql`
    SELECT activity_type, COUNT(*) as count
    FROM clan_activities
    WHERE ${sql.raw(conditions.join(' AND '))}
    GROUP BY activity_type
  `);
  
  const stats: Record<string, number> = {};
  for (const row of statResult.rows as any[]) {
    stats[row.activity_type] = row.count;
  }
  
  return stats as Record<ClanActivityType, number>;
}

export async function getPlayerContributions(
  clanId: string,
  playerId: string,
  days: number = 30
): Promise<{
  totalActivities: number;
  researchContributions: number;
  bankDeposits: number;
  territoriesClaimed: number;
  activityScore: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const result = await db.execute(sql`
    SELECT * FROM clan_activities
    WHERE clan_id = ${clanId}
      AND player_id = ${playerId}
      AND timestamp >= ${startDate}
  `);
  
  const activities = (result.rows as any[]).map((row: any) => ({
    activityType: row.activity_type as ClanActivityType,
    details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
  }));
  
  let researchContributions = 0;
  let bankDeposits = 0;
  let territoriesClaimed = 0;
  
  for (const activity of activities) {
    switch (activity.activityType) {
      case ClanActivityType.RESEARCH_CONTRIBUTED:
        researchContributions++;
        break;
      case ClanActivityType.BANK_DEPOSIT:
        bankDeposits++;
        break;
      case ClanActivityType.TERRITORY_CLAIMED:
        territoriesClaimed++;
        break;
    }
  }
  
  const activityScore =
    researchContributions * 10 +
    bankDeposits * 5 +
    territoriesClaimed * 15 +
    activities.length * 1;
  
  return {
    totalActivities: activities.length,
    researchContributions,
    bankDeposits,
    territoriesClaimed,
    activityScore,
  };
}

export async function getRecentMemberActivities(
  clanId: string,
  hours: number = 24
): Promise<Array<{
  playerId: string;
  username: string;
  activityCount: number;
  lastActivity: Date;
}>> {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);
  
  const result = await db.execute(sql`
    SELECT player_id, username, COUNT(*) as activity_count, MAX(timestamp) as last_activity
    FROM clan_activities
    WHERE clan_id = ${clanId}
      AND timestamp >= ${startTime}
      AND player_id IS NOT NULL
    GROUP BY player_id
    ORDER BY activity_count DESC
  `);
  
  return (result.rows as any[]).map((row: any) => ({
    playerId: row.player_id,
    username: row.username || row.player_id,
    activityCount: Number(row.activity_count),
    lastActivity: new Date(row.last_activity),
  }));
}

export async function cleanupOldActivities(
  clanId: string,
  daysToKeep: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await db.execute(sql`
    DELETE FROM clan_activities
    WHERE clan_id = ${clanId}
      AND timestamp < ${cutoffDate}
  `);
  
  // pg: QueryResult.rowCount carries the affected-row count (mysql2 affectedRows does not exist)
  return result.rowCount ?? 0;
}

export async function getActivityTimeline(
  clanId: string,
  days: number = 7,
  groupBy: 'hour' | 'day' = 'day'
): Promise<Array<{ date: string; count: number }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // MySQL DATE_FORMAT('%Y-%m-%d [ %H:00]') → Postgres TO_CHAR; the ":00" suffix is
  // a double-quoted literal in the format string.
  const pgFormat = groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH24":00"';

  const result = await db.execute(sql`
    SELECT TO_CHAR(timestamp, ${pgFormat}) as date, COUNT(*) as count
    FROM clan_activities
    WHERE clan_id = ${clanId}
      AND timestamp >= ${startDate}
    GROUP BY 1
    ORDER BY date ASC
  `);

  return (result.rows as any[]).map((row: any) => ({
    date: row.date,
    count: Number(row.count),
  }));
}

export async function getMostActiveMembers(
  clanId: string,
  days: number = 7,
  limit: number = 10
): Promise<Array<{
  playerId: string;
  username: string;
  activityScore: number;
  totalActivities: number;
}>> {
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    return [];
  }
  
  const clan = clanRows[0];
  const memberScores: Array<{
    playerId: string;
    username: string;
    activityScore: number;
    totalActivities: number;
  }> = [];
  
  for (const member of clan.members) {
    const contributions = await getPlayerContributions(clanId, member.playerId, days);
    memberScores.push({
      playerId: member.playerId,
      username: member.username,
      activityScore: contributions.activityScore,
      totalActivities: contributions.totalActivities,
    });
  }
  
  memberScores.sort((a, b) => b.activityScore - a.activityScore);
  
  return memberScores.slice(0, limit);
}
