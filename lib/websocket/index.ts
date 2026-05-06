/**
 * @file lib/websocket/index.ts
 * @created 2025-11-04
 * @updated 2025-11-04 (FID-20251026-001: Full ECHO Architecture Compliance Refactor)
 * @overview WebSocket System - Barrel Export
 *
 * OVERVIEW:
 * Central export point for WebSocket server implementation, authentication,
 * broadcasting, room management, and message handlers.
 *
 * Organization:
 * - Core: Server setup and authentication
 * - Broadcasting: Message distribution utilities
 * - Rooms: Room management and user grouping
 * - Handlers: Message processing for different features
 *
 * Usage:
 * ```typescript
 * import { createWebSocketServer, handleWebSocketAuth } from '@/lib/websocket';
 * ```
 */

// ============================================================================
// CORE WEBSOCKET SERVER
// ============================================================================

// Re-export WebSocket server implementation
export * from './server';

// ============================================================================
// AUTHENTICATION
// ============================================================================

// Re-export WebSocket authentication utilities
export * from './auth';

// ============================================================================
// BROADCASTING
// ============================================================================

// Re-export broadcasting utilities
export * from './broadcast';

// ============================================================================
// ROOM MANAGEMENT
// ============================================================================

// Re-export room management utilities
export * from './rooms';

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

// Re-export messaging handlers (private messaging)
export {
  handleMessageSend,
  handleMessageRead,
  handleJoinConversation,
  handleLeaveConversation
} from './messagingHandlers';

// Re-export messaging typing handlers with alias to avoid conflicts
export {
  handleTypingStart as handleMessagingTypingStart,
  handleTypingStop as handleMessagingTypingStop
} from './messagingHandlers';

// Re-export chat handlers (global chat)
export {
  handleChatMessage,
  handleJoinChannel,
  handleLeaveChannel,
  autoJoinChatChannels,
  handleAskVeterans,
  notifyMessageDeleted,
  notifyUserMuted,
  kickUserFromChannel
} from './chatHandlers';

// Re-export chat typing handlers with alias to avoid conflicts
export {
  handleTypingStart as handleChatTypingStart,
  handleTypingStop as handleChatTypingStop
} from './chatHandlers';

// Re-export chat event types
export type {
  ChatMessageEvent,
  JoinChannelEvent,
  LeaveChannelEvent,
  TypingEvent,
  AskVeteransEvent,
  MessageDeletedNotification,
  UserMutedNotification
} from './chatHandlers';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * WebSocket Architecture:
 * - Server handles connection lifecycle and basic messaging
 * - Auth validates user sessions on connection
 * - Broadcast handles message distribution to rooms/users
 * - Rooms manage user grouping and permissions
 * - Handlers process feature-specific messages (chat, game, etc.)
 *
 * Connection Flow:
 * 1. Client connects → auth.ts validates session
 * 2. Server assigns to rooms based on user context
 * 3. Handlers process incoming messages by type
 * 4. Broadcast distributes messages to appropriate recipients
 *
 * Usage Examples:
 * ```typescript
 * import { createWebSocketServer, handleWebSocketMessage } from '@/lib/websocket';
 *
 * const wss = createWebSocketServer(server);
 * // Server handles auth, rooms, and message routing automatically
 * ```
 *
 * ============================================================================
 */