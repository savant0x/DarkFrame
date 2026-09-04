/**
 * @file lib/flagBotService.ts
 * @created 2025-10-23
 * @overview Flag Bot lifecycle management service
 * 
 * OVERVIEW:
 * Manages the AI-controlled bot that holds the flag when no player possesses it.
 * Handles bot spawning, movement, defeat mechanics, and flag transfer logic.
 * Integrates with botService.ts for bot creation and flags table for state.
 * 
 * Features:
 * - Spawn flag bot at random position when needed
 * - Move bot randomly every 30 minutes (1-3 tiles)
 * - Handle bot defeat and flag transfer to victor
 * - Reset/respawn bot if flag unclaimed for > 1 hour
 * - Track flag ownership in MySQL flags table
 * 
 * Related Files:
 * - /lib/botService.ts - Bot creation utilities
 * - /app/api/flag/route.ts - Flag API endpoints
 * - /types/flag.types.ts - Flag type definitions
 * - /lib/flagService.ts - Flag calculation utilities
 */

import { db } from '@/lib/db';
import { players, flags } from '@/lib/db/schema';
import { eq, like, sql } from 'drizzle-orm';
import { BotSpecialization, type Player, type Position } from '@/types/game.types';
import { createBotPlayer } from '@/lib/botService';
import { mapRowToPlayer, mapDomainPlayerToRow, getPlayerByUsername } from '@/lib/playerService';
import { generateId } from '@/lib/utils';
import { FLAG_CONFIG } from '@/types/flag.types';

/**
 * Flag bot configuration
 * Uses Balanced specialization with custom HP for flag defense
 */
const FLAG_BOT_CONFIG = {
  specialization: BotSpecialization.Balanced,
  tier: 2, // Mid-tier bot
  baseHP: FLAG_CONFIG.BASE_ATTACK_DAMAGE * 10, // 100 * 10 = 1000 HP
  respawnDelay: 3600000, // 1 hour in milliseconds
  mapSize: { min: 1, max: 150 }, // Full map coordinates
};

// ============================================================
// FLAG BOT RETRIEVAL
// ============================================================

/**
 * Get the current flag bot from database
 * Queries the flags table for active flag holder
 * 
 * @returns Flag bot Player object or null if no bot holds flag
 * 
 * @example
 * ```typescript
 * const flagBot = await getFlagBot();
 * if (flagBot) {
 *   console.log(`Flag held by bot: ${flagBot.username}`);
 * }
 * ```
 */
export async function getFlagBot(): Promise<Player | null> {
  try {
    const flagRows = await db.select().from(flags).limit(1);
    const flagDoc = flagRows[0];
    
    if (!flagDoc || !flagDoc.currentHolder) {
      return null; // Flag unclaimed or doesn't exist
    }
    
    // currentHolder stores the holder's username (string) — every writer in this file
    // (createFlagBot, handleFlagBotDefeat) sets it that way; the old object-with-botId
    // shape never existed, so this read path always returned null.
    const holderRows = await db.select().from(players).where(eq(players.username, flagDoc.currentHolder)).limit(1);
    if (!holderRows[0]) return null;
    
    const holder = mapRowToPlayer(holderRows[0]);
    
    // Only the bot is "the flag bot" — when a player holds the flag, return null
    // (the job uses that to skip movement)
    if (!holder.isBot) return null;
    
    return holder;
  } catch (error) {
    console.error('❌ Error getting flag bot:', error);
    return null;
  }
}

// ============================================================
// FLAG BOT CREATION
// ============================================================

/**
 * Create a new flag bot with flag in possession
 * Uses botService.createBot() pattern with custom configuration
 * Initializes flags table if it doesn't exist
 * Spawns at completely random location (1-150, 1-150) unless position specified
 * 
 * @param position - Optional spawn position (completely random if not provided)
 * @returns Newly created flag bot Player object
 * 
 * @example
 * ```typescript
 * // Spawn at random position anywhere on map
 * const bot = await createFlagBot();
 * 
 * // Spawn at specific position
 * const bot = await createFlagBot({ x: 75, y: 75 });
 * ```
 */
export async function createFlagBot(position?: Position): Promise<Player> {
  try {
    // Create bot using botService pattern (zone will be calculated from final position)
    const botData = await createBotPlayer(
      null, // Random zone (will be overridden by position)
      FLAG_BOT_CONFIG.specialization,
      false // Not a Beer Base
    );
    
    // Generate completely random position anywhere on 150x150 map if not provided
    const spawnPosition = position || {
      x: Math.floor(Math.random() * FLAG_BOT_CONFIG.mapSize.max) + FLAG_BOT_CONFIG.mapSize.min,
      y: Math.floor(Math.random() * FLAG_BOT_CONFIG.mapSize.max) + FLAG_BOT_CONFIG.mapSize.min,
    };
    
    // Override position with random or specified location
    botData.base = spawnPosition;
    botData.currentPosition = spawnPosition;
    
    // Add flag-specific fields
    const flagBot = {
      ...botData,
      currentHP: FLAG_BOT_CONFIG.baseHP,
      maxHP: FLAG_BOT_CONFIG.baseHP,
      username: `Flag-Bearer-${Math.floor(Math.random() * 9999)}`,
    };
    
    // Insert bot into database — domain→row mapping (nested base/currentPosition/resources →
    // flat columns, boolean isBot → smallint; raw domain objects crash pg smallint columns)
    await db.insert(players).values(mapDomainPlayerToRow(flagBot));
    const botId = flagBot.username;
    
    // Initialize or update flags table
    const existingFlagRows = await db.select().from(flags).limit(1);
    const existingFlag = existingFlagRows[0];
    
    const flagData = {
      // id is varchar(24) — crypto.randomUUID() (36 chars) overflows the column
      id: generateId(),
      currentHolder: botId,
      currentHolderUsername: flagBot.username,
      lastCapturedAt: new Date(),
      lastCapturedBy: 'System',
      totalCaptures: 0,
    };
    
    if (existingFlag) {
      // Update existing flag document
      await db.update(flags).set({
        currentHolder: flagData.currentHolder,
        currentHolderUsername: flagData.currentHolderUsername,
        lastCapturedAt: flagData.lastCapturedAt,
        lastCapturedBy: flagData.lastCapturedBy,
      }).where(eq(flags.id, existingFlag.id));
    } else {
      // Create new flag document
      await db.insert(flags).values(flagData);
    }
    
    // Re-read through the single mapping path — verifies the insert landed and the
    // returned Player reflects the actual row
    const createdBot = await getPlayerByUsername(flagBot.username);
    if (!createdBot) throw new Error('Flag bot insert did not persist');
    
    console.log(`✅ Flag bot created: ${createdBot.username} at (${createdBot.currentPosition.x}, ${createdBot.currentPosition.y})`);
    
    return createdBot;
  } catch (error) {
    console.error('❌ Error creating flag bot:', error);
    throw new Error('Failed to create flag bot');
  }
}

// ============================================================
// FLAG BOT MOVEMENT
// ============================================================

/**
 * Move flag bot to random position anywhere on the map
 * Called by cron job every 30 minutes
 * TELEPORTS to completely random location (1-150, 1-150) to keep flag dynamic
 * 
 * @param botId - Username of the flag bot
 * @returns New position after teleport
 * 
 * @example
 * ```typescript
 * const newPosition = await moveFlagBot(botId);
 * console.log(`Bot teleported to (${newPosition.x}, ${newPosition.y})`);
 * ```
 */
export async function moveFlagBot(botId: string): Promise<Position> {
  try {
    const botRows = await db.select().from(players).where(eq(players.username, botId)).limit(1);
    const bot = botRows[0] ? mapRowToPlayer(botRows[0]) : undefined;
    
    if (!bot) {
      throw new Error('Flag bot not found');
    }
    
    // Generate completely random position anywhere on 150x150 map
    const newX = Math.floor(Math.random() * FLAG_BOT_CONFIG.mapSize.max) + FLAG_BOT_CONFIG.mapSize.min;
    const newY = Math.floor(Math.random() * FLAG_BOT_CONFIG.mapSize.max) + FLAG_BOT_CONFIG.mapSize.min;
    
    const newPosition: Position = { x: newX, y: newY };
    
    // Update bot position in database
    await db.update(players).set({
      currentPositionX: newX,
      currentPositionY: newY,
    }).where(eq(players.username, botId));
    
    // Update flag position
    await db.update(flags).set({
      lastCapturedAt: new Date(),
    }).where(eq(flags.currentHolder, botId));
    
    console.log(`🤖 Flag bot teleported: (${bot.currentPosition?.x || bot.base?.x}, ${bot.currentPosition?.y || bot.base?.y}) → (${newX}, ${newY})`);
    
    return newPosition;
  } catch (error) {
    console.error('❌ Error moving flag bot:', error);
    throw new Error('Failed to move flag bot');
  }
}

// ============================================================
// FLAG BOT DEFEAT & TRANSFER
// ============================================================

/**
 * Handle flag bot defeat and transfer flag to victor
 * Called when bot HP reaches 0
 * Resets bot HP to full and transfers flag ownership
 * 
 * @param botId - Username of defeated flag bot
 * @param victorId - Username of victorious player
 * 
 * @example
 * ```typescript
 * await handleFlagBotDefeat(botId, playerId);
 * console.log('Flag transferred to player!');
 * ```
 */
export async function handleFlagBotDefeat(
  botId: string,
  victorId: string
): Promise<void> {
  try {
    // Get bot and victor data
    const botRows = await db.select().from(players).where(eq(players.username, botId)).limit(1);
    const victorRows = await db.select().from(players).where(eq(players.username, victorId)).limit(1);
    
    const bot = botRows[0] ? mapRowToPlayer(botRows[0]) : undefined;
    const victor = victorRows[0] ? mapRowToPlayer(victorRows[0]) : undefined;
    
    if (!bot || !victor) {
      throw new Error('Bot or victor not found');
    }
    
    // Reset bot HP to full
    await db.update(players).set({
      currentHP: FLAG_BOT_CONFIG.baseHP,
    }).where(eq(players.username, botId));
    
    // Transfer flag to victor
    await db.update(flags).set({
      currentHolder: victorId,
      currentHolderUsername: victor.username,
      lastCapturedAt: new Date(),
      lastCapturedBy: victor.username,
      totalCaptures: sql`${flags.totalCaptures} + 1`,
    }).where(eq(flags.currentHolder, botId));
    
    console.log(`⚔️ Flag transferred: ${bot.username} (bot) → ${victor.username} (player)`);
  } catch (error) {
    console.error('❌ Error handling flag bot defeat:', error);
    throw new Error('Failed to handle flag bot defeat');
  }
}

// ============================================================
// FLAG BOT RESET & RESPAWN
// ============================================================

/**
 * Reset flag bot if unclaimed for > 1 hour
 * Despawns old bot and spawns new one with flag
 * Called by cron job to keep flag active
 * 
 * @returns Newly spawned flag bot
 * 
 * @example
 * ```typescript
 * const newBot = await resetFlagBot();
 * console.log(`New flag bot spawned: ${newBot.username}`);
 * ```
 */
export async function resetFlagBot(): Promise<Player> {
  try {
    const flagRows = await db.select().from(flags).limit(1);
    const flagDoc = flagRows[0];
    
    if (flagDoc?.currentHolder) {
      // Remove old flag bot
      await db.delete(players).where(eq(players.username, flagDoc.currentHolder));
      
      console.log(`🗑️ Old flag bot removed: ${flagDoc.currentHolderUsername || flagDoc.currentHolder}`);
    }
    
    // Create new flag bot at random position
    const newBot = await createFlagBot();
    
    console.log(`🔄 Flag bot reset and respawned: ${newBot.username}`);
    
    return newBot;
  } catch (error) {
    console.error('❌ Error resetting flag bot:', error);
    throw new Error('Failed to reset flag bot');
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if flag needs reset (unclaimed for > 1 hour)
 * 
 * @returns True if flag should be reset
 */
export async function shouldResetFlag(): Promise<boolean> {
  try {
    const flagRows = await db.select().from(flags).limit(1);
    const flagDoc = flagRows[0];
    
    if (!flagDoc?.currentHolder) {
      return true; // No holder, needs reset
    }
    
    const timeSinceClaim = Date.now() - new Date(flagDoc.lastCapturedAt || 0).getTime();
    const shouldReset = timeSinceClaim > FLAG_BOT_CONFIG.respawnDelay;
    
    return shouldReset;
  } catch (error) {
    console.error('❌ Error checking flag reset status:', error);
    return false;
  }
}

/**
 * Initialize flags table with first flag bot
 * Called on first server startup if flags table doesn't exist
 * 
 * CRITICAL: This function ensures only ONE flag exists in the system.
 * It checks for existing flags/flag bots and only creates if none exist.
 */
export async function initializeFlagSystem(): Promise<void> {
  try {
    // Check if flags table already has a document
    const flagRows = await db.select().from(flags).limit(1);
    const flagDoc = flagRows[0];
    
    if (flagDoc) {
      // Flag system already initialized, do nothing
      console.log('✅ Flag system already initialized');
      return;
    }
    
    // Check if any flag bots already exist in players table
    const existingFlagBotRows = await db.select().from(players).where(
      like(players.username, 'Flag-Bearer-%')
    ).limit(1);
    
    if (existingFlagBotRows.length > 0) {
      console.log('⚠️ Found orphaned flag bot without flag document - cleaning up');
      await db.delete(players).where(eq(players.username, existingFlagBotRows[0].username));
    }
    
    // No flag exists - create the first flag bot
    console.log('🏴 Initializing flag system for first time...');
    await createFlagBot();
    console.log('✅ Flag system initialized with single flag');
  } catch (error) {
    console.error('❌ Error initializing flag system:', error);
    throw new Error('Failed to initialize flag system');
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Flag bot uses Balanced specialization (not special Beer Base)
// - Bot HP: 1000 (10x base attack damage for multiple attacks)
// - Movement: TELEPORTS to random location (1-150, 1-150) every 30 min
// - Spawn: Completely random position anywhere on 150×150 map
// - Reset: If unclaimed for > 1 hour, despawn and respawn at new random location
// - Flags table: Singleton document tracking current holder
// - Transfer history: Tracks all flag ownership changes
// - Statistics: Longest hold time, most transfers per player
// 
// Why Random Teleport Instead of Incremental Movement?
// - Map is 150×150 = 22,500 tiles
// - Moving 1-3 tiles every 30 min would keep flag in tiny area
// - Random teleport ensures flag is accessible to all players
// - Creates dynamic gameplay - flag location constantly changes
// - Prevents flag camping in one zone
// 
// Related Lessons:
// - Lesson #35: Zero mocks - all data from MySQL
// - Lesson #37: Complete file reading before implementation
// 
// Database Tables Used:
// - players: Bot and player data
// - flags: Current flag state (singleton document)
// ============================================================
// END OF FILE
// ============================================================
