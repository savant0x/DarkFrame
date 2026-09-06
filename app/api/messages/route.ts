/**
 * Messages API Route
 * Created: 2025-10-25
 * Feature: FID-20251025-102
 * 
 * OVERVIEW:
 * RESTful API endpoints for private messaging operations.
 * Handles sending messages, fetching conversations, message history,
 * and marking messages as read.
 * 
 * ENDPOINTS:
 * - GET  /api/messages - Get message history for a conversation
 * - POST /api/messages - Send a new message
 * - GET  /api/messages/conversations - Get all conversations for a player
 * - POST /api/messages/read - Mark messages as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { getConversationForParticipant } from '@/lib/messagingService';
import {
  sendDirectMessage,
  getMessageHistory,


} from '@/lib/messagingService';

// ============================================================================
// GET - Fetch Message History
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // FID-20260904-005 §5.1: reading a conversation requires SESSION membership in it.
    // The prior route served any conversationId to anyone (no auth at all).
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const limit = searchParams.get('limit');
    const before = searchParams.get('before');
    const after = searchParams.get('after');

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const membership = await getConversationForParticipant(conversationId, authUser.username);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const result = await getMessageHistory({
      conversationId,
      limit: limit ? parseInt(limit) : undefined,
      before: before ? new Date(before) : undefined,
      after: after ? new Date(after) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/messages:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Send Message
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // FID-20260904-005 §5.1: the sender is the SESSION user. The body `senderId` was
    // previously trusted — an unauthenticated caller forged messages as any player.
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { recipientId, content, contentType } = body;

    if (!recipientId || !content) {
      return NextResponse.json(
        { success: false, error: 'recipientId and content are required' },
        { status: 400 }
      );
    }

    const result = await sendDirectMessage(authUser.username, {
      recipientId,
      content,
      contentType,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in POST /api/messages:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) || 'Internal server error' },
      { status: 500 }
    );
  }
}
