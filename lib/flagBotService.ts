/**
 * @file lib/flagBotService.ts
 * @created 2025-10-23
 * @overview Flag Bot lifecycle management service
 * 
 * OVERVIEW:
 * Manages the AI-controlled bot that holds the flag when no player possesses it.
 * Handles bot spawning, movement, defeat mechanics, and flag transfer logic.
 * Integrates with botService.ts for bot creation and flags collection for state.
 * 
 * Features:
 * - Spawn flag bot at random position when needed
 * - Move bot randomly every 30 minutes (1-3 tiles)
 * - Handle bot defeat and flag transfer to victor
 * - Reset/respawn bot if flag unclaimed for > 1 hour
 * - Track flag ownership in Supabase flags table
 * 
 * Related Files:
 * - /lib/botService.ts - Bot creation utilities
 * - /app/api/flag/route.ts - Flag API endpoints
 * - /types/flag.types.ts - Flag type definitions
 * - /lib/flagService.ts - Flag calculation utilities
 */

import { BotSpecialization, type Player, type Position } from '@/types/game.types';
import { createBotPlayer } from '@/lib/botService';
import { createServiceClient } from '@/lib/supabase/server';
import { parseFlagBotConfig, parseJsonString } from '@/lib/supabase/jsonb';
import type { TablesInsert, Json } from '@/types/database';
import { FLAG_CONFIG } from '@/types/flag.types';

/**
 * Flag bot configuration
 * Uses Balanced specialization with custom HP for flag defense
 */
const FLAG_BOT_CONFIG = {
  specialization: BotSpecialization.Balanced,
  tier: 2, // Mid-tier bot
  baseHP: FLAG_CONFIG.CHALLENGE_RANGE * 10, // 100 * 10 = 1000 HP
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
    const supabase = createServiceClient();
    const { data: flagDoc, error: flagError } = await supabase
      .from('flags')
      .select('*')
      .single();

    if (flagError || !flagDoc || !flagDoc.is_bot || !flagDoc.bearer_id) {
      return null; // Flag held by player or doesn't exist
    }

    // Get the bot from players table
    const { data: bot, error: botError } = await supabase
      .from('players')
      .select('*')
      .eq('username', flagDoc.bearer_id)
      .single();

    if (botError || !bot) {
      return null;
    }

    return bot as unknown as Player;
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
 * Initializes flags table if it doesn't have a row
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
    const supabase = createServiceClient();

    // Generate completely random position anywhere on 150x150 map if not provided
    const spawnPosition = position || {
      x: Math.floor(Math.random() * FLAG_BOT_CONFIG.mapSize.max) + FLAG_BOT_CONFIG.mapSize.min,
      y: Math.floor(Math.random() * FLAG_BOT_CONFIG.mapSize.max) + FLAG_BOT_CONFIG.mapSize.min,
    };

    // Build insert with only valid DB columns — no Partial<Player> camelCase fields
    const flagBotUsername = `Flag-Bearer-${Math.floor(Math.random() * 9999)}`;
    const { data: insertedBot, error: insertError } = await supabase
      .from('players')
      .insert({
        username: flagBotUsername,
        email: `flagbot-${Date.now()}@darkframe.internal`,
        password: 'bot_auth_placeholder',
        base_x: spawnPosition.x,
        base_y: spawnPosition.y,
        current_x: spawnPosition.x,
        current_y: spawnPosition.y,
        is_bot: true,
        is_special_base: false,
        level: 15,
        rank: 3,
        current_hp: FLAG_BOT_CONFIG.baseHP,
        max_hp: FLAG_BOT_CONFIG.baseHP,
        total_strength: 5000,
        total_defense: 5000,
        resources_metal: 50000,
        resources_energy: 50000,
      })
      .select('username')
      .single();

    if (insertError || !insertedBot) {
      throw new Error(`Failed to insert flag bot: ${insertError?.message || 'unknown error'}`);
    }

    // Check existing flag row
    const { data: existingFlag, error: existingError } = await supabase
      .from('flags')
      .select('id')
      .single();

      const now = new Date();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 1000); // 8 minutes from now

    const newTrail = [
      {
        x: spawnPosition.x,
        y: spawnPosition.y,
        timestamp: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    ];

    const newTransfer = {
      from: { type: 'system', id: null, username: 'System' },
      to: { type: 'bot', id: flagBotUsername, username: flagBotUsername },
      timestamp: now.toISOString(),
      method: 'spawn',
    };

    const newStatistics = {
      totalTransfers: 0,
      longestHold: { username: '', duration: 0 },
      mostTransfers: { username: '', count: 0 },
    };

    if (existingFlag) {
      // Read current bot_config to get existing transferHistory
      const { data: currentFlag } = await supabase
        .from('flags')
        .select('bot_config')
        .eq('id', existingFlag.id)
        .single();

      const config = ((currentFlag?.bot_config as unknown) as Record<string, unknown>) || {};
      const existingHistory = (config.transferHistory as unknown[]) || [];
      const existingTrail = (config.trail as unknown[]) || [];
      const existingStats = (config.statistics as Record<string, unknown>) || newStatistics;

      // Update existing flag row with flat columns + bot_config JSON + new challenge/flee columns
      await supabase
        .from('flags')
        .update({
          is_bot: true,
          bearer_id: flagBotUsername,
          bearer_username: flagBotUsername,
          position_x: spawnPosition.x,
          position_y: spawnPosition.y,
          claimed_at: now.toISOString(),
          current_hp: FLAG_BOT_CONFIG.baseHP,
          max_hp: FLAG_BOT_CONFIG.baseHP,
          flee_count: 0,
          session_metal_earned: 0,
          session_energy_earned: 0,
          grace_until: new Date(now.getTime() + FLAG_CONFIG.GRACE_PERIOD_MS).toISOString(),
          max_hold_expires_at: new Date(now.getTime() + FLAG_CONFIG.MAX_HOLD_HOURS * 60 * 60 * 1000).toISOString(),
          challenge_active: false,
          challenge_challenger_id: null,
          challenge_started_at: null,
          challenge_expires_at: null,
          challenge_lock_expires_at: null,
          respawn_at: null,
          bot_config: {
            trail: [...existingTrail, ...newTrail],
            transferHistory: [...existingHistory, newTransfer],
            statistics: existingStats,
          } as unknown as Json,
        } as never)
        .eq('id', existingFlag.id);
    } else {
      // Create new flag row
      await supabase
        .from('flags')
        .insert({
          is_bot: true,
          bearer_id: flagBotUsername,
          bearer_username: flagBotUsername,
          position_x: spawnPosition.x,
          position_y: spawnPosition.y,
          claimed_at: now.toISOString(),
          current_hp: FLAG_BOT_CONFIG.baseHP,
          max_hp: FLAG_BOT_CONFIG.baseHP,
          flee_count: 0,
          session_metal_earned: 0,
          session_energy_earned: 0,
          challenge_active: false,
          bot_config: {
            trail: newTrail,
            transferHistory: [newTransfer],
            statistics: newStatistics,
          },
        } as unknown as TablesInsert<'flags'>);
    }

    // Add trail entry to flag_trails table
    await supabase.from('flag_trails').insert({
      holder_username: flagBotUsername,
      x: spawnPosition.x,
      y: spawnPosition.y,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    const createdBot = {
      username: flagBotUsername,
      base: spawnPosition,
      currentPosition: spawnPosition,
      currentHP: FLAG_BOT_CONFIG.baseHP,
      maxHP: FLAG_BOT_CONFIG.baseHP,
      level: 15,
      totalStrength: 5000,
      totalDefense: 5000,
    } as Player;

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
    const supabase = createServiceClient();
    const { data: bot, error: botError } = await supabase
      .from('players')
      .select('*')
      .eq('username', botId)
      .single();

    if (botError || !bot) {
      throw new Error('Flag bot not found');
    }

    // Generate completely random position anywhere on 150x150 map
    const newX = Math.floor(Math.random() * FLAG_BOT_CONFIG.mapSize.max) + FLAG_BOT_CONFIG.mapSize.min;
    const newY = Math.floor(Math.random() * FLAG_BOT_CONFIG.mapSize.max) + FLAG_BOT_CONFIG.mapSize.min;

    const newPosition: Position = { x: newX, y: newY };

    // Update bot position in database
    await supabase
      .from('players')
      .update({ current_x: newX, current_y: newY })
      .eq('username', botId);

    // Get current flag for trail
    const { data: flagDoc } = await supabase
      .from('flags')
      .select('id, bot_config')
      .single();

    // Add trail entry for bot movement (8-minute lingering effect)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 1000); // 8 minutes from now

    const newTrailEntry = {
      x: newPosition.x,
      y: newPosition.y,
      timestamp: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    if (flagDoc) {
      const config = parseFlagBotConfig(flagDoc.bot_config);
      const existingTrail: Record<string, Json | undefined>[] = config.trail as Record<string, Json | undefined>[] || [];

      // Filter out expired trail entries
      const activeTrail = existingTrail.filter(t => {
        const exp = parseJsonString(t.expiresAt);
        return exp && new Date(exp) > now;
      });

      // Add new entry and cap at 200
      const updatedTrail = [...activeTrail, newTrailEntry as unknown as Record<string, Json | undefined>].slice(-200);

      // Update flag position AND trail in bot_config JSON
      await supabase
        .from('flags')
        .update({
          position_x: newPosition.x,
          position_y: newPosition.y,
          bot_config: {
            ...config,
            trail: updatedTrail,
          },
        })
        .eq('id', flagDoc.id);

      // Add trail entry to flag_trails table for particle effects
      await supabase.from('flag_trails').insert({
        holder_username: botId,
        x: newPosition.x,
        y: newPosition.y,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    console.log(`🤖 Flag bot teleported: (${bot.current_x}, ${bot.current_y}) → (${newX}, ${newY})`);

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
    const supabase = createServiceClient();

    // Get bot and victor data
    const { data: bot, error: botError } = await supabase
      .from('players')
      .select('*')
      .eq('username', botId)
      .single();

    const { data: victor, error: victorError } = await supabase
      .from('players')
      .select('*')
      .eq('username', victorId)
      .single();

    if (botError || !bot || victorError || !victor) {
      throw new Error('Bot or victor not found');
    }

    // Reset bot HP to full
    await supabase
      .from('players')
      .update({ current_hp: FLAG_BOT_CONFIG.baseHP })
      .eq('username', botId);

    // Get current flag for trail and transfer history
    const { data: flagDoc, error: flagError } = await supabase
      .from('flags')
      .select('*')
      .single();

    if (flagError || !flagDoc) {
      throw new Error('Flag document not found');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 1000); // 8 minutes from now

    const newTrail = [
      {
        x: victor.current_x,
        y: victor.current_y,
        timestamp: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    ];

    const newTransfer = {
      from: { type: 'bot', id: botId, username: bot.username },
      to: { type: 'player', id: victorId, username: victor.username },
      timestamp: now.toISOString(),
      method: 'combat',
    };

    const config = parseFlagBotConfig(flagDoc.bot_config);
    const existingHistory: Json[] = config.transferHistory as Json[] || [];
    const existingStats: Record<string, number> = config.statistics as Record<string, number> || {
      totalTransfers: 0,
      longestHold: { username: '', duration: 0 },
      mostTransfers: { username: '', count: 0 },
    };

    // Increment total transfers
    existingStats.totalTransfers = (existingStats.totalTransfers || 0) + 1;

    const updatedConfig = {
      ...config,
      trail: newTrail,
      transferHistory: [...existingHistory, newTransfer],
      statistics: existingStats,
    };

    // Transfer flag to victor with flat columns + bot_config JSON + new challenge state
    await supabase
      .from('flags')
      .update({
        is_bot: false,
        bearer_id: victorId,
        bearer_username: victor.username,
        position_x: victor.current_x,
        position_y: victor.current_y,
        claimed_at: now.toISOString(),
        current_hp: flagDoc.max_hp,
        session_metal_earned: 0,
        session_energy_earned: 0,
        flee_count: 0,
        grace_until: null,
        max_hold_expires_at: null,
        challenge_active: false,
        challenge_challenger_id: null,
        challenge_started_at: null,
        challenge_expires_at: null,
        challenge_lock_expires_at: null,
        bot_config: updatedConfig,
      } as never)
      .eq('id', flagDoc.id);

    // Add trail entry for particle effects
    await supabase.from('flag_trails').insert({
      holder_username: victorId,
      x: victor.current_x,
      y: victor.current_y,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

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
    const supabase = createServiceClient();
    const { data: flagDoc, error: flagError } = await supabase
      .from('flags')
      .select('*')
      .single();

    if (!flagError && flagDoc?.bearer_id && flagDoc.is_bot) {
      // Remove old flag bot
      await supabase
        .from('players')
        .delete()
        .eq('username', flagDoc.bearer_id);

      console.log(`🗑️ Old flag bot removed: ${flagDoc.bearer_username}`);
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
    const supabase = createServiceClient();
    const { data: flagDoc, error: flagError } = await supabase
      .from('flags')
      .select('*')
      .single();

    if (flagError || !flagDoc?.claimed_at) {
      return true; // No flag or no holder, needs reset
    }

    const timeSinceClaim = Date.now() - new Date(flagDoc.claimed_at).getTime();
    const shouldReset = timeSinceClaim > FLAG_BOT_CONFIG.respawnDelay;

    return shouldReset;
  } catch (error) {
    console.error('❌ Error checking flag reset status:', error);
    return false;
  }
}

/**
 * Initialize flags table with first flag bot
 * Called on first server startup if flags table doesn't have a row
 * 
 * CRITICAL: This function ensures only ONE flag exists in the system.
 * It checks for existing flags/flag bots and only creates if none exist.
 */
export async function initializeFlagSystem(): Promise<void> {
  try {
    const supabase = createServiceClient();

    // Check if flags table already has a row
    const { data: flagDoc, error: flagError } = await supabase
      .from('flags')
      .select('*')
      .single();

    if (!flagError && flagDoc) {
      // Flag system already initialized, do nothing
      console.log('✅ Flag system already initialized');
      return;
    }

    // Check if any flag bots already exist in players table
    const { data: existingFlagBots, error: botError } = await supabase
      .from('players')
      .select('username')
      .ilike('username', 'Flag-Bearer-%');

    if (!botError && existingFlagBots && existingFlagBots.length > 0) {
      console.log('⚠️ Found orphaned flag bots without flag row - cleaning up');
      // Delete all flag bots
      const usernames = existingFlagBots.map((b: any) => b.username);
      for (const username of usernames) {
        await supabase.from('players').delete().eq('username', username);
      }
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
// - Flags table: Singleton row tracking current holder with flat columns
// - Transfer history: Stored in bot_config JSONB on flags table
// - Statistics: Stored in bot_config JSONB on flags table
// 
// Why Random Teleport Instead of Incremental Movement?
// - Map is 150×150 = 22,500 tiles
// - Moving 1-3 tiles every 30 min would keep flag in tiny area
// - Random teleport ensures flag is accessible to all players
// - Creates dynamic gameplay - flag location constantly changes
// - Prevents flag camping in one zone
// 
// Related Lessons:
// - Lesson #35: Zero mocks - all data from Supabase
// - Lesson #37: Complete file reading before implementation
// 
// Database Tables Used:
// - players: Bot and player data
// - flags: Current flag state (singleton row)
// ============================================================
// END OF FILE
// ============================================================
