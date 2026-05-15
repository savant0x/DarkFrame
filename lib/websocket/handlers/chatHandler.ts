/**
 * Chat Event Handler
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Handles real-time chat events for clan communication including messages,
 * typing indicators, and presence status.
 */

import type { Server, Socket } from 'socket.io';
import { createServiceClient } from '@/lib/supabase/server';
import type { AuthenticatedUser } from '../auth';
import {
  broadcastChatMessage,
  broadcastTypingIndicator,
  broadcastMemberOnlineStatus,
} from '../broadcast';
import type { ChatMessagePayload, ChatTypingPayload } from '@/types/websocket';

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

  if (!user || !user.clanId) {
    callback?.({ success: false, error: 'Unauthorized or no clan membership' });
    return;
  }
  
  try {
    const supabase = createServiceClient();
    const now = Date.now();
    
    const messageId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { error } = await supabase
      .from('clan_chat_messages')
      .insert({
        id: messageId,
        channel: data.channelId,
        clan_id: user.clanId,
        sender_id: user.userId,
        message: data.content,
        created_at: new Date(now).toISOString(),
        deleted: false,
        sender_role: 'MEMBER',
      });

    if (error) {
      throw error;
    }
    
    // Broadcast message
    const payload: ChatMessagePayload = {
      messageId,
      channelId: data.channelId,
      userId: user.userId,
      username: user.username,
      level: (user as { level?: number }).level ?? 1,
      isVIP: Boolean((user as { isVIP?: boolean; vip?: boolean }).isVIP ?? (user as { vip?: boolean }).vip ?? false),
      content: data.content,
      timestamp: now,
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
