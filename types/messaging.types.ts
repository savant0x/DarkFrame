/**
 * Messaging System Type Definitions
 * Created: 2025-10-25
 * Feature: FID-20251025-102
 * 
 * OVERVIEW:
 * Complete TypeScript type definitions for the private messaging system.
 * Supports 1-on-1 conversations, real-time delivery, typing indicators,
 * read receipts, and message history pagination.
 * 
 * KEY FEATURES:
 * - Type-safe message and conversation structures
 * - Real-time event types for Socket.io
 * - Validation interfaces for API requests
 * - UI state management types
 * - Notification and alert types
 */

import { ObjectId } from 'mongodb';

// ============================================================================
// CORE MESSAGE TYPES
// ============================================================================

/**
 * Message status lifecycle
 */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Message content types
 */
export type MessageContentType = 'text' | 'system' | 'notification';

/**
 * Individual message in a conversation
 */
export interface Message {
  _id: ObjectId | string;
  conversationId: ObjectId | string;
  senderId: string;                    // Player username or ID
  recipientId: string;                 // Player username or ID
  content: string;                     // Message text (profanity-filtered)
  contentType: MessageContentType;     // Type of message
  status: MessageStatus;               // Delivery status
  createdAt: Date;
  readAt?: Date;                       // When recipient read the message
  editedAt?: Date;                     // If message was edited
  deletedAt?: Date;                    // Soft delete timestamp
  metadata?: MessageMetadata;          // Additional context
}

/**
 * Optional message metadata
 */
export interface MessageMetadata {
  originalContent?: string;            // Before profanity filter
  editHistory?: Array<{
    content: string;
    editedAt: Date;
  }>;
  systemType?: 'achievement' | 'battle' | 'trade' | 'notification';
  relatedEntityId?: string;            // Link to battle, trade, etc.
}

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

/**
 * Conversation between two players
 */
export interface Conversation {
  _id: ObjectId | string;
  participants: [string, string];      // Exactly 2 player IDs/usernames
  participantDetails?: {
    [playerId: string]: {
      username: string;
      avatarUrl?: string;
      isOnline: boolean;
      lastSeen?: Date;
    };
  };
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: Date;
    status: MessageStatus;
  };
  unreadCount: {
    [playerId: string]: number;        // Unread messages per participant
  };
  createdAt: Date;
  updatedAt: Date;                     // Last activity timestamp
  isArchived?: {
    [playerId: string]: boolean;       // Archive status per participant
  };
  isPinned?: {
    [playerId: string]: boolean;       // Pin status per participant
  };
  metadata?: ConversationMetadata;
}

/**
 * Optional conversation metadata
 */
export interface ConversationMetadata {
  totalMessages?: number;
  firstMessageAt?: Date;
  muteUntil?: {
    [playerId: string]: Date;          // Mute notifications until
  };
}

// ============================================================================
// REAL-TIME EVENT TYPES
// ============================================================================

/**
 * Typing indicator event
 */
export interface TypingIndicator {
  conversationId: string;
  playerId: string;
  username: string;
  isTyping: boolean;
  timestamp: Date;
}

/**
 * Read receipt event
 */
export interface ReadReceipt {
  conversationId: string;
  messageId: string;
  playerId: string;
  readAt: Date;
}

/**
 * Real-time message event
 */
export interface MessageEvent {
  type: 'new_message' | 'message_read' | 'message_deleted' | 'message_edited';
  message: Message;
  conversationId: string;
}

/**
 * Socket.io event payloads
 */
export interface SocketMessageEvents {
  'message:send': (data: SendMessagePayload) => void;
  'message:receive': (message: Message) => void;
  'message:read': (data: ReadReceiptPayload) => void;
  'typing:start': (data: TypingPayload) => void;
  'typing:stop': (data: TypingPayload) => void;
  'conversation:updated': (conversation: Conversation) => void;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Send message API request
 */
export interface SendMessageRequest {
  recipientId: string;
  content: string;
  contentType?: MessageContentType;
}

/**
 * Send message validation result
 */
export interface SendMessageValidation {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  filteredContent?: string;            // Content after profanity filter
}

/**
 * Get messages API request
 */
export interface GetMessagesRequest {
  conversationId: string;
  limit?: number;                      // Default 50
  before?: Date;                       // Pagination cursor
  after?: Date;
}

/**
 * Get conversations API request
 */
export interface GetConversationsRequest {
  playerId: string;
  limit?: number;                      // Default 20
  offset?: number;
  includeArchived?: boolean;
  sortBy?: 'recent' | 'unread' | 'pinned';
}

/**
 * API response for message operations
 */
export interface MessageResponse {
  success: boolean;
  message?: Message;
  conversation?: Conversation;
  error?: string;
  validationErrors?: string[];
}

/**
 * API response for conversation list
 */
export interface ConversationsResponse {
  success: boolean;
  conversations: Conversation[];
  totalCount: number;
  hasMore: boolean;
  error?: string;
}

/**
 * API response for message history
 */
export interface MessagesResponse {
  success: boolean;
  messages: Message[];
  hasMore: boolean;
  conversationId: string;
  error?: string;
}

// ============================================================================
// SOCKET PAYLOAD TYPES
// ============================================================================

/**
 * Send message via Socket.io
 */
export interface SendMessagePayload {
  recipientId: string;
  content: string;
  tempId?: string;                     // Client-side temporary ID
}

/**
 * Mark message as read
 */
export interface ReadReceiptPayload {
  conversationId: string;
  messageId: string;
}

/**
 * Typing indicator payload
 */
export interface TypingPayload {
  conversationId: string;
  recipientId: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * UI state for message inbox
 */
export interface MessageInboxState {
  conversations: Conversation[];
  selectedConversationId?: string;
  isLoading: boolean;
  searchQuery: string;
  filter: 'all' | 'unread' | 'archived' | 'pinned';
  error?: string;
}

/**
 * UI state for message thread
 */
export interface MessageThreadState {
  conversationId: string;
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  recipientTyping: boolean;
  error?: string;
  draftMessage: string;
}

/**
 * Message notification for game UI
 */
export interface MessageNotification {
  id: string;
  type: 'new_message' | 'multiple_messages';
  senderUsername: string;
  senderAvatar?: string;
  content: string;
  conversationId: string;
  unreadCount?: number;
  timestamp: Date;
  priority: 'normal' | 'high';
}

// ============================================================================
// VALIDATION & CONFIGURATION
// ============================================================================

/**
 * Message validation rules
 */
export interface MessageValidationRules {
  minLength: number;                   // Minimum message length
  maxLength: number;                   // Maximum message length
  allowEmojis: boolean;
  allowLinks: boolean;
  profanityFilter: boolean;
  rateLimitPerMinute: number;
}

/**
 * Default messaging configuration
 */
export const DEFAULT_MESSAGING_CONFIG: MessageValidationRules = {
  minLength: 1,
  maxLength: 1000,
  allowEmojis: true,
  allowLinks: true,
  profanityFilter: true,
  rateLimitPerMinute: 20,
};

/**
 * Rate limiting state
 */
export interface RateLimitState {
  playerId: string;
  messageCount: number;
  windowStart: Date;
  isBlocked: boolean;
  resetAt: Date;
}

// ============================================================================
// ANALYTICS & METRICS
// ============================================================================

/**
 * Messaging analytics
 */
export interface MessagingAnalytics {
  totalMessages: number;
  totalConversations: number;
  activeConversations24h: number;
  averageResponseTime: number;         // In seconds
  messagesByHour: { [hour: string]: number };
  topSenders: Array<{
    playerId: string;
    username: string;
    messageCount: number;
  }>;
}

/**
 * Player messaging statistics
 */
export interface PlayerMessagingStats {
  playerId: string;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  activeConversations: number;
  averageResponseTime: number;
  firstMessageDate?: Date;
  lastMessageDate?: Date;
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. PROFANITY FILTERING:
 *    - Use bad-words package in messagingService.ts
 *    - Store original content in metadata.originalContent for moderation
 * 
 * 2. RATE LIMITING:
 *    - Track messages per player per minute
 *    - Block after exceeding rateLimitPerMinute threshold
 *    - Reset window after 60 seconds
 * 
 * 3. REAL-TIME DELIVERY:
 *    - Socket.io rooms: conversation_<conversationId>
 *    - Emit to recipient when they're online
 *    - Store for later retrieval if offline
 * 
 * 4. PAGINATION:
 *    - Use cursor-based pagination with 'before' timestamp
 *    - Default 50 messages per page
 *    - Load older messages on scroll up
 * 
 * 5. TYPING INDICATORS:
 *    - Debounce typing events (500ms)
 *    - Auto-stop after 3 seconds of no input
 *    - Only show in active conversation
 * 
 * 6. READ RECEIPTS:
 *    - Mark as read when message enters viewport
 *    - Update conversation.unreadCount
 *    - Emit read receipt to sender
 */
