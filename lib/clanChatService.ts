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

import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum MessageType {
  USER = 'USER',           // Regular user message
  SYSTEM = 'SYSTEM',       // System-generated message (war declared, etc.)
  ANNOUNCEMENT = 'ANNOUNCEMENT', // Leader announcement (highlighted)
}

export interface ChatMessage {
  id?: string;
  clanId: string;
  type: MessageType;

  // User messages
  playerId?: string;
  username?: string;
  role?: string;

  message: string;
  created_at: string;

  // Moderation
  editedAt?: string;
  deleted?: boolean;
  deletedBy?: string;

  // System messages
  eventType?: string;       // For system messages (e.g., 'WAR_DECLARED')
  eventData?: Record<string, unknown>;          // Additional event data
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
  RATE_LIMIT_MESSAGES: 5,      // Max messages
  RATE_LIMIT_WINDOW_SECONDS: 60, // Per 60 seconds
  EDIT_WINDOW_MINUTES: 5,       // Can edit within 5 minutes
  RECRUIT_WAIT_HOURS: 24,       // Recruits must wait 24 hours
};

// ============================================================================
// HELPERS
// ============================================================================

function messageTypeToChannel(type: MessageType): string {
  switch (type) {
    case MessageType.SYSTEM: return 'system';
    case MessageType.ANNOUNCEMENT: return 'announcement';
    default: return 'general';
  }
}

function channelToMessageType(channel: string): MessageType {
  switch (channel) {
    case 'system': return MessageType.SYSTEM;
    case 'announcement': return MessageType.ANNOUNCEMENT;
    default: return MessageType.USER;
  }
}

function supabaseRowToChatMessage(
  row: Database['public']['Tables']['clan_chat_messages']['Row'],
  extra?: { username?: string; role?: string; eventType?: string; eventData?: Record<string, unknown> }
): ChatMessage {
  return {
    id: row.id,
    clanId: row.clan_id,
    type: channelToMessageType(row.channel),
    playerId: row.sender_id,
    username: extra?.username || row.sender_id,
    role: extra?.role || row.sender_role,
    message: row.message,
    created_at: row.created_at,
    deleted: row.deleted,
    eventType: extra?.eventType,
    eventData: extra?.eventData,
  };
}

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
  const supabase = createServiceClient();

  // Validate message length
  if (!message || message.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }

  if (message.length > CHAT_LIMITS.MESSAGE_MAX_LENGTH) {
    throw new Error(`Message too long (max ${CHAT_LIMITS.MESSAGE_MAX_LENGTH} characters)`);
  }

  // Get clan member record
  const { data: member, error: memberError } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId)
    .eq('player_id', playerId)
    .single();

  if (memberError || !member) {
    throw new Error('Player is not a member of this clan');
  }

  // Check recruit wait period
  if (member.role === 'RECRUIT') {
    const joinedAt = new Date(member.joined_at);
    const hoursSinceJoin = (Date.now() - joinedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceJoin < CHAT_LIMITS.RECRUIT_WAIT_HOURS) {
      const hoursRemaining = Math.ceil(CHAT_LIMITS.RECRUIT_WAIT_HOURS - hoursSinceJoin);
      throw new Error(`Recruits must wait ${hoursRemaining} hours before chatting`);
    }
  }

  // Rate limiting check
  const rateLimitStart = new Date(Date.now() - CHAT_LIMITS.RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  const { count: recentMessages } = await supabase
    .from('clan_chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('clan_id', clanId)
    .eq('sender_id', playerId)
    .gte('created_at', rateLimitStart)
    .eq('deleted', false);

  if ((recentMessages || 0) >= CHAT_LIMITS.RATE_LIMIT_MESSAGES) {
    throw new Error(`Rate limit exceeded. Max ${CHAT_LIMITS.RATE_LIMIT_MESSAGES} messages per ${CHAT_LIMITS.RATE_LIMIT_WINDOW_SECONDS} seconds`);
  }

  // Get player info
  const { data: player } = await supabase
    .from('players')
    .select('username')
    .eq('username', playerId)
    .single();

  const now = new Date().toISOString();
  const channel = messageTypeToChannel(type);

  // Create message
  const { data: inserted, error: insertError } = await supabase
    .from('clan_chat_messages')
    .insert({
      clan_id: clanId,
      channel,
      sender_id: playerId,
      sender_role: member.role as Database['public']['Enums']['clan_role'],
      message: message.trim(),
      deleted: false,
      created_at: now,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    throw new Error('Failed to send message');
  }

  return supabaseRowToChatMessage(inserted, {
    username: player?.username || 'Unknown',
    role: member.role,
  });
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
  eventData?: Record<string, unknown>
): Promise<ChatMessage> {
  const supabase = createServiceClient();

  const now = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from('clan_chat_messages')
    .insert({
      clan_id: clanId,
      channel: 'system',
      sender_id: 'SYSTEM',
      sender_role: 'MEMBER' as Database['public']['Enums']['clan_role'],
      message: message.trim(),
      deleted: false,
      created_at: now,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    throw new Error('Failed to send system message');
  }

  return supabaseRowToChatMessage(inserted, {
    username: 'System',
    role: 'SYSTEM',
    eventType,
    eventData,
  });
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
 * const olderMessages = await getClanChatMessages('clan123', 50, messages[messages.length - 1].created_at);
 */
export async function getClanChatMessages(
  clanId: string,
  limit = CHAT_LIMITS.MESSAGES_PER_PAGE,
  before?: string
): Promise<ChatMessage[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from('clan_chat_messages')
    .select('*')
    .eq('clan_id', clanId)
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, CHAT_LIMITS.MESSAGES_PER_PAGE));

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((row) => supabaseRowToChatMessage(row));
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
  const supabase = createServiceClient();

  // Validate new message
  if (!newMessage || newMessage.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }

  if (newMessage.length > CHAT_LIMITS.MESSAGE_MAX_LENGTH) {
    throw new Error(`Message too long (max ${CHAT_LIMITS.MESSAGE_MAX_LENGTH} characters)`);
  }

  // Get message
  const { data: messageRow, error } = await supabase
    .from('clan_chat_messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (error || !messageRow) {
    throw new Error('Message not found');
  }

  if (messageRow.deleted) {
    throw new Error('Cannot edit deleted message');
  }

  // Verify ownership
  if (messageRow.sender_id !== playerId) {
    throw new Error('Can only edit your own messages');
  }

  // Check time limit
  const createdAt = new Date(messageRow.created_at);
  const minutesSincePost = (Date.now() - createdAt.getTime()) / (1000 * 60);
  if (minutesSincePost > CHAT_LIMITS.EDIT_WINDOW_MINUTES) {
    throw new Error(`Can only edit messages within ${CHAT_LIMITS.EDIT_WINDOW_MINUTES} minutes`);
  }

  // Update message
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from('clan_chat_messages')
    .update({ message: newMessage.trim() })
    .eq('id', messageId)
    .select('*')
    .single();

  if (updateError || !updated) {
    throw new Error('Failed to edit message');
  }

  const result = supabaseRowToChatMessage(updated);
  result.editedAt = now;

  return result;
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
  const supabase = createServiceClient();

  // Get message
  const { data: messageRow, error } = await supabase
    .from('clan_chat_messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (error || !messageRow) {
    throw new Error('Message not found');
  }

  if (messageRow.clan_id !== clanId) {
    throw new Error('Message not in this clan');
  }

  if (messageRow.deleted) {
    throw new Error('Message already deleted');
  }

  // Get clan member
  const { data: member, error: memberError } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId)
    .eq('player_id', playerId)
    .single();

  if (memberError || !member) {
    throw new Error('Player is not a member of this clan');
  }

  // Check permissions
  const canDeleteAny = ['LEADER', 'CO_LEADER'].includes(member.role);
  const isOwnMessage = messageRow.sender_id === playerId;

  if (!canDeleteAny && !isOwnMessage) {
    throw new Error('Can only delete your own messages');
  }

  // Soft delete
  await supabase
    .from('clan_chat_messages')
    .update({ deleted: true })
    .eq('id', messageId);
}

/**
 * Get message count for clan
 * 
 * @param clanId - Clan ID
 * @returns Total message count (excluding deleted)
 */
export async function getMessageCount(clanId: string): Promise<number> {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from('clan_chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('clan_id', clanId)
    .eq('deleted', false);

  if (error) {
    throw error;
  }

  return count || 0;
}

/**
 * Get recent messages since timestamp
 * Used for real-time updates
 * 
 * @param clanId - Clan ID
 * @param since - Get messages after this timestamp
 * @returns Array of new messages
 */
export async function getMessagesSince(clanId: string, since: string): Promise<ChatMessage[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('clan_chat_messages')
    .select('*')
    .eq('clan_id', clanId)
    .gt('created_at', since)
    .eq('deleted', false)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => supabaseRowToChatMessage(row));
}
