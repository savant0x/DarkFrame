/**
 * WebSocket Event Types and Payload Schemas
 * Created: 2025-10-19
 * Updated: 2025-01-25 - Added Global Chat System events (FID-20251025-103)
 * 
 * OVERVIEW:
 * Comprehensive type-safe WebSocket event definitions for real-time communication.
 * Covers all event categories: game, clan, chat, combat, messaging, and system notifications.
 * 
 * Architecture:
 * - Server-to-Client events (broadcasts, notifications)
 * - Client-to-Server events (actions, requests)
 * - Bidirectional events (acknowledgments, responses)
 * 
 * Event Categories:
 * 1. Game Events: Position updates, resource changes, level-ups
 * 2. Clan Events: Member actions, territory changes, warfare
 * 3. Chat Events: Global chat system with channels, moderation, veteran help
 * 4. Messaging Events: Private 1-on-1 messages and conversations
 * 5. Combat Events: Battle notifications, unit updates
 * 6. System Events: Achievements, maintenance, global notifications
 * 7. WMD Events: Missiles, research, espionage, voting
 * 
 * UPDATES:
 * 2025-01-25 (FID-20251025-103 - Global Chat System):
 * - Enhanced ChatMessagePayload with level, VIP status, item links, replies
 * - Added channel management events (join, leave, switch)
 * - Added moderation events (mute, unmute, ban, unban, kick)
 * - Added veteran notification system for newbie help
 * - Added admin broadcast for system announcements
 * - Added rate limiting and spam detection events
 * - Added channel statistics and profanity filter events
 * - Updated WebSocketRooms with chatChannel, chatVeterans, chatAdmins
 * - Added comprehensive client-to-server chat actions with callbacks
 * - Total new events: 14 server-to-client, 12 client-to-server
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export interface WebSocketUser {
  userId: string;
  username: string;
  level?: number;
  clanId?: string;
  clanName?: string;
}

export interface WebSocketError {
  code: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// GAME EVENTS
// ============================================================================

export interface GamePositionUpdatePayload {
  userId: string;
  username: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface GameResourceChangePayload {
  userId: string;
  resourceType: 'wood' | 'stone' | 'iron' | 'gold' | 'food' | 'energy';
  previousAmount: number;
  newAmount: number;
  change: number;
  reason: string;
}

export interface GameLevelUpPayload {
  userId: string;
  username: string;
  previousLevel: number;
  newLevel: number;
  unlockedFeatures?: string[];
}

export interface GameTileUpdatePayload {
  x: number;
  y: number;
  tileType: string;
  ownerId?: string;
  ownerName?: string;
  clanId?: string;
  clanName?: string;
}

export interface GamePlayerOnlinePayload {
  userId: string;
  username: string;
  level: number;
  x: number;
  y: number;
}

export interface GamePlayerOfflinePayload {
  userId: string;
  username: string;
}

// ============================================================================
// CLAN EVENTS
// ============================================================================

export interface ClanMemberJoinedPayload {
  clanId: string;
  clanName: string;
  userId: string;
  username: string;
  joinedAt: number;
  memberCount: number;
}

export interface ClanMemberLeftPayload {
  clanId: string;
  clanName: string;
  userId: string;
  username: string;
  reason: 'left' | 'kicked' | 'disbanded';
  leftAt: number;
  memberCount: number;
}

export interface ClanMemberRoleChangedPayload {
  clanId: string;
  userId: string;
  username: string;
  previousRole: string;
  newRole: string;
  changedBy: string;
}

export interface ClanTerritoryUpdatePayload {
  clanId: string;
  clanName: string;
  action: 'captured' | 'lost' | 'defended';
  x: number;
  y: number;
  previousOwner?: string;
  newOwner?: string;
  timestamp: number;
}

export interface ClanWarDeclaredPayload {
  warId: string;
  attackerClanId: string;
  attackerClanName: string;
  defenderClanId: string;
  defenderClanName: string;
  warType: 'territory' | 'resource' | 'honor';
  declaredAt: number;
  declaredBy: string;
}

export interface ClanWarEndedPayload {
  warId: string;
  attackerClanId: string;
  attackerClanName: string;
  defenderClanId: string;
  defenderClanName: string;
  winner: 'attacker' | 'defender' | 'draw';
  endedAt: number;
  casualties: {
    attacker: number;
    defender: number;
  };
  territoriesChanged?: number;
}

export interface ClanTreasuryUpdatePayload {
  clanId: string;
  resourceType: 'wood' | 'stone' | 'iron' | 'gold' | 'food';
  previousAmount: number;
  newAmount: number;
  change: number;
  actionType: 'deposit' | 'withdrawal' | 'war_cost' | 'building';
  performedBy: string;
  timestamp: number;
}

export interface ClanActivityPayload {
  clanId: string;
  activityType: 'member_joined' | 'member_left' | 'territory_captured' | 
                 'territory_lost' | 'war_declared' | 'war_won' | 'war_lost' |
                 'treasury_deposit' | 'treasury_withdrawal' | 'member_promoted' |
                 'member_demoted' | 'building_constructed';
  description: string;
  actorUserId?: string;
  actorUsername?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ClanLeaderboardUpdatePayload {
  clanId: string;
  clanName: string;
  category: 'power' | 'territory' | 'combat' | 'economic' | 'members';
  previousRank: number;
  newRank: number;
  rankChange: number;
  score: number;
}

// ============================================================================
// CHAT EVENTS (Global Chat System - FID-20251025-103)
// ============================================================================

/**
 * Chat Message Payload - Broadcasted when new message sent
 * Used by: ChatPanel, ChatMessage components
 */
export interface ChatMessagePayload {
  messageId: string;
  channelId: string;
  userId: string;
  username: string;
  level: number;
  isVIP: boolean;
  clanId?: string;
  clanName?: string;
  content: string;
  timestamp: number;
  mentions?: string[];
  itemLinks?: Array<{
    itemId: string;
    itemName: string;
    rarity: string;
  }>;
  replyTo?: {
    messageId: string;
    username: string;
    content: string;
  };
  isEdited?: boolean;
  isPinned?: boolean;
}

/**
 * Typing Indicator Payload - Real-time typing status
 */
export interface ChatTypingPayload {
  channelId: string;
  userId: string;
  username: string;
  isTyping: boolean;
  timestamp: number;
}

/**
 * Member Online Status - Presence updates
 */
export interface ChatMemberOnlinePayload {
  channelId: string;
  userId: string;
  username: string;
  level: number;
  isVIP: boolean;
  status: 'online' | 'away' | 'offline';
  timestamp: number;
}

/**
 * Message Edited - Broadcasted when message updated
 */
export interface ChatMessageEditedPayload {
  messageId: string;
  channelId: string;
  userId: string;
  newContent: string;
  editedAt: number;
}

/**
 * Message Deleted - Broadcasted when message removed
 */
export interface ChatMessageDeletedPayload {
  messageId: string;
  channelId: string;
  deletedBy: string;
  deletedByUsername: string;
  reason?: string;
  deletedAt: number;
}

/**
 * Channel Join - User joined channel
 */
export interface ChatChannelJoinPayload {
  channelId: string;
  channelName: string;
  userId: string;
  username: string;
  level: number;
  isVIP: boolean;
  memberCount: number;
  timestamp: number;
}

/**
 * Channel Leave - User left channel
 */
export interface ChatChannelLeavePayload {
  channelId: string;
  channelName: string;
  userId: string;
  username: string;
  reason: 'manual' | 'kicked' | 'banned' | 'disconnected';
  memberCount: number;
  timestamp: number;
}

/**
 * Channel Switch - User changed active channel
 */
export interface ChatChannelSwitchPayload {
  userId: string;
  username: string;
  fromChannelId: string;
  toChannelId: string;
  timestamp: number;
}

/**
 * User Muted - Moderation action
 */
export interface ChatUserMutedPayload {
  channelId: string;
  userId: string;
  username: string;
  mutedBy: string;
  mutedByUsername: string;
  reason: string;
  duration: number; // milliseconds
  expiresAt: number; // timestamp
  timestamp: number;
}

/**
 * User Unmuted - Moderation action
 */
export interface ChatUserUnmutedPayload {
  channelId: string;
  userId: string;
  username: string;
  unmutedBy: string;
  unmutedByUsername: string;
  reason?: string;
  timestamp: number;
}

/**
 * User Banned - Moderation action
 */
export interface ChatUserBannedPayload {
  channelId: string;
  userId: string;
  username: string;
  bannedBy: string;
  bannedByUsername: string;
  reason: string;
  duration?: number; // undefined = permanent
  expiresAt?: number; // timestamp if temporary
  timestamp: number;
}

/**
 * User Unbanned - Moderation action
 */
export interface ChatUserUnbannedPayload {
  channelId: string;
  userId: string;
  username: string;
  unbannedBy: string;
  unbannedByUsername: string;
  reason?: string;
  timestamp: number;
}

/**
 * User Kicked - Temporary removal
 */
export interface ChatUserKickedPayload {
  channelId: string;
  userId: string;
  username: string;
  kickedBy: string;
  kickedByUsername: string;
  reason: string;
  timestamp: number;
}

/**
 * Veteran Notification - Help request from newbie
 */
export interface ChatVeteranNotificationPayload {
  notificationId: string;
  requesterId: string;
  requesterUsername: string;
  requesterLevel: number;
  question: string;
  channelId: string;
  timestamp: number;
  expiresAt: number;
}

/**
 * Admin Broadcast - System-wide announcement
 */
export interface ChatAdminBroadcastPayload {
  messageId: string;
  adminId: string;
  adminUsername: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  channels: string[]; // 'all' or specific channel IDs
  timestamp: number;
  expiresAt?: number;
}

/**
 * Rate Limit Warning - User approaching limit
 */
export interface ChatRateLimitWarningPayload {
  userId: string;
  channelId: string;
  messagesRemaining: number;
  resetAt: number;
  timestamp: number;
}

/**
 * Spam Detection Alert - Potential spam detected
 */
export interface ChatSpamDetectionPayload {
  messageId: string;
  userId: string;
  username: string;
  channelId: string;
  spamType: 'repeated_content' | 'excessive_caps' | 'excessive_mentions' | 'link_spam';
  actionTaken: 'warning' | 'mute' | 'message_deleted';
  timestamp: number;
}

/**
 * Channel Stats Update - Real-time statistics
 */
export interface ChatChannelStatsPayload {
  channelId: string;
  onlineCount: number;
  totalMembers: number;
  messagesLast24h: number;
  timestamp: number;
}

/**
 * Profanity Filter Alert - Censored content notification
 */
export interface ChatProfanityFilterPayload {
  messageId: string;
  userId: string;
  channelId: string;
  filteredWords: number;
  originalLength: number;
  timestamp: number;
}

// ============================================================================
// MESSAGING EVENTS (Private 1-on-1 Messages)
// ============================================================================

export interface MessagingMessagePayload {
  _id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  contentType: 'text' | 'system' | 'notification';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: Date;
  readAt?: Date;
}

export interface MessagingConversationPayload {
  _id: string;
  participants: string[];
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: Date;
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  };
  unreadCount: { [playerId: string]: number };
  createdAt: Date;
  updatedAt: Date;
}

export interface MessagingTypingPayload {
  conversationId: string;
  playerId: string;
  username: string;
  isTyping: boolean;
  timestamp: Date;
}

export interface MessagingReadReceiptPayload {
  conversationId: string;
  messageId?: string;
  playerId: string;
  readAt: Date;
}

export interface MessagingErrorPayload {
  error: string;
  code: string;
  tempId?: string;
}

// ============================================================================
// COMBAT EVENTS
// ============================================================================

export interface CombatAttackStartedPayload {
  battleId: string;
  attackerId: string;
  attackerName: string;
  defenderId: string;
  defenderName: string;
  attackerClanId?: string;
  defenderClanId?: string;
  location: { x: number; y: number };
  startedAt: number;
}

export interface CombatBattleResultPayload {
  battleId: string;
  winner: string;
  loser: string;
  winnerClanId?: string;
  loserClanId?: string;
  casualties: {
    winner: number;
    loser: number;
  };
  resourcesLost: {
    winner: Record<string, number>;
    loser: Record<string, number>;
  };
  experienceGained: {
    winner: number;
    loser: number;
  };
  completedAt: number;
}

export interface CombatUnitDestroyedPayload {
  battleId: string;
  unitId: string;
  unitType: string;
  ownerId: string;
  ownerName: string;
  destroyedBy: string;
  timestamp: number;
}

export interface CombatDefenseAlertPayload {
  defenderId: string;
  defenderName: string;
  attackerId: string;
  attackerName: string;
  location: { x: number; y: number };
  estimatedArrival: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// SYSTEM EVENTS
// ============================================================================

export interface SystemNotificationPayload {
  notificationId: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  userId?: string;
  clanId?: string;
  actionUrl?: string;
  timestamp: number;
  expiresAt?: number;
}

export interface SystemAchievementUnlockedPayload {
  userId: string;
  username: string;
  achievementId: string;
  achievementName: string;
  achievementDescription: string;
  rewards?: {
    experience?: number;
    gold?: number;
    items?: string[];
  };
  unlockedAt: number;
}

export interface SystemMaintenanceAlertPayload {
  maintenanceId: string;
  type: 'scheduled' | 'emergency';
  message: string;
  startTime: number;
  estimatedDuration: number;
  affectedSystems?: string[];
}

export interface SystemServerStatsPayload {
  onlinePlayers: number;
  activeClans: number;
  ongoingBattles: number;
  serverLoad: number;
  timestamp: number;
}

// ============================================================================
// WMD EVENTS
// ============================================================================

export interface WMDMissileLaunchedPayload {
  missileId: string;
  targetName: string;
  warheadType: string;
  impactAt: string;
  message: string;
}

export interface WMDIncomingMissilePayload {
  missileId: string;
  launcherName: string;
  warheadType: string;
  impactAt: string;
  message: string;
}

export interface WMDMissileInterceptedPayload {
  missileId: string;
  targetName?: string;
  launcherName?: string;
  interceptedBy: string;
  message: string;
}

export interface WMDInterceptionSuccessPayload {
  missileId: string;
  launcherName: string;
  message: string;
}

export interface WMDMissileImpactPayload {
  missileId: string;
  targetName?: string;
  launcherName?: string;
  warheadType: string;
  damageDealt: number;
  message: string;
}

export interface WMDResearchCompletePayload {
  techId: string;
  techName: string;
  category: string;
  message: string;
}

export interface WMDSpyMissionCompletePayload {
  missionId: string;
  spyName: string;
  targetName: string;
  missionType: string;
  success: boolean;
  intelligence?: string;
  message: string;
}

export interface WMDVoteUpdatePayload {
  voteId: string;
  voteType: string;
  proposer: string;
  targetName?: string;
  status: string;
  votesFor: number;
  votesAgainst: number;
  requiredVotes: number;
  message: string;
}

export interface WMDBatteryDeployedPayload {
  batteryId: string;
  batteryType: string;
  interceptChance: number;
  message: string;
}

export interface WMDSpyRecruitedPayload {
  spyId: string;
  spyName: string;
  specialization: string;
  message: string;
}

export interface WMDCounterIntelAlertPayload {
  spiesDetected: Array<{ codename: string; specialization: string }>;
  message: string;
}

// ============================================================================
// SERVER-TO-CLIENT EVENT MAP
// ============================================================================

export interface ServerToClientEvents {
  // Game Events
  'game:position_update': (payload: GamePositionUpdatePayload) => void;
  'game:resource_change': (payload: GameResourceChangePayload) => void;
  'game:level_up': (payload: GameLevelUpPayload) => void;
  'game:tile_update': (payload: GameTileUpdatePayload) => void;
  'game:player_online': (payload: GamePlayerOnlinePayload) => void;
  'game:player_offline': (payload: GamePlayerOfflinePayload) => void;

  // Clan Events
  'clan:member_joined': (payload: ClanMemberJoinedPayload) => void;
  'clan:member_left': (payload: ClanMemberLeftPayload) => void;
  'clan:member_role_changed': (payload: ClanMemberRoleChangedPayload) => void;
  'clan:territory_update': (payload: ClanTerritoryUpdatePayload) => void;
  'clan:war_declared': (payload: ClanWarDeclaredPayload) => void;
  'clan:war_ended': (payload: ClanWarEndedPayload) => void;
  'clan:treasury_update': (payload: ClanTreasuryUpdatePayload) => void;
  'clan:activity': (payload: ClanActivityPayload) => void;
  'clan:leaderboard_update': (payload: ClanLeaderboardUpdatePayload) => void;

  // Chat Events (Global Chat System - FID-20251025-103)
  'chat:message': (payload: ChatMessagePayload) => void;
  'chat:typing': (payload: ChatTypingPayload) => void;
  'chat:member_online': (payload: ChatMemberOnlinePayload) => void;
  'chat:message_edited': (payload: ChatMessageEditedPayload) => void;
  'chat:message_deleted': (payload: ChatMessageDeletedPayload) => void;
  'chat:channel_join': (payload: ChatChannelJoinPayload) => void;
  'chat:channel_leave': (payload: ChatChannelLeavePayload) => void;
  'chat:channel_switch': (payload: ChatChannelSwitchPayload) => void;
  'chat:user_muted': (payload: ChatUserMutedPayload) => void;
  'chat:user_unmuted': (payload: ChatUserUnmutedPayload) => void;
  'chat:user_banned': (payload: ChatUserBannedPayload) => void;
  'chat:user_unbanned': (payload: ChatUserUnbannedPayload) => void;
  'chat:user_kicked': (payload: ChatUserKickedPayload) => void;
  'chat:veteran_notification': (payload: ChatVeteranNotificationPayload) => void;
  'chat:admin_broadcast': (payload: ChatAdminBroadcastPayload) => void;
  'chat:rate_limit_warning': (payload: ChatRateLimitWarningPayload) => void;
  'chat:spam_detection': (payload: ChatSpamDetectionPayload) => void;
  'chat:channel_stats': (payload: ChatChannelStatsPayload) => void;
  'chat:profanity_filter': (payload: ChatProfanityFilterPayload) => void;

  // Messaging Events (Private 1-on-1)
  'message:receive': (payload: MessagingMessagePayload) => void;
  'message:read': (payload: MessagingReadReceiptPayload) => void;
  'message:error': (payload: MessagingErrorPayload) => void;
  'conversation:updated': (payload: MessagingConversationPayload) => void;
  'typing:start': (payload: MessagingTypingPayload) => void;
  'typing:stop': (payload: MessagingTypingPayload) => void;

  // Combat Events
  'combat:attack_started': (payload: CombatAttackStartedPayload) => void;
  'combat:battle_result': (payload: CombatBattleResultPayload) => void;
  'combat:unit_destroyed': (payload: CombatUnitDestroyedPayload) => void;
  'combat:defense_alert': (payload: CombatDefenseAlertPayload) => void;

  // System Events
  'system:notification': (payload: SystemNotificationPayload) => void;
  'system:achievement_unlocked': (payload: SystemAchievementUnlockedPayload) => void;
  'system:maintenance_alert': (payload: SystemMaintenanceAlertPayload) => void;
  'system:server_stats': (payload: SystemServerStatsPayload) => void;

  // WMD Events
  'wmd:missile_launched': (payload: WMDMissileLaunchedPayload) => void;
  'wmd:incoming_missile': (payload: WMDIncomingMissilePayload) => void;
  'wmd:missile_intercepted': (payload: WMDMissileInterceptedPayload) => void;
  'wmd:interception_success': (payload: WMDInterceptionSuccessPayload) => void;
  'wmd:missile_impact': (payload: WMDMissileImpactPayload) => void;
  'wmd:research_complete': (payload: WMDResearchCompletePayload) => void;
  'wmd:spy_mission_complete': (payload: WMDSpyMissionCompletePayload) => void;
  'wmd:vote_update': (payload: WMDVoteUpdatePayload) => void;
  'wmd:battery_deployed': (payload: WMDBatteryDeployedPayload) => void;
  'wmd:spy_recruited': (payload: WMDSpyRecruitedPayload) => void;
  'wmd:counter_intel_alert': (payload: WMDCounterIntelAlertPayload) => void;

  // Connection Events
  'connect': () => void;
  'disconnect': () => void;
  'error': (error: WebSocketError) => void;
}

// ============================================================================
// CLIENT-TO-SERVER EVENT MAP
// ============================================================================

export interface ClientToServerEvents {
  // Game Actions
  'game:update_position': (data: { x: number; y: number }) => void;
  'game:request_tile_info': (data: { x: number; y: number }) => void;

  // Clan Actions
  'clan:join_room': (data: { clanId: string }) => void;
  'clan:leave_room': (data: { clanId: string }) => void;
  'clan:declare_war': (data: {
    targetClanId: string;
    warType: 'territory' | 'resource' | 'honor';
    unitsCommitted: number;
  }) => void;

  // Chat Actions (Global Chat System - FID-20251025-103)
  'chat:send_message': (data: {
    channelId: string;
    content: string;
    mentions?: string[];
    replyTo?: string; // messageId
  }, callback?: (response: { success: boolean; messageId?: string; error?: string }) => void) => void;
  'chat:start_typing': (data: { channelId: string }) => void;
  'chat:stop_typing': (data: { channelId: string }) => void;
  'chat:edit_message': (data: {
    messageId: string;
    channelId: string;
    newContent: string;
  }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'chat:delete_message': (data: {
    messageId: string;
    channelId: string;
    reason?: string;
  }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'chat:join_channel': (data: {
    channelId: string;
  }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'chat:leave_channel': (data: {
    channelId: string;
  }) => void;
  'chat:switch_channel': (data: {
    fromChannelId: string;
    toChannelId: string;
  }) => void;
  'chat:mute_user': (data: {
    channelId: string;
    userId: string;
    reason: string;
    duration: number; // milliseconds
  }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'chat:unmute_user': (data: {
    channelId: string;
    userId: string;
    reason?: string;
  }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'chat:ban_user': (data: {
    channelId: string;
    userId: string;
    reason: string;
    duration?: number; // undefined = permanent
  }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'chat:unban_user': (data: {
    channelId: string;
    userId: string;
    reason?: string;
  }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'chat:kick_user': (data: {
    channelId: string;
    userId: string;
    reason: string;
  }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'chat:ask_veterans': (data: {
    question: string;
    channelId: string;
  }, callback?: (response: { success: boolean; notificationId?: string; error?: string }) => void) => void;
  'chat:admin_broadcast': (data: {
    title: string;
    content: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    channels: string[]; // 'all' or specific channel IDs
    expiresAt?: number;
  }, callback?: (response: { success: boolean; messageId?: string; error?: string }) => void) => void;
  'chat:request_stats': (data: {
    channelId: string;
  }, callback?: (stats: ChatChannelStatsPayload) => void) => void;

  // Messaging Actions (Private 1-on-1)
  'message:send': (data: {
    recipientId: string;
    content: string;
    tempId?: string;
  }, callback?: (response: { success: boolean; messageId?: string; error?: string }) => void) => void;
  'message:mark_read': (data: {
    conversationId: string;
    messageId?: string;
  }) => void;
  'conversation:join': (data: { conversationId: string }) => void;
  'conversation:leave': (data: { conversationId: string }) => void;
  'typing:start_private': (data: {
    conversationId: string;
    recipientId: string;
  }) => void;
  'typing:stop_private': (data: {
    conversationId: string;
    recipientId: string;
  }) => void;

  // Combat Actions
  'combat:request_battle_update': (data: { battleId: string }) => void;

  // System Actions
  'system:ping': (callback: (latency: number) => void) => void;
}

// ============================================================================
// ROOM NAMING CONVENTIONS
// ============================================================================

export const WebSocketRooms = {
  global: () => 'global',
  user: (userId: string) => `user:${userId}`,
  clan: (clanId: string) => `clan:${clanId}`,
  clanChat: (clanId: string) => `clan:${clanId}:chat`,
  chatChannel: (channelId: string) => `chat:channel:${channelId}`,
  chatVeterans: () => 'chat:veterans',
  chatAdmins: () => 'chat:admins',
  battle: (battleId: string) => `battle:${battleId}`,
  location: (x: number, y: number) => `location:${x}:${y}`,
} as const;

// ============================================================================
// CONNECTION STATE
// ============================================================================

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'error';

export interface WebSocketConnectionInfo {
  state: ConnectionState;
  connectedAt?: number;
  disconnectedAt?: number;
  reconnectAttempts: number;
  latency?: number;
  userId?: string;
  rooms: string[];
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Event Naming Convention:
 *    - Format: `category:action` (e.g., 'clan:war_declared', 'chat:user_muted')
 *    - Categories: game, clan, chat, combat, system, wmd, message
 *    - Actions: past tense for notifications, present for requests
 * 
 * 2. Payload Design:
 *    - Always include timestamp for event ordering
 *    - Include user context (userId, username) for attribution
 *    - Use optional fields with `?` for conditional data
 *    - Provide metadata object for extensibility
 * 
 * 3. Type Safety:
 *    - All events strongly typed via ServerToClientEvents interface
 *    - Payloads validated on both client and server
 *    - Use discriminated unions for action types
 * 
 * 4. Room Management:
 *    - Use WebSocketRooms helper for consistent naming
 *    - Auto-join user-specific room on connection
 *    - Join/leave clan rooms on membership changes
 *    - Location-based rooms for proximity events
 *    - Chat channel rooms for global chat system (chatChannel)
 *    - Veterans room for help request notifications (chatVeterans)
 *    - Admins room for moderation events (chatAdmins)
 * 
 * 5. Performance Considerations:
 *    - Keep payloads small (< 1KB typical)
 *    - Batch similar events when possible
 *    - Use throttling for high-frequency events (position updates, typing indicators)
 *    - Implement selective room subscriptions
 *    - Rate limit client-to-server events (enforced via chatService)
 * 
 * 6. Security:
 *    - Validate user permissions before emitting to rooms
 *    - Never expose sensitive data in payloads
 *    - Rate-limit client-to-server events
 *    - Authenticate socket connections via JWT
 *    - Moderation actions require admin/moderator role verification
 *    - Profanity filtering applied before message broadcast
 * 
 * 7. Global Chat System (FID-20251025-103):
 *    - Channel-based architecture (general, trade, clan, help, veterans)
 *    - Real-time message broadcasting with WebSocket
 *    - Moderation system (mute, ban, kick) with audit logging
 *    - Veteran notification system for newbie help requests
 *    - Admin broadcast for system-wide announcements
 *    - Rate limiting and spam detection
 *    - Profanity filtering with configurable blacklist
 *    - Item linking and mention support (@username)
 *    - Message editing and deletion with history
 *    - Typing indicators with throttling
 *    - Online presence tracking per channel
 * 
 * CHAT EVENT FLOW EXAMPLES:
 * 
 * 1. Sending a Message:
 *    Client -> 'chat:send_message' -> Server validates -> Save to DB ->
 *    Server -> 'chat:message' -> All users in channel room
 * 
 * 2. Muting a User:
 *    Admin Client -> 'chat:mute_user' -> Server validates admin role ->
 *    Save mute to DB -> Server -> 'chat:user_muted' -> All channel members
 * 
 * 3. Veteran Help Request:
 *    Newbie Client -> 'chat:ask_veterans' -> Server validates level ->
 *    Create notification -> Server -> 'chat:veteran_notification' -> Veterans room
 * 
 * 4. Channel Join:
 *    Client -> 'chat:join_channel' -> Server validates permissions ->
 *    Socket.join(chatChannel(channelId)) -> Server -> 'chat:channel_join' -> All members
 * 
 * 5. Admin Broadcast:
 *    Admin Client -> 'chat:admin_broadcast' -> Server validates admin ->
 *    Server -> 'chat:admin_broadcast' -> Selected channels (or all)
 * 
 * FUTURE ENHANCEMENTS:
 * - Add event versioning for backward compatibility
 * - Implement event compression for large payloads
 * - Add replay/history functionality
 * - Support for custom user-defined events
 * - Voice chat integration events
 * - Ephemeral messages (auto-delete after time)
 * - Message reactions/emoji support
 * - File/image sharing events
 * - Thread/reply system for message organization
 */
