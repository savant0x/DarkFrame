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
 * - Drizzle ORM for persistence
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { chatMessages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { PlayerContext } from '@/lib/channelService';
import { getIO } from '@/lib/websocket/server';
import { notifyMessageDeleted } from '@/lib/websocket/chatHandlers';
import { ChannelType } from '@/lib/channelService';

// ============================================================================
// AUTHENTICATION (PLACEHOLDER)
// ============================================================================

/**
 * Get the chat PlayerContext from the SESSION (FID-20260905-001 follow-up).
 * The prior implementation was a placeholder returning a hardcoded TestUser,
 * letting any unauthenticated caller delete messages. Identity now resolves
 * from the session cookie via authenticateRequest.
 *
 * @param request - Next.js request object
 * @returns Player context or null if not authenticated
 */
async function getAuthenticatedUser(
  request: NextRequest
): Promise<PlayerContext | null> {
  const auth = await authenticateRequest(request);
  if (!auth) return null;

  return {
    username: auth.username,
    level: auth.player.level ?? 1,
    isVIP: !!auth.player.vip,
    clanId: auth.player.clanId ?? undefined,
    isMuted: false, // deletion is not mute-gated
    channelBans: [],
  };
}

// ============================================================================
// DELETE /api/chat/delete - Delete Message
// ============================================================================

/**
 * DELETE /api/chat/delete
 * Soft-delete a chat message (user's own message)
 * 
 * Query Parameters:
 * - messageId (required): ID of message to delete
 * 
 * @example
 * DELETE /api/chat/delete?messageId=msg_abc123
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    // Validate required parameters
    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'messageId is required' },
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

    // Check if already deleted
    if (message.deleted === 1) {
      return NextResponse.json(
        { success: false, error: 'Message is already deleted' },
        { status: 400 }
      );
    }

    // Check if user owns the message
    if (message.senderUsername !== user.username) {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own messages' },
        { status: 403 }
      );
    }

    // Soft-delete message (preserve original content for moderation)
    const result = await db.update(chatMessages)
      .set({
        deleted: 1,
        deletedBy: user.username,
        deletionReason: 'Deleted by user',
      })
      .where(eq(chatMessages.id, messageId));

    const affected = Array.isArray(result) ? result.length : (result as unknown as { rowCount?: number }).rowCount ?? 0;
    if (affected === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete message' },
        { status: 500 }
      );
    }

    // FID-20260919-002: push the deletion to every client in the message's
    // channel room (the previously-dead emission path — getIO() returns the
    // singleton the custom server mounted).
    const io = getIO();
    if (io) {
      await notifyMessageDeleted(
        io,
        message.channelId as ChannelType,
        messageId,
        user.username,
        'Deleted by user'
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

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Soft Delete:
 *    - Sets deleted: 1 (preserves original content)
 *    - Stores deletedBy username
 *    - Original content remains in database for moderation review
 * 
 * 2. Ownership Validation:
 *    - Only the message sender can delete here (admins use the bare /api/chat
 *      moderator endpoint); checked via senderUsername against the session
 *      identity from real authenticateRequest (the userId TODO is obsolete)
 * 
 * 3. Client Display:
 *    - Deleted messages show "[deleted]" text
 *    - Original sender info preserved
 *    - Timestamp preserved
 *    - "(deleted)" badge shown
 * 
 * 4. Moderation Access:
 *    - Moderators can see original content
 *    - Helps identify abuse patterns
 *    - Can restore message if deleted in error (undelete endpoint = future
 *      work, FID-20260919-012 section 5)
 * 
 * 5. WebSocket Integration:
 *    - Live (FID-20260919-002): notifyMessageDeleted() emits to the channel
 *      room; all clients remove/hide the message in real-time
 *    - Prevents stale content display
 * 
 * 6. Query Filtering:
 *    - GET /api/chat excludes deleted messages by default
 *    - Use filter: { deleted: 0 }
 *    - Moderators can optionally include deleted messages
 * 
 * 7. Future Enhancements:
 *    - Hard delete after 30 days (GDPR compliance)
 *    - Moderator ability to delete any message
 *    - Bulk delete (delete all messages by user)
 *    - Delete reason tracking
 *    - Notification to moderators if user deletes many messages
 */
