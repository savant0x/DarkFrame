/**
 * Channel Service
 * Created: 2025-10-25
 * Feature: FID-20251025-103
 * 
 * OVERVIEW:
 * Manages chat channel types, permissions, and auto-assignment logic.
 * Handles 6 channel types: Global, Newbie, Clan, Trade, Help, VIP.
 * Implements level-based restrictions and automatic channel access.
 * 
 * CHANNEL TYPES:
 * - GLOBAL: All players (full playerbase communication)
 * - NEWBIE: Levels 1-5 only (auto-removed at level 6)
 * - CLAN: Clan membership required
 * - TRADE: All players (item trading and commerce)
 * - HELP: All players (new player assistance)
 * - VIP: VIP status required (premium exclusive)
 * 
 * KEY FEATURES:
 * - Level-based auto-assignment
 * - Permission validation (read/write)
 * - Channel metadata (descriptions, icons, colors)
 * - Socket.io room name generation
 * Player channel eligibility checking
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Available channel types
 */
export enum ChannelType {
  GLOBAL = 'global',
  NEWBIE = 'newbie',
  CLAN = 'clan',
  TRADE = 'trade',
  HELP = 'help',
  VIP = 'vip',
}

/**
 * Channel metadata
 */
export interface ChannelMetadata {
  id: ChannelType;
  name: string;
  description: string;
  icon: string;
  color: string; // Tailwind color class
  minLevel: number;
  maxLevel: number | null; // null = no max
  requiresVIP: boolean;
  requiresClan: boolean;
  sortOrder: number; // Display order in UI
}

/**
 * Channel permissions for a specific player
 */
export interface ChannelPermissions {
  canRead: boolean;
  canWrite: boolean;
  reason?: string; // Why permission denied (for debugging)
}

/**
 * Player context for permission checking
 */
export interface PlayerContext {
  username: string;
  level: number;
  isVIP: boolean;
  clanId?: string;
  isMuted?: boolean;
  channelBans?: string[]; // Array of channel IDs player is banned from
}

// ============================================================================
// CHANNEL DEFINITIONS
// ============================================================================

/**
 * Master channel configuration
 * Defines all available channels and their requirements
 */
export const CHANNEL_METADATA: Record<ChannelType, ChannelMetadata> = {
  [ChannelType.GLOBAL]: {
    id: ChannelType.GLOBAL,
    name: 'Global Chat',
    description: 'Talk with the entire DarkFrame community',
    icon: '🌍',
    color: 'blue',
    minLevel: 1,
    maxLevel: null,
    requiresVIP: false,
    requiresClan: false,
    sortOrder: 1,
  },
  [ChannelType.NEWBIE]: {
    id: ChannelType.NEWBIE,
    name: 'Newbie Chat',
    description: 'New player discussion (Levels 1-5)',
    icon: '🌱',
    color: 'green',
    minLevel: 1,
    maxLevel: 5,
    requiresVIP: false,
    requiresClan: false,
    sortOrder: 2,
  },
  [ChannelType.TRADE]: {
    id: ChannelType.TRADE,
    name: 'Trade',
    description: 'Buy, sell, and trade items',
    icon: '💰',
    color: 'yellow',
    minLevel: 1,
    maxLevel: null,
    requiresVIP: false,
    requiresClan: false,
    sortOrder: 3,
  },
  [ChannelType.HELP]: {
    id: ChannelType.HELP,
    name: 'Help',
    description: 'Ask questions and get assistance',
    icon: '❓',
    color: 'purple',
    minLevel: 1,
    maxLevel: null,
    requiresVIP: false,
    requiresClan: false,
    sortOrder: 4,
  },
  [ChannelType.CLAN]: {
    id: ChannelType.CLAN,
    name: 'Clan Chat',
    description: 'Private chat with your clan members',
    icon: '⚔️',
    color: 'red',
    minLevel: 1,
    maxLevel: null,
    requiresVIP: false,
    requiresClan: true,
    sortOrder: 5,
  },
  [ChannelType.VIP]: {
    id: ChannelType.VIP,
    name: 'VIP Lounge',
    description: 'Exclusive chat for VIP members',
    icon: '👑',
    color: 'amber',
    minLevel: 1,
    maxLevel: null,
    requiresVIP: true,
    requiresClan: false,
    sortOrder: 6,
  },
};

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Check if player can read from a channel
 * 
 * @param channelId - Channel to check
 * @param player - Player context
 * @returns Permission result with reason if denied
 * 
 * @example
 * const perm = canReadChannel('newbie', { level: 10, isVIP: false });
 * if (!perm.canRead) console.log(perm.reason); // "Level too high (max: 5)"
 */
export function canReadChannel(
  channelId: ChannelType,
  player: PlayerContext
): ChannelPermissions {
  const channel = CHANNEL_METADATA[channelId];
  
  if (!channel) {
    return { canRead: false, canWrite: false, reason: 'Invalid channel' };
  }

  // Check level requirements
  if (player.level < channel.minLevel) {
    return {
      canRead: false,
      canWrite: false,
      reason: `Level too low (min: ${channel.minLevel})`,
    };
  }

  if (channel.maxLevel !== null && player.level > channel.maxLevel) {
    return {
      canRead: false,
      canWrite: false,
      reason: `Level too high (max: ${channel.maxLevel})`,
    };
  }

  // Check VIP requirement
  if (channel.requiresVIP && !player.isVIP) {
    return {
      canRead: false,
      canWrite: false,
      reason: 'VIP status required',
    };
  }

  // Check clan requirement
  if (channel.requiresClan && !player.clanId) {
    return {
      canRead: false,
      canWrite: false,
      reason: 'Clan membership required',
    };
  }

  // Check channel ban
  if (player.channelBans?.includes(channelId)) {
    return {
      canRead: false,
      canWrite: false,
      reason: 'Banned from this channel',
    };
  }

  // Player can read
  return { canRead: true, canWrite: true };
}

/**
 * Check if player can write to a channel
 * Includes read checks plus mute status
 * 
 * @param channelId - Channel to check
 * @param player - Player context
 * @returns Permission result
 */
export function canWriteChannel(
  channelId: ChannelType,
  player: PlayerContext
): ChannelPermissions {
  // First check read permissions
  const readPerm = canReadChannel(channelId, player);
  if (!readPerm.canRead) {
    return { ...readPerm, canWrite: false };
  }

  // Check mute status
  if (player.isMuted) {
    return {
      canRead: true,
      canWrite: false,
      reason: 'You are currently muted',
    };
  }

  return { canRead: true, canWrite: true };
}

// ============================================================================
// CHANNEL ASSIGNMENT
// ============================================================================

/**
 * Get all channels a player can access
 * Auto-assigns based on level, VIP status, and clan membership
 * 
 * @param player - Player context
 * @returns Array of channel IDs player can access
 * 
 * @example
 * // Level 3 player (no VIP, no clan)
 * getPlayerChannels({ level: 3, isVIP: false })
 * // Returns: ['global', 'newbie', 'trade', 'help']
 * 
 * // Level 10 VIP player with clan
 * getPlayerChannels({ level: 10, isVIP: true, clanId: 'clan123' })
 * // Returns: ['global', 'trade', 'help', 'clan', 'vip']
 */
export function getPlayerChannels(player: PlayerContext): ChannelType[] {
  const accessibleChannels: ChannelType[] = [];

  // Check each channel
  for (const channelId of Object.values(ChannelType)) {
    const perm = canReadChannel(channelId, player);
    if (perm.canRead) {
      accessibleChannels.push(channelId);
    }
  }

  // Sort by display order
  return accessibleChannels.sort((a, b) => {
    return CHANNEL_METADATA[a].sortOrder - CHANNEL_METADATA[b].sortOrder;
  });
}

/**
 * Get default channel for a player
 * Auto-selects most appropriate channel based on level
 * 
 * @param player - Player context
 * @returns Default channel ID
 * 
 * @example
 * getDefaultChannel({ level: 3, isVIP: false }) // 'newbie'
 * getDefaultChannel({ level: 10, isVIP: false }) // 'global'
 * getDefaultChannel({ level: 10, isVIP: true }) // 'vip'
 */
export function getDefaultChannel(player: PlayerContext): ChannelType {
  // VIP players default to VIP lounge
  if (player.isVIP) {
    return ChannelType.VIP;
  }

  // Newbies (1-5) default to Newbie chat
  if (player.level >= 1 && player.level <= 5) {
    return ChannelType.NEWBIE;
  }

  // Everyone else defaults to Global
  return ChannelType.GLOBAL;
}

/**
 * Check if player should be auto-assigned to Help channel
 * New players (level 1-5) get auto-assigned
 * 
 * @param player - Player context
 * @returns True if should auto-join Help
 */
export function shouldAutoJoinHelp(player: PlayerContext): boolean {
  return player.level >= 1 && player.level <= 5;
}

// ============================================================================
// SOCKET.IO ROOM GENERATION
// ============================================================================

/**
 * Get Socket.io room name for a channel
 * 
 * @param channelId - Channel type
 * @param clanId - Optional clan ID (for clan channels)
 * @returns Socket.io room name
 * 
 * @example
 * getChannelRoom('global') // 'chat_global'
 * getChannelRoom('clan', 'clan123') // 'chat_clan_clan123'
 */
export function getChannelRoom(
  channelId: ChannelType,
  clanId?: string
): string {
  if (channelId === ChannelType.CLAN && clanId) {
    return `chat_clan_${clanId}`;
  }
  return `chat_${channelId}`;
}

/**
 * Parse room name back to channel info
 * 
 * @param roomName - Socket.io room name
 * @returns Channel ID and optional clan ID
 * 
 * @example
 * parseChannelRoom('chat_global') // { channelId: 'global' }
 * parseChannelRoom('chat_clan_clan123') // { channelId: 'clan', clanId: 'clan123' }
 */
export function parseChannelRoom(roomName: string): {
  channelId: ChannelType | null;
  clanId?: string;
} {
  if (!roomName.startsWith('chat_')) {
    return { channelId: null };
  }

  const parts = roomName.replace('chat_', '').split('_');
  const channelId = parts[0] as ChannelType;

  if (channelId === ChannelType.CLAN && parts[1]) {
    return { channelId, clanId: parts[1] };
  }

  return { channelId };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get channel metadata by ID
 * 
 * @param channelId - Channel type
 * @returns Channel metadata or null if invalid
 */
export function getChannelMetadata(
  channelId: ChannelType
): ChannelMetadata | null {
  return CHANNEL_METADATA[channelId] || null;
}

/**
 * Get all available channels (sorted by display order)
 * 
 * @returns Array of all channel metadata
 */
export function getAllChannels(): ChannelMetadata[] {
  return Object.values(CHANNEL_METADATA).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Validate channel ID
 * 
 * @param channelId - String to validate
 * @returns True if valid channel type
 */
export function isValidChannel(channelId: string): channelId is ChannelType {
  return Object.values(ChannelType).includes(channelId as ChannelType);
}

/**
 * Get channel display name with icon
 * 
 * @param channelId - Channel type
 * @returns Formatted display name
 * 
 * @example
 * getChannelDisplayName('global') // '🌍 Global Chat'
 */
export function getChannelDisplayName(channelId: ChannelType): string {
  const channel = CHANNEL_METADATA[channelId];
  if (!channel) return 'Unknown Channel';
  return `${channel.icon} ${channel.name}`;
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Channel Access Logic:
 *    - Global: All players can access
 *    - Newbie: Only levels 1-5 (auto-removed at level 6)
 *    - Trade: All players (no restrictions)
 *    - Help: All players (auto-assigned to newbies)
 *    - Clan: Requires clan membership
 *    - VIP: Requires VIP status
 * 
 * 2. Permission Hierarchy:
 *    - Level restrictions checked first
 *    - VIP/Clan requirements checked second
 *    - Channel bans checked third
 *    - Mute status only affects writing
 * 
 * 3. Auto-Assignment:
 *    - Levels 1-5: Global, Newbie, Trade, Help
 *    - Level 6+: Global, Trade, Help (Newbie removed)
 *    - + Clan if member
 *    - + VIP if VIP status
 * 
 * 4. Socket.io Rooms:
 *    - Format: chat_{channelType}
 *    - Clan channels: chat_clan_{clanId}
 *    - Allows targeted broadcasting
 * 
 * 5. Default Channel Selection:
 *    - VIP → VIP Lounge
 *    - Levels 1-5 → Newbie Chat
 *    - Level 6+ → Global Chat
 * 
 * 6. Future Enhancements:
 *    - Custom channels (guild halls, events)
 *    - Channel moderation roles (moderators per channel)
 *    - Channel slowmode (rate limiting per channel)
 *    - Channel announcements (pinned messages)
 */
