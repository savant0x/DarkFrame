/**
 * Admin Moderation API Routes
 * Created: 2025-01-25
 * Updated: 2026-05-03 — Migrated to Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import {
  muteUser,
  unmuteUser,
  banFromChannel,
  unbanFromChannel,
  addToBlacklist,
  removeFromBlacklist,
  getActiveMutes,
  getActiveChannelBans,
  getModerationHistory,
  isAdmin,
  type MuteDuration,
  type ModActionType,
} from '@/lib/moderationService';
import type { PlayerContext } from '@/lib/channelService';

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

interface RevokeModerationBody {
  action: 'unmute' | 'unban_from_channel' | 'remove_from_blacklist';
  targetUserId?: string;
  channelId?: string;
  word?: string;
}

interface ModerationQuery {
  type?: 'mutes' | 'bans' | 'blacklist' | 'history';
  targetUserId?: string;
  moderatorId?: string;
  limit?: string;
}

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
      return '24h' as MuteDuration;
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { username } = auth;

    const hasAdminPermission = await isAdmin(username);
    if (!hasAdminPermission) {
      return NextResponse.json(
        { success: false, error: 'Admin permissions required' },
        { status: 403 }
      );
    }

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

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Reason is required' },
        { status: 400 }
      );
    }

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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { username } = auth;

    const hasAdminPermission = await isAdmin(username);
    if (!hasAdminPermission) {
      return NextResponse.json(
        { success: false, error: 'Admin permissions required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'history';
    const targetUserId = searchParams.get('targetUserId') || undefined;
    const moderatorId = searchParams.get('moderatorId') || undefined;
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 100;

    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json(
        { success: false, error: 'limit must be between 1 and 1000' },
        { status: 400 }
      );
    }

    switch (type) {
      case 'mutes': {
        const mutes = await getActiveMutes();
        return NextResponse.json(
          {
            success: true,
            type: 'mutes',
            data: mutes,
            count: mutes.length,
          },
          { status: 200 }
        );
      }

      case 'bans': {
        const bans = await getActiveChannelBans();
        return NextResponse.json(
          {
            success: true,
            type: 'bans',
            data: bans,
            count: bans.length,
          },
          { status: 200 }
        );
      }

      case 'blacklist': {
        return NextResponse.json(
          {
            success: true,
            type: 'blacklist',
            data: [],
            count: 0,
            note: 'Blacklist endpoint not yet implemented',
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

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { username } = auth;

    const hasAdminPermission = await isAdmin(username);
    if (!hasAdminPermission) {
      return NextResponse.json(
        { success: false, error: 'Admin permissions required' },
        { status: 403 }
      );
    }

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
