/**
 * Mark Messages as Read API Route
 * Created: 2025-10-25
 * Feature: FID-20251025-102
 * 
 * OVERVIEW:
 * API endpoint for marking messages as read in a conversation.
 * 
 * ENDPOINT:
 * POST /api/messages/read
 * Body: { conversationId, playerId, messageIds? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { markMessagesAsRead } from '@/lib/messagingService';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const playerId = auth.playerId;

    const body = await request.json();
    const { conversationId, messageIds } = body;

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const result = await markMessagesAsRead(
      conversationId,
      playerId,
      messageIds
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/messages/read:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
