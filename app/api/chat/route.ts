/**
 * Chat API Routes
 * Created: 2025-01-25
 * Updated: 2025-10-26 (FID-20251026-019 Phase 1)
 * Features: FID-20251025-103 (Chat System), FID-20251026-019 (Auto-Moderation)
 * 
 * OVERVIEW:
 * RESTful API endpoints for chat message operations.
 * Handles GET (retrieve messages) and POST (send message) requests.
 * Integrates with chatService, channelService, and moderationService.
 * Now includes profanity filtering and spam detection (FID-20251026-019).
 * 
 * ENDPOINTS:
 * - GET /api/chat - Retrieve messages from a channel
 * - POST /api/chat - Send a new message to a channel (with auto-moderation)
 * 
 * AUTO-MODERATION (NEW):
 * - Profanity filter with bad-words library
 * - Spam detection (rate limiting, duplicate content, excessive caps)
 * - Auto-mute for spam violations (5 minutes)
 * - Warning system (3 strikes → 24h ban)
 * - Admin whitelist bypass
 * 
 * SECURITY:
 * - TODO: Authentication not implemented yet (next-auth not installed)
 * - Uses placeholder getAuthenticatedUser() for now
 * - All operations require authenticated user
 * - Validates channel access permissions
 * - Checks mute and ban status before allowing writes
 * - Filters profanity and detects spam before saving messages
 * 
 * DEPENDENCIES:
 * - lib/chatService.ts - Message operations and rate limiting
 * - lib/channelService.ts - Channel permissions
 * - lib/moderationService.ts - Mute/ban status, profanity filter, spam detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authMiddleware';
import {
  sendGlobalChatMessage,
  getGlobalChatMessages,
  type SendMessageRequest,
  type GetMessagesRequest,
  type ChatMessage,
} from '@/lib/chatService';
import {
  canReadChannel,
  canWriteChannel,
  ChannelType,
  type PlayerContext,
} from '@/lib/channelService';
import { 
  checkMuteStatus,
  filterMessage,
  detectSpam,
  muteUserForSpam,
} from '@/lib/moderationService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * GET request query params
 */
interface GetChatParams {
  channelId: string;
  clanId?: string;
  limit?: string;
  before?: string; // ISO date string
  since?: string; // ISO date string
}

/**
 * POST request body
 */
interface PostChatBody {
  channelId: string;
  clanId?: string;
  message: string;
}

// ============================================================================
// AUTHENTICATION (SESSION)

/**
 * Get the chat PlayerContext from the SESSION (FID-20260904-005 §5.1). The prior
 * implementation was a placeholder returning a hardcoded TestUser — every chat
 * write executed as that identity. Identity now resolves from the session cookie.
 */
async function getChatPlayerContext(
  request: NextRequest
): Promise<PlayerContext | null> {
  const auth = await authenticateRequest(request);
  if (!auth) return null;

  return {
    username: auth.username,
    level: auth.player.level ?? 1,
    isVIP: !!auth.player.vip,
    clanId: auth.player.clanId ?? undefined,
    isMuted: false, // checked via checkMuteStatus by callers
    channelBans: [],
  };
}

// ============================================================================
// GET /api/chat - Retrieve Messages
// ============================================================================

/**
 * GET /api/chat
 * Retrieve messages from a channel
 * 
 * Query Parameters:
 * - channelId (required): Channel type (global, newbie, clan, trade, help, vip)
 * - clanId (optional): Required for clan channels
 * - limit (optional): Max messages to return (default: 50)
 * - before (optional): ISO date string - Get messages before this timestamp
 * - since (optional): ISO date string - Get messages after this timestamp
 * 
 * @example
 * GET /api/chat?channelId=global&limit=50
 * GET /api/chat?channelId=clan&clanId=clan123&before=2025-01-25T12:00:00Z
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getChatPlayerContext(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const clanId = searchParams.get('clanId') || undefined;
    const limitStr = searchParams.get('limit');
    const beforeStr = searchParams.get('before');
    const sinceStr = searchParams.get('since');

    // Validate required parameters
    if (!channelId) {
      return NextResponse.json(
        { success: false, error: 'channelId is required' },
        { status: 400 }
      );
    }

    // Validate channel type
    if (!Object.values(ChannelType).includes(channelId as ChannelType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid channel type' },
        { status: 400 }
      );
    }

    // Check read permissions
    const readPermission = canReadChannel(channelId as ChannelType, user);
    if (!readPermission.canRead) {
      return NextResponse.json(
        {
          success: false,
          error: readPermission.reason || 'Access denied to this channel',
        },
        { status: 403 }
      );
    }

    // Parse optional parameters
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const before = beforeStr ? new Date(beforeStr) : undefined;
    const since = sinceStr ? new Date(sinceStr) : undefined;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { success: false, error: 'limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Validate date parameters
    if (before && isNaN(before.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid before date' },
        { status: 400 }
      );
    }

    if (since && isNaN(since.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid since date' },
        { status: 400 }
      );
    }

    // Build request object
    const getMessagesRequest: GetMessagesRequest = {
      channelId: channelId as ChannelType,
      clanId,
      limit,
      before,
      since,
    };

    // Fetch messages (FID-20260904-005 §5.4-M3: dummy fixture removed — GET serves
    // real DB rows for every channel; no channel-specific mock path remains)
    const messages = await getGlobalChatMessages(getMessagesRequest);

    return NextResponse.json(
      {
        success: true,
        messages,
        count: messages.length,
        channelId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /chat GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while fetching messages',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/chat - Send Message
// ============================================================================

/**
 * POST /api/chat
 * Send a new message to a channel
 * 
 * Request Body:
 * - channelId (required): Channel type (global, newbie, clan, trade, help, vip)
 * - clanId (optional): Required for clan channels
 * - message (required): Message text (1-500 characters)
 * 
 * @example
 * POST /api/chat
 * {
 *   "channelId": "global",
 *   "message": "Hello world!"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getChatPlayerContext(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: PostChatBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { channelId, clanId, message } = body;

    // Validate required fields
    if (!channelId || !message) {
      return NextResponse.json(
        { success: false, error: 'channelId and message are required' },
        { status: 400 }
      );
    }

    // Validate channel type
    if (!Object.values(ChannelType).includes(channelId as ChannelType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid channel type' },
        { status: 400 }
      );
    }

    // Validate message length
    if (message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Message cannot exceed 500 characters' },
        { status: 400 }
      );
    }

    // Check mute status
    const muteStatus = await checkMuteStatus(user.username);
    if (muteStatus.isMuted) {
      const expiresIn = muteStatus.expiresIn;
      const expiryMessage = expiresIn
        ? `You are muted for ${Math.ceil(expiresIn / 60)} more minutes`
        : 'You are permanently muted';
      
      return NextResponse.json(
        {
          success: false,
          error: expiryMessage,
          muteRecord: muteStatus.muteRecord,
        },
        { status: 403 }
      );
    }

    // Check write permissions (includes channel bans check)
    const writePermission = canWriteChannel(channelId as ChannelType, user);
    if (!writePermission.canWrite) {
      return NextResponse.json(
        {
          success: false,
          error: writePermission.reason || 'You cannot write to this channel',
        },
        { status: 403 }
      );
    }

    // PROFANITY FILTER (FID-20251026-019)
    const filteredResult = await filterMessage(message, user.username);
    
    if (!filteredResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: filteredResult.error || 'Failed to process message',
        },
        { status: 400 }
      );
    }

    // Use filtered message
    const cleanMessage = filteredResult.filtered;

    // Optionally notify user if profanity was detected and filtered
    const hadProfanity = filteredResult.hadProfanity;

    // SPAM DETECTION (FID-20251026-019)
    const spamCheck = await detectSpam(user.username, user.username, cleanMessage);
    
    if (spamCheck.isSpam) {
      // Auto-mute for spam if shouldMute is true
      if (spamCheck.shouldMute) {
        await muteUserForSpam(user.username, user.username, spamCheck.reason || 'Spam detected');
      }
      
      return NextResponse.json(
        {
          success: false,
          error: spamCheck.reason || 'Spam detected',
          isSpam: true,
          muted: spamCheck.shouldMute,
        },
        { status: 429 } // 429 Too Many Requests
      );
    }

    // Build send message request
    const sendMessageRequest: SendMessageRequest = {
      channelId: channelId as ChannelType,
      clanId,
      sender: user,
      message: cleanMessage, // Use filtered message
    };

    // Send message (includes rate limiting)
    const result = await sendGlobalChatMessage(sendMessageRequest);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send message',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        hadProfanity, // Inform client if profanity was filtered
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API /chat POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while sending message',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/chat - Mark Messages as Read
// ============================================================================

/**
 * PATCH /api/chat
 * Mark messages as read up to a certain message ID
 * 
 * Request Body:
 * - channelId (required): Channel type
 * - clanId (optional): Required for clan channels
 * - lastReadMessageId (required): Last message ID that was read
 * 
 * @example
 * PATCH /api/chat
 * {
 *   "channelId": "global",
 *   "lastReadMessageId": "msg_abc123"
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getChatPlayerContext(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    let body: {
      channelId: string;
      clanId?: string;
      lastReadMessageId: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { channelId, clanId, lastReadMessageId } = body;

    // Validate required fields
    if (!channelId || !lastReadMessageId) {
      return NextResponse.json(
        {
          success: false,
          error: 'channelId and lastReadMessageId are required',
        },
        { status: 400 }
      );
    }

    // Validate channel type
    if (!Object.values(ChannelType).includes(channelId as ChannelType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid channel type' },
        { status: 400 }
      );
    }

    // Check read permissions
    const readPermission = canReadChannel(channelId as ChannelType, user);
    if (!readPermission.canRead) {
      return NextResponse.json(
        {
          success: false,
          error: readPermission.reason || 'Access denied to this channel',
        },
        { status: 403 }
      );
    }

    // TODO: Implement markMessagesAsRead() in chatService
    // For now, just return success
    // const result = await markMessagesAsRead({
    //   channelId: channelId as ChannelType,
    //   clanId,
    //   username: user.username,
    //   lastReadMessageId,
    // });

    return NextResponse.json(
      {
        success: true,
        message: 'Messages marked as read',
        channelId,
        lastReadMessageId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /chat PATCH] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while marking messages as read',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/chat - Delete Message (Moderator Only)
// ============================================================================

/**
 * DELETE /api/chat
 * Soft-delete a message (moderator only)
 * 
 * Query Parameters:
 * - messageId (required): ID of message to delete
 * 
 * @example
 * DELETE /api/chat?messageId=msg_abc123
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getChatPlayerContext(request);
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

    // TODO: Check if user is moderator/admin
    // For now, allow all authenticated users (will be restricted later)
    // const isModerator = await checkModeratorStatus(user.username);
    // if (!isModerator) {
    //   return NextResponse.json(
    //     { success: false, error: 'Moderator access required' },
    //     { status: 403 }
    //   );
    // }

    // TODO: Implement deleteMessage() in chatService
    // For now, just return success
    // const result = await deleteMessage({
    //   messageId,
    //   deletedBy: user.username,
    // });

    return NextResponse.json(
      {
        success: true,
        message: 'Message deleted',
        messageId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /chat DELETE] Error:', error);
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
 * 1. Authentication:
 *    - TODO: Currently using placeholder getAuthenticatedUser()
 *    - Need to install next-auth and implement proper authentication
 *    - Need to create lib/auth.ts with authOptions
 *    - Need to fetch player data from database
 *    - Need to check mute/ban status from moderationService
 * 
 * 2. Rate Limiting:
 *    - Handled automatically by chatService.sendMessage()
 *    - Uses checkRateLimit() internally (5 messages/minute regular, 10/minute VIP)
 *    - Returns error if rate limit exceeded
 *    - No need to implement rate limiting here
 * 
 * 3. Profanity Filtering:
 *    - Handled automatically by chatService.sendMessage()
 *    - Uses bad-words library + custom blacklist
 *    - Filters message before saving to database
 *    - No need to call filterProfanity() manually
 * 
 * 4. Channel Permissions:
 *    - canReadChannel() checks level, VIP status, clan membership, bans
 *    - canWriteChannel() includes canReadChannel() + mute check
 *    - Returns ChannelPermissions { canRead, canWrite, reason? }
 *    - Reason field provides user-friendly error message
 * 
 * 5. Mute Status:
 *    - checkMuteStatus() queries moderation database
 *    - Auto-expires temporary mutes
 *    - Returns { isMuted, muteRecord?, expiresIn? }
 *    - expiresIn is in seconds (convert to minutes for UI)
 * 
 * 6. Error Handling:
 *    - 401: Authentication required
 *    - 400: Invalid parameters (missing channelId, invalid message length)
 *    - 403: Permission denied (muted, banned, no access)
 *    - 500: Unexpected server error
 *    - All errors return { success: false, error: string }
 * 
 * 7. Response Format:
 *    - GET: { success: true, messages: ChatMessage[], count: number, channelId: string }
 *    - POST: { success: true, message: ChatMessage }
 *    - PATCH: { success: true, message: string, channelId: string, lastReadMessageId: string }
 *    - DELETE: { success: true, message: string, messageId: string }
 *    - Error: { success: false, error: string }
 * 
 * 8. TODO - Read Status (PATCH):
 *    - Need to add markMessagesAsRead() to chatService
 *    - Will update chat_read_status collection
 *    - Tracks last read message per user per channel
 *    - Used for unread message badges
 * 
 * 9. TODO - Message Deletion (DELETE):
 *    - Need to add deleteMessage() to chatService
 *    - Soft delete (sets isDeleted=true, preserves for moderation review)
 *    - Check moderator status via moderationService
 *    - Log deletion action for audit trail
 *    - WebSocket emit to remove message from all clients
 * 
 * 10. Future Enhancements:
 *    - WebSocket integration for real-time updates
 *    - Message editing (PUT /api/chat/:messageId)
 *    - Typing indicators
 *    - Read receipts
 *    - Message reactions
 */
