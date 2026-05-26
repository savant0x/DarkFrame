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
import { createServiceClient } from '@/lib/supabase/server';
import type { PlayerContext } from '@/lib/channelService';

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  id: string;
  channel: string;
  clan_id?: string;
  sender_id: string;
  sender_username: string;
  sender_level: number;
  sender_is_vip: boolean;
  content: string;
  timestamp: string;
  edited: boolean;
  edited_at?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  deleted_by?: string;
}

interface MessageSoftDeleteData {
  is_deleted: boolean;
  deleted_at: string;
  deleted_by: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const TABLE_MESSAGES = 'clan_chat_messages';

// ============================================================================
// AUTHENTICATION (PLACEHOLDER)
// ============================================================================

async function getAuthenticatedUser(
  request: NextRequest
): Promise<PlayerContext | null> {
  // PLACEHOLDER: Mock user for development
  return {
    username: 'TestUser',
    level: 10,
    isVIP: false,
    clanId: undefined,
    isMuted: false,
    channelBans: [],
  };
}

// ============================================================================
// DELETE /api/chat/delete - Delete Message
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'messageId is required' },
        { status: 400 }
      );
    }

    if (messageId.length < 8 || messageId.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: message } = await supabase
      .from(TABLE_MESSAGES)
      .select('*')
      .eq('id', messageId)
      .single();

    if (!message) {
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

    // Check ownership via sender_id (resolve to username from players table)
    const { data: sender } = await supabase
      .from('players')
      .select('username')
      .eq('username', message.sender_id)
      .maybeSingle();

    if (!sender || sender.username !== user.username) {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own messages' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from(TABLE_MESSAGES)
      .update({ deleted: true })
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
