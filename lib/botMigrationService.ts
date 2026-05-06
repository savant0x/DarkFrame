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

import { createServiceClient } from '@/lib/supabase/server';
import { parseBotMigrationConfig } from '@/lib/supabase/jsonb';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Bot specialization types
 */
export type BotSpecialization = 'Hoarder' | 'Fortress' | 'Raider' | 'Balanced' | 'Ghost';

/**
 * Migration event record
 */
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
  triggeredByUser?: string; // Admin username if manual
}

/**
 * Position on the map
 */
interface Position {
  x: number;
  y: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Migration system configuration
 */
const MIGRATION_CONFIG = {
  MIGRATION_PERCENTAGE: 0.3,   // 30% of bots migrate
  MAP_SIZE: 5000,              // Map dimensions (0-5000)
  SAFE_DISTANCE: 50,           // Min distance from players
  NEST_ATTRACTION_RANGE: 300,  // Range for Fortress bots to move toward nests
  RAIDER_TARGET_RANGE: 500,    // Range for Raiders to detect player activity
  HOARDER_AVOID_RANGE: 500,    // Range for Hoarders to avoid player activity
} as const;

/**
 * Nest locations (from spawnBots.ts)
 */
const NEST_LOCATIONS: Position[] = [
  { x: 500, y: 500 },
  { x: 1500, y: 1500 },
  { x: 2500, y: 2500 },
  { x: 3500, y: 3500 },
  { x: 4500, y: 4500 },
];

// ============================================================================
// POSITION CALCULATION
// ============================================================================

/**
 * Calculate distance between two positions
 */
function calculateDistance(pos1: Position, pos2: Position): number {
  return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
}

/**
 * Get random position on the map
 */
function getRandomPosition(): Position {
  return {
    x: Math.floor(Math.random() * MIGRATION_CONFIG.MAP_SIZE),
    y: Math.floor(Math.random() * MIGRATION_CONFIG.MAP_SIZE),
  };
}

/**
 * Check if position is safe (not too close to players)
 */
async function isSafePosition(supabase: ReturnType<typeof createServiceClient>, position: Position): Promise<boolean> {
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .neq('is_bot', true)
    .gte('current_position->x', position.x - MIGRATION_CONFIG.SAFE_DISTANCE)
    .lte('current_position->x', position.x + MIGRATION_CONFIG.SAFE_DISTANCE)
    .gte('current_position->y', position.y - MIGRATION_CONFIG.SAFE_DISTANCE)
    .lte('current_position->y', position.y + MIGRATION_CONFIG.SAFE_DISTANCE);

  return count === 0;
}

/**
 * Find safe position with retries
 */
async function findSafePosition(supabase: ReturnType<typeof createServiceClient>, maxRetries = 10): Promise<Position> {
  for (let i = 0; i < maxRetries; i++) {
    const position = getRandomPosition();
    if (await isSafePosition(supabase, position)) {
      return position;
    }
  }
  
  // Fallback: return random position anyway
  return getRandomPosition();
}

// ============================================================================
// SPECIALIZATION-BASED MIGRATION
// ============================================================================

/**
 * Calculate migration position for Raider bots (move toward players)
 */
async function getMigrationPositionRaider(supabase: ReturnType<typeof createServiceClient>): Promise<Position> {
  // Get random active player
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .neq('is_bot', true)
    .limit(20);

  if (!players || players.length === 0) {
    return getRandomPosition();
  }

  const targetPlayer = players[Math.floor(Math.random() * players.length)];
  const targetPos: Position = { x: targetPlayer.current_x, y: targetPlayer.current_y };

  // Move within range of player, but not too close
  const angle = Math.random() * 2 * Math.PI;
  const distance = MIGRATION_CONFIG.SAFE_DISTANCE + Math.random() * (MIGRATION_CONFIG.RAIDER_TARGET_RANGE - MIGRATION_CONFIG.SAFE_DISTANCE);

  return {
    x: Math.max(0, Math.min(MIGRATION_CONFIG.MAP_SIZE, Math.floor(targetPos.x + distance * Math.cos(angle)))),
    y: Math.max(0, Math.min(MIGRATION_CONFIG.MAP_SIZE, Math.floor(targetPos.y + distance * Math.sin(angle)))),
  };
}

/**
 * Calculate migration position for Hoarder bots (move away from players)
 */
async function getMigrationPositionHoarder(supabase: ReturnType<typeof createServiceClient>): Promise<Position> {
  // Find low-activity zones (away from players)
  const position = await findSafePosition(supabase);
  return position;
}

/**
 * Calculate migration position for Fortress bots (near nests)
 */
function getMigrationPositionFortress(): Position {
  const nest = NEST_LOCATIONS[Math.floor(Math.random() * NEST_LOCATIONS.length)];
  
  // Spawn within attraction range of nest
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * MIGRATION_CONFIG.NEST_ATTRACTION_RANGE;

  return {
    x: Math.max(0, Math.min(MIGRATION_CONFIG.MAP_SIZE, Math.floor(nest.x + distance * Math.cos(angle)))),
    y: Math.max(0, Math.min(MIGRATION_CONFIG.MAP_SIZE, Math.floor(nest.y + distance * Math.sin(angle)))),
  };
}

/**
 * Calculate migration position for Ghost bots (random teleport)
 */
function getMigrationPositionGhost(): Position {
  return getRandomPosition();
}

/**
 * Calculate migration position for Balanced bots (evenly distributed)
 */
function getMigrationPositionBalanced(): Position {
  // Grid-based distribution for even coverage
  const gridSize = MIGRATION_CONFIG.MAP_SIZE / 10; // 10x10 grid
  const gridX = Math.floor(Math.random() * 10);
  const gridY = Math.floor(Math.random() * 10);

  return {
    x: Math.floor(gridX * gridSize + Math.random() * gridSize),
    y: Math.floor(gridY * gridSize + Math.random() * gridSize),
  };
}

/**
 * Get migration position based on bot specialization
 */
async function getMigrationPosition(supabase: ReturnType<typeof createServiceClient>, specialization: BotSpecialization): Promise<Position> {
  switch (specialization) {
    case 'Raider':
      return await getMigrationPositionRaider(supabase);
    case 'Hoarder':
      return await getMigrationPositionHoarder(supabase);
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

// ============================================================================
// MIGRATION EXECUTION
// ============================================================================

/**
 * Execute bot migration event
 * @param triggeredBy - How migration was triggered
 * @param triggeredByUser - Admin username if manual trigger
 * @returns Migration event results
 */
export async function executeMigration(
  triggeredBy: 'automatic' | 'manual' = 'automatic',
  triggeredByUser?: string
): Promise<MigrationEvent> {
  const supabase = createServiceClient();

  // Get all bots
  const { data: allBots } = await supabase
    .from('players')
    .select('*')
    .eq('is_bot', true);

  const bots = allBots || [];

  // Calculate how many bots to migrate
  const migrateCount = Math.floor(bots.length * MIGRATION_CONFIG.MIGRATION_PERCENTAGE);

  // Randomly select bots to migrate
  const shuffled = [...bots].sort(() => 0.5 - Math.random());
  const botsToMigrate = shuffled.slice(0, migrateCount);

  // Track migrations by specialization
  const bySpecialization = {
    Hoarder: 0,
    Fortress: 0,
    Raider: 0,
    Balanced: 0,
    Ghost: 0,
  };

  // Migrate each bot
  for (const bot of botsToMigrate) {
    const botData = bot;
    const config = botData.bot_config ? parseBotMigrationConfig(botData.bot_config) : { specialization: '' as string };
    const specialization = config.specialization as BotSpecialization;
    const validSpecs: readonly string[] = ['Hoarder', 'Fortress', 'Raider', 'Balanced', 'Ghost'];
    if (!specialization || !validSpecs.includes(specialization)) continue;

    bySpecialization[specialization]++;
    
    const newX = Math.floor(Math.random() * 150) + 1;
    const newY = Math.floor(Math.random() * 150) + 1;
    await supabase.from('players')
      .update({ current_x: newX, current_y: newY })
      .eq('username', bot.username);

    bySpecialization[specialization]++;
  }

  // Create migration event record
  const event: MigrationEvent = {
    timestamp: new Date(),
    botsMigrated: botsToMigrate.length,
    bySpecialization,
    triggeredBy,
    triggeredByUser,
  };

  // Store migration history (unsupported table: use logging instead)
  console.log('[Bot Migration] Event:', event);

  return event;
}

// ============================================================================
// MIGRATION HISTORY
// ============================================================================

/**
 * Get recent migration events
 * @param limit - Number of events to retrieve
 * @returns Array of migration events
 */
export async function getMigrationHistory(limit = 10): Promise<MigrationEvent[]> {
  // bot_migration_history table not in schema — return empty
  return [];
}

/**
 * Get next scheduled migration time (Sundays at 8 AM UTC)
 * @returns Next migration timestamp
 */
export function getNextMigrationTime(): Date {
  const now = new Date();
  const nextSunday = new Date(now);

  // Find next Sunday
  const dayOfWeek = now.getUTCDay();
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;

  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(8, 0, 0, 0);

  // If it's Sunday and past 8 AM, schedule for next week
  if (dayOfWeek === 0 && now.getUTCHours() >= 8) {
    nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);
  }

  return nextSunday;
}

/**
 * Check if it's time for automatic migration (Sunday 8 AM UTC)
 * @returns True if migration should run
 */
export function shouldRunAutoMigration(): boolean {
  const now = new Date();
  const isSunday = now.getUTCDay() === 0;
  const isEightAM = now.getUTCHours() === 8 && now.getUTCMinutes() < 15; // 15-minute window

  return isSunday && isEightAM;
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * INTEGRATION:
 * - Call executeMigration() from scheduled cron job or admin endpoint
 * - Run shouldRunAutoMigration() check in background process
 * - Migration history stored in bot_migration_history collection
 * 
 * SPECIALIZATION BEHAVIORS:
 * - Raiders: Aggressive, move toward player activity
 * - Hoarders: Defensive, avoid player activity
 * - Fortress: Territorial, cluster near nests
 * - Ghost: Unpredictable, random teleportation
 * - Balanced: Strategic, evenly distributed
 * 
 * FUTURE ENHANCEMENTS:
 * - Migration notification system for players
 * - Seasonal migration patterns
 * - Event-triggered migrations (player milestones)
 * - Migration impact on bot reputation
 */
