/**
 * Messaging Socket.io Event Handlers
 * Created: 2025-10-25
 * Feature: FID-20251025-102
 * 
 * OVERVIEW:
 * Real-time event handlers for private messaging system.
 * Handles message sending, delivery, read receipts, and typing indicators.
 * 
 * KEY FEATURES:
 * - Real-time message delivery to online recipients
 * - Typing indicator broadcasts
 * - Read receipt notifications
 * - Conversation room management
 * 
 * SOCKET.IO ROOMS:
 * - conversation_{conversationId} - All participants in a conversation
 * - user_{username} - Personal room for direct user messaging
 */

import type { Server as SocketIOServer, Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  MessagingMessagePayload,
  MessagingConversationPayload,
  MessagingTypingPayload,
  MessagingReadReceiptPayload,
} from '@/types/websocket';
import {
  sendDirectMessage,
  markMessagesAsRead,
} from '@/lib/messagingService';

/**
 * Handle sending a message via Socket.io
 * Validates, saves to DB, and broadcasts to recipient in real-time
 * 
 * @param io - Socket.io server instance
 * @param socket - Client socket
 * @param data - Message payload
 * @param callback - Optional callback for acknowledgment
 */
export async function handleMessageSend(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket,
  data: { recipientId: string; content: string; tempId?: string },
  callback?: (response: { success: boolean; messageId?: string; error?: string }) => void
): Promise<void> {
  try {
    const sender = socket.data.user;
    if (!sender) {
      console.error('[Messaging] Message send failed: No authenticated user');
      socket.emit('message:error', {
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        tempId: data.tempId,
      });
      callback?.({ success: false, error: 'Authentication required' });
      return;
    }

    console.log(`[Messaging] Message send: ${sender.username} → ${data.recipientId}`);

    // Send message via service (validates, filters profanity, saves to DB)
    const result = await sendDirectMessage(sender.username, {
      recipientId: data.recipientId,
      content: data.content,
      contentType: 'text',
    });

    if (!result.success || !result.message || !result.conversation) {
      console.error('[Messaging] Message send failed:', result.error);
      socket.emit('message:error', {
        error: result.error || 'Failed to send message',
        code: 'SEND_FAILED',
        tempId: data.tempId,
      });
      callback?.({ success: false, error: result.error });
      return;
    }

    const { message, conversation } = result;

    // Join sender to conversation room if not already in it
    const conversationRoom = `conversation_${conversation._id}`;
    socket.join(conversationRoom);

    // Convert message to WebSocket payload format
    const messagePayload: MessagingMessagePayload = {
      _id: message._id.toString(),
      conversationId: message.conversationId.toString(),
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content,
      contentType: message.contentType,
      status: message.status,
      createdAt: message.createdAt,
      readAt: message.readAt,
    };

    // Convert conversation to WebSocket payload format
    const conversationPayload: MessagingConversationPayload = {
      _id: conversation._id.toString(),
      participants: conversation.participants,
      lastMessage: conversation.lastMessage,
      unreadCount: conversation.unreadCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };

    // Emit to conversation room (includes sender for confirmation)
    io.to(conversationRoom).emit('message:receive', messagePayload);

    // Also emit to recipient's personal room in case they're not in conversation room yet
    io.to(`user_${data.recipientId}`).emit('message:receive', messagePayload);

    // Emit conversation update to both participants
    io.to(`user_${sender.username}`).emit('conversation:updated', conversationPayload);
    io.to(`user_${data.recipientId}`).emit('conversation:updated', conversationPayload);

    console.log(`[Messaging] Message sent successfully: ${message._id}`);
    callback?.({ success: true, messageId: message._id.toString() });
  } catch (error: any) {
    console.error('[Messaging] Error in handleMessageSend:', {
      error: error.message,
      stack: error.stack,
    });
    socket.emit('message:error', {
      error: 'Internal server error',
      code: 'SERVER_ERROR',
      tempId: data.tempId,
    });
    callback?.({ success: false, error: 'Internal server error' });
  }
}

/**
 * Handle marking messages as read
 * Updates DB and notifies sender of read receipt
 * 
 * @param io - Socket.io server instance
 * @param socket - Client socket
 * @param data - Read receipt payload
 */
export async function handleMessageRead(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket,
  data: { conversationId: string; messageId?: string }
): Promise<void> {
  try {
    const reader = socket.data.user;
    if (!reader) {
      console.error('[Messaging] Read receipt failed: No authenticated user');
      return;
    }

    console.log(`[Messaging] Marking message as read: ${data.messageId || 'all'} by ${reader.username}`);

    // Mark message(s) as read in database
    const result = await markMessagesAsRead(
      data.conversationId,
      reader.username,
      data.messageId ? [data.messageId] : undefined
    );

    if (!result.success) {
      console.error('[Messaging] Failed to mark messages as read:', result.error);
      return;
    }

    // Broadcast read receipt to conversation room
    const conversationRoom = `conversation_${data.conversationId}`;
    const receiptPayload: MessagingReadReceiptPayload = {
      conversationId: data.conversationId,
      messageId: data.messageId,
      playerId: reader.username,
      readAt: new Date(),
    };
    
    io.to(conversationRoom).emit('message:read', receiptPayload);

    console.log(`[Messaging] Read receipt sent: ${result.readCount} messages marked as read`);
  } catch (error: any) {
    console.error('[Messaging] Error in handleMessageRead:', {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Handle typing indicator start
 * Broadcasts to recipient that user is typing
 * 
 * @param io - Socket.io server instance
 * @param socket - Client socket
 * @param data - Typing payload
 */
export async function handleTypingStart(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket,
  data: { conversationId: string; recipientId: string }
): Promise<void> {
  try {
    const typer = socket.data.user;
    if (!typer) return;

    const typingPayload: MessagingTypingPayload = {
      conversationId: data.conversationId,
      playerId: typer.username,
      username: typer.username,
      isTyping: true,
      timestamp: new Date(),
    };

    // Broadcast to conversation room (excluding sender)
    const conversationRoom = `conversation_${data.conversationId}`;
    socket.to(conversationRoom).emit('typing:start', typingPayload);

    // Also emit to recipient's personal room
    socket.to(`user_${data.recipientId}`).emit('typing:start', typingPayload);
  } catch (error: any) {
    console.error('[Messaging] Error in handleTypingStart:', error);
  }
}

/**
 * Handle typing indicator stop
 * Broadcasts to recipient that user stopped typing
 * 
 * @param io - Socket.io server instance
 * @param socket - Client socket
 * @param data - Typing payload
 */
export async function handleTypingStop(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket,
  data: { conversationId: string; recipientId: string }
): Promise<void> {
  try {
    const typer = socket.data.user;
    if (!typer) return;

    const typingPayload: MessagingTypingPayload = {
      conversationId: data.conversationId,
      playerId: typer.username,
      username: typer.username,
      isTyping: false,
      timestamp: new Date(),
    };

    // Broadcast to conversation room (excluding sender)
    const conversationRoom = `conversation_${data.conversationId}`;
    socket.to(conversationRoom).emit('typing:stop', typingPayload);

    // Also emit to recipient's personal room
    socket.to(`user_${data.recipientId}`).emit('typing:stop', typingPayload);
  } catch (error: any) {
    console.error('[Messaging] Error in handleTypingStop:', error);
  }
}

/**
 * Handle joining a conversation room
 * Allows client to receive real-time updates for a specific conversation
 * 
 * @param socket - Client socket
 * @param data - Conversation join payload
 */
export async function handleJoinConversation(
  socket: Socket,
  data: { conversationId: string }
): Promise<void> {
  try {
    const user = socket.data.user;
    if (!user) return;

    const conversationRoom = `conversation_${data.conversationId}`;
    socket.join(conversationRoom);
    
    console.log(`[Messaging] ${user.username} joined conversation room: ${conversationRoom}`);
  } catch (error: any) {
    console.error('[Messaging] Error in handleJoinConversation:', error);
  }
}

/**
 * Handle leaving a conversation room
 * Stops real-time updates for a specific conversation
 * 
 * @param socket - Client socket
 * @param data - Conversation leave payload
 */
export async function handleLeaveConversation(
  socket: Socket,
  data: { conversationId: string }
): Promise<void> {
  try {
    const user = socket.data.user;
    if (!user) return;

    const conversationRoom = `conversation_${data.conversationId}`;
    socket.leave(conversationRoom);
    
    console.log(`[Messaging] ${user.username} left conversation room: ${conversationRoom}`);
  } catch (error: any) {
    console.error('[Messaging] Error in handleLeaveConversation:', error);
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Room Strategy:
 *    - conversation_{id}: All participants in a conversation
 *    - user_{username}: Personal room for each user
 *    - Dual broadcast ensures delivery even if not in conversation room
 * 
 * 2. Message Flow:
 *    - Client emits message:send
 *    - Server validates, saves to DB, filters profanity
 *    - Server broadcasts message:receive to conversation room
 *    - Server also sends to recipient's user room
 *    - Recipient(s) receive message in real-time
 * 
 * 3. Typing Indicators:
 *    - Debounced on client (500ms)
 *    - Auto-stop after 3 seconds of no input
 *    - Broadcast only to conversation participants
 * 
 * 4. Read Receipts:
 *    - Triggered when message enters viewport
 *    - Batch update for multiple messages
 *    - Broadcast to sender for UI update
 * 
 * 5. Error Handling:
 *    - Authentication errors: Emit error event to client
 *    - Validation errors: Return error in callback
 *    - Server errors: Log and emit generic error
 * 
 * 6. Performance:
 *    - Room-based broadcasting for efficient delivery
 *    - No database polling - fully event-driven
 *    - Rate limiting handled by messagingService
 */
