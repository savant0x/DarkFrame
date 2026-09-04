/**
 * @fileoverview Bot Migration Service - Weekly bot movement events
 * @module lib/botMigrationService
 * @created 2025-10-18
 * 
 * OVERVIEW:
 * Manages the weekly bot migration event where 30% of bots relocate based on
 * their specialization behaviors. Runs automatically on Sundays at 8 AM UTC
 * or can be manually triggered by admins.
 * 
 * Migration Patterns:
 * - Raiders: Move toward high-activity zones (near players)
 * - Hoarders: Migrate to low-activity zones (away from players)
 * - Fortress: Move near nest locations for clustering
 * - Ghost: Random teleportation across the map
 * - Balanced: Evenly redistribute across the map
 * 
 * Features:
 * - 30% of total bot population migrates
 * - Specialization-based movement logic
 * - Migration history tracking
 * - Collision avoidance (don't spawn on players)
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export type BotSpecialization = 'Hoarder' | 'Fortress' | 'Raider' | 'Balanced' | 'Ghost';

export interface MigrationEvent {
  timestamp: Date;
  botsMigrated: number;
  bySpecialization: {
    Hoarder: number;
    Fortress: number;
    Raider: number;
    Balanced: number;
    Ghost: number;
  };
  triggeredBy: 'automatic' | 'manual';
  triggeredByUser?: string;
}

interface Position {
  x: number;
  y: number;
}

const MIGRATION_CONFIG = {
  MIGRATION_PERCENTAGE: 0.3,
  MAP_SIZE: 5000,
  SAFE_DISTANCE: 50,
  NEST_ATTRACTION_RANGE: 300,
  RAIDER_TARGET_RANGE: 500,
  HOARDER_AVOID_RANGE: 500,
} as const;

const NEST_LOCATIONS: Position[] = [
  { x: 500, y: 500 },
  { x: 1500, y: 1500 },
  { x: 2500, y: 2500 },
  { x: 3500, y: 3500 },
  { x: 4500, y: 4500 },
];

function getRandomPosition(): Position {
  return {
    x: Math.floor(Math.random() * MIGRATION_CONFIG.MAP_SIZE),
    y: Math.floor(Math.random() * MIGRATION_CONFIG.MAP_SIZE),
  };
}

async function isSafePosition(position: Position): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM players
    WHERE is_bot != 1
      AND current_position_x >= ${position.x - MIGRATION_CONFIG.SAFE_DISTANCE}
      AND current_position_x <= ${position.x + MIGRATION_CONFIG.SAFE_DISTANCE}
      AND current_position_y >= ${position.y - MIGRATION_CONFIG.SAFE_DISTANCE}
      AND current_position_y <= ${position.y + MIGRATION_CONFIG.SAFE_DISTANCE}
  `);
  const firstRow = (result.rows as Array<Record<string, unknown>>)[0];
  return Number(firstRow?.cnt ?? 0) === 0;
}

async function findSafePosition(maxRetries = 10): Promise<Position> {
  for (let i = 0; i < maxRetries; i++) {
    const position = getRandomPosition();
    if (await isSafePosition(position)) {
      return position;
    }
  }
  return getRandomPosition();
}

async function getMigrationPositionRaider(): Promise<Position> {
  const playerResult = await db.execute(sql`
    SELECT username, current_position_x, current_position_y FROM players
    WHERE is_bot != 1
    LIMIT 20
  `);
  const playerRows = playerResult.rows as Array<{ username: string; current_position_x: number; current_position_y: number }>;

  if (playerRows.length === 0) {
    return getRandomPosition();
  }

  const targetPlayer = playerRows[Math.floor(Math.random() * playerRows.length)];
  const targetPos: Position = { x: targetPlayer.current_position_x, y: targetPlayer.current_position_y };

  const angle = Math.random() * 2 * Math.PI;
  const distance = MIGRATION_CONFIG.SAFE_DISTANCE + Math.random() * (MIGRATION_CONFIG.RAIDER_TARGET_RANGE - MIGRATION_CONFIG.SAFE_DISTANCE);

  return {
    x: Math.max(0, Math.min(MIGRATION_CONFIG.MAP_SIZE, Math.floor(targetPos.x + distance * Math.cos(angle)))),
    y: Math.max(0, Math.min(MIGRATION_CONFIG.MAP_SIZE, Math.floor(targetPos.y + distance * Math.sin(angle)))),
  };
}

async function getMigrationPositionHoarder(): Promise<Position> {
  const position = await findSafePosition();
  return position;
}

function getMigrationPositionFortress(): Position {
  const nest = NEST_LOCATIONS[Math.floor(Math.random() * NEST_LOCATIONS.length)];
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * MIGRATION_CONFIG.NEST_ATTRACTION_RANGE;

  return {
    x: Math.max(0, Math.min(MIGRATION_CONFIG.MAP_SIZE, Math.floor(nest.x + distance * Math.cos(angle)))),
    y: Math.max(0, Math.min(MIGRATION_CONFIG.MAP_SIZE, Math.floor(nest.y + distance * Math.sin(angle)))),
  };
}

function getMigrationPositionGhost(): Position {
  return getRandomPosition();
}

function getMigrationPositionBalanced(): Position {
  const gridSize = MIGRATION_CONFIG.MAP_SIZE / 10;
  const gridX = Math.floor(Math.random() * 10);
  const gridY = Math.floor(Math.random() * 10);

  return {
    x: Math.floor(gridX * gridSize + Math.random() * gridSize),
    y: Math.floor(gridY * gridSize + Math.random() * gridSize),
  };
}

async function getMigrationPosition(specialization: BotSpecialization): Promise<Position> {
  switch (specialization) {
    case 'Raider':
      return await getMigrationPositionRaider();
    case 'Hoarder':
      return await getMigrationPositionHoarder();
    case 'Fortress':
      return getMigrationPositionFortress();
    case 'Ghost':
      return getMigrationPositionGhost();
    case 'Balanced':
      return getMigrationPositionBalanced();
    default:
      return getRandomPosition();
  }
}

export async function executeMigration(
  triggeredBy: 'automatic' | 'manual' = 'automatic',
  triggeredByUser?: string
): Promise<MigrationEvent> {
  const allBots = await db.select().from(players).where(eq(players.isBot, 1));

  const migrateCount = Math.floor(allBots.length * MIGRATION_CONFIG.MIGRATION_PERCENTAGE);

  const shuffled = [...allBots].sort(() => 0.5 - Math.random());
  const botsToMigrate = shuffled.slice(0, migrateCount);

  const bySpecialization = {
    Hoarder: 0,
    Fortress: 0,
    Raider: 0,
    Balanced: 0,
    Ghost: 0,
  };

  for (const bot of botsToMigrate) {
    const specialization = bot.botConfig?.specialization as unknown as BotSpecialization;
    if (!specialization) continue;

    const newPosition = await getMigrationPosition(specialization);

    await db.update(players).set({
      currentPositionX: newPosition.x,
      currentPositionY: newPosition.y,
    }).where(eq(players.username, bot.username));

    bySpecialization[specialization]++;
  }

  const event: MigrationEvent = {
    timestamp: new Date(),
    botsMigrated: botsToMigrate.length,
    bySpecialization,
    triggeredBy,
    triggeredByUser,
  };

  await db.execute(sql`
    INSERT INTO bot_migration_history
    (timestamp, bots_migrated, by_specialization, triggered_by, triggered_by_user)
    VALUES (${event.timestamp}, ${event.botsMigrated}, ${JSON.stringify(event.bySpecialization)},
            ${event.triggeredBy}, ${event.triggeredByUser || null})
  `);

  return event;
}

export async function getMigrationHistory(limit = 10): Promise<MigrationEvent[]> {
  const rows = await db.execute(sql`
    SELECT * FROM bot_migration_history
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `);

  return (rows.rows as Array<Record<string, unknown>>).map((row) => ({
    timestamp: new Date(row.timestamp as string),
    botsMigrated: row.bots_migrated as number,
    bySpecialization: typeof row.by_specialization === 'string'
      ? JSON.parse(row.by_specialization as string)
      : row.by_specialization,
    triggeredBy: row.triggered_by as MigrationEvent['triggeredBy'],
    triggeredByUser: (row.triggered_by_user as string | null) || undefined,
  }));
}

export function getNextMigrationTime(): Date {
  const now = new Date();
  const nextSunday = new Date(now);

  const dayOfWeek = now.getUTCDay();
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;

  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(8, 0, 0, 0);

  if (dayOfWeek === 0 && now.getUTCHours() >= 8) {
    nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);
  }

  return nextSunday;
}

export function shouldRunAutoMigration(): boolean {
  const now = new Date();
  const isSunday = now.getUTCDay() === 0;
  const isEightAM = now.getUTCHours() === 8 && now.getUTCMinutes() < 15;

  return isSunday && isEightAM;
}
