/**
 * Chat Channels API Route
 * Created: 2025-01-25
 * Feature: FID-20251025-103
 * 
 * OVERVIEW:
 * Returns list of channels accessible to authenticated player.
 * Auto-assigns channels based on level, VIP status, and clan membership.
 * Used by ChatPanel to display available channel tabs.
 * 
 * ENDPOINTS:
 * - GET /api/chat/channels - Get all accessible channels for current user
 * 
 * RESPONSE FORMAT:
 * {
 *   success: true,
 *   channels: ChannelMetadata[], // Sorted by display order
 *   defaultChannel: ChannelType    // Recommended default channel
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { getUserChannelBans } from '@/lib/moderationService';
import {
  getPlayerChannels,
  getDefaultChannel,
  getAllChannels,
  type PlayerContext,
  type ChannelMetadata,
} from '@/lib/channelService';

// ============================================================================
// GET /api/chat/channels - Get Accessible Channels
// ============================================================================

/**
 * GET /api/chat/channels
 * Returns all channels the authenticated user can access
 * 
 * Auto-assigns channels based on:
 * - Player level (Newbie channel for levels 1-5)
 * - VIP status (VIP Lounge for VIP members)
 * - Clan membership (Clan Chat if in a clan)
 * - Channel bans (excludes banned channels)
 * 
 * @example
 * GET /api/chat/channels
 * Response: {
 *   success: true,
 *   channels: [
 *     { id: 'global', name: 'Global Chat', icon: '🌍', ... },
 *     { id: 'trade', name: 'Trade', icon: '💰', ... }
 *   ],
 *   defaultChannel: 'global'
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Authenticate user
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('username', tokenPayload.username)
      .single();

    if (playerError || !player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const username = player.username;

    // Get user's channel bans
    const channelBans = await getUserChannelBans(username);

    // Create player context
    const user: PlayerContext = {
      username,
      level: player.level || 1,
      isVIP: player.is_vip === true,
      clanId: player.clan_id?.toString(),
      isMuted: false, // Will be checked by chatService when needed
      channelBans,
    };

    // Get accessible channel IDs for this player
    const accessibleChannelIds = getPlayerChannels(user);

    // Get full metadata for all channels
    const allChannels = getAllChannels();

    // Filter to only accessible channels (maintains sort order)
    const accessibleChannels = allChannels.filter((channel) =>
      accessibleChannelIds.includes(channel.id)
    );

    // Get recommended default channel
    const defaultChannel = getDefaultChannel(user);

    return NextResponse.json(
      {
        success: true,
        channels: accessibleChannels,
        defaultChannel,
        playerLevel: user.level,
        isVIP: user.isVIP,
        hasClan: !!user.clanId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /chat/channels GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while fetching channels',
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Channel Auto-Assignment Logic:
 *    - All players: Global, Trade, Help
 *    - Levels 1-5: + Newbie (auto-removed at level 6)
 *    - VIP members: + VIP Lounge
 *    - Clan members: + Clan Chat (specific to their clan)
 *    - Excludes channels player is banned from
 * 
 * 2. Default Channel Selection:
 *    - VIP players → VIP Lounge
 *    - Levels 1-5 → Newbie Chat
 *    - Everyone else → Global Chat
 * 
 * 3. Channel Metadata:
 *    - Includes icon, color, description
 *    - Used for UI rendering in ChatPanel
 *    - Sorted by display order (Global first, VIP last)
 * 
 * 4. Response Format:
 *    - channels: Full ChannelMetadata array
 *    - defaultChannel: Recommended initial channel
 *    - playerLevel, isVIP, hasClan: For client-side logic
 * 
 * 5. Security:
 *    - Authentication required (401 if not logged in)
 *    - Only returns channels player can access
 *    - Channel bans automatically enforced
 * 
 * 6. Performance:
 *    - Very lightweight (no database queries)
 *    - Channel metadata is static configuration
 *    - Only filters based on player context
 *    - Can be cached on client for session duration
 * 
 * 7. Usage in ChatPanel:
 *    - Fetch on component mount
 *    - Display channel tabs based on response
 *    - Set initial active channel to defaultChannel
 *    - Update if player levels up or gains VIP
 * 
 * 8. Future Enhancements:
 *    - Custom channels (guild halls, events)
 *    - Channel categories (social, trading, help)
 *    - Channel notifications (unread counts)
 *    - Channel search/filter
 */
