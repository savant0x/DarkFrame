/**
 * @file types/directMessage.ts
 * @created 2025-10-26
 * @updated 2025-10-26 (FID-20251026-019: Sprint 2 Phase 2 - Direct Messaging Types)
 * @overview TypeScript types and interfaces for Direct Messaging system
 * 
 * OVERVIEW:
 * Comprehensive type definitions for the Direct Messaging feature, supporting 1-on-1
 * conversations with read receipts, message status tracking, and efficient querying.
 * Designed to work with MongoDB collections: conversations and directMessages.
 * 
 * KEY FEATURES:
 * - Message status tracking (SENT, DELIVERED, READ)
 * - Conversation metadata with last message preview
 * - Unread count per participant
 * - Soft-delete support for messages
 * - Type-safe API request/response interfaces
 * - Efficient query support with indexed fields
 * 
 * TYPE HIERARCHY:
 * - MessageStatus: Enum for delivery states
 * - DirectMessage: Individual message data
 * - Conversation: Conversation metadata and participants
 * - ConversationPreview: List view with unread counts
 * - API request/response types for endpoints
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251026-019: Sprint 2 Phase 2 - Private Messaging System
 * - Compatible with MongoDB document structure
 * - Supports real-time updates via HTTP polling
 * - Read receipts implemented via status field
 * - Participants array sorted for consistent querying
 * - ECHO v5.2 compliant: Production-ready, comprehensive docs
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Message delivery and read status states
 * 
 * @enum {string}
 * @property SENT - Message sent by sender, not yet delivered
 * @property DELIVERED - Message delivered to recipient's device
 * @property READ - Message read by recipient (read receipt)
 * 
 * @example
 * ```typescript
 * const message: DirectMessage = {
 *   status: DMMessageStatus.READ,
 *   // ... other fields
 * };
 * ```
 */
export enum DMMessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Individual direct message between two users
 * 
 * @interface DirectMessage
 * @property {string} id - Unique message identifier (MongoDB ObjectId as string)
 * @property {string} conversationId - Parent conversation ID
 * @property {string} senderId - User ID of message sender
 * @property {string} recipientId - User ID of message recipient
 * @property {string} content - Message text content (max 2000 chars)
 * @property {DMMessageStatus} status - Delivery/read status
 * @property {Date} timestamp - Message sent timestamp
 * @property {Date} [editedAt] - Last edit timestamp (if edited)
 * @property {Date} [deletedAt] - Soft-delete timestamp (if deleted)
 * 
 * @example
 * ```typescript
 * const message: DirectMessage = {
 *   id: '507f1f77bcf86cd799439011',
 *   conversationId: '507f191e810c19729de860ea',
 *   senderId: 'user123',
 *   recipientId: 'user456',
 *   content: 'Hey, how are you?',
 *   status: DMMessageStatus.SENT,
 *   timestamp: new Date(),
 * };
 * ```
 */
export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  status: DMMessageStatus;
  timestamp: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

/**
 * Last message preview for conversation list
 * 
 * @interface DMLastMessage
 * @property {string} content - Preview text (truncated if needed)
 * @property {string} senderId - Who sent the last message
 * @property {Date} timestamp - When the last message was sent
 * @property {DMMessageStatus} status - Status of last message
 * 
 * @example
 * ```typescript
 * const preview: DMLastMessage = {
 *   content: 'See you tomorrow!',
 *   senderId: 'user456',
 *   timestamp: new Date(),
 *   status: DMMessageStatus.READ,
 * };
 * ```
 */
export interface DMLastMessage {
  content: string;
  senderId: string;
  timestamp: Date;
  status: DMMessageStatus;
}

/**
 * Full conversation metadata with participants
 * 
 * @interface DMConversation
 * @property {string} id - Unique conversation identifier (MongoDB ObjectId)
 * @property {string[]} participants - Array of exactly 2 user IDs (sorted)
 * @property {DMLastMessage | null} lastMessage - Preview of most recent message
 * @property {Record<string, number>} unreadCount - Unread count per participant
 * @property {Date} createdAt - Conversation creation timestamp
 * @property {Date} updatedAt - Last activity timestamp
 * 
 * @example
 * ```typescript
 * const conversation: DMConversation = {
 *   id: '507f191e810c19729de860ea',
 *   participants: ['user123', 'user456'].sort(),
 *   lastMessage: {
 *     content: 'Thanks!',
 *     senderId: 'user456',
 *     timestamp: new Date(),
 *     status: DMMessageStatus.SENT,
 *   },
 *   unreadCount: {
 *     'user123': 2,
 *     'user456': 0,
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface DMConversation {
  id: string;
  participants: [string, string]; // Exactly 2 participants, sorted
  lastMessage: DMLastMessage | null;
  unreadCount: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Conversation preview for list view with participant details
 * 
 * @interface ConversationPreview
 * @property {string} id - Conversation ID
 * @property {string} otherUserId - The other participant's user ID
 * @property {string} otherUsername - The other participant's username
 * @property {string} [otherUserAvatar] - The other participant's avatar URL
 * @property {DMLastMessage | null} lastMessage - Preview of last message
 * @property {number} unreadCount - Unread messages for current user
 * @property {Date} updatedAt - Last activity timestamp
 * 
 * @example
 * ```typescript
 * const preview: ConversationPreview = {
 *   id: '507f191e810c19729de860ea',
 *   otherUserId: 'user456',
 *   otherUsername: 'JohnDoe',
 *   otherUserAvatar: '/avatars/user456.png',
 *   lastMessage: {
 *     content: 'See you!',
 *     senderId: 'user456',
 *     timestamp: new Date(),
 *     status: DMMessageStatus.READ,
 *   },
 *   unreadCount: 2,
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface ConversationPreview {
  id: string;
  otherUserId: string;
  otherUsername: string;
  otherUserAvatar?: string;
  lastMessage: DMLastMessage | null;
  unreadCount: number;
  updatedAt: Date;
}

// ============================================================================
// API REQUEST TYPES
// ============================================================================

/**
 * Request body for sending a new direct message
 * 
 * @interface SendMessageRequest
 * @property {string} recipientId - User ID to send message to
 * @property {string} content - Message text content
 * 
 * @example
 * ```typescript
 * const request: SendMessageRequest = {
 *   recipientId: 'user456',
 *   content: 'Hello!',
 * };
 * ```
 */
export interface SendMessageRequest {
  recipientId: string;
  content: string;
}

/**
 * Request body for marking messages as read
 * 
 * @interface MarkReadRequest
 * @property {string} conversationId - Conversation to mark as read
 * @property {string[]} [messageIds] - Specific messages to mark (optional, marks all if omitted)
 * 
 * @example
 * ```typescript
 * const request: MarkReadRequest = {
 *   conversationId: '507f191e810c19729de860ea',
 * };
 * ```
 */
export interface MarkReadRequest {
  conversationId: string;
  messageIds?: string[];
}

/**
 * Query parameters for getting conversation messages
 * 
 * @interface GetMessagesQuery
 * @property {number} [limit] - Max messages to return (default: 50)
 * @property {string} [before] - Get messages before this timestamp (ISO string)
 * @property {string} [after] - Get messages after this timestamp (ISO string)
 * 
 * @example
 * ```typescript
 * const query: GetMessagesQuery = {
 *   limit: 25,
 *   before: new Date().toISOString(),
 * };
 * ```
 */
export interface GetMessagesQuery {
  limit?: number;
  before?: string; // ISO timestamp
  after?: string; // ISO timestamp
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Response from sending a message
 * 
 * @interface SendMessageResponse
 * @property {DirectMessage} message - The created message
 * @property {string} conversationId - Parent conversation ID (created if new)
 * 
 * @example
 * ```typescript
 * const response: SendMessageResponse = {
 *   message: {
 *     id: '507f1f77bcf86cd799439011',
 *     conversationId: '507f191e810c19729de860ea',
 *     senderId: 'user123',
 *     recipientId: 'user456',
 *     content: 'Hello!',
 *     status: DMMessageStatus.SENT,
 *     timestamp: new Date(),
 *   },
 *   conversationId: '507f191e810c19729de860ea',
 * };
 * ```
 */
export interface SendMessageResponse {
  message: DirectMessage;
  conversationId: string;
}

/**
 * Response from getting conversations list
 * 
 * @interface GetConversationsResponse
 * @property {ConversationPreview[]} conversations - Array of conversation previews
 * @property {number} totalUnread - Total unread count across all conversations
 * 
 * @example
 * ```typescript
 * const response: GetConversationsResponse = {
 *   conversations: [
 *     {
 *       id: '507f191e810c19729de860ea',
 *       otherUserId: 'user456',
 *       otherUsername: 'JohnDoe',
 *       lastMessage: { content: 'Hi!', senderId: 'user456', timestamp: new Date(), status: DMMessageStatus.SENT },
 *       unreadCount: 2,
 *       updatedAt: new Date(),
 *     },
 *   ],
 *   totalUnread: 2,
 * };
 * ```
 */
export interface GetConversationsResponse {
  conversations: ConversationPreview[];
  totalUnread: number;
}

/**
 * Response from getting conversation messages
 * 
 * @interface GetMessagesResponse
 * @property {DirectMessage[]} messages - Array of messages (newest first)
 * @property {boolean} hasMore - Whether more messages exist (pagination)
 * @property {string} [nextCursor] - Cursor for next page (ISO timestamp)
 * 
 * @example
 * ```typescript
 * const response: GetMessagesResponse = {
 *   messages: [
 *     {
 *       id: '507f1f77bcf86cd799439011',
 *       conversationId: '507f191e810c19729de860ea',
 *       senderId: 'user123',
 *       recipientId: 'user456',
 *       content: 'Hello!',
 *       status: DMMessageStatus.READ,
 *       timestamp: new Date(),
 *     },
 *   ],
 *   hasMore: true,
 *   nextCursor: '2025-10-26T10:30:00.000Z',
 * };
 * ```
 */
export interface GetMessagesResponse {
  messages: DirectMessage[];
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Response from marking messages as read
 * 
 * @interface MarkReadResponse
 * @property {number} markedCount - Number of messages marked as read
 * @property {number} newUnreadCount - Updated unread count for conversation
 * 
 * @example
 * ```typescript
 * const response: MarkReadResponse = {
 *   markedCount: 3,
 *   newUnreadCount: 0,
 * };
 * ```
 */
export interface MarkReadResponse {
  markedCount: number;
  newUnreadCount: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Typing indicator data for real-time updates
 * 
 * @interface DMTypingIndicator
 * @property {string} conversationId - Conversation where user is typing
 * @property {string} userId - User who is typing
 * @property {string} username - Username for display
 * @property {Date} timestamp - When typing started
 * 
 * @example
 * ```typescript
 * const typing: DMTypingIndicator = {
 *   conversationId: '507f191e810c19729de860ea',
 *   userId: 'user456',
 *   username: 'JohnDoe',
 *   timestamp: new Date(),
 * };
 * ```
 */
export interface DMTypingIndicator {
  conversationId: string;
  userId: string;
  username: string;
  timestamp: Date;
}

/**
 * User search result for starting new conversations
 * 
 * @interface UserSearchResult
 * @property {string} userId - User ID
 * @property {string} username - Username
 * @property {number} level - User level
 * @property {boolean} isOnline - Online status
 * @property {string} [avatar] - Avatar URL
 * @property {boolean} hasExistingConversation - Whether conversation already exists
 * @property {string} [existingConversationId] - Existing conversation ID (if any)
 * 
 * @example
 * ```typescript
 * const result: UserSearchResult = {
 *   userId: 'user789',
 *   username: 'PlayerOne',
 *   level: 25,
 *   isOnline: true,
 *   avatar: '/avatars/user789.png',
 *   hasExistingConversation: false,
 * };
 * ```
 */
export interface UserSearchResult {
  userId: string;
  username: string;
  level: number;
  isOnline: boolean;
  avatar?: string;
  hasExistingConversation: boolean;
  existingConversationId?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is a valid DMMessageStatus
 * 
 * @param value - Value to check
 * @returns True if value is a valid DMMessageStatus
 * 
 * @example
 * ```typescript
 * if (isDMMessageStatus('READ')) {
 *   // TypeScript knows this is DMMessageStatus
 * }
 * ```
 */
export function isDMMessageStatus(value: unknown): value is DMMessageStatus {
  return (
    typeof value === 'string' &&
    Object.values(DMMessageStatus).includes(value as DMMessageStatus)
  );
}

/**
 * Type guard to check if a value is a valid DirectMessage
 * 
 * @param value - Value to check
 * @returns True if value is a valid DirectMessage
 * 
 * @example
 * ```typescript
 * if (isDirectMessage(data)) {
 *   // TypeScript knows data is DirectMessage
 *   console.log(data.content);
 * }
 * ```
 */
export function isDirectMessage(value: unknown): value is DirectMessage {
  if (!value || typeof value !== 'object') return false;
  
  const msg = value as Record<string, unknown>;
  
  return (
    typeof msg.id === 'string' &&
    typeof msg.conversationId === 'string' &&
    typeof msg.senderId === 'string' &&
    typeof msg.recipientId === 'string' &&
    typeof msg.content === 'string' &&
    isDMMessageStatus(msg.status) &&
    msg.timestamp instanceof Date
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. MongoDB Integration:
 *    - All IDs are MongoDB ObjectId strings
 *    - Dates use JavaScript Date objects (converted to/from MongoDB ISODate)
 *    - participants array is sorted for efficient querying
 *    - Indexes required: conversations.participants, directMessages.conversationId
 * 
 * 2. Read Receipts:
 *    - Implemented via MessageStatus enum (SENT → DELIVERED → READ)
 *    - Status updated when recipient views message
 *    - Unread count decremented when marked as read
 * 
 * 3. Performance Optimization:
 *    - Conversation participants sorted for consistent compound index
 *    - lastMessage embedded to avoid extra query for list view
 *    - Pagination supported via cursor-based (timestamp) approach
 *    - Unread counts cached in conversation document
 * 
 * 4. Soft Delete:
 *    - Messages have optional deletedAt field
 *    - Deleted messages preserved for moderation
 *    - UI should filter out messages with deletedAt set
 * 
 * 5. API Design:
 *    - RESTful endpoints: POST /api/dm (send), GET /api/dm (list conversations)
 *    - GET /api/dm/[id] (get messages), PATCH /api/dm/[id]/read (mark read)
 *    - DELETE /api/dm/[id] (delete conversation)
 * 
 * 6. Real-Time Updates:
 *    - HTTP polling used (already implemented in project)
 *    - Poll /api/dm for new conversations/messages every 2-5 seconds
 *    - Typing indicators via separate endpoint with TTL
 * 
 * 7. Validation Rules:
 *    - Content max length: 2000 characters
 *    - Participants array must have exactly 2 users
 *    - Cannot send messages to yourself
 *    - Recipient must exist and not be blocked
 * 
 * 8. ECHO Compliance:
 *    - ✅ Complete implementation (no pseudo-code)
 *    - ✅ TypeScript with proper types and interfaces
 *    - ✅ Comprehensive JSDoc on all exports
 *    - ✅ Type guards for runtime validation
 *    - ✅ Production-ready with usage examples
 *    - ✅ Clear documentation and implementation notes
 */
