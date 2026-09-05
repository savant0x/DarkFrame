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
 * - Drizzle ORM (MySQL) for persistence
 * - bad-words for profanity filtering
 * - types/messaging.types.ts for type safety
 */

import { randomUUID } from 'node:crypto';
import { Filter } from 'bad-words';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { eq, and, isNull, desc, asc, sql, ne, like } from 'drizzle-orm';
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
  // Normalize participant order for consistent lookup
  const participants: [string, string] = [player1Id, player2Id].sort() as [string, string];

  // Try to find existing conversation - fetch all and filter in JS since participants is JSON
  const allConversations = await db.select().from(conversations);
  const existing = allConversations.find(conv => {
    const convParticipants = conv.participants as string[];
    return convParticipants.length === 2 &&
      convParticipants.includes(participants[0]) &&
      convParticipants.includes(participants[1]);
  });

  if (existing) {
    return mapConversationToType(existing);
  }

  // Create new conversation
  const newId = randomUUID().replace(/-/g, '').substring(0, 24);
  const now = new Date();
  const unreadCount: Record<string, number> = {
    [player1Id]: 0,
    [player2Id]: 0,
  };

  await db.insert(conversations).values({
    id: newId,
    participants: participants as unknown as string[],
    unreadCount,
    createdAt: now,
    updatedAt: now,
  });

  const created = await db.select().from(conversations).where(eq(conversations.id, newId)).limit(1);
  return mapConversationToType(created[0]);
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
    const limit = request.limit || 20;
    const offset = request.offset || 0;

    // Fetch all conversations and filter in JS since participants is JSON
    const allConversations = await db.select().from(conversations);

    // Filter by participant
    let filtered = allConversations.filter(conv => {
      const convParticipants = conv.participants as string[];
      return convParticipants.includes(request.playerId);
    });

    // Filter out archived if requested
    if (!request.includeArchived) {
      filtered = filtered.filter(conv => {
        const isArchived = (conv.isArchived as Record<string, boolean>)?.[request.playerId];
        return !isArchived;
      });
    }

    // Sort
    if (request.sortBy === 'unread') {
      filtered.sort((a, b) => {
        const aUnread = ((a.unreadCount as Record<string, number>)?.[request.playerId] ?? 0);
        const bUnread = ((b.unreadCount as Record<string, number>)?.[request.playerId] ?? 0);
        if (bUnread !== aUnread) return bUnread - aUnread;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    } else if (request.sortBy === 'pinned') {
      filtered.sort((a, b) => {
        const aPinned = (a.isPinned as Record<string, boolean>)?.[request.playerId] ? 1 : 0;
        const bPinned = (b.isPinned as Record<string, boolean>)?.[request.playerId] ? 1 : 0;
        if (bPinned !== aPinned) return bPinned - aPinned;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    } else {
      // Default: most recent first
      filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    const totalCount = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);
    const results = paginated.map(mapConversationToType);

    return {
      success: true,
      conversations: results,
      totalCount,
      hasMore: offset + results.length < totalCount,
    };
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return {
      success: false,
      conversations: [],
      totalCount: 0,
      hasMore: false,
      error: error.message || 'Failed to fetch conversations',
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
    const messageId = randomUUID().replace(/-/g, '').substring(0, 24);
    const now = new Date();

    const messageData = {
      id: messageId,
      conversationId: conversation._id as string,
      senderId,
      recipientId: request.recipientId,
      content: validation.filteredContent || request.content,
      contentType: request.contentType || 'text',
      status: 'sent' as const,
      createdAt: now,
      metadataOriginalContent: validation.filteredContent !== request.content
        ? request.content
        : undefined,
    };

    await db.insert(messages).values(messageData);

    // Fetch the created message
    const createdMessages = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    const message = mapMessageToType(createdMessages[0]);

    // Update conversation
    await db.update(conversations)
      .set({
        lastMessageContent: message.content,
        lastMessageSenderId: message.senderId,
        lastMessageCreatedAt: message.createdAt,
        lastMessageStatus: message.status,
        updatedAt: now,
        unreadCount: sql`jsonb_set(COALESCE(${conversations.unreadCount}, '{}'::jsonb), ARRAY[${request.recipientId}]::text[], to_jsonb(COALESCE((${conversations.unreadCount}->>${request.recipientId})::numeric, 0) + 1))`,
      })
      .where(eq(conversations.id, conversation._id as string));

    return {
      success: true,
      message,
      conversation,
    };
  } catch (error: any) {
    console.error('Error sending message:', error);
    return {
      success: false,
      error: error.message || 'Failed to send message',
    };
  }
}

/**
 * FID-20260904-005 §5.1: return the conversation ONLY if `playerId` is a participant.
 * Used by API routes to enforce that a session user can only read conversations they
 * belong to (the history route previously served any conversationId to anyone).
 * @returns Conversation or null when not found / not a participant
 */
export async function getConversationForParticipant(
  conversationId: string,
  playerId: string
): Promise<Conversation | null> {
  try {
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const participants = row.participants as string[];
    if (!Array.isArray(participants) || !participants.includes(playerId)) return null;
    return mapConversationToType(row);
  } catch (error: any) {
    console.error('Error in getConversationForParticipant:', error);
    return null;
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
    const limit = request.limit || 50;

    // Build base query conditions
    const conditions = [
      eq(messages.conversationId, request.conversationId),
      isNull(messages.deletedAt), // Exclude soft-deleted messages
    ];

    if (request.before) {
      conditions.push(sql`${messages.createdAt} < ${request.before}`);
    } else if (request.after) {
      conditions.push(sql`${messages.createdAt} > ${request.after}`);
    }

    // Fetch messages (sorted newest first)
    const results = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1); // Fetch one extra to check hasMore

    const hasMore = results.length > limit;
    const messageList = hasMore ? results.slice(0, limit) : results;

    return {
      success: true,
      messages: messageList.map(mapMessageToType).reverse(), // Reverse to show oldest first
      hasMore,
      conversationId: request.conversationId,
    };
  } catch (error: any) {
    console.error('Error fetching message history:', error);
    return {
      success: false,
      messages: [],
      hasMore: false,
      conversationId: request.conversationId,
      error: error.message || 'Failed to fetch messages',
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
    const now = new Date();

    // Participant gate: only conversation members may touch its read state
    // (a non-participant session could otherwise zero anyone's unread counts).
    const conversation = await getConversationForParticipant(conversationId, playerId);
    if (!conversation) {
      return { success: false, error: 'Conversation not found or access denied' };
    }

    // Build query conditions
    const conditions = [
      eq(messages.conversationId, conversationId),
      eq(messages.recipientId, playerId),
      ne(messages.status, 'read'),
    ];

    if (messageIds && messageIds.length > 0) {
      conditions.push(sql`${messages.id} IN (${sql.join(messageIds.map(id => sql`${id}`), sql`, `)})`);
    }

    // Mark messages as read
    const result = await db
      .update(messages)
      .set({
        status: 'read',
        readAt: now,
      })
      .where(and(...conditions));

    // Update conversation unread count
    await db.update(conversations)
      .set({
        unreadCount: sql`jsonb_set(COALESCE(${conversations.unreadCount}, '{}'::jsonb), ARRAY[${playerId}]::text[], to_jsonb(0))`,
      })
      .where(eq(conversations.id, conversationId));

    return {
      success: true,
      readCount: result.rowCount ?? 0,
    };
  } catch (error: any) {
    console.error('Error marking messages as read:', error);
    return {
      success: false,
      error: error.message || 'Failed to mark messages as read',
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
    // Verify ownership
    const found = await db
      .select()
      .from(messages)
      .where(and(
        eq(messages.id, messageId),
        eq(messages.senderId, playerId),
      ))
      .limit(1);

    if (found.length === 0) {
      return {
        success: false,
        error: 'Message not found or you do not have permission to delete it',
      };
    }

    // Soft delete
    await db
      .update(messages)
      .set({
        deletedAt: new Date(),
        status: 'failed',
      })
      .where(eq(messages.id, messageId));

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting message:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete message',
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
    // Get all conversations and filter in JS
    const allConversations = await db.select().from(conversations);

    // Filter by participant
    const playerConversations = allConversations.filter(conv => {
      const convParticipants = conv.participants as string[];
      return convParticipants.includes(playerId);
    });

    // Filter by search query (client-side for now)
    // TODO: Implement server-side search with player name index
    const filtered = playerConversations.filter(conv => {
      const convParticipants = conv.participants as string[];
      const otherParticipant = convParticipants.find(p => p !== playerId);
      return otherParticipant?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const results = filtered.map(mapConversationToType);

    return {
      success: true,
      conversations: results,
      totalCount: results.length,
      hasMore: false,
    };
  } catch (error: any) {
    console.error('Error searching conversations:', error);
    return {
      success: false,
      conversations: [],
      totalCount: 0,
      hasMore: false,
      error: error.message || 'Failed to search conversations',
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map a Drizzle conversation row to the Conversation type
 */
function mapConversationToType(row: typeof conversations.$inferSelect): Conversation {
  const participants = row.participants as [string, string];
  const unreadCount = (row.unreadCount as Record<string, number>) ?? {};
  const isArchived = row.isArchived as Record<string, boolean> | undefined;
  const isPinned = row.isPinned as Record<string, boolean> | undefined;
  const participantDetails = row.participantDetails as Conversation['participantDetails'];

  const conversation: Conversation = {
    _id: row.id,
    participants,
    unreadCount,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };

  if (participantDetails) {
    conversation.participantDetails = participantDetails;
  }

  if (row.lastMessageContent && row.lastMessageSenderId && row.lastMessageCreatedAt && row.lastMessageStatus) {
    conversation.lastMessage = {
      content: row.lastMessageContent,
      senderId: row.lastMessageSenderId,
      createdAt: new Date(row.lastMessageCreatedAt),
      status: row.lastMessageStatus as MessageStatus,
    };
  }

  if (isArchived) {
    conversation.isArchived = isArchived;
  }

  if (isPinned) {
    conversation.isPinned = isPinned;
  }

  return conversation;
}

/**
 * Map a Drizzle message row to the Message type
 */
function mapMessageToType(row: typeof messages.$inferSelect): Message {
  const message: Message = {
    _id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    recipientId: row.recipientId,
    content: row.content,
    contentType: row.contentType as Message['contentType'],
    status: row.status as MessageStatus,
    createdAt: new Date(row.createdAt),
  };

  if (row.readAt) {
    message.readAt = new Date(row.readAt);
  }

  if (row.editedAt) {
    message.editedAt = new Date(row.editedAt);
  }

  if (row.deletedAt) {
    message.deletedAt = new Date(row.deletedAt);
  }

  // Build metadata object from flat columns
  const hasMetadata = row.metadataOriginalContent || row.metadataEditHistory || row.metadataSystemType || row.metadataRelatedEntityId;
  if (hasMetadata) {
    message.metadata = {};
    if (row.metadataOriginalContent) {
      message.metadata.originalContent = row.metadataOriginalContent;
    }
    if (row.metadataEditHistory) {
      message.metadata.editHistory = row.metadataEditHistory;
    }
    if (row.metadataSystemType) {
      message.metadata.systemType = row.metadataSystemType as any;
    }
    if (row.metadataRelatedEntityId) {
      message.metadata.relatedEntityId = row.metadataRelatedEntityId;
    }
  }

  return message;
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
