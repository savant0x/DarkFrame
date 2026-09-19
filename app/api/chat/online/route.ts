/**
 * @file app/api/chat/online/route.ts
 * @created 2025-10-26
 * @rewritten 2026-09-18 (FID-20260917-017 slice 3: Mongo shim → direct drizzle/pg)
 * @overview Online user count API with channel permissions
 *
 * OVERVIEW:
 * Counts online users per channel. Queries `user_presence` (joined with
 * `players` for level/VIP) for users with a recent heartbeat (<60s) and
 * respects channel permissions (level-gated newbie channel, VIP channel,
 * clan membership).
 *
 * ENDPOINTS:
 * - GET /api/chat/online?channelId=X: Get online count for channel
 * - GET /api/chat/online: Get online counts for all channels
 *
 * KEY FEATURES:
 * - Real-time count: based on heartbeat timestamps (last_seen >= now - 60s)
 * - Honest attributes: level/VIP derive from the players join, not from
 *   heartbeat body fields (no such columns exist on user_presence)
 * - Permission filtering: only counts users who can access the channel
 * - User list support: optionally return user details (for friend lists)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { userPresence, players, clans } from '@/lib/db/schema';
import { gte, eq } from 'drizzle-orm';
import { ChannelType } from '@/lib/channelService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Online user row (presence row joined with its player attributes)
 */
interface UserPresence {
  /** Presence owner (user_id IS the username on the pg pivot) */
  userId: string;
  /** Presence window start (row is "online" while lastSeen >= threshold) */
  lastSeen: Date;
  /** From the players join (no such columns exist on user_presence) */
  level?: number;
  /** From the players join (players.vip is a smallint grant flag) */
  isVIP?: boolean;
  /** Resolved per request for clan-channel filtering */
  clanIds?: Set<string>;
}

/**
 * Online user summary
 */
interface OnlineUser {
  userId: string;
  username: string;
  level?: number;
  isVIP?: boolean;
  status: string;
  lastSeen: string;
}

/**
 * GET response (single channel)
 */
interface GetOnlineResponse {
  channelId: string;
  count: number;
  users?: OnlineUser[]; // Optional: include user details
}

/**
 * GET response (all channels)
 */
interface GetAllOnlineResponse {
  total: number;
  channels: Record<string, number>;
  users?: Record<string, OnlineUser[]>; // Optional: user details per channel
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ONLINE_THRESHOLD_MS = 60000; // 60 seconds (matches heartbeat timeout)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user can access channel based on permissions
 *
 * @param channelId - Channel ID to check
 * @param user - User presence record
 * @returns Whether user has access
 */
function canAccessChannel(channelId: string, user: UserPresence): boolean {
  // Global: Everyone
  if (channelId === 'global') {
    return true;
  }

  // Newbie: Level 1-5 only
  if (channelId === 'newbie') {
    return (user.level ?? 999) <= 5;
  }

  // VIP: VIP users only
  if (channelId === 'vip') {
    return user.isVIP === true;
  }

  // Trade, Help: Everyone
  if (channelId === 'trade' || channelId === 'help') {
    return true;
  }

  // Clan channels: Format is "clan_[clanId]". Membership is checked against
  // the preloaded clans.members roster (FID-20260909-023 §3.2 resolves the
  // former TODO; the caller supplies the clanIds map from one indexed query).
  if (channelId.startsWith('clan_')) {
    const clanId = channelId.slice('clan_'.length);
    return user.clanIds?.has(clanId) === true;
  }

  return false;
}

/**
 * Format user presence for response
 *
 * @param user - User presence record
 * @returns Formatted user object
 */
function formatUser(user: UserPresence): OnlineUser {
  return {
    userId: user.userId,
    username: user.userId, // user_id IS the username on the pg pivot
    level: user.level,
    isVIP: user.isVIP,
    status: 'Online', // inside the presence window = online
    lastSeen: user.lastSeen.toISOString(),
  };
}

// ============================================================================
// GET /api/chat/online
// ============================================================================

/**
 * Get online user count(s)
 *
 * @param request - Next.js request object
 * @returns Online count(s)
 *
 * @example
 * ```
 * GET /api/chat/online?channelId=global&includeUsers=true
 * Response: {
 *   channelId: 'global',
 *   count: 42,
 *   users: [{ userId: 'alice', username: 'alice', level: 42, isVIP: true, status: 'Online', lastSeen: '...' }]
 * }
 *
 * GET /api/chat/online?includeUsers=true
 * Response: {
 *   total: 100,
 *   channels: { global: 100, newbie: 15, vip: 8, trade: 50, help: 25 },
 *   users: { global: [...], newbie: [...], vip: [...] }
 * }
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const includeUsers = searchParams.get('includeUsers') === 'true';

    // Online window: rows heartbeating within the last 60s. Expired rows are
    // filtered here (there is no TTL engine on pg — writes only refresh
    // last_seen/expires_at) and removed later by the presence cleanup.
    const onlineThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

    const onlineUsers: UserPresence[] = await db
      .select({
        userId: userPresence.userId,
        lastSeen: userPresence.lastSeen,
        level: players.level,
        vip: players.vip,
      })
      .from(userPresence)
      .leftJoin(players, eq(players.username, userPresence.userId))
      .where(gte(userPresence.lastSeen, onlineThreshold))
      .then((rows) =>
        rows.map((r) => ({
          userId: r.userId,
          lastSeen: r.lastSeen,
          level: r.level ?? undefined,
          isVIP: r.vip === 1 ? true : undefined,
        }))
      );

    // FID-20260909-023 §3.2: resolve clan membership once per request and
    // annotate presence rows, so clan-channel filtering is real (one clans
    // scan; membership rows carry playerId = username).
    const onlineUsernames = new Set(onlineUsers.map((u) => u.userId));
    const memberClanIds = new Map<string, Set<string>>();
    for (const member of await db.select({ id: clans.id, members: clans.members }).from(clans)) {
      for (const m of member.members ?? []) {
        if (onlineUsernames.has(m.playerId)) {
          const set = memberClanIds.get(m.playerId) ?? new Set<string>();
          set.add(member.id);
          memberClanIds.set(m.playerId, set);
        }
      }
    }
    for (const user of onlineUsers) {
      const ids = memberClanIds.get(user.userId);
      if (ids) user.clanIds = ids;
    }

    // Single channel mode
    if (channelId) {
      const filteredUsers = onlineUsers.filter((user) =>
        canAccessChannel(channelId, user)
      );

      const response: GetOnlineResponse = {
        channelId,
        count: filteredUsers.length,
      };

      if (includeUsers) {
        response.users = filteredUsers.map(formatUser);
      }

      return NextResponse.json(response);
    }

    // All channels mode
    const channels: Record<string, number> = {};
    const usersByChannel: Record<string, OnlineUser[]> = {};

    // Channel list (based on ChannelType from channelService)
    const channelList = [
      ChannelType.GLOBAL,
      ChannelType.NEWBIE,
      ChannelType.VIP,
      ChannelType.TRADE,
      ChannelType.HELP,
    ];

    // Count users per channel
    for (const channel of channelList) {
      const filteredUsers = onlineUsers.filter((user) =>
        canAccessChannel(channel, user)
      );

      channels[channel] = filteredUsers.length;

      if (includeUsers) {
        usersByChannel[channel] = filteredUsers.map(formatUser);
      }
    }

    // Clan channels: covered by canAccessChannel's clan_ branch (membership
    // roster above); the historical TODO note predates FID-20260909-023.

    const response: GetAllOnlineResponse = {
      total: onlineUsers.length,
      channels,
    };

    if (includeUsers) {
      response.users = usersByChannel;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/chat/online] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch online count',
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 *
 * 1. Online Threshold:
 *    - 60 seconds (matches heartbeat timeout)
 *    - WHERE last_seen >= now - 60s (the read-time enforcement of the window
 *      the Mongo TTL engine used to provide)
 *    - Users with heartbeat <60s ago = online
 *
 * 2. Channel Permissions:
 *    - Global/Trade/Help: everyone; Newbie: level 1-5; VIP: players.vip = 1
 *    - Clan (clan_[clanId]): resolved against the clans.members roster
 *
 * 3. Attributes:
 *    - level/isVIP come from the players LEFT JOIN — user_presence carries no
 *      such columns (the shim silently dropped them on write; the join is the
 *      honest source and reflects promotions/grants immediately)
 *    - Missing player row (deleted account) → level undefined → newbie-closed,
 *      still counted in global/trade/help
 *
 * 4. Performance Optimization:
 *    - Single indexed query fetches all online users (last_seen index)
 *    - One clans scan annotates membership
 *    - In-memory channel filtering (fast for <1000 users)
 *
 * 5. Security Considerations:
 *    - Public endpoint (matches prior contract); includeUsers reveals
 *      usernames (unchanged exposure)
 *
 * 6. UI Integration:
 *    - ChatPanel polls every 30s for channel counts (consumes count + users)
 */
