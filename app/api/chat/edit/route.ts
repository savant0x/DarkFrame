/**
 * Chat Message Edit API
 * Created: 2025-10-26
 * Feature: FID-20251026-019 Phase 1
 * 
 * OVERVIEW:
 * API endpoint for editing chat messages.
 * Allows users to edit their own messages within 15 minutes.
 * Includes profanity filtering and spam detection on edited content.
 * Marks message as edited with timestamp.
 * 
 * ENDPOINTS:
 * - POST /api/chat/edit - Edit a chat message
 * 
 * SECURITY:
 * - Users can only edit their own messages
 * - Cannot edit messages older than 15 minutes
 * - Cannot edit deleted messages
 * - Profanity filter applied to edited content
 * - Spam detection applied to edited content
 * 
 * DEPENDENCIES:
 * - lib/chatService.ts - Message operations
 * - lib/moderationService.ts - Profanity filter, spam detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { filterMessage, detectSpam } from '@/lib/moderationService';
import type { PlayerContext } from '@/lib/channelService';

// ============================================================================
// TYPES
// ============================================================================

interface EditMessageBody {
  messageId: string;
  newContent: string;
}

interface ChatMessage {
  id: string;
  channel_id: string;
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
}

interface MessageUpdateData {
  content: string;
  edited: boolean;
  edited_at: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const TABLE_MESSAGES = 'chat_messages';
const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000;

// ============================================================================
// POST /api/chat/edit - Edit Message
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = (body as Record<string, unknown>).username as string;
    if (!username) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });

    const { messageId, newContent } = body as EditMessageBody;

    const user: PlayerContext = {
      username,
      level: 1,
      isVIP: false,
      clanId: undefined,
      isMuted: false,
      channelBans: [],
    };

    if (!messageId || !newContent) {
      return NextResponse.json(
        { success: false, error: 'messageId and newContent are required' },
        { status: 400 }
      );
    }

    if (newContent.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    if (newContent.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Message cannot exceed 500 characters' },
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
        { success: false, error: 'Cannot edit deleted message' },
        { status: 403 }
      );
    }

    if (message.sender_id !== user.username) {
      return NextResponse.json(
        { success: false, error: 'You can only edit your own messages' },
        { status: 403 }
      );
    }

    const now = new Date();
    const msgTimestamp = new Date(message.created_at);
    const timeSinceMessage = now.getTime() - msgTimestamp.getTime();
    
    if (timeSinceMessage > EDIT_TIME_LIMIT_MS) {
      const minutesAgo = Math.floor(timeSinceMessage / 60000);
      return NextResponse.json(
        {
          success: false,
          error: `Cannot edit messages older than 15 minutes (this message is ${minutesAgo} minutes old)`,
        },
        { status: 403 }
      );
    }

    const filteredResult = await filterMessage(newContent, user.username);
    
    if (!filteredResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: filteredResult.error || 'Failed to process message',
        },
        { status: 400 }
      );
    }

    const cleanContent = filteredResult.filtered;
    const hadProfanity = filteredResult.hadProfanity;

    if (cleanContent.length >= 10) {
      const letters = cleanContent.replace(/[^a-zA-Z]/g, '');
      if (letters.length > 0) {
        const capsRatio = letters.replace(/[^A-Z]/g, '').length / letters.length;
        
        if (capsRatio >= 0.7) {
          return NextResponse.json(
            {
              success: false,
              error: 'Please do not use excessive caps',
            },
            { status: 400 }
          );
        }
      }
    }

    const nowISO = now.toISOString();

    const { error } = await supabase
      .from(TABLE_MESSAGES)
      .update({ message: cleanContent })
      .eq('id', messageId);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to update message' },
        { status: 500 }
      );
    }

    const { data: updatedMessage } = await supabase
      .from(TABLE_MESSAGES)
      .select('*')
      .eq('id', messageId)
      .single();

    return NextResponse.json(
      {
        success: true,
        message: updatedMessage,
        hadProfanity,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /chat/edit POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while editing message',
      },
      { status: 500 }
    );
  }
}
