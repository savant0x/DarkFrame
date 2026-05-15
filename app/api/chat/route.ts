/**
 * Chat API Routes
 * Created: 2025-10-25
 * Updated: 2026-05-05 — requireAuth, real player context, debug logging
 * 
 * OVERVIEW:
 * RESTful API endpoints for chat message operations.
 * Handles GET (retrieve messages) and POST (send message with auto-moderation).
 * Integrates with chatService, channelService, and moderationService.
 * Uses Supabase cookie-based auth via requireAuth().
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import {
  sendGlobalChatMessage,
  getGlobalChatMessages,
  deleteGlobalChatMessage,
  editGlobalChatMessage,
  type SendMessageRequest,
  type GetMessagesRequest,
  type ChatMessage,
} from '@/lib/chatService';
import {
  canReadChannel,
  canWriteChannel,
  ChannelType,
  type PlayerContext,
} from '@/lib/channelService';
import { 
  checkMuteStatus,
  filterMessage,
  detectSpam,
  muteUserForSpam,
} from '@/lib/moderationService';

function buildPlayerContext(username: string, player?: { level?: number; is_vip?: boolean; clan_id?: string | null }): PlayerContext {
  return {
    username,
    level: player?.level || 1,
    isVIP: player?.is_vip || false,
    clanId: player?.clan_id || undefined,
    isMuted: false,
    channelBans: [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = request.nextUrl;
    const username = auth.playerId;
    const user = buildPlayerContext(username, auth.player);

    const channelId = searchParams.get('channelId');
    const clanId = searchParams.get('clanId') || undefined;
    const limitStr = searchParams.get('limit');
    const beforeStr = searchParams.get('before');
    const sinceStr = searchParams.get('since');

    if (!channelId) {
      return NextResponse.json({ success: false, error: 'channelId is required' }, { status: 400 });
    }

    if (!Object.values(ChannelType).includes(channelId as ChannelType)) {
      return NextResponse.json({ success: false, error: 'Invalid channel type' }, { status: 400 });
    }

    const readPermission = canReadChannel(channelId as ChannelType, user);
    if (!readPermission.canRead) {
      return NextResponse.json({ success: false, error: readPermission.reason || 'Access denied' }, { status: 403 });
    }

    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ success: false, error: 'limit must be between 1 and 100' }, { status: 400 });
    }

    const before = beforeStr ? new Date(beforeStr) : undefined;
    const since = sinceStr ? new Date(sinceStr) : undefined;
    if (before && isNaN(before.getTime())) return NextResponse.json({ success: false, error: 'Invalid before date' }, { status: 400 });
    if (since && isNaN(since.getTime())) return NextResponse.json({ success: false, error: 'Invalid since date' }, { status: 400 });

    const getMessagesRequest: GetMessagesRequest = {
      channelId: channelId as ChannelType,
      clanId,
      limit,
      before,
      since,
    };

    const messages = await getGlobalChatMessages(getMessagesRequest);
    console.log(`[Chat GET] channel=${channelId} count=${messages.length}`);

    return NextResponse.json({ success: true, messages, count: messages.length, channelId }, { status: 200 });
  } catch (error) {
    console.error('[Chat GET] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;
    const body = await request.json();
    const user = buildPlayerContext(username, auth.player);
    const { channelId, message } = body;

    if (!channelId || !message) {
      return NextResponse.json({ success: false, error: 'channelId and message are required' }, { status: 400 });
    }

    if (!Object.values(ChannelType).includes(channelId as ChannelType)) {
      return NextResponse.json({ success: false, error: 'Invalid channel type' }, { status: 400 });
    }

    if (message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Message cannot be empty' }, { status: 400 });
    }
    if (message.length > 500) {
      return NextResponse.json({ success: false, error: 'Message cannot exceed 500 characters' }, { status: 400 });
    }

    const muteStatus = await checkMuteStatus(user.username);
    if (muteStatus.isMuted) {
      return NextResponse.json({ success: false, error: 'You are muted' }, { status: 403 });
    }

    const writePermission = canWriteChannel(channelId as ChannelType, user);
    if (!writePermission.canWrite) {
      return NextResponse.json({ success: false, error: writePermission.reason || 'Cannot write to channel' }, { status: 403 });
    }

    const filteredResult = await filterMessage(message, user.username);
    if (!filteredResult.success) {
      return NextResponse.json({ success: false, error: filteredResult.error || 'Failed to process message' }, { status: 400 });
    }
    const cleanMessage = filteredResult.filtered;
    const hadProfanity = filteredResult.hadProfanity;

    const spamCheck = await detectSpam(username, username, cleanMessage);
    if (spamCheck.isSpam) {
      if (spamCheck.shouldMute) {
        await muteUserForSpam(username, username, spamCheck.reason || 'Spam detected');
      }
      return NextResponse.json({ success: false, error: spamCheck.reason || 'Spam detected', isSpam: true, muted: spamCheck.shouldMute }, { status: 429 });
    }

    const sendMessageRequest: SendMessageRequest = {
      channelId: channelId as ChannelType,
      sender: user,
      message: cleanMessage,
    };

    const result = await sendGlobalChatMessage(sendMessageRequest);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to send message' }, { status: 400 });
    }

    console.log(`[Chat POST] channel=${channelId} sender=${username} persisted=true`);

    return NextResponse.json({ success: true, message: result.message, hadProfanity }, { status: 201 });
  } catch (error) {
    console.error('[Chat POST] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;
    const body = await request.json();
    const { messageId, newContent } = body;
    if (!messageId || !newContent) {
      return NextResponse.json({ success: false, error: 'messageId and newContent required' }, { status: 400 });
    }
    const result = await editGlobalChatMessage(messageId, newContent, username);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to edit message' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = request.nextUrl;
    const username = auth.playerId;
    const user = buildPlayerContext(username, auth.player);
    const messageId = searchParams.get('messageId');
    if (!messageId) return NextResponse.json({ success: false, error: 'messageId required' }, { status: 400 });
    const deleted = await deleteGlobalChatMessage(messageId, username, 'User deleted');
    return NextResponse.json({ success: deleted });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
