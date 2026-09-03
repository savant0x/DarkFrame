/**
 * Global Chat WebSocket Handlers
 * Created: 2025-10-25
 * Feature: FID-20251025-103
 * 
 * OVERVIEW:
 * Real-time WebSocket handlers for the global chat system.
 * Manages message broadcasting, channel joining/leaving, typing indicators,
 * Ask Veterans notifications, and online user tracking.
 * 
 * KEY FEATURES:
 * - Broadcast messages to channel rooms
 * - Join/leave channel management with permission validation
 * - Typing indicator broadcasting
 * - Ask Veterans notification to level 50+ players
 * - Online user count tracking per channel
 * - Message deletion notifications
 * - Moderation action notifications
 * 
 * INTEGRATION:
 * - Connects to lib/websocket/server.ts
 * - Uses chatService for message operations
 * - Uses channelService for permissions
 * - Uses moderationService for admin actions
 */

import type { Server, Socket } from 'socket.io';
import type { AuthenticatedUser } from './auth';
import { connectToDatabase } from '@/lib/mongodb';
import {
  sendGlobalChatMessage,
  type SendMessageRequest,
  type ChatMessage,
  sendVeteranNotification,
  isVeteran,
} from '@/lib/chatService';
import {
  ChannelType,
  canWriteChannel,
  canReadChannel,
  getChannelRoom,
  getPlayerChannels,
  type PlayerContext,
} from '@/lib/channelService';
import {
  checkMuteStatus,
  getUserChannelBans,
} from '@/lib/moderationService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chat message event payload
 */
export interface ChatMessageEvent {
  channelId: ChannelType;
  clanId?: string;
  message: string;
}

/**
 * Join channel event payload
 */
export interface JoinChannelEvent {
  channelId: ChannelType;
  clanId?: string;
}

/**
 * Leave channel event payload
 */
export interface LeaveChannelEvent {
  channelId: ChannelType;
  clanId?: string;
}

/**
 * Typing indicator event payload
 */
export interface TypingEvent {
  channelId: ChannelType;
  clanId?: string;
}

/**
 * Ask Veterans event payload
 */
export interface AskVeteransEvent {
  question: string;
}

/**
 * Message deleted notification
 */
export interface MessageDeletedNotification {
  messageId: string;
  channelId: ChannelType;
  deletedBy: string;
  reason: string;
}

/**
 * User muted notification
 */
export interface UserMutedNotification {
  userId: string;
  username: string;
  duration: string;
  expiresAt: Date | null;
  mutedBy: string;
  reason: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert AuthenticatedUser to PlayerContext
 * Fetches VIP status from database
 */
async function toPlayerContext(
  user: AuthenticatedUser,
  channelBans: string[]
): Promise<PlayerContext> {
  // Check if user is VIP from database
  let isVIP = false;
  try {
    const db = await connectToDatabase();
    const player = await db.collection('players').findOne({ username: user.username });
    isVIP = player?.vip === true || player?.isVIP === true;
  } catch (error) {
    console.error('[ChatHandlers] Failed to check VIP status:', error);
  }

  return {
    username: user.username,
    level: user.level || 1,
    isVIP,
    clanId: user.clanId,
    isMuted: false, // Will be checked separately
    channelBans,
  };
}

/**
 * Get all online users in a channel room
 */
async function getOnlineUsersInChannel(
  io: Server,
  channelId: ChannelType,
  clanId?: string
): Promise<number> {
  const room = getChannelRoom(channelId, clanId);
  const sockets = await io.in(room).fetchSockets();
  return sockets.length;
}

/**
 * Broadcast online count update to channel
 */
async function broadcastOnlineCount(
  io: Server,
  channelId: ChannelType,
  clanId?: string
): Promise<void> {
  const room = getChannelRoom(channelId, clanId);
  const count = await getOnlineUsersInChannel(io, channelId, clanId);
  
  io.to(room).emit('chat:online_count', {
    channelId,
    clanId,
    count,
  });
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

/**
 * Handle chat message send
 * 
 * @param io - Socket.io server instance
 * @param socket - Client socket
 * @param data - Message data
 * @param callback - Response callback
 */
export async function handleChatMessage(
  io: Server,
  socket: Socket,
  data: ChatMessageEvent,
  callback?: (response: { success: boolean; error?: string; message?: ChatMessage }) => void
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;
  
  if (!user) {
    callback?.({ success: false, error: 'Not authenticated' });
    return;
  }

  try {
    const { channelId, clanId, message } = data;

    // Get user's channel bans
    const channelBans = await getUserChannelBans(user.username);
    
    // Create player context
    const playerContext = await toPlayerContext(user, channelBans);
    
    // Check mute status
    const muteStatus = await checkMuteStatus(user.username);
    if (muteStatus.isMuted) {
      const expiresIn = muteStatus.expiresIn || 'permanent';
      callback?.({
        success: false,
        error: `You are muted. ${typeof expiresIn === 'number' ? `Expires in ${Math.ceil(expiresIn / 60)} minutes` : 'Permanent mute'}`,
      });
      return;
    }
    
    playerContext.isMuted = false;

    // Send message via chat service
    const request: SendMessageRequest = {
      channelId,
      clanId,
      sender: playerContext,
      message,
    };

    const result = await sendGlobalChatMessage(request);

    if (!result.success || !result.message) {
      callback?.({ success: false, error: result.error || 'Failed to send message' });
      return;
    }

    // Broadcast message to channel room
    const room = getChannelRoom(channelId, clanId);
    io.to(room).emit('chat:message', result.message);

    callback?.({ success: true, message: result.message });

  } catch (error) {
    console.error('[ChatHandlers] Send message error:', error);
    callback?.({ success: false, error: 'Failed to send message' });
  }
}

// ============================================================================
// CHANNEL MANAGEMENT
// ============================================================================

/**
 * Handle join channel
 * 
 * @param io - Socket.io server instance
 * @param socket - Client socket
 * @param data - Channel data
 * @param callback - Response callback
 */
export async function handleJoinChannel(
  io: Server,
  socket: Socket,
  data: JoinChannelEvent,
  callback?: (response: { success: boolean; error?: string }) => void
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;
  
  if (!user) {
    callback?.({ success: false, error: 'Not authenticated' });
    return;
  }

  try {
    const { channelId, clanId } = data;

    // Get user's channel bans
    const channelBans = await getUserChannelBans(user.username);
    
    // Create player context
    const playerContext = await toPlayerContext(user, channelBans);

    // Check read permission
    const perm = canReadChannel(channelId, playerContext);
    if (!perm.canRead) {
      callback?.({ success: false, error: perm.reason || 'Access denied' });
      return;
    }

    // Join Socket.io room
    const room = getChannelRoom(channelId, clanId);
    await socket.join(room);

    console.log(`[ChatHandlers] ${user.username} joined ${room}`);

    // Broadcast online count update
    await broadcastOnlineCount(io, channelId, clanId);

    callback?.({ success: true });

  } catch (error) {
    console.error('[ChatHandlers] Join channel error:', error);
    callback?.({ success: false, error: 'Failed to join channel' });
  }
}

/**
 * Handle leave channel
 * 
 * @param io - Socket.io server instance
 * @param socket - Client socket
 * @param data - Channel data
 */
export async function handleLeaveChannel(
  io: Server,
  socket: Socket,
  data: LeaveChannelEvent
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;
  
  if (!user) return;

  try {
    const { channelId, clanId } = data;

    // Leave Socket.io room
    const room = getChannelRoom(channelId, clanId);
    await socket.leave(room);

    console.log(`[ChatHandlers] ${user.username} left ${room}`);

    // Broadcast online count update
    await broadcastOnlineCount(io, channelId, clanId);

  } catch (error) {
    console.error('[ChatHandlers] Leave channel error:', error);
  }
}

/**
 * Auto-join user to all accessible channels on connect
 * 
 * @param io - Socket.io server instance
 * @param socket - Client socket
 */
export async function autoJoinChatChannels(
  io: Server,
  socket: Socket
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;
  
  if (!user) return;

  try {
    // Get user's channel bans
    const channelBans = await getUserChannelBans(user.username);
    
    // Create player context
    const playerContext = await toPlayerContext(user, channelBans);

    // Get accessible channels
    const channels = getPlayerChannels(playerContext);

    // Join all accessible channel rooms
    for (const channelId of channels) {
      const room = getChannelRoom(channelId, user.clanId);
      await socket.join(room);
      console.log(`[ChatHandlers] ${user.username} auto-joined ${room}`);
    }

    // Broadcast online counts for all joined channels
    for (const channelId of channels) {
      await broadcastOnlineCount(io, channelId, user.clanId);
    }

  } catch (error) {
    console.error('[ChatHandlers] Auto-join channels error:', error);
  }
}

// ============================================================================
// TYPING INDICATORS
// ============================================================================

/**
 * Handle typing start
 * 
 * @param io - Socket.io server instance
 * @param socket - Client socket
 * @param data - Typing data
 */
export async function handleTypingStart(
  io: Server,
  socket: Socket,
  data: TypingEvent
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;
  
  if (!user) return;

  try {
    const { channelId, clanId } = data;

    // Broadcast typing indicator to channel room (exclude sender)
    const room = getChannelRoom(channelId, clanId);
    socket.to(room).emit('chat:typing_start', {
      channelId,
      clanId,
      username: user.username,
    });

  } catch (error) {
    console.error('[ChatHandlers] Typing start error:', error);
  }
}

/**
 * Handle typing stop
 * 
 * @param io - Socket.io server instance
 * @param socket - Client socket
 * @param data - Typing data
 */
export async function handleTypingStop(
  io: Server,
  socket: Socket,
  data: TypingEvent
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;
  
  if (!user) return;

  try {
    const { channelId, clanId } = data;

    // Broadcast typing stop to channel room (exclude sender)
    const room = getChannelRoom(channelId, clanId);
    socket.to(room).emit('chat:typing_stop', {
      channelId,
      clanId,
      username: user.username,
    });

  } catch (error) {
    console.error('[ChatHandlers] Typing stop error:', error);
  }
}

// ============================================================================
// ASK VETERANS FEATURE
// ============================================================================

/**
 * Handle Ask Veterans notification
 * Broadcasts question to all online players level 50+
 * 
 * @param io - Socket.io server instance
 * @param socket - Client socket
 * @param data - Question data
 * @param callback - Response callback
 */
export async function handleAskVeterans(
  io: Server,
  socket: Socket,
  data: AskVeteransEvent,
  callback?: (response: { success: boolean; error?: string; notifiedCount?: number }) => void
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;
  
  if (!user) {
    callback?.({ success: false, error: 'Not authenticated' });
    return;
  }

  try {
    const { question } = data;

    // Validate question length
    if (!question || question.trim().length === 0) {
      callback?.({ success: false, error: 'Question cannot be empty' });
      return;
    }

    if (question.length > 500) {
      callback?.({ success: false, error: 'Question too long (max 500 characters)' });
      return;
    }

    // Create notification
    const notification = await sendVeteranNotification(
      user.username,
      user.username,
      user.level || 1,
      question.trim()
    );

    // Get all connected sockets
    const sockets = await io.fetchSockets();
    
    let notifiedCount = 0;

    // Broadcast to veteran players (level 50+)
    for (const targetSocket of sockets) {
      const targetUser = targetSocket.data.user as AuthenticatedUser | undefined;
      
      if (targetUser && isVeteran(targetUser.level || 1)) {
        targetSocket.emit('chat:veteran_notification', {
          playerId: user.username,
          playerUsername: user.username,
          playerLevel: user.level || 1,
          question: question.trim(),
          timestamp: notification.timestamp,
        });
        notifiedCount++;
      }
    }

    console.log(`[ChatHandlers] Ask Veterans: "${question}" (${notifiedCount} veterans notified)`);

    callback?.({ success: true, notifiedCount });

  } catch (error) {
    console.error('[ChatHandlers] Ask Veterans error:', error);
    callback?.({ success: false, error: 'Failed to send notification' });
  }
}

// ============================================================================
// MODERATION NOTIFICATIONS
// ============================================================================

/**
 * Broadcast message deleted notification
 * 
 * @param io - Socket.io server instance
 * @param channelId - Channel ID
 * @param messageId - Message ID that was deleted
 * @param deletedBy - Username of moderator
 * @param reason - Deletion reason
 * @param clanId - Clan ID (if clan channel)
 */
export async function notifyMessageDeleted(
  io: Server,
  channelId: ChannelType,
  messageId: string,
  deletedBy: string,
  reason: string,
  clanId?: string
): Promise<void> {
  try {
    const room = getChannelRoom(channelId, clanId);
    
    const notification: MessageDeletedNotification = {
      messageId,
      channelId,
      deletedBy,
      reason,
    };

    io.to(room).emit('chat:message_deleted', notification);

  } catch (error) {
    console.error('[ChatHandlers] Notify message deleted error:', error);
  }
}

/**
 * Broadcast user muted notification
 * 
 * @param io - Socket.io server instance
 * @param userId - User ID that was muted
 * @param username - Username
 * @param duration - Mute duration
 * @param expiresAt - Expiry date (null for permanent)
 * @param mutedBy - Moderator username
 * @param reason - Mute reason
 */
export async function notifyUserMuted(
  io: Server,
  userId: string,
  username: string,
  duration: string,
  expiresAt: Date | null,
  mutedBy: string,
  reason: string
): Promise<void> {
  try {
    const notification: UserMutedNotification = {
      userId,
      username,
      duration,
      expiresAt,
      mutedBy,
      reason,
    };

    // Notify the muted user directly
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      const user = socket.data.user as AuthenticatedUser | undefined;
      if (user?.username === username) {
        socket.emit('chat:user_muted', notification);
      }
    }

  } catch (error) {
    console.error('[ChatHandlers] Notify user muted error:', error);
  }
}

/**
 * Kick user from channel (after ban)
 * 
 * @param io - Socket.io server instance
 * @param userId - User ID to kick
 * @param channelId - Channel ID
 * @param clanId - Clan ID (if clan channel)
 * @param reason - Ban reason
 */
export async function kickUserFromChannel(
  io: Server,
  userId: string,
  channelId: ChannelType,
  clanId: string | undefined,
  reason: string
): Promise<void> {
  try {
    const room = getChannelRoom(channelId, clanId);
    
    // Find user's socket and remove from room
    const sockets = await io.in(room).fetchSockets();
    
    for (const socket of sockets) {
      const user = socket.data.user as AuthenticatedUser | undefined;
      if (user?.username === userId) {
        await socket.leave(room);
        
        // Notify user of ban
        socket.emit('chat:banned_from_channel', {
          channelId,
          clanId,
          reason,
        });
        
        console.log(`[ChatHandlers] Kicked ${userId} from ${room}: ${reason}`);
      }
    }

    // Update online count
    await broadcastOnlineCount(io, channelId, clanId);

  } catch (error) {
    console.error('[ChatHandlers] Kick user from channel error:', error);
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Message Broadcasting:
 *    - Messages sent to channel-specific Socket.io rooms
 *    - Room names: "chat_global", "chat_clan_clanId", etc.
 *    - Only users with read permissions in room
 * 
 * 2. Channel Join/Leave:
 *    - handleJoinChannel() validates permissions before joining
 *    - handleLeaveChannel() updates online count
 *    - autoJoinChatChannels() called on user connect
 * 
 * 3. Typing Indicators:
 *    - Broadcast to room using socket.to(room).emit() (excludes sender)
 *    - Auto-stop after 5 seconds (client-side timeout)
 *    - Debounced on client side
 * 
 * 4. Ask Veterans:
 *    - Fetches all connected sockets
 *    - Filters by level >= 50
 *    - Broadcasts to qualified veterans
 *    - Returns notified count to sender
 * 
 * 5. Online Count:
 *    - Tracked per channel room
 *    - Updated on join/leave/disconnect
 *    - Broadcasted to all users in channel
 * 
 * 6. Moderation:
 *    - notifyMessageDeleted() removes message from clients
 *    - notifyUserMuted() notifies muted user
 *    - kickUserFromChannel() removes from room and notifies
 * 
 * 7. VIP Status:
 *    - Fetched from database in toPlayerContext()
 *    - Checked against player.vip or player.isVIP fields
 *    - Used for rate limiting and permissions
 * 
 * 8. Integration with server.ts:
 *    - Add event listeners in server.ts connection handler
 *    - Call autoJoinChatChannels(io, socket) on connect
 *    - See IMPLEMENTATION NOTES for event registration
 * 
 * 9. Error Handling:
 *    - All handlers wrapped in try-catch
 *    - Errors logged with context
 *    - Callbacks include error messages
 *    - Failed operations don't crash server
 */
