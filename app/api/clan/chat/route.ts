/**
 * @file app/api/clan/chat/route.ts
 * @created 2025-10-18
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Clan chat functionality with message sending, history retrieval, editing, and moderation.
 * Implements role-based permissions and rate limiting for chat operations.
 * 
 * ROUTES:
 * - GET /api/clan/chat - Retrieve chat history with pagination
 * - POST /api/clan/chat - Send new message
 * - PUT /api/clan/chat - Edit own message (within time limit)
 * - DELETE /api/clan/chat - Delete message (moderation)
 * 
 * AUTHENTICATION:
 * - All routes require clan membership via requireClanMembership()
 * 
 * BUSINESS RULES:
 * - Members can send messages (recruits must wait 24h)
 * - Only leaders can send announcements
 * - Users can edit own messages within 5 minutes
 * - Officers/leaders can delete any message
 * - Members can only delete own messages
 * - Rate limiting: 1 message per 2 seconds
 * - Max message length: 500 characters
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requireClanMembership,
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  logger,
} from '@/lib';
import { createServiceClient } from '@/lib/supabase/server';
import {
  sendClanChatMessage,
  getClanChatMessages,
  editClanChatMessage,
  deleteClanChatMessage,
  getMessagesSince,
  MessageType,
} from '@/lib/clanChatService';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/clan/chat
 * Retrieve clan chat messages with pagination
 * 
 * @param request - NextRequest with authentication cookie and query parameters
 * @returns NextResponse with messages array
 * 
 * @example
 * GET /api/clan/chat?clanId=abc123&limit=50&before=2025-10-23T12:00:00Z
 * Response: { success: true, messages: [...], count: 50 }
 * 
 * GET /api/clan/chat?clanId=abc123&since=2025-10-23T12:00:00Z
 * Response: { success: true, messages: [...], count: 3 }
 * 
 * @throws {400} Clan ID required or invalid timestamp
 * @throws {401} Unauthorized
 * @throws {403} Not a member of clan
 * @throws {404} Clan not found
 * @throws {500} Failed to retrieve messages
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('clan-chat-get');
  const endTimer = log.time('chat-get');
  
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    const { clanId } = result;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const beforeParam = searchParams.get('before');
    const sinceParam = searchParams.get('since');

    let messages;

    if (sinceParam) {
      const since = new Date(sinceParam);
      if (isNaN(since.getTime())) {
        return NextResponse.json({ error: 'Invalid since timestamp' }, { status: 400 });
      }
      messages = await getMessagesSince(clanId, sinceParam);
    } else {
      const before = beforeParam ? new Date(beforeParam) : undefined;
      if (beforeParam && before && isNaN(before.getTime())) {
        return NextResponse.json({ error: 'Invalid before timestamp' }, { status: 400 });
      }
      messages = await getClanChatMessages(clanId, limit, beforeParam || undefined);
    }

    log.info('Chat messages retrieved', { clanId, messageCount: messages.length });
    return NextResponse.json({
      success: true,
      messages,
      count: messages.length,
    });
  } catch (error: unknown) {
    log.error('Failed to retrieve chat messages', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST /api/clan/chat
 * Send a new chat message
 * 
 * @param request - NextRequest with authentication cookie and message data in body
 * @returns NextResponse with created message
 * 
 * @example
 * POST /api/clan/chat
 * Body: { clanId: "abc123", message: "Hello clan!", type: "USER" }
 * Response: { success: true, message: { id: "msg123", content: "Hello clan!", ... } }
 * 
 * @throws {400} Missing clan ID or message
 * @throws {400} Message too long (max 500 chars)
 * @throws {401} Unauthorized
 * @throws {403} Only leaders can send announcements
 * @throws {403} Recruits must wait 24h before chatting
 * @throws {429} Rate limit exceeded
 * @throws {500} Failed to send message
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    const { auth, clan, clanId } = result;

    const body = await request.json();
    const { message, type } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const messageType = type || MessageType.USER;
    if (!Object.values(MessageType).includes(messageType)) {
      return NextResponse.json({ error: 'Invalid message type' }, { status: 400 });
    }

    if (messageType === MessageType.ANNOUNCEMENT) {
      const supabase = createServiceClient();
      const { data: member } = await supabase
        .from('clan_members')
        .select('role')
        .eq('clan_id', clanId)
        .eq('player_id', auth.username)
        .maybeSingle();
      if (!member || member.role !== 'LEADER') {
        return NextResponse.json(
          { error: 'Only leaders can send announcements' },
          { status: 403 }
        );
      }
    }

    const chatMessage = await sendClanChatMessage(clanId, auth.playerId, message, messageType);

    return NextResponse.json({
      success: true,
      message: chatMessage,
    });
  } catch (error: unknown) {
    logger.error('Error sending chat message:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Recruits must wait')) {
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    if (errorMessage.includes('Rate limit exceeded')) {
      return NextResponse.json({ error: errorMessage }, { status: 429 });
    }

    if (errorMessage.includes('too long')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json(
      { error: errorMessage || 'Failed to send message' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clan/chat
 * Edit own message (within 5 minute time limit)
 * 
 * @param request - NextRequest with authentication cookie and edit data in body
 * @returns NextResponse with updated message
 * 
 * @example
 * PUT /api/clan/chat
 * Body: { messageId: "msg123", message: "Corrected message text" }
 * Response: { success: true, message: { id: "msg123", content: "Corrected...", edited: true } }
 * 
 * @throws {400} Missing message ID or message text
 * @throws {400} Message too long
 * @throws {401} Unauthorized
 * @throws {403} Can only edit your own messages
 * @throws {403} Can only edit within 5 minutes
 * @throws {500} Failed to edit message
 */
export async function PUT(request: NextRequest) {
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    const { auth } = result;

    const body = await request.json();
    const { messageId, message } = body;

    if (!messageId || !message) {
      return NextResponse.json(
        { error: 'Message ID and new message text are required' },
        { status: 400 }
      );
    }

    const updatedMessage = await editClanChatMessage(messageId, auth.playerId, message);

    return NextResponse.json({
      success: true,
      message: updatedMessage,
    });
  } catch (error: unknown) {
    logger.error('Error editing chat message:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Can only edit your own')) {
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    if (errorMessage.includes('within')) {
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    if (errorMessage.includes('too long')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json(
      { error: errorMessage || 'Failed to edit message' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clan/chat
 * Delete a chat message (with moderation permissions)
 * 
 * @param request - NextRequest with authentication cookie and message ID in query
 * @returns NextResponse with success confirmation
 * 
 * @example
 * DELETE /api/clan/chat?messageId=msg123&clanId=abc123
 * Response: { success: true, message: "Message deleted successfully" }
 * 
 * @throws {400} Missing message ID or clan ID
 * @throws {401} Unauthorized
 * @throws {403} Can only delete your own messages (unless officer/leader)
 * @throws {500} Failed to delete message
 */
export async function DELETE(request: NextRequest) {
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    const { auth, clanId } = result;

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID is required' },
        { status: 400 }
      );
    }

    await deleteClanChatMessage(messageId, clanId, auth.playerId);

    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error: unknown) {
    logger.error('Error deleting chat message:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('Can only delete your own')) {
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }

    return NextResponse.json(
      { error: errorMessage || 'Failed to delete message' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
