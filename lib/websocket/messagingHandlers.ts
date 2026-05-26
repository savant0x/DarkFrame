/**
 * Messaging Socket.io Event Handlers
 * Created: 2025-10-25
 * Updated: 2026-05-26 — Migrated from messagingService to dmService (Supabase)
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
  markMessageRead,
} from '@/lib/dmService';
import type { DirectMessage } from '@/types/directMessage';
import { DMMessageStatus } from '@/types/directMessage';

function mapDMStatusToWSStatus(status: DMMessageStatus): MessagingMessagePayload['status'] {
  switch (status) {
    case DMMessageStatus.SENT:
      return 'sent';
    case DMMessageStatus.DELIVERED:
      return 'delivered';
    case DMMessageStatus.READ:
      return 'read';
    default:
      return 'sent';
  }
}

function parseConversationParticipants(conversationId: string): [string, string] {
  if (conversationId.startsWith('dm_')) {
    const parts = conversationId.substring(3).split('_');
    const splitIdx = Math.floor(parts.length / 2);
    const a = parts.slice(0, splitIdx + 1).join('_');
    const b = parts.slice(splitIdx + 1).join('_');
    return [a, b];
  }
  return ['', ''];
}

function buildMessagePayload(message: DirectMessage): MessagingMessagePayload {
  return {
    _id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    recipientId: message.recipientId,
    content: message.content,
    contentType: 'text',
    status: mapDMStatusToWSStatus(message.status),
    createdAt: message.timestamp,
    readAt: undefined,
  };
}

function buildConversationPayload(
  conversationId: string,
  senderId: string,
  recipientId: string,
  lastMessageContent: string
): MessagingConversationPayload {
  const now = new Date();
  return {
    _id: conversationId,
    participants: [senderId, recipientId].sort(),
    lastMessage: {
      content: lastMessageContent,
      senderId,
      createdAt: now,
      status: 'sent',
    },
    unreadCount: {
      [senderId]: 0,
      [recipientId]: 1,
    },
    createdAt: now,
    updatedAt: now,
  };
}

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

    const result = await sendDirectMessage(sender.username, {
      recipientId: data.recipientId,
      content: data.content,
    });

    const messagePayload = buildMessagePayload(result.message);
    const conversationPayload = buildConversationPayload(
      result.conversationId,
      sender.username,
      data.recipientId,
      result.message.content
    );

    const conversationRoom = `conversation_${result.conversationId}`;
    socket.join(conversationRoom);

    io.to(conversationRoom).emit('message:receive', messagePayload);
    io.to(`user_${data.recipientId}`).emit('message:receive', messagePayload);

    io.to(`user_${sender.username}`).emit('conversation:updated', conversationPayload);
    io.to(`user_${data.recipientId}`).emit('conversation:updated', conversationPayload);

    console.log(`[Messaging] Message sent successfully: ${result.message.id}`);
    callback?.({ success: true, messageId: result.message.id });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
    console.error('[Messaging] Error in handleMessageSend:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    socket.emit('message:error', {
      error: errorMessage,
      code: 'SEND_FAILED',
      tempId: data.tempId,
    });
    callback?.({ success: false, error: errorMessage });
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

    const result = await markMessageRead(reader.username, {
      conversationId: data.conversationId,
      messageIds: data.messageId ? [data.messageId] : undefined,
    });

    const conversationRoom = `conversation_${data.conversationId}`;
    const receiptPayload: MessagingReadReceiptPayload = {
      conversationId: data.conversationId,
      messageId: data.messageId,
      playerId: reader.username,
      readAt: new Date(),
    };
    
    io.to(conversationRoom).emit('message:read', receiptPayload);

    console.log(`[Messaging] Read receipt sent: ${result.markedCount} messages marked as read`);
  } catch (error: unknown) {
    console.error('[Messaging] Error in handleMessageRead:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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

    const conversationRoom = `conversation_${data.conversationId}`;
    socket.to(conversationRoom).emit('typing:start', typingPayload);
    socket.to(`user_${data.recipientId}`).emit('typing:start', typingPayload);
  } catch (error: unknown) {
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

    const conversationRoom = `conversation_${data.conversationId}`;
    socket.to(conversationRoom).emit('typing:stop', typingPayload);
    socket.to(`user_${data.recipientId}`).emit('typing:stop', typingPayload);
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    console.error('[Messaging] Error in handleLeaveConversation:', error);
  }
}
