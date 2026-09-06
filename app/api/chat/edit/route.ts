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
import { db } from '@/lib/db';
import { chatMessages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { filterMessage } from '@/lib/moderationService';
import type { PlayerContext } from '@/lib/channelService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * POST request body
 */
interface EditMessageBody {
  messageId: string;
  newContent: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

// ============================================================================
// AUTHENTICATION (PLACEHOLDER)
// ============================================================================

/**
 * Get authenticated user from request
 * 
 * TODO: Replace with actual authentication once next-auth is installed
 * For now, this is a placeholder that returns mock user data
 * 
 * @param request - Next.js request object
 * @returns Player context or null if not authenticated
 */
async function getAuthenticatedUser(
  _request: NextRequest
): Promise<PlayerContext | null> {
  // PLACEHOLDER: Mock user for development
  // Replace this entire function when authentication is ready
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
// POST /api/chat/edit - Edit Message
// ============================================================================

/**
 * POST /api/chat/edit
 * Edit a chat message (user's own message, within 15 minutes)
 * 
 * Request Body:
 * - messageId (required): ID of message to edit
 * - newContent (required): New message content (1-500 characters)
 * 
 * @example
 * POST /api/chat/edit
 * {
 *   "messageId": "msg_abc123",
 *   "newContent": "Updated message text"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: EditMessageBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { messageId, newContent } = body;

    // Validate required fields
    if (!messageId || !newContent) {
      return NextResponse.json(
        { success: false, error: 'messageId and newContent are required' },
        { status: 400 }
      );
    }

    // Validate message length
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

    // Find message
    const messageResult = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);

    if (messageResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    const message = messageResult[0];

    // Check if message is deleted
    if (message.deleted === 1) {
      return NextResponse.json(
        { success: false, error: 'Cannot edit deleted message' },
        { status: 403 }
      );
    }

    // Check if user owns the message
    if (message.senderUsername !== user.username) {
      return NextResponse.json(
        { success: false, error: 'You can only edit your own messages' },
        { status: 403 }
      );
    }

    // Check if message is within edit time limit
    const now = new Date();
    const timeSinceMessage = now.getTime() - message.timestamp.getTime();
    
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

    // PROFANITY FILTER
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

    // SPAM DETECTION (only check for caps, not rate limiting for edits)
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

    // Update message
    const result = await db.update(chatMessages)
      .set({
        message: cleanContent,
        edited: 1,
        editedAt: now,
      })
      .where(eq(chatMessages.id, messageId));

    const affected = Array.isArray(result) ? result.length : (result as unknown as { rowCount?: number }).rowCount ?? 0;
    if (affected === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update message' },
        { status: 500 }
      );
    }

    // Fetch updated message
    const updatedMessageResult = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
    const updatedMessage = updatedMessageResult[0];

    // TODO: Emit WebSocket event to update message in real-time for all clients
    // Example: io.to(channelId).emit('message:edited', { messageId, newContent, editedAt });

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

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Edit Time Limit:
 *    - Users can edit messages within 15 minutes of sending
 *    - After 15 minutes, message is locked
 *    - Provides clear error message with time elapsed
 * 
 * 2. Ownership Validation:
 *    - Only message sender can edit
 *    - Checked via senderUsername matching
 *    - TODO: Use userId once authentication is implemented
 * 
 * 3. Profanity Filtering:
 *    - Same filter as new messages
 *    - Uses bad-words + custom blacklist
 *    - Returns hadProfanity flag to client
 * 
 * 4. Spam Detection (Limited):
 *    - Only checks for excessive caps
 *    - Does NOT check rate limiting (editing doesn't count toward spam)
 *    - Does NOT check duplicate content (user can restore original)
 * 
 * 5. Edit Tracking:
 *    - Sets edited: true
 *    - Stores editedAt timestamp
 *    - Client can show "(edited)" badge
 *    - TODO: Add edit history tracking for moderation
 * 
 * 6. Deleted Messages:
 *    - Cannot edit deleted messages
 *    - Prevents resurrection of moderated content
 *    - Moderators must undelete first (if appropriate)
 * 
 * 7. WebSocket Integration:
 *    - TODO: Emit 'message:edited' event to channel
 *    - All clients update message in real-time
 *    - Prevents stale content display
 * 
 * 8. Future Enhancements:
 *    - Edit history tracking (multiple edits)
 *    - Moderator ability to edit any message
 *    - Custom edit time limits per user role
 *    - Notification if message was edited after being read
 */
