/**
 * Messaging Service
 * Created: 2025-10-25
 * Feature: FID-20251025-102
 * 
 * OVERVIEW:
 * Core business logic for the private messaging system. Handles message sending,
 * conversation management, read receipts, profanity filtering, and rate limiting.
 * 
 * KEY RESPONSIBILITIES:
 * - Send and receive private messages between players
 * - Manage conversations and message history
 * - Filter profanity using bad-words package
 * - Enforce rate limits to prevent spam
 * - Track read receipts and delivery status
 * - Provide pagination for message history
 * 
 * DEPENDENCIES:
 * - Supabase for persistence
 * - bad-words for profanity filtering
 * - types/messaging.types.ts for type safety
 */

import { Filter } from 'bad-words';
import { createServiceClient } from '@/lib/supabase/server';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';
import type {
  Message,
  Conversation,
  SendMessageRequest,
  SendMessageValidation,
  GetMessagesRequest,
  GetConversationsRequest,
  MessageResponse,
  ConversationsResponse,
  MessagesResponse,
  RateLimitState,
  MessageStatus,
  DEFAULT_MESSAGING_CONFIG,
} from '@/types/messaging.types';

// Initialize profanity filter
const profanityFilter = new Filter();

// Rate limiting cache (in production, use Redis)

// ============================================================================
// DB ↔ DOMAIN MAPPING FUNCTIONS
// ============================================================================

/**
 * Maps a conversations DB row to our domain Conversation type.
 */
function mapDbConversation(row: Tables<'conversations'>): Conversation {
  const lastMsg = typeof row.last_message === 'string'
    ? JSON.parse(row.last_message)
    : (row.last_message as Record<string, unknown> | null);

  return {
    _id: row.id,
    participants: row.participants as Conversation['participants'],
    lastMessage: lastMsg?.content
      ? {
          content: (lastMsg.content as string) ?? '',
          senderId: (lastMsg.sender_id as string) ?? '',
          createdAt: new Date((lastMsg.created_at as string) ?? Date.now()),
          status: ((lastMsg.status as string) ?? 'sent') as MessageStatus,
        }
      : undefined,
    unreadCount: typeof row.unread_count === 'number' ? { total: row.unread_count } : {},
    createdAt: new Date(row.created_at ?? Date.now()),
    updatedAt: new Date(row.updated_at ?? Date.now()),
  };
}

/**
 * Maps our domain Conversation to a DB insert object.
 */
function mapConversationToDb(conv: Partial<Conversation>): TablesInsert<'conversations'> {
  return {
    id: conv._id,
    participants: conv.participants ?? [],
    last_message: conv.lastMessage
      ? JSON.stringify({
          content: conv.lastMessage.content,
          sender_id: conv.lastMessage.senderId,
          created_at: conv.lastMessage.createdAt.toISOString(),
          status: conv.lastMessage.status,
        })
      : null,
    created_at: conv.createdAt?.toISOString() ?? new Date().toISOString(),
    updated_at: conv.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

/**
 * Maps a messages DB row to our domain Message type.
 */
function mapDbMessage(row: Tables<'messages'>): Message {
  return {
    _id: row.id,
    conversationId: row.conversation_id ?? '',
    senderId: row.sender_id ?? '',
    recipientId: row.recipient_id ?? '',
    content: row.content,
    contentType: (row.content_type as Message['contentType']) ?? 'text',
    status: (row.status as MessageStatus) ?? 'sent',
    createdAt: new Date(row.created_at ?? Date.now()),
    readAt: row.read_at ? new Date(row.read_at) : undefined,
    editedAt: row.edited_at ? new Date(row.edited_at) : undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
  };
}

/**
 * Maps our domain Message to a DB insert object.
 */
function mapMessageToDb(msg: Message): TablesInsert<'messages'> {
  return {
    id: msg._id,
    conversation_id: msg.conversationId,
    sender_id: msg.senderId,
    recipient_id: msg.recipientId,
    content: msg.content,
    content_type: msg.contentType,
    status: msg.status,
    created_at: msg.createdAt.toISOString(),
    read_at: msg.readAt?.toISOString() ?? null,
    edited_at: msg.editedAt?.toISOString() ?? null,
    deleted_at: msg.deletedAt?.toISOString() ?? null,
  };
}
const rateLimitCache = new Map<string, RateLimitState>();

// ============================================================================
// VALIDATION & FILTERING
// ============================================================================

/**
 * Validate message content before sending
 * @param request - Send message request to validate
 * @returns Validation result with errors and filtered content
 */
export async function validateMessage(
  request: SendMessageRequest
): Promise<SendMessageValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Content length validation
  if (!request.content || request.content.trim().length === 0) {
    errors.push('Message content cannot be empty');
  }

  const config = {
    minLength: 1,
    maxLength: 1000,
    allowEmojis: true,
    allowLinks: true,
    profanityFilter: true,
    rateLimitPerMinute: 20,
  };

  if (request.content.length < config.minLength) {
    errors.push(`Message must be at least ${config.minLength} character(s)`);
  }

  if (request.content.length > config.maxLength) {
    errors.push(`Message cannot exceed ${config.maxLength} characters`);
  }

  // Recipient validation
  if (!request.recipientId || request.recipientId.trim().length === 0) {
    errors.push('Recipient ID is required');
  }

  // Profanity filtering
  let filteredContent = request.content;
  if (config.profanityFilter) {
    const originalContent = request.content;
    filteredContent = profanityFilter.clean(request.content);
    
    if (filteredContent !== originalContent) {
      warnings.push('Message contains filtered content');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
    filteredContent,
  };
}

/**
 * Check if player has exceeded direct message rate limit
 * @param playerId - Player to check
 * @returns Rate limit state
 */
export function checkDirectMessageRateLimit(playerId: string): RateLimitState {
  const now = new Date();
  const existing = rateLimitCache.get(playerId);

  if (!existing) {
    // First message
    const state: RateLimitState = {
      playerId,
      messageCount: 1,
      windowStart: now,
      isBlocked: false,
      resetAt: new Date(now.getTime() + 60000), // 1 minute from now
    };
    rateLimitCache.set(playerId, state);
    return state;
  }

  // Check if window has expired
  const windowAge = now.getTime() - existing.windowStart.getTime();
  if (windowAge > 60000) {
    // Reset window
    const state: RateLimitState = {
      playerId,
      messageCount: 1,
      windowStart: now,
      isBlocked: false,
      resetAt: new Date(now.getTime() + 60000),
    };
    rateLimitCache.set(playerId, state);
    return state;
  }

  // Increment count
  const config = {
    minLength: 1,
    maxLength: 1000,
    allowEmojis: true,
    allowLinks: true,
    profanityFilter: true,
    rateLimitPerMinute: 20,
  };

  existing.messageCount++;
  existing.isBlocked = existing.messageCount > config.rateLimitPerMinute;
  rateLimitCache.set(playerId, existing);

  return existing;
}

// ============================================================================
// CONVERSATION MANAGEMENT
// ============================================================================

/**
 * Get or create a conversation between two players
 * @param player1Id - First player ID/username
 * @param player2Id - Second player ID/username
 * @returns Conversation object
 */
export async function getOrCreateConversation(
  player1Id: string,
  player2Id: string
): Promise<Conversation> {
  const supabase = createServiceClient();

  const participants: [string, string] = [player1Id, player2Id].sort() as [string, string];

  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .contains('participants', participants)
    .eq('participants', participants)
    .single();

  if (existing) {
    return mapDbConversation(existing);
  }

  const newConversation = {
    _id: crypto.randomUUID(),
    participants,
    unreadCount: {
      [player1Id]: 0,
      [player2Id]: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Conversation;

  await supabase.from('conversations').insert(mapConversationToDb(newConversation));

  return newConversation;
}

/**
 * Get all conversations for a player
 * @param request - Request with player ID and pagination options
 * @returns List of conversations with metadata
 */
export async function getConversations(
  request: GetConversationsRequest
): Promise<ConversationsResponse> {
  try {
    const supabase = createServiceClient();

    const limit = request.limit || 20;
    const offset = request.offset || 0;

    const { data: results, count: totalCount, error } = await supabase
      .from('conversations')
      .select('*', { count: 'exact' })
      .contains('participants', [request.playerId])
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const conversations = (results || []).map(mapDbConversation);

    if (request.sortBy === 'unread') {
      conversations.sort((a, b) => {
        const aCount = typeof a.unreadCount === 'number' ? a.unreadCount : (a.unreadCount as Record<string, number>)?.[request.playerId] || 0;
        const bCount = typeof b.unreadCount === 'number' ? b.unreadCount : (b.unreadCount as Record<string, number>)?.[request.playerId] || 0;
        return bCount - aCount;
      });
    }

    return {
      success: true,
      conversations,
      totalCount: totalCount || 0,
      hasMore: offset + (results?.length || 0) < (totalCount || 0),
    };
  } catch (error: unknown) {
    console.error('Error fetching conversations:', error);
    return {
      success: false,
      conversations: [],
      totalCount: 0,
      hasMore: false,
      error: error instanceof Error ? error.message : 'Failed to fetch conversations',
    };
  }
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Send a direct message to another player
 * @param senderId - Sender player ID/username
 * @param request - Message request with recipient and content
 * @returns Message response with created message
 */
export async function sendDirectMessage(
  senderId: string,
  request: SendMessageRequest
): Promise<MessageResponse> {
  try {
    // Rate limit check
    const rateLimit = checkDirectMessageRateLimit(senderId);
    if (rateLimit.isBlocked) {
      return {
        success: false,
        error: `Rate limit exceeded. Please wait until ${rateLimit.resetAt.toISOString()}`,
      };
    }

    // Validate message
    const validation = await validateMessage(request);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', '),
        validationErrors: validation.errors,
      };
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(senderId, request.recipientId);

    // Create message
    const supabase = createServiceClient();

    const message: Message = {
      _id: crypto.randomUUID(),
      conversationId: conversation._id,
      senderId: senderId,
      recipientId: request.recipientId,
      content: validation.filteredContent || request.content,
      contentType: request.contentType || 'text',
      status: 'sent',
      createdAt: new Date(),
      metadata: validation.filteredContent !== request.content
        ? { originalContent: request.content }
        : undefined,
    };

    await supabase.from('messages').insert(mapMessageToDb(message));

    // Update conversation
    const currentUnread = typeof conversation.unreadCount === 'number' ? conversation.unreadCount : 0;
    const updateData = {
      last_message: JSON.stringify({
        content: message.content,
        sender_id: message.senderId,
        created_at: message.createdAt.toISOString(),
        status: message.status,
      }),
      updated_at: new Date().toISOString(),
      unread_count: currentUnread + 1,
    };
    await supabase.from('conversations').update(updateData as never).eq('id', conversation._id);

    return {
      success: true,
      message,
      conversation,
    };
  } catch (error: unknown) {
    console.error('Error sending message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}

/**
 * Get message history for a conversation
 * @param request - Request with conversation ID and pagination
 * @returns List of messages
 */
export async function getMessageHistory(
  request: GetMessagesRequest
): Promise<MessagesResponse> {
  try {
    const supabase = createServiceClient();

    const limit = request.limit || 50;

    // Build query
    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', request.conversationId)
      .is('deleted_at', null);

    if (request.before) {
      query = query.lt('created_at', request.before);
    } else if (request.after) {
      query = query.gt('created_at', request.after);
    }

    // Fetch messages (sorted newest first)
    const { data: results, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (error) throw error;

    const hasMore = (results?.length || 0) > limit;
    const messageList = hasMore ? results!.slice(0, limit) : (results || []);

    return {
      success: true,
      messages: messageList.reverse().map(mapDbMessage),
      hasMore,
      conversationId: request.conversationId,
    };
  } catch (error: unknown) {
    console.error('Error fetching message history:', error);
    return {
      success: false,
      messages: [],
      hasMore: false,
      conversationId: request.conversationId,
      error: error instanceof Error ? error.message : 'Failed to fetch messages',
    };
  }
}

/**
 * Mark messages as read in a conversation
 * @param conversationId - Conversation ID
 * @param playerId - Player marking messages as read
 * @param messageIds - Specific message IDs to mark (optional, marks all if empty)
 * @returns Success status
 */
export async function markMessagesAsRead(
  conversationId: string,
  playerId: string,
  messageIds?: string[]
): Promise<{ success: boolean; error?: string; readCount?: number }> {
  try {
    const supabase = createServiceClient();

    let query = supabase
      .from('messages')
      .update({
        status: 'read',
        read_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId)
      .eq('recipient_id', playerId)
      .neq('status', 'read');

    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    }

    const { data, error } = await query.select('id');

    if (error) throw error;

    const readCount = (data || []).length;

    await supabase
      .from('conversations')
      .update({
        unread_count: 0,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', conversationId);

    return {
      success: true,
      readCount,
    };
  } catch (error: unknown) {
    console.error('Error marking messages as read:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark messages as read',
    };
  }
}

/**
 * Delete a direct message (soft delete)
 * @param messageId - Message ID to delete
 * @param playerId - Player requesting deletion
 * @returns Success status
 */
export async function deleteDirectMessage(
  messageId: string,
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();

    const { data: message } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('sender_id', playerId)
      .single();

    if (!message) {
      return {
        success: false,
        error: 'Message not found or you do not have permission to delete it',
      };
    }

    await supabase
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'deleted',
      })
      .eq('id', messageId);

    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete message',
    };
  }
}

/**
 * Search conversations by participant username
 * @param playerId - Current player ID
 * @param searchQuery - Search query
 * @returns Filtered conversations
 */
export async function searchConversations(
  playerId: string,
  searchQuery: string
): Promise<ConversationsResponse> {
  try {
    const supabase = createServiceClient();

    // Get all player's conversations
    const { data: results } = await supabase
      .from('conversations')
      .select('*')
      .contains('participants', [playerId]);

    // Filter by search query (client-side for now)
    // TODO: Implement server-side search with player name index
    const filtered = (results || []).filter((conv: any) => {
      const otherParticipant = conv.participants.find((p: string) => p !== playerId);
      return otherParticipant?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return {
      success: true,
      conversations: filtered.map(mapDbConversation),
      totalCount: filtered.length,
      hasMore: false,
    };
  } catch (error: unknown) {
    console.error('Error searching conversations:', error);
    return {
      success: false,
      conversations: [],
      totalCount: 0,
      hasMore: false,
      error: error instanceof Error ? error.message : 'Failed to search conversations',
    };
  }
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * TODO: Future enhancements
 * 
 * 1. Message editing:
 *    - Add editMessage(messageId, newContent) function
 *    - Store edit history in metadata.editHistory
 *    - Set editedAt timestamp
 * 
 * 2. Message reactions:
 *    - Add emoji reactions to messages
 *    - Store in message.metadata.reactions
 * 
 * 3. File attachments:
 *    - Support image/file uploads
 *    - Store URLs in message.metadata.attachments
 * 
 * 4. Conversation settings:
 *    - Mute notifications
 *    - Archive conversations
 *    - Pin important conversations
 * 
 * 5. Enhanced search:
 *    - Full-text search in message content
 *    - Filter by date range
 *    - Search by participant
 * 
 * 6. Delivery status updates:
 *    - Update status from 'sent' to 'delivered' when recipient comes online
 *    - Emit Socket.io events for status changes
 */
