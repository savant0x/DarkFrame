/**
 * Admin Moderation API Routes
 * Created: 2025-01-25
 * Feature: FID-20251025-103
 * 
 * OVERVIEW:
 * Admin-only endpoints for chat moderation actions.
 * Handles mutes, channel bans, word blacklist, and moderation history.
 * All operations require admin/moderator role validation.
 * 
 * ENDPOINTS:
 * - POST /api/admin/moderation - Perform moderation action
 * - GET /api/admin/moderation - Get moderation logs and active restrictions
 * - DELETE /api/admin/moderation - Remove/revoke moderation action
 * 
 * SECURITY:
 * - All endpoints require admin/moderator role
 * - Audit logging for all actions
 * - Cannot moderate other admins
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import {
  muteUser,
  unmuteUser,
  banFromChannel,
  unbanFromChannel,
  addToBlacklist,
  removeFromBlacklist,
  getActiveMutes,
  getActiveChannelBans,
  getBlacklist,
  getModerationHistory,
  isAdmin,
  type MuteDuration,
} from '@/lib/moderationService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * POST request body for moderation actions
 */
interface ModerationActionBody {
  action:
    | 'mute'
    | 'ban_from_channel'
    | 'add_to_blacklist';
  targetUserId?: string;
  targetUsername?: string;
  channelId?: string;
  word?: string;
  reason: string;
  duration?: 'one_hour' | 'twenty_four_hours' | 'seven_days' | 'permanent';
  category?: 'profanity' | 'slur' | 'spam' | 'custom';
}

/**
 * DELETE request body for revoking actions
 */
interface RevokeModerationBody {
  action: 'unmute' | 'unban_from_channel' | 'remove_from_blacklist';
  targetUserId?: string;
  channelId?: string;
  word?: string;
}

/**
 * GET request query params
 */
interface ModerationQuery {
  type?: 'mutes' | 'bans' | 'blacklist' | 'history';
  targetUserId?: string;
  moderatorId?: string;
  limit?: string;
}

// ============================================================================
// HELPER: Duration Mapping
// ============================================================================

/**
 * Map API duration string to MuteDuration enum
 */
function mapDuration(duration: string): MuteDuration {
  switch (duration) {
    case 'one_hour':
      return '1h' as MuteDuration;
    case 'twenty_four_hours':
      return '24h' as MuteDuration;
    case 'seven_days':
      return '7d' as MuteDuration;
    case 'permanent':
      return 'permanent' as MuteDuration;
    default:
      return '24h' as MuteDuration; // Default to 24 hours
  }
}

// ============================================================================
// POST /api/admin/moderation - Perform Moderation Action
// ============================================================================

/**
 * POST /api/admin/moderation
 * Perform a moderation action (mute, ban, blacklist)
 * 
 * Request Body:
 * {
 *   action: 'mute' | 'ban_from_channel' | 'add_to_blacklist',
 *   targetUserId?: string,
 *   targetUsername?: string,
 *   channelId?: string,
 *   word?: string,
 *   reason: string,
 *   duration?: 'one_hour' | 'twenty_four_hours' | 'seven_days' | 'permanent',
 *   category?: 'profanity' | 'slur' | 'spam' | 'custom'
 * }
 * 
 * @example Mute user
 * POST /api/admin/moderation
 * {
 *   "action": "mute",
 *   "targetUserId": "player123",
 *   "targetUsername": "Spammer",
 *   "reason": "Spam in global chat",
 *   "duration": "twenty_four_hours"
 * }
 * 
 * @example Ban from channel
 * POST /api/admin/moderation
 * {
 *   "action": "ban_from_channel",
 *   "targetUserId": "player456",
 *   "targetUsername": "Troll",
 *   "channelId": "trade",
 *   "reason": "Scamming attempts"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error
    }

    const { username } = auth;

    // Check admin permissions
    const hasAdminPermission = await isAdmin(username);
    if (!hasAdminPermission) {
      return NextResponse.json(
        { success: false, error: 'Admin permissions required' },
        { status: 403 }
      );
    }

    // Parse request body
    let body: ModerationActionBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { action, targetUserId, targetUsername, channelId, word, reason, duration, category } =
      body;

    // Validate reason
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Reason is required' },
        { status: 400 }
      );
    }

    // Execute moderation action
    switch (action) {
      case 'mute': {
        if (!targetUserId || !targetUsername) {
          return NextResponse.json(
            { success: false, error: 'targetUserId and targetUsername are required for mute' },
            { status: 400 }
          );
        }

        if (!duration) {
          return NextResponse.json(
            { success: false, error: 'duration is required for mute' },
            { status: 400 }
          );
        }

        const muteDuration = mapDuration(duration);
        const result = await muteUser(
          targetUserId,
          targetUsername,
          muteDuration,
          username,
          username,
          reason
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            message: `User ${targetUsername} muted for ${duration}`,
            mute: result.mute,
          },
          { status: 200 }
        );
      }

      case 'ban_from_channel': {
        if (!targetUserId || !targetUsername || !channelId) {
          return NextResponse.json(
            {
              success: false,
              error: 'targetUserId, targetUsername, and channelId are required for channel ban',
            },
            { status: 400 }
          );
        }

        const result = await banFromChannel(
          targetUserId,
          targetUsername,
          channelId,
          username,
          username,
          reason
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            message: `User ${targetUsername} banned from ${channelId} channel`,
            ban: result.ban,
          },
          { status: 200 }
        );
      }

      case 'add_to_blacklist': {
        if (!word) {
          return NextResponse.json(
            { success: false, error: 'word is required for blacklist' },
            { status: 400 }
          );
        }

        const wordCategory = category || 'custom';
        const result = await addToBlacklist(
          word,
          wordCategory,
          username,
          username
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            message: `Word "${word}" added to blacklist (${wordCategory})`,
          },
          { status: 200 }
        );
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API /admin/moderation POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while performing moderation action',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/admin/moderation - Get Moderation Data
// ============================================================================

/**
 * GET /api/admin/moderation
 * Retrieve moderation data (mutes, bans, blacklist, history)
 * 
 * Query Parameters:
 * - type: 'mutes' | 'bans' | 'blacklist' | 'history' (default: 'history')
 * - targetUserId: Filter by target user
 * - moderatorId: Filter by moderator
 * - limit: Max results (default: 100)
 * 
 * @example Get active mutes
 * GET /api/admin/moderation?type=mutes
 * 
 * @example Get moderation history for user
 * GET /api/admin/moderation?type=history&targetUserId=player123&limit=50
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error
    }

    const { username } = auth;

    // Check admin permissions
    const hasAdminPermission = await isAdmin(username);
    if (!hasAdminPermission) {
      return NextResponse.json(
        { success: false, error: 'Admin permissions required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'history';
    const targetUserId = searchParams.get('targetUserId') || undefined;
    const moderatorId = searchParams.get('moderatorId') || undefined;
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 100;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json(
        { success: false, error: 'limit must be between 1 and 1000' },
        { status: 400 }
      );
    }

    // Fetch requested data
    switch (type) {
      case 'mutes': {
        const mutes = await getActiveMutes();
        // Enrich with usernames (playerId and moderatorId both reference players.username)
        const ids = [...new Set(mutes.flatMap((m) => [m.playerId, m.moderatorId]))].filter(Boolean);
        const nameMap = new Map<string, string>();
        if (ids.length > 0) {
          const rows = await db.select({ username: players.username }).from(players).where(inArray(players.username, ids));
          for (const r of rows) nameMap.set(r.username, r.username);
        }
        return NextResponse.json(
          {
            success: true,
            type: 'mutes',
            data: mutes.map((m) => ({ ...m, username: nameMap.get(m.playerId) ?? m.playerId, mutedBy: nameMap.get(m.moderatorId) ?? m.moderatorId })),
            count: mutes.length,
          },
          { status: 200 }
        );
      }

      case 'bans': {
        const bans = await getActiveChannelBans();
        // Channel-ban rows store the channelId in moderatorId (see banFromChannel);
        // only the playerId needs username enrichment.
        const ids = [...new Set(bans.map((b) => b.playerId))].filter(Boolean);
        const nameMap = new Map<string, string>();
        if (ids.length > 0) {
          const rows = await db.select({ username: players.username }).from(players).where(inArray(players.username, ids));
          for (const r of rows) nameMap.set(r.username, r.username);
        }
        return NextResponse.json(
          {
            success: true,
            type: 'bans',
            data: bans.map((b) => ({ ...b, username: nameMap.get(b.playerId) ?? b.playerId, channelId: b.moderatorId })),
            count: bans.length,
          },
          { status: 200 }
        );
      }

      case 'blacklist': {
        const blacklist = await getBlacklist();
        return NextResponse.json(
          {
            success: true,
            type: 'blacklist',
            data: blacklist,
            count: blacklist.length,
          },
          { status: 200 }
        );
      }

      case 'history': {
        const history = await getModerationHistory({
          targetUserId,
          moderatorId,
          limit,
        });

        return NextResponse.json(
          {
            success: true,
            type: 'history',
            data: history,
            count: history.length,
          },
          { status: 200 }
        );
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API /admin/moderation GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while fetching moderation data',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/admin/moderation - Revoke Moderation Action
// ============================================================================

/**
 * DELETE /api/admin/moderation
 * Revoke a moderation action (unmute, unban, remove from blacklist)
 * 
 * Request Body:
 * {
 *   action: 'unmute' | 'unban_from_channel' | 'remove_from_blacklist',
 *   targetUserId?: string,
 *   channelId?: string,
 *   word?: string
 * }
 * 
 * @example Unmute user
 * DELETE /api/admin/moderation
 * {
 *   "action": "unmute",
 *   "targetUserId": "player123"
 * }
 * 
 * @example Unban from channel
 * DELETE /api/admin/moderation
 * {
 *   "action": "unban_from_channel",
 *   "targetUserId": "player456",
 *   "channelId": "trade"
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error
    }

    const { username } = auth;

    // Check admin permissions
    const hasAdminPermission = await isAdmin(username);
    if (!hasAdminPermission) {
      return NextResponse.json(
        { success: false, error: 'Admin permissions required' },
        { status: 403 }
      );
    }

    // Parse request body
    let body: RevokeModerationBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { action, targetUserId, channelId, word } = body;

    // Execute revocation
    switch (action) {
      case 'unmute': {
        if (!targetUserId) {
          return NextResponse.json(
            { success: false, error: 'targetUserId is required for unmute' },
            { status: 400 }
          );
        }

        const result = await unmuteUser(targetUserId, username, username);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            message: `User ${targetUserId} unmuted`,
          },
          { status: 200 }
        );
      }

      case 'unban_from_channel': {
        if (!targetUserId || !channelId) {
          return NextResponse.json(
            {
              success: false,
              error: 'targetUserId and channelId are required for unban',
            },
            { status: 400 }
          );
        }

        const result = await unbanFromChannel(
          targetUserId,
          channelId,
          username,
          username
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            message: `User ${targetUserId} unbanned from ${channelId} channel`,
          },
          { status: 200 }
        );
      }

      case 'remove_from_blacklist': {
        if (!word) {
          return NextResponse.json(
            { success: false, error: 'word is required for blacklist removal' },
            { status: 400 }
          );
        }

        const result = await removeFromBlacklist(word, username, username);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            message: `Word "${word}" removed from blacklist`,
          },
          { status: 200 }
        );
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API /admin/moderation DELETE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while revoking moderation action',
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Admin Permission Check:
 *    - isAdmin() checks player.role === 'admin' || 'moderator'
 *    - All endpoints require admin permission (403 if not)
 *    - TODO: Add role-based permissions (admin vs moderator capabilities)
 * 
 * 2. Moderation Actions (POST):
 *    - mute: Requires targetUserId, targetUsername, duration, reason
 *    - ban_from_channel: Requires targetUserId, targetUsername, channelId, reason
 *    - add_to_blacklist: Requires word, category, reason
 * 
 * 3. Revocation Actions (DELETE):
 *    - unmute: Requires targetUserId
 *    - unban_from_channel: Requires targetUserId, channelId
 *    - remove_from_blacklist: Requires word
 * 
 * 4. Mute Durations:
 *    - one_hour: 1 hour temporary mute
 *    - twenty_four_hours: 24 hours (default)
 *    - seven_days: 7 days
 *    - permanent: Never expires
 * 
 * 5. Audit Logging:
 *    - All actions automatically logged by moderationService
 *    - Includes moderator, target, reason, timestamp
 *    - getModerationHistory() retrieves logs with filters
 * 
 * 6. Data Retrieval (GET):
 *    - type=mutes: All active mutes
 *    - type=bans: All active channel bans
 *    - type=blacklist: Custom word blacklist
 *    - type=history: Moderation action logs (filterable)
 * 
 * 7. Error Handling:
 *    - 401: Not authenticated
 *    - 403: Not admin/moderator
 *    - 400: Invalid parameters or action failed
 *    - 500: Unexpected server error
 * 
 * 8. Future Enhancements:
 *    - Role-based permissions (moderators can't unmute admin actions)
 *    - Bulk moderation actions (mass mute from IP range)
 *    - Moderation templates (common mute reasons)
 *    - Appeal system for users
 *    - Moderation analytics (top violators, common issues)
 */
