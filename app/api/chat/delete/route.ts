/**
 * Chat Message Delete API
 * Created: 2025-10-26
 * Feature: FID-20251026-019 Phase 1
 * 
 * OVERVIEW:
 * API endpoint for deleting chat messages.
 * Allows users to delete their own messages.
 * Soft-delete implementation (sets isDeleted flag, preserves data for moderation).
 * 
 * ENDPOINTS:
 * - DELETE /api/chat/delete - Delete a chat message
 * 
 * SECURITY:
 * - Users can only delete their own messages
 * - Soft-delete (preserves message for moderation review)
 * - Deleted messages show "[deleted]" text
 * - Original content preserved in database
 * 
 * DEPENDENCIES:
 * - Supabase for persistence
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';

const TABLE_MESSAGES = 'chat_messages';

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'messageId is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: message, error: fetchError } = await supabase
      .from(TABLE_MESSAGES)
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    if (message.deleted) {
      return NextResponse.json(
        { success: false, error: 'Message is already deleted' },
        { status: 400 }
      );
    }

    if (message.sender_id !== username && message.sender_username !== username) {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own messages' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from(TABLE_MESSAGES)
      .update({ deleted: true } as never)
      .eq('id', messageId);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete message' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Message deleted successfully',
        messageId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /chat/delete DELETE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while deleting message',
      },
      { status: 500 }
    );
  }
}
