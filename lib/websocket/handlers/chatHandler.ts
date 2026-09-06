/**
 * Chat Event Handler
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Handles real-time chat events for clan communication including messages,
 * typing indicators, and presence status.
 */

import type { Server, Socket } from 'socket.io';
import { db } from '@/lib/db';
import { chatMessages } from '@/lib/db/schema';
import type { AuthenticatedUser } from '../auth';
import {
  broadcastChatMessage,
  broadcastTypingIndicator,

} from '../broadcast';
import type { ChatMessagePayload, ChatTypingPayload } from '@/types/websocket';
import { randomUUID } from 'node:crypto';

/**
 * Handles sending a chat message
 */
export async function handleSendMessage(
  io: Server,
  socket: Socket,
  data: {
    channelId: string;
    content: string;
    mentions?: string[];
  },
  callback?: (response: { success: boolean; messageId?: string; error?: string }) => void
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;

  if (!user) {
    callback?.({ success: false, error: 'Unauthorized' });
    return;
  }
  
  try {
    const messageId = randomUUID();
    const now = new Date();
    const monthCategory = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await db.insert(chatMessages).values({
      id: messageId,
      channelId: data.channelId,
      clanId: user.clanId,
      senderId: user.userId,
      senderUsername: user.username,
      senderLevel: user.level ?? 1,
      isVIP: Number(Boolean((user as any).isVIP ?? (user as any).vip ?? false)),
      isNewbie: 0,
      message: data.content,
      itemLinks: [],
      mentions: data.mentions || [],
      timestamp: now,
      monthCategory,
      edited: 0,
      deleted: 0,
    });
    
    const payload: ChatMessagePayload = {
      messageId,
      channelId: data.channelId,
      userId: user.userId,
      username: user.username,
      level: (user as any).level ?? 1,
      isVIP: Boolean((user as any).isVIP ?? (user as any).vip ?? false),
      content: data.content,
      timestamp: Date.now(),
      mentions: data.mentions,
    };
    
    await broadcastChatMessage(io, payload);
    
    callback?.({ success: true, messageId });
    
  } catch (error) {
    console.error('[Chat Handler] Failed to send message:', error);
    callback?.({ success: false, error: 'Failed to send message' });
  }
}

/**
 * Handles typing indicator
 */
export async function handleTyping(
  io: Server,
  socket: Socket,
  data: { channelId: string },
  isTyping: boolean
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;
  
  if (!user) return;
  
  const payload: ChatTypingPayload = {
    channelId: data.channelId,
    userId: user.userId,
    username: user.username,
    isTyping,
    timestamp: Date.now(),
  };
  
  await broadcastTypingIndicator(io, payload);
}
