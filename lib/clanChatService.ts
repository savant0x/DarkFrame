/**
 * Clan Chat Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages clan chat functionality including message sending, history retrieval,
 * and moderation. Provides real-time chat experience for clan members with
 * role-based permissions and message persistence.
 * 
 * Features:
 * - Message sending with validation
 * - Message history with pagination
 * - Role-based moderation (delete messages)
 * - Message editing (own messages only)
 * - Anti-spam protection (rate limiting)
 * - System messages for clan events
 * 
 * Permissions:
 * - Send: All members except Recruit (24hr wait)
 * - Edit: Own messages within 5 minutes
 * - Delete: Leaders/Co-Leaders can delete any, others own only
 * - View: All members
 * 
 * @module lib/clanChatService
 */

import { db } from '@/lib/db';
import { players, clans } from '@/lib/db/schema';
import { eq, and, gt, lt, desc, sql } from 'drizzle-orm';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum MessageType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
}

export interface ChatMessage {
  id: string;
  clanId: string;
  type: MessageType;
  
  playerId?: string;
  username?: string;
  role?: string;
  
  message: string;
  timestamp: Date;
  
  editedAt?: Date;
  deletedAt?: Date;
  deletedBy?: string;
  
  eventType?: string;
  eventData?: any;
}

export interface ChatMessageWithAuthor extends ChatMessage {
  author?: {
    playerId: string;
    username: string;
    role: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const CHAT_LIMITS = {
  MESSAGE_MAX_LENGTH: 500,
  MESSAGES_PER_PAGE: 50,
  RATE_LIMIT_MESSAGES: 5,
  RATE_LIMIT_WINDOW_SECONDS: 60,
  EDIT_WINDOW_MINUTES: 5,
  RECRUIT_WAIT_HOURS: 24,
};

// ============================================================================
// MESSAGE FUNCTIONS
// ============================================================================

/**
 * Send clan chat message
 * 
 * @param clanId - Clan ID
 * @param playerId - Player sending message
 * @param message - Message text
 * @param type - Message type (default USER)
 * @returns Created message
 * @throws Error if validation fails or rate limited
 * @example
 * const msg = await sendClanChatMessage('clan123', 'player456', 'Hello clan!');
 */
export async function sendClanChatMessage(
  clanId: string,
  playerId: string,
  message: string,
  type: MessageType = MessageType.USER
): Promise<ChatMessage> {
  if (!message || message.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  
  if (message.length > CHAT_LIMITS.MESSAGE_MAX_LENGTH) {
    throw new Error(`Message too long (max ${CHAT_LIMITS.MESSAGE_MAX_LENGTH} characters)`);
  }
  
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0];
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const members = clan.members as any[];
  const member = members.find((m: any) => m.playerId === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }
  
  if (member.role === 'RECRUIT') {
    const joinedAt = new Date(member.joinedAt);
    const hoursSinceJoin = (Date.now() - joinedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceJoin < CHAT_LIMITS.RECRUIT_WAIT_HOURS) {
      const hoursRemaining = Math.ceil(CHAT_LIMITS.RECRUIT_WAIT_HOURS - hoursSinceJoin);
      throw new Error(`Recruits must wait ${hoursRemaining} hours before chatting`);
    }
  }
  
  const rateLimitStart = new Date(Date.now() - CHAT_LIMITS.RATE_LIMIT_WINDOW_SECONDS * 1000);
  const rateResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM clan_chat_messages
    WHERE clan_id = ${clanId} AND player_id = ${playerId}
    AND timestamp >= ${rateLimitStart}
    AND deleted_at IS NULL
  `);
  
  const recentMessages = Number((rateResult.rows[0] as { cnt?: string | number } | undefined)?.cnt || 0);
  if (recentMessages >= CHAT_LIMITS.RATE_LIMIT_MESSAGES) {
    throw new Error(`Rate limit exceeded. Max ${CHAT_LIMITS.RATE_LIMIT_MESSAGES} messages per ${CHAT_LIMITS.RATE_LIMIT_WINDOW_SECONDS} seconds`);
  }
  
  // pg: identity is username (mongo_id is NULL post-migration)
  const playerResult = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
  const player = playerResult[0];
  
  const messageId = crypto.randomUUID().slice(0, 24);
  const chatMessage: ChatMessage = {
    id: messageId,
    clanId,
    type,
    playerId,
    username: player?.username || 'Unknown',
    role: member.role,
    message: message.trim(),
    timestamp: new Date(),
  };
  
  await db.execute(sql`
    INSERT INTO clan_chat_messages 
    (id, clan_id, type, player_id, username, role, message, timestamp)
    VALUES (${messageId}, ${clanId}, ${type}, ${playerId}, ${chatMessage.username}, ${member.role}, ${chatMessage.message}, ${chatMessage.timestamp})
  `);
  
  return chatMessage;
}

/**
 * Send system message
 * 
 * @param clanId - Clan ID
 * @param message - System message text
 * @param eventType - Event type (e.g., 'WAR_DECLARED')
 * @param eventData - Additional event data
 * @returns Created message
 * @example
 * await sendSystemMessage('clan123', 'War declared against Enemy Clan!', 'WAR_DECLARED', { targetClan: 'clan456' });
 */
export async function sendSystemMessage(
  clanId: string,
  message: string,
  eventType?: string,
  eventData?: any
): Promise<ChatMessage> {
  const messageId = crypto.randomUUID().slice(0, 24);
  const chatMessage: ChatMessage = {
    id: messageId,
    clanId,
    type: MessageType.SYSTEM,
    message: message.trim(),
    timestamp: new Date(),
    eventType,
    eventData,
  };
  
  await db.execute(sql`
    INSERT INTO clan_chat_messages 
    (id, clan_id, type, message, timestamp, event_type, event_data)
    VALUES (${messageId}, ${clanId}, ${MessageType.SYSTEM}, ${chatMessage.message}, ${chatMessage.timestamp}, ${eventType || null}, ${eventData ? JSON.stringify(eventData) : null})
  `);
  
  return chatMessage;
}

/**
 * Get clan chat messages with pagination
 * 
 * @param clanId - Clan ID
 * @param limit - Number of messages to retrieve
 * @param before - Get messages before this timestamp (for pagination)
 * @returns Array of messages (newest first)
 * @example
 * const messages = await getClanChatMessages('clan123', 50);
 * const olderMessages = await getClanChatMessages('clan123', 50, messages[messages.length - 1].timestamp);
 */
export async function getClanChatMessages(
  clanId: string,
  limit = CHAT_LIMITS.MESSAGES_PER_PAGE,
  before?: Date
): Promise<ChatMessage[]> {
  const cappedLimit = Math.min(limit, CHAT_LIMITS.MESSAGES_PER_PAGE);
  
  let query = sql`
    SELECT * FROM clan_chat_messages
    WHERE clan_id = ${clanId} AND deleted_at IS NULL
  `;
  
  if (before) {
    query = sql`${query} AND timestamp < ${before}`;
  }
  
  query = sql`${query} ORDER BY timestamp DESC LIMIT ${cappedLimit}`;
  
  const messages = await db.execute(query);
  return (messages.rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    clanId: String(row.clan_id),
    type: String(row.type) as MessageType,
    playerId: row.player_id != null ? String(row.player_id) : undefined,
    username: row.username != null ? String(row.username) : undefined,
    role: row.role != null ? String(row.role) : undefined,
    message: String(row.message),
    timestamp: new Date(row.timestamp as string),
    editedAt: row.edited_at ? new Date(row.edited_at as string) : undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : undefined,
    deletedBy: row.deleted_by != null ? String(row.deleted_by) : undefined,
    eventType: row.event_type != null ? String(row.event_type) : undefined,
    eventData: row.event_data ? (typeof row.event_data === 'string' ? JSON.parse(row.event_data) : row.event_data) : undefined,
  }));
}

/**
 * Edit clan chat message (own messages only, within time limit)
 * 
 * @param messageId - Message ID
 * @param playerId - Player editing (must be author)
 * @param newMessage - New message text
 * @returns Updated message
 * @throws Error if not authorized or time limit exceeded
 * @example
 * await editClanChatMessage('msg123', 'player456', 'Corrected message');
 */
export async function editClanChatMessage(
  messageId: string,
  playerId: string,
  newMessage: string
): Promise<ChatMessage> {
  if (!newMessage || newMessage.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  
  if (newMessage.length > CHAT_LIMITS.MESSAGE_MAX_LENGTH) {
    throw new Error(`Message too long (max ${CHAT_LIMITS.MESSAGE_MAX_LENGTH} characters)`);
  }
  
  const messageResult = await db.execute(sql`SELECT * FROM clan_chat_messages WHERE id = ${messageId} LIMIT 1`);
  const messages = (messageResult as any) as any[];
  const message = messages[0];
  
  if (!message) {
    throw new Error('Message not found');
  }
  
  if (message.deleted_at) {
    throw new Error('Cannot edit deleted message');
  }
  
  if (message.player_id !== playerId) {
    throw new Error('Can only edit your own messages');
  }
  
  const minutesSincePost = (Date.now() - new Date(message.timestamp).getTime()) / (1000 * 60);
  if (minutesSincePost > CHAT_LIMITS.EDIT_WINDOW_MINUTES) {
    throw new Error(`Can only edit messages within ${CHAT_LIMITS.EDIT_WINDOW_MINUTES} minutes`);
  }
  
  await db.execute(sql`
    UPDATE clan_chat_messages 
    SET message = ${newMessage.trim()}, edited_at = ${new Date()}
    WHERE id = ${messageId}
  `);
  
  const updatedResult = await db.execute(sql`SELECT * FROM clan_chat_messages WHERE id = ${messageId} LIMIT 1`);
  const updated = ((updatedResult as any) as any[])[0];
  
  return {
    id: updated.id,
    clanId: updated.clan_id,
    type: updated.type,
    playerId: updated.player_id,
    username: updated.username,
    role: updated.role,
    message: updated.message,
    timestamp: new Date(updated.timestamp),
    editedAt: updated.edited_at ? new Date(updated.edited_at) : undefined,
  };
}

/**
 * Delete clan chat message
 * Leaders/Co-Leaders can delete any message, others can only delete own
 * 
 * @param messageId - Message ID
 * @param clanId - Clan ID
 * @param playerId - Player deleting
 * @returns Success status
 * @throws Error if not authorized
 * @example
 * await deleteClanChatMessage('msg123', 'clan123', 'player456');
 */
export async function deleteClanChatMessage(
  messageId: string,
  clanId: string,
  playerId: string
): Promise<void> {
  const messageResult = await db.execute(sql`SELECT * FROM clan_chat_messages WHERE id = ${messageId} LIMIT 1`);
  const message = messageResult.rows[0] as Record<string, unknown> | undefined;
  
  if (!message) {
    throw new Error('Message not found');
  }
  
  if (message.clan_id !== clanId) {
    throw new Error('Message not in this clan');
  }
  
  if (message.deleted_at) {
    throw new Error('Message already deleted');
  }
  
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0];
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const members = clan.members as any[];
  const member = members.find((m: any) => m.playerId === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }
  
  const canDeleteAny = ['LEADER', 'CO_LEADER'].includes(member.role);
  const isOwnMessage = message.player_id === playerId;
  
  if (!canDeleteAny && !isOwnMessage) {
    throw new Error('Can only delete your own messages');
  }
  
  await db.execute(sql`
    UPDATE clan_chat_messages 
    SET deleted_at = ${new Date()}, deleted_by = ${playerId}
    WHERE id = ${messageId}
  `);
}

/**
 * Get message count for clan
 * 
 * @param clanId - Clan ID
 * @returns Total message count (excluding deleted)
 */
export async function getMessageCount(clanId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM clan_chat_messages
    WHERE clan_id = ${clanId} AND deleted_at IS NULL
  `);
  
  return Number((result.rows[0] as { cnt?: string | number } | undefined)?.cnt || 0);
}

/**
 * Get recent messages since timestamp
 * Used for real-time updates
 * 
 * @param clanId - Clan ID
 * @param since - Get messages after this timestamp
 * @returns Array of new messages
 */
export async function getMessagesSince(clanId: string, since: Date): Promise<ChatMessage[]> {
  const messages = await db.execute(sql`
    SELECT * FROM clan_chat_messages
    WHERE clan_id = ${clanId}
    AND timestamp > ${since}
    AND deleted_at IS NULL
    ORDER BY timestamp ASC
  `);
  
  return (messages.rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    clanId: String(row.clan_id),
    type: String(row.type) as MessageType,
    playerId: row.player_id != null ? String(row.player_id) : undefined,
    username: row.username != null ? String(row.username) : undefined,
    role: row.role != null ? String(row.role) : undefined,
    message: String(row.message),
    timestamp: new Date(row.timestamp as string),
    editedAt: row.edited_at ? new Date(row.edited_at as string) : undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : undefined,
    deletedBy: row.deleted_by != null ? String(row.deleted_by) : undefined,
    eventType: row.event_type != null ? String(row.event_type) : undefined,
    eventData: row.event_data ? (typeof row.event_data === 'string' ? JSON.parse(row.event_data) : row.event_data) : undefined,
  }));
}
