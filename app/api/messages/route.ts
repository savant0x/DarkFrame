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
import {
  sendDirectMessage,
  getMessageHistory,
  getConversations,
  markMessagesAsRead,
} from '@/lib/messagingService';

// ============================================================================
// GET - Fetch Message History
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const playerId = searchParams.get('playerId');
    const limit = searchParams.get('limit');
    const before = searchParams.get('before');
    const after = searchParams.get('after');

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const result = await getMessageHistory({
      conversationId,
      limit: limit ? parseInt(limit) : undefined,
      before: before ? new Date(before) : undefined,
      after: after ? new Date(after) : undefined,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/messages:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Send Message
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderId, recipientId, content, contentType } = body;

    if (!senderId || !recipientId || !content) {
      return NextResponse.json(
        { success: false, error: 'senderId, recipientId, and content are required' },
        { status: 400 }
      );
    }

    const result = await sendDirectMessage(senderId, {
      recipientId,
      content,
      contentType,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/messages:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
