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
import { markMessagesAsRead } from '@/lib/messagingService';
import { getAuthenticatedUser } from '@/lib/authMiddleware';

export async function POST(request: NextRequest) {
  try {
    // FID-20260904-005 §5.1: mark-as-read acts on the SESSION user's inbox only —
    // the body `playerId` was previously trusted (cross-player read-state tampering).
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

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
      authUser.username,
      messageIds
    );

    // Surface service-level denial (non-participant / unknown conversation) as
    // a real 403 — NextResponse.json defaults to 200 even for success:false.
    if (!result.success) {
      return NextResponse.json(result, { status: 403 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/messages/read:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
