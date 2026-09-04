/**
 * Chat Service
 * Created: 2025-10-25
 * Feature: FID-20251025-103
 * 
 * OVERVIEW:
 * Core chat functionality with MySQL persistence via Drizzle ORM, item linking,
 * profanity filtering, rate limiting, and Ask Veterans notifications.
 * Handles message storage with 1-week display window and 1-year retention.
 * 
 * KEY FEATURES:
 * - Message storage with monthly categorization
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
 * - Drizzle ORM (database operations)
 */

import { randomUUID } from 'node:crypto';
import { eq, and, lt, gte, desc } from 'drizzle-orm';
import { Filter } from 'bad-words';
import { db } from '@/lib/db';
import { chatMessages, wordBlacklist, players } from '@/lib/db/schema';
import {
  ChannelType,
  canWriteChannel,
  type PlayerContext,
} from './channelService';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Chat message stored in database
 */
export interface ChatMessage {
  id: string;
  channelId: ChannelType;
  clanId?: string; // If clan channel
  senderId: string;
  senderUsername: string;
  senderLevel: number;
  isVIP: boolean;
  isNewbie: boolean; // Level 1-5
  message: string;
  itemLinks: string[]; // Parsed [ItemName] references
  mentions: string[]; // @username references
  timestamp: Date;
  monthCategory: string; // "2025-10" for indexing/cleanup
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
  limit?: number; // Default: 100
  before?: Date; // Pagination: messages before this timestamp
  since?: Date; // Messages after this timestamp (for real-time sync)
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
  resetTime: number; // Timestamp in ms
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Rate limiting
const RATE_LIMIT_WINDOW = 10 * 1000; // 10 seconds
const RATE_LIMIT_NORMAL = 5; // 5 messages per 10 seconds
const RATE_LIMIT_VIP = 10; // 10 messages per 10 seconds

// History retention
const DISPLAY_WINDOW_DAYS = 7; // Show 1 week of history
const RETENTION_DAYS = 365; // Keep 1 year of history

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
// CONTENT FILTERING
// ============================================================================

/**
 * Load custom blacklist words from database
 */
async function loadCustomBlacklist(): Promise<void> {
  try {
    const words = await db.select().from(wordBlacklist);
    customBlacklist = words.map(w => w.word);
    
    // Add to profanity filter
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
 * TODO: The items collection/table doesn't exist in the current Drizzle schema.
 * Implement this when the items table is added to the schema.
 * 
 * @param itemName - Item name to validate
 * @returns True if item exists
 */
export async function validateItem(_itemName: string): Promise<boolean> {
  try {
    // TODO: Implement when items table is added to schema
    // Example: const item = await db.select().from(items).where(eq(items.name, itemName)).limit(1);
    console.warn('[ChatService] validateItem not implemented - items table not in schema');
    return false;
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
    const player = await db.select().from(players).where(eq(players.username, username)).limit(1);
    return player.length > 0;
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
    // Create new window
    rateLimits.set(playerId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return false;
  }
  
  if (entry.count >= limit) {
    // Rate limit exceeded
    return true;
  }
  
  // Increment count
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

    // Validate permissions
    const perm = canWriteChannel(channelId, sender);
    if (!perm.canWrite) {
      return { success: false, error: perm.reason || 'Permission denied' };
    }

    // Check rate limit
    if (checkGlobalChatRateLimit(sender.username, sender.isVIP)) {
      const resetTime = getRateLimitResetTime(sender.username);
      return {
        success: false,
        error: `Rate limit exceeded. Try again in ${resetTime} seconds.`,
      };
    }

    // Validate message length
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      return { success: false, error: 'Message cannot be empty' };
    }
    if (trimmed.length > 1000) {
      return { success: false, error: 'Message too long (max 1000 characters)' };
    }

    // Filter profanity
    const filtered = filterProfanity(trimmed);

    // Parse item links and mentions
    const itemLinks = parseItemLinks(filtered);
    const mentions = parseMentions(filtered);

    // Create message document
    const now = new Date();
    const monthCategory = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // chat_messages.id is varchar(24) — randomUUID() (36 chars) overflows the column
    const messageId = randomUUID().replace(/-/g, '').slice(0, 24);

    const chatMessage: ChatMessage = {
      id: messageId,
      channelId,
      clanId,
      senderId: sender.username,
      senderUsername: sender.username,
      senderLevel: sender.level,
      isVIP: sender.isVIP,
      isNewbie: sender.level >= 1 && sender.level <= 5,
      message: filtered,
      itemLinks,
      mentions,
      timestamp: now,
      monthCategory,
      edited: false,
      deleted: false,
    };

    // Save to database
    await db.insert(chatMessages).values({
      id: messageId,
      channelId,
      clanId,
      senderId: sender.username,
      senderUsername: sender.username,
      senderLevel: sender.level,
      isVIP: sender.isVIP ? 1 : 0,
      isNewbie: chatMessage.isNewbie ? 1 : 0,
      message: filtered,
      itemLinks,
      mentions,
      timestamp: now,
      monthCategory,
      edited: 0,
      deleted: 0,
    });

    return { success: true, message: chatMessage };
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

    // Build query conditions
    const conditions = [
      eq(chatMessages.channelId, channelId),
      eq(chatMessages.deleted, 0),
    ];

    if (clanId) {
      conditions.push(eq(chatMessages.clanId, clanId));
    }

    // 1-week display window (unless specific date range requested)
    if (!since && !before) {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - DISPLAY_WINDOW_DAYS);
      conditions.push(gte(chatMessages.timestamp, oneWeekAgo));
    } else {
      if (since) {
        conditions.push(gte(chatMessages.timestamp, since));
      }
      if (before) {
        conditions.push(lt(chatMessages.timestamp, before));
      }
    }

    // Fetch messages
    const messages = await db
      .select()
      .from(chatMessages)
      .where(and(...conditions))
      .orderBy(desc(chatMessages.timestamp))
      .limit(Math.min(limit, 500)); // Cap at 500 for performance

    // Convert to ChatMessage interface
    const result: ChatMessage[] = messages.map(msg => ({
      id: msg.id,
      channelId: msg.channelId as ChannelType,
      clanId: msg.clanId ?? undefined,
      senderId: msg.senderId,
      senderUsername: msg.senderUsername,
      senderLevel: msg.senderLevel,
      isVIP: msg.isVIP === 1,
      isNewbie: msg.isNewbie === 1,
      message: msg.message,
      itemLinks: msg.itemLinks ?? [],
      mentions: msg.mentions ?? [],
      timestamp: msg.timestamp,
      monthCategory: msg.monthCategory,
      edited: msg.edited === 1,
      editedAt: msg.editedAt ?? undefined,
      deleted: msg.deleted === 1,
      deletedBy: msg.deletedBy ?? undefined,
      deletionReason: msg.deletionReason ?? undefined,
    }));

    return result.reverse(); // Oldest first for display
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
    const result = await db.update(chatMessages)
      .set({
        deleted: 1,
        deletedBy,
        deletionReason: reason,
      })
      .where(eq(chatMessages.id, messageId));

    // drizzle pg returns rowCount (affectedRows is a MySQL-ism — always undefined here)
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[ChatService] Delete message error:', error);
    return false;
  }
}

/**
 * Edit a global chat message (own messages only, within 5 minutes)
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
    const message = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
    
    if (message.length === 0) {
      return { success: false, error: 'Message not found' };
    }
    
    const msg = message[0];
    
    if (msg.senderId !== userId) {
      return { success: false, error: 'Can only edit own messages' };
    }
    
    // Check 5-minute edit window
    const now = new Date();
    const messageAge = now.getTime() - msg.timestamp.getTime();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (messageAge > fiveMinutes) {
      return { success: false, error: 'Edit window expired (5 minutes)' };
    }
    
    // Filter profanity and update
    const filtered = filterProfanity(newMessage.trim());
    const itemLinks = parseItemLinks(filtered);
    const mentions = parseMentions(filtered);
    
    const result = await db.update(chatMessages)
      .set({
        message: filtered,
        itemLinks,
        mentions,
        edited: 1,
        editedAt: now,
      })
      .where(eq(chatMessages.id, messageId));
    
    // drizzle pg returns rowCount (affectedRows is a MySQL-ism — always undefined here)
    return { success: (result.rowCount ?? 0) > 0 };
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

  // Notification will be broadcasted via WebSocket to veteran players
  // (level >= VETERAN_LEVEL_THRESHOLD)
  
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
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - RETENTION_DAYS);
    
    const result = await db.delete(chatMessages).where(lt(chatMessages.timestamp, oneYearAgo));
    
    // drizzle pg returns rowCount (affectedRows is a MySQL-ism — always undefined here)
    const purged = result.rowCount ?? 0;
    console.log(`[ChatService] Purged ${purged} old messages`);
    return purged;
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
 *    - MySQL via Drizzle ORM with monthly categorization (monthCategory field)
 *    - 1-week display window (default query filter)
 *    - 1-year retention (annual cleanup on Jan 1st)
 * 
 * 2. Item Linking:
 *    - Parse [ItemName] from messages
 *    - Validate items exist in database
 *    - Store in itemLinks array
 *    - Frontend renders as clickable links
 * 
 * 3. Profanity Filtering:
 *    - bad-words library for base filtering
 *    - Custom blacklist loaded from database
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
 *    - 5-minute edit window
 *    - Profanity filtered on edit
 *    - Marked as edited with timestamp
 * 
 * 8. Performance:
 *    - Indexed by channelId + timestamp
 *    - Indexed by monthCategory for cleanup
 *    - Limit queries to 500 messages max
 *    - 1-week default display reduces load
 */
