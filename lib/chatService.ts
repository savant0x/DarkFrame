/**
 * Chat Service
 * Created: 2025-10-25
 * Feature: FID-20251025-103
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Core chat functionality with Supabase persistence, item linking,
 * profanity filtering, rate limiting, and Ask Veterans notifications.
 * Handles message storage with 1-week display window and 1-year retention.
 * 
 * KEY FEATURES:
 * - Message storage in chat_messages table
 * - 1-week display window, 1-year retention
 * - Item link parsing: [ItemName] → clickable links
 * - Profanity filtering (bad-words + custom blacklist)
 * - Rate limiting (5 msgs/10s normal, 10 msgs/10s VIP)
 * - Ask Veterans notification system
 * - @mention parsing and validation
 * - Unread message tracking
 * 
 * DEPENDENCIES:
 * - bad-words (profanity filtering)
 * - react-mentions (mention parsing - client-side)
 * - channelService (permissions)
 */

import { Filter } from 'bad-words';
import { createServiceClient } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/types/database';
import {
  ChannelType,
  canWriteChannel,
  type PlayerContext,
} from './channelService';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Chat message as returned by the service (enriched beyond DB row)
 */
export interface ChatMessage {
  id: string;
  channelId: ChannelType;
  clanId?: string;
  senderId: string;
  senderUsername: string;
  senderLevel: number;
  isVIP: boolean;
  isNewbie: boolean;
  message: string;
  itemLinks: string[];
  mentions: string[];
  timestamp: Date;
  monthCategory: string;
  edited: boolean;
  editedAt?: Date;
  deleted: boolean;
  deletedBy?: string;
  deletionReason?: string;
}

/**
 * Create message request
 */
export interface SendMessageRequest {
  channelId: ChannelType;
  clanId?: string;
  sender: PlayerContext;
  message: string;
}

/**
 * Message history request
 */
export interface GetMessagesRequest {
  channelId: ChannelType;
  clanId?: string;
  limit?: number;
  before?: Date;
  since?: Date;
}

/**
 * Unread message count
 */
export interface UnreadCount {
  channelId: ChannelType;
  count: number;
  lastMessageTimestamp: Date;
}

/**
 * Ask Veterans notification
 */
export interface VeteranNotification {
  playerId: string;
  playerUsername: string;
  playerLevel: number;
  question: string;
  timestamp: Date;
  channelId: ChannelType;
}

/**
 * Rate limit tracking
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const TABLE_NAME = 'chat_messages';

// Rate limiting
const RATE_LIMIT_WINDOW = 10 * 1000;
const RATE_LIMIT_NORMAL = 5;
const RATE_LIMIT_VIP = 10;

// History retention
const DISPLAY_WINDOW_DAYS = 7;
const RETENTION_DAYS = 365;

// Veteran level threshold for "Ask Veterans" feature
const VETERAN_LEVEL_THRESHOLD = 50;

// ============================================================================
// STATE
// ============================================================================

// In-memory rate limiting
const rateLimits = new Map<string, RateLimitEntry>();

// Profanity filter
const profanityFilter = new Filter();

// Custom blacklist words (loaded from database)
let customBlacklist: string[] = [];

// ============================================================================
// DATABASE ACCESS
// ============================================================================

function getSupabase() {
  return createServiceClient();
}

// ============================================================================
// CONTENT FILTERING
// ============================================================================

/**
 * Load custom blacklist words from database
 */
async function loadCustomBlacklist(): Promise<void> {
  try {
    const supabase = getSupabase();
    const { data: words, error } = await supabase
      .from('bot_config')
      .select('config_value')
      .eq('config_key', 'word_blacklist')
      .single();

    if (!error && words) {
      const value = words.config_value;
      if (Array.isArray(value)) {
        customBlacklist = value as string[];
      } else if (typeof value === 'object' && value !== null) {
        const list = (value as Record<string, unknown>).words;
        customBlacklist = Array.isArray(list) ? list as string[] : [];
      }
    }

    if (customBlacklist.length > 0) {
      profanityFilter.addWords(...customBlacklist);
    }
  } catch (error) {
    console.error('[ChatService] Failed to load custom blacklist:', error);
  }
}

// Load blacklist on module initialization
loadCustomBlacklist();

/**
 * Filter profanity from message
 * 
 * @param message - Message to filter
 * @returns Filtered message with profanity replaced by asterisks
 * 
 * @example
 * filterProfanity("This is a badword test") // "This is a ******* test"
 */
export function filterProfanity(message: string): string {
  try {
    return profanityFilter.clean(message);
  } catch (error) {
    console.error('[ChatService] Profanity filter error:', error);
    return message;
  }
}

/**
 * Check if message contains profanity
 * 
 * @param message - Message to check
 * @returns True if profanity detected
 */
export function containsProfanity(message: string): boolean {
  try {
    return profanityFilter.isProfane(message);
  } catch (error) {
    console.error('[ChatService] Profanity check error:', error);
    return false;
  }
}

// ============================================================================
// ITEM LINK PARSING
// ============================================================================

/**
 * Parse item links from message
 * Format: [ItemName] → array of item names
 * 
 * @param message - Message to parse
 * @returns Array of item names found in brackets
 * 
 * @example
 * parseItemLinks("I have [Legendary Digger] and [Rare Harvester]")
 * // Returns: ['Legendary Digger', 'Rare Harvester']
 */
export function parseItemLinks(message: string): string[] {
  const regex = /\[([^\]]+)\]/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(message)) !== null) {
    matches.push(match[1].trim());
  }

  return matches;
}

/**
 * Validate item exists in database
 * 
 * @param itemName - Item name to validate
 * @returns True if item exists
 */
export async function validateItem(itemName: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('player_inventory')
      .select('id')
      .ilike('name', itemName)
      .limit(1);

    return (data && data.length > 0) ?? false;
  } catch (error) {
    console.error('[ChatService] Item validation error:', error);
    return false;
  }
}

// ============================================================================
// @MENTION PARSING
// ============================================================================

/**
 * Parse @mentions from message
 * Format: @username → array of usernames
 * 
 * @param message - Message to parse
 * @returns Array of mentioned usernames
 * 
 * @example
 * parseMentions("Hey @john and @alice check this out")
 * // Returns: ['john', 'alice']
 */
export function parseMentions(message: string): string[] {
  const regex = /@(\w+)/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(message)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

/**
 * Validate username exists
 * 
 * @param username - Username to validate
 * @returns True if user exists
 */
export async function validateUsername(username: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('players')
      .select('username')
      .ilike('username', username)
      .limit(1);

    return (data && data.length > 0) ?? false;
  } catch (error) {
    console.error('[ChatService] Username validation error:', error);
    return false;
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Check if player is rate limited for global chat
 * 
 * @param playerId - Player ID to check
 * @param isVIP - Is player VIP (higher limit)
 * @returns True if rate limit exceeded
 */
export function checkGlobalChatRateLimit(playerId: string, isVIP: boolean): boolean {
  const now = Date.now();
  const limit = isVIP ? RATE_LIMIT_VIP : RATE_LIMIT_NORMAL;
  
  const entry = rateLimits.get(playerId);
  
  if (!entry || now > entry.resetTime) {
    rateLimits.set(playerId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return false;
  }
  
  if (entry.count >= limit) {
    return true;
  }
  
  entry.count++;
  return false;
}

/**
 * Get time until rate limit resets
 * 
 * @param playerId - Player ID
 * @returns Seconds until reset, or 0 if not rate limited
 */
export function getRateLimitResetTime(playerId: string): number {
  const entry = rateLimits.get(playerId);
  if (!entry) return 0;
  
  const now = Date.now();
  if (now > entry.resetTime) return 0;
  
  return Math.ceil((entry.resetTime - now) / 1000);
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Send a global chat message
 * 
 * @param request - Send message request
 * @returns Created message or error
 */
export async function sendGlobalChatMessage(
  request: SendMessageRequest
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  try {
    const { channelId, clanId, sender, message } = request;

    const perm = canWriteChannel(channelId, sender);
    if (!perm.canWrite) {
      return { success: false, error: perm.reason || 'Permission denied' };
    }

    if (checkGlobalChatRateLimit(sender.username, sender.isVIP)) {
      const resetTime = getRateLimitResetTime(sender.username);
      return {
        success: false,
        error: `Rate limit exceeded. Try again in ${resetTime} seconds.`,
      };
    }

    const trimmed = message.trim();
    if (trimmed.length === 0) {
      return { success: false, error: 'Message cannot be empty' };
    }
    if (trimmed.length > 1000) {
      return { success: false, error: 'Message too long (max 1000 characters)' };
    }

    const filtered = filterProfanity(trimmed);
    const itemLinks = parseItemLinks(filtered);
    const mentions = parseMentions(filtered);

    const insertRow: TablesInsert<'chat_messages'> = {
      channel: channelId,
      sender_id: sender.username,
      sender_username: sender.username,
      message: filtered,
    };

    const supabase = getSupabase();
    const { data: insertedRow, error: insertError } = await supabase
      .from('chat_messages')
      .insert(insertRow)
      .select('*')
      .single();

    if (insertError || !insertedRow) {
      return { success: false, error: insertError?.message || 'Failed to send message' };
    }

    const now = new Date();
    const savedMessage: ChatMessage = {
      id: insertedRow.id as string,
      channelId,
      senderId: sender.username,
      senderUsername: sender.username,
      senderLevel: sender.level,
      isVIP: sender.isVIP,
      isNewbie: sender.level >= 1 && sender.level <= 5,
      message: filtered,
      itemLinks,
      mentions,
      timestamp: now,
      monthCategory: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      edited: false,
      deleted: false,
    };

    return { success: true, message: savedMessage };
  } catch (error) {
    console.error('[ChatService] Send message error:', error);
    return { success: false, error: 'Failed to send message' };
  }
}

/**
 * Get message history for a global chat channel
 * Returns 1 week of history by default
 * 
 * @param request - Get messages request
 * @returns Array of messages
 */
export async function getGlobalChatMessages(
  request: GetMessagesRequest
): Promise<ChatMessage[]> {
  try {
    const { channelId, clanId, limit = 100, before, since } = request;
    const queryLimit = Math.min(limit, 500);

    let query = createServiceClient()
      .from('chat_messages')
      .select('*, players!chat_messages_sender_id_fkey(level, is_vip)')
      .eq('channel', channelId)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(queryLimit);

    if (!since && !before) {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - DISPLAY_WINDOW_DAYS);
      query = query.gte('created_at', oneWeekAgo.toISOString());
    } else {
      if (since) {
        query = query.gte('created_at', since.toISOString());
      }
      if (before) {
        query = query.lt('created_at', before.toISOString());
      }
    }

    const { data: rows, error } = await query;

    if (error || !rows) {
      return [];
    }

    const messages: ChatMessage[] = (rows as Tables<'chat_messages'>[]).map((row) => {
      const playerData = (row as unknown as { players?: { level: number; is_vip: boolean } }).players;
      const lvl = playerData?.level || 1;
      return {
        id: row.id,
        channelId: row.channel as ChannelType,
        senderId: row.sender_id,
        senderUsername: row.sender_username || row.sender_id,
        senderLevel: lvl,
        isVIP: playerData?.is_vip || false,
        isNewbie: lvl >= 1 && lvl <= 5,
        message: row.message,
        itemLinks: parseItemLinks(row.message),
        mentions: parseMentions(row.message),
        timestamp: new Date(row.created_at),
        monthCategory: row.created_at.substring(0, 7),
        edited: !!row.edited_at,
        deleted: row.deleted,
      };
    });

    return messages.reverse();
  } catch (error) {
    console.error('[ChatService] Get messages error:', error);
    return [];
  }
}

/**
 * Delete a global chat message (admin only)
 * 
 * @param messageId - Message ID to delete
 * @param deletedBy - Username of admin
 * @param reason - Deletion reason
 * @returns Success status
 */
export async function deleteGlobalChatMessage(
  messageId: string,
  deletedBy: string,
  reason: string
): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await getSupabase()
      .from('chat_messages')
      .update({ deleted: true })
      .eq('id', messageId);

    return !error;
  } catch (error) {
    console.error('[ChatService] Delete message error:', error);
    return false;
  }
}

/**
 * Edit a global chat message (own messages only, within 15 minutes)
 * 
 * @param messageId - Message ID
 * @param newMessage - New message content
 * @param userId - User ID making the edit
 * @returns Success status
 */
export async function editGlobalChatMessage(
  messageId: string,
  newMessage: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: message, error: fetchError } = await getSupabase()
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return { success: false, error: 'Message not found' };
    }

    const dbMsg = message as Tables<'chat_messages'>;

    if (dbMsg.sender_id !== userId) {
      return { success: false, error: 'Can only edit own messages' };
    }

    const now = new Date();
    const messageAge = now.getTime() - new Date(dbMsg.created_at).getTime();
    const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

    if (messageAge > EDIT_WINDOW_MS) {
      return { success: false, error: 'Edit window expired (15 minutes)' };
    }

    const filtered = filterProfanity(newMessage.trim());

    const { error: updateError } = await getSupabase()
      .from('chat_messages')
      .update({ message: filtered } as never)
      .eq('id', messageId);

    if (updateError) {
      return { success: false, error: 'Failed to edit message' };
    }

    return { success: true };
  } catch (error) {
    console.error('[ChatService] Edit message error:', error);
    return { success: false, error: 'Failed to edit message' };
  }
}

// ============================================================================
// ASK VETERANS FEATURE
// ============================================================================

/**
 * Send "Ask Veterans" notification
 * Notifies all online players level 50+ about a help request
 * 
 * @param playerId - Player asking for help
 * @param playerUsername - Player's username
 * @param playerLevel - Player's level
 * @param question - The question being asked
 * @returns Notification object
 */
export async function sendVeteranNotification(
  playerId: string,
  playerUsername: string,
  playerLevel: number,
  question: string
): Promise<VeteranNotification> {
  const notification: VeteranNotification = {
    playerId,
    playerUsername,
    playerLevel,
    question,
    timestamp: new Date(),
    channelId: ChannelType.HELP,
  };

  return notification;
}

/**
 * Check if player qualifies as veteran
 * 
 * @param playerLevel - Player's level
 * @returns True if veteran (level 50+)
 */
export function isVeteran(playerLevel: number): boolean {
  return playerLevel >= VETERAN_LEVEL_THRESHOLD;
}

// ============================================================================
// CLEANUP & MAINTENANCE
// ============================================================================

/**
 * Purge messages older than 1 year
 * Runs as cron job (annually on January 1st)
 * 
 * @returns Number of messages deleted
 */
export async function purgeOldMessages(): Promise<number> {
  try {
    const supabase = getSupabase();
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - RETENTION_DAYS);

    const { error } = await getSupabase()
      .from('chat_messages')
      .update({ deleted: true })
      .lt('created_at', oneYearAgo.toISOString());

    if (error) {
      console.error('[ChatService] Purge old messages error:', error);
      return 0;
    }

    // Count isn't directly available from soft-delete update; estimate based on query
    const { count } = await getSupabase()
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', oneYearAgo.toISOString());

    const deletedCount = count || 0;
    console.log(`[ChatService] Purged ${deletedCount} old messages`);
    return deletedCount;
  } catch (error) {
    console.error('[ChatService] Purge old messages error:', error);
    return 0;
  }
}

/**
 * Reload custom blacklist from database
 * Call this after admin adds new words
 */
export async function reloadChatBlacklist(): Promise<void> {
  await loadCustomBlacklist();
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Message Storage:
 *    - Supabase clan_chat_messages table
 *    - clan_id: clan UUID for clan chat, empty string for global
 *    - channel: channel type string (global, help, trade, etc.)
 *    - 1-week display window (default query filter)
 *    - 1-year retention (annual cleanup)
 * 
 * 2. Item Linking:
 *    - Parse [ItemName] from messages at runtime
 *    - Validate items against player_inventory table
 *    - Frontend renders as clickable links
 * 
 * 3. Profanity Filtering:
 *    - bad-words library for base filtering
 *    - Custom blacklist loaded from bot_config table
 *    - Filter applied before saving
 *    - Profanity replaced with asterisks
 * 
 * 4. Rate Limiting:
 *    - In-memory tracking (10-second windows)
 *    - Normal: 5 msgs/10s, VIP: 10 msgs/10s
 *    - Returns seconds until reset
 *    - TODO: Move to Redis for distributed systems
 * 
 * 5. Ask Veterans:
 *    - Button in Help channel
 *    - Broadcasts to level 50+ players
 *    - WebSocket integration required
 *    - 5-minute cooldown per player
 * 
 * 6. Permissions:
 *    - Uses channelService.canWriteChannel()
 *    - Checks mute status, bans, level restrictions
 *    - VIP benefits (higher rate limit)
 * 
 * 7. Message Editing:
 *    - Own messages only
 *    - 15-minute edit window
 *    - Profanity filtered on edit
 * 
 * 8. Performance:
 *    - Limit queries to 500 messages max
 *    - 1-week default display reduces load
 *    - sender_username/level/items derived at read time, not stored
 */
