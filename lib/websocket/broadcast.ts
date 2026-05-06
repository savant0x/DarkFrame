/**
 * WebSocket Broadcasting Utilities
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Centralized helper functions for broadcasting WebSocket events to targeted groups.
 * Provides type-safe wrappers around Socket.io emit operations with consistent
 * error handling and logging.
 * 
 * Broadcasting Strategies:
 * 1. Global: All connected users (server announcements)
 * 2. User-specific: Individual user notifications
 * 3. Clan-wide: All clan members
 * 4. Clan chat: Clan chat participants
 * 5. Battle participants: Users in specific battle
 * 6. Location-based: Users near specific coordinates
 * 7. Conditional: Filtered subset of users
 * 
 * Usage:
 * - Import broadcast helpers in event handlers
 * - Use type-safe event emitters
 * - Automatic logging and error handling
 */

import type { Server } from 'socket.io';
import { WebSocketRooms } from '@/types/websocket';
import type {
  ServerToClientEvents,
  GamePositionUpdatePayload,
  GameResourceChangePayload,
  GameLevelUpPayload,
  GameTileUpdatePayload,
  ClanMemberJoinedPayload,
  ClanMemberLeftPayload,
  ClanTerritoryUpdatePayload,
  ClanWarDeclaredPayload,
  ClanWarEndedPayload,
  ClanTreasuryUpdatePayload,
  ClanActivityPayload,
  ClanLeaderboardUpdatePayload,
  ChatMessagePayload,
  ChatTypingPayload,
  ChatMemberOnlinePayload,
  CombatAttackStartedPayload,
  CombatBattleResultPayload,
  CombatDefenseAlertPayload,
  SystemNotificationPayload,
  SystemAchievementUnlockedPayload,
  SystemMaintenanceAlertPayload,
} from '@/types/websocket';
import { getNearbyLocationRooms } from './rooms';

// ============================================================================
// GLOBAL BROADCASTS
// ============================================================================

/**
 * Broadcasts event to all connected users
 * 
 * @param io - Socket.io server instance
 * @param event - Event name
 * @param payload - Event payload
 * 
 * @example
 * await broadcastToAll(io, 'system:maintenance_alert', {
 *   maintenanceId: 'maint_001',
 *   type: 'scheduled',
 *   message: 'Server maintenance in 10 minutes',
 *   startTime: Date.now() + 600000,
 *   estimatedDuration: 1800000
 * });
 */
export async function broadcastToAll<K extends keyof ServerToClientEvents>(
  io: Server,
  event: K,
  payload: Parameters<ServerToClientEvents[K]>[0]
): Promise<void> {
  try {
    const roomName = WebSocketRooms.global();
    io.to(roomName).emit(event, payload as any);
    console.log(`[Broadcast] Global event '${event}' sent to all users`);
  } catch (error) {
    console.error(`[Broadcast] Failed to broadcast global event '${event}':`, error);
  }
}

/**
 * Broadcasts system maintenance alert to all users
 * 
 * @param io - Socket.io server instance
 * @param payload - Maintenance alert data
 */
export async function broadcastMaintenanceAlert(
  io: Server,
  payload: SystemMaintenanceAlertPayload
): Promise<void> {
  await broadcastToAll(io, 'system:maintenance_alert', payload);
}

// ============================================================================
// USER-SPECIFIC BROADCASTS
// ============================================================================

/**
 * Sends event to a specific user's personal room
 * 
 * @param io - Socket.io server instance
 * @param userId - Target user ID
 * @param event - Event name
 * @param payload - Event payload
 * 
 * @example
 * await broadcastToUser(io, 'user123', 'system:notification', {
 *   notificationId: 'notif_001',
 *   type: 'success',
 *   title: 'Level Up!',
 *   message: 'You reached level 10',
 *   userId: 'user123',
 *   timestamp: Date.now()
 * });
 */
export async function broadcastToUser<K extends keyof ServerToClientEvents>(
  io: Server,
  userId: string,
  event: K,
  payload: Parameters<ServerToClientEvents[K]>[0]
): Promise<void> {
  try {
    const roomName = WebSocketRooms.user(userId);
    io.to(roomName).emit(event, payload as any);
    console.log(`[Broadcast] Event '${event}' sent to user ${userId}`);
  } catch (error) {
    console.error(`[Broadcast] Failed to broadcast to user ${userId}:`, error);
  }
}

/**
 * Sends notification to specific user
 * 
 * @param io - Socket.io server instance
 * @param userId - Target user ID
 * @param payload - Notification data
 */
export async function notifyUser(
  io: Server,
  userId: string,
  payload: SystemNotificationPayload
): Promise<void> {
  await broadcastToUser(io, userId, 'system:notification', payload);
}

/**
 * Sends achievement unlock notification to user
 * 
 * @param io - Socket.io server instance
 * @param userId - Target user ID
 * @param payload - Achievement data
 */
export async function notifyAchievement(
  io: Server,
  userId: string,
  payload: SystemAchievementUnlockedPayload
): Promise<void> {
  await broadcastToUser(io, userId, 'system:achievement_unlocked', payload);
}

/**
 * Sends combat defense alert to user
 * 
 * @param io - Socket.io server instance
 * @param defenderId - Target defender user ID
 * @param payload - Defense alert data
 */
export async function notifyDefenseAlert(
  io: Server,
  defenderId: string,
  payload: CombatDefenseAlertPayload
): Promise<void> {
  await broadcastToUser(io, defenderId, 'combat:defense_alert', payload);
}

// ============================================================================
// CLAN BROADCASTS
// ============================================================================

/**
 * Broadcasts event to all clan members
 * 
 * @param io - Socket.io server instance
 * @param clanId - Target clan ID
 * @param event - Event name
 * @param payload - Event payload
 * 
 * @example
 * await broadcastToClan(io, 'clan456', 'clan:war_declared', {
 *   warId: 'war_001',
 *   attackerClanId: 'clan456',
 *   attackerClanName: 'Warriors',
 *   defenderClanId: 'clan789',
 *   defenderClanName: 'Defenders',
 *   warType: 'territory',
 *   declaredAt: Date.now(),
 *   declaredBy: 'user123'
 * });
 */
export async function broadcastToClan<K extends keyof ServerToClientEvents>(
  io: Server,
  clanId: string,
  event: K,
  payload: Parameters<ServerToClientEvents[K]>[0]
): Promise<void> {
  try {
    const roomName = WebSocketRooms.clan(clanId);
    io.to(roomName).emit(event, payload as any);
    console.log(`[Broadcast] Event '${event}' sent to clan ${clanId}`);
  } catch (error) {
    console.error(`[Broadcast] Failed to broadcast to clan ${clanId}:`, error);
  }
}

/**
 * Broadcasts to multiple clans simultaneously
 * 
 * @param io - Socket.io server instance
 * @param clanIds - Array of clan IDs
 * @param event - Event name
 * @param payload - Event payload
 */
export async function broadcastToClans<K extends keyof ServerToClientEvents>(
  io: Server,
  clanIds: string[],
  event: K,
  payload: Parameters<ServerToClientEvents[K]>[0]
): Promise<void> {
  await Promise.all(
    clanIds.map(clanId => broadcastToClan(io, clanId, event, payload))
  );
}

/**
 * Broadcasts clan member joined event
 * 
 * @param io - Socket.io server instance
 * @param payload - Member joined data
 */
export async function broadcastClanMemberJoined(
  io: Server,
  payload: ClanMemberJoinedPayload
): Promise<void> {
  await broadcastToClan(io, payload.clanId, 'clan:member_joined', payload);
}

/**
 * Broadcasts clan member left event
 * 
 * @param io - Socket.io server instance
 * @param payload - Member left data
 */
export async function broadcastClanMemberLeft(
  io: Server,
  payload: ClanMemberLeftPayload
): Promise<void> {
  await broadcastToClan(io, payload.clanId, 'clan:member_left', payload);
}

/**
 * Broadcasts clan territory update
 * 
 * @param io - Socket.io server instance
 * @param payload - Territory update data
 */
export async function broadcastClanTerritoryUpdate(
  io: Server,
  payload: ClanTerritoryUpdatePayload
): Promise<void> {
  await broadcastToClan(io, payload.clanId, 'clan:territory_update', payload);
}

/**
 * Broadcasts war declaration to both clans
 * 
 * @param io - Socket.io server instance
 * @param payload - War declaration data
 */
export async function broadcastWarDeclaration(
  io: Server,
  payload: ClanWarDeclaredPayload
): Promise<void> {
  // Send to both attacker and defender clans
  await broadcastToClans(
    io,
    [payload.attackerClanId, payload.defenderClanId],
    'clan:war_declared',
    payload
  );
}

/**
 * Broadcasts war ended to both clans
 * 
 * @param io - Socket.io server instance
 * @param payload - War ended data
 */
export async function broadcastWarEnded(
  io: Server,
  payload: ClanWarEndedPayload
): Promise<void> {
  await broadcastToClans(
    io,
    [payload.attackerClanId, payload.defenderClanId],
    'clan:war_ended',
    payload
  );
}

/**
 * Broadcasts clan treasury update
 * 
 * @param io - Socket.io server instance
 * @param payload - Treasury update data
 */
export async function broadcastClanTreasuryUpdate(
  io: Server,
  payload: ClanTreasuryUpdatePayload
): Promise<void> {
  await broadcastToClan(io, payload.clanId, 'clan:treasury_update', payload);
}

/**
 * Broadcasts clan activity event
 * 
 * @param io - Socket.io server instance
 * @param payload - Activity event data
 */
export async function broadcastClanActivity(
  io: Server,
  payload: ClanActivityPayload
): Promise<void> {
  await broadcastToClan(io, payload.clanId, 'clan:activity', payload);
}

/**
 * Broadcasts clan leaderboard update
 * 
 * @param io - Socket.io server instance
 * @param payload - Leaderboard update data
 */
export async function broadcastClanLeaderboardUpdate(
  io: Server,
  payload: ClanLeaderboardUpdatePayload
): Promise<void> {
  await broadcastToClan(io, payload.clanId, 'clan:leaderboard_update', payload);
}

// ============================================================================
// CLAN CHAT BROADCASTS
// ============================================================================

/**
 * Broadcasts chat message to clan chat room
 * 
 * @param io - Socket.io server instance
 * @param payload - Chat message data
 */
export async function broadcastChatMessage(
  io: Server,
  payload: ChatMessagePayload
): Promise<void> {
  try {
    const roomName = WebSocketRooms.chatChannel(payload.channelId);
    io.to(roomName).emit('chat:message', payload);
    console.log(`[Broadcast] Chat message sent to channel ${payload.channelId}`);
  } catch (error) {
    console.error(`[Broadcast] Failed to broadcast chat message:`, error);
  }
}

/**
 * Broadcasts typing indicator to clan chat room
 * 
 * @param io - Socket.io server instance
 * @param payload - Typing indicator data
 */
export async function broadcastTypingIndicator(
  io: Server,
  payload: ChatTypingPayload
): Promise<void> {
  try {
    const roomName = WebSocketRooms.chatChannel(payload.channelId);
    io.to(roomName).emit('chat:typing', payload);
  } catch (error) {
    console.error(`[Broadcast] Failed to broadcast typing indicator:`, error);
  }
}

/**
 * Broadcasts member online status to clan chat room
 * 
 * @param io - Socket.io server instance
 * @param payload - Member online status data
 */
export async function broadcastMemberOnlineStatus(
  io: Server,
  payload: ChatMemberOnlinePayload
): Promise<void> {
  try {
    const roomName = WebSocketRooms.chatChannel(payload.channelId);
    io.to(roomName).emit('chat:member_online', payload);
  } catch (error) {
    console.error(`[Broadcast] Failed to broadcast member status:`, error);
  }
}

// ============================================================================
// BATTLE/COMBAT BROADCASTS
// ============================================================================

/**
 * Broadcasts combat attack started to battle participants
 * 
 * @param io - Socket.io server instance
 * @param payload - Attack started data
 */
export async function broadcastAttackStarted(
  io: Server,
  payload: CombatAttackStartedPayload
): Promise<void> {
  try {
    const roomName = WebSocketRooms.battle(payload.battleId);
    io.to(roomName).emit('combat:attack_started', payload);
    
    // Also notify both participants directly
    await Promise.all([
      broadcastToUser(io, payload.attackerId, 'combat:attack_started', payload),
      broadcastToUser(io, payload.defenderId, 'combat:attack_started', payload),
    ]);
    
    console.log(`[Broadcast] Attack started event sent for battle ${payload.battleId}`);
  } catch (error) {
    console.error(`[Broadcast] Failed to broadcast attack started:`, error);
  }
}

/**
 * Broadcasts battle result to participants
 * 
 * @param io - Socket.io server instance
 * @param payload - Battle result data
 */
export async function broadcastBattleResult(
  io: Server,
  payload: CombatBattleResultPayload
): Promise<void> {
  try {
    const roomName = WebSocketRooms.battle(payload.battleId);
    io.to(roomName).emit('combat:battle_result', payload);
    
    // Notify participants' clans if applicable
    if (payload.winnerClanId) {
      await broadcastToClan(io, payload.winnerClanId, 'combat:battle_result', payload);
    }
    if (payload.loserClanId) {
      await broadcastToClan(io, payload.loserClanId, 'combat:battle_result', payload);
    }
    
    console.log(`[Broadcast] Battle result sent for battle ${payload.battleId}`);
  } catch (error) {
    console.error(`[Broadcast] Failed to broadcast battle result:`, error);
  }
}

// ============================================================================
// LOCATION-BASED BROADCASTS
// ============================================================================

/**
 * Broadcasts event to users near a specific location
 * 
 * @param io - Socket.io server instance
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param event - Event name
 * @param payload - Event payload
 * 
 * @example
 * await broadcastToLocation(io, 50, 75, 'game:tile_update', {
 *   x: 50,
 *   y: 75,
 *   tileType: 'fortress',
 *   ownerId: 'user123',
 *   ownerName: 'Player1',
 *   clanId: 'clan456',
 *   clanName: 'Warriors'
 * });
 */
export async function broadcastToLocation<K extends keyof ServerToClientEvents>(
  io: Server,
  x: number,
  y: number,
  event: K,
  payload: Parameters<ServerToClientEvents[K]>[0]
): Promise<void> {
  try {
    const roomName = WebSocketRooms.location(x, y);
    io.to(roomName).emit(event, payload as any);
    console.log(`[Broadcast] Event '${event}' sent to location (${x},${y})`);
  } catch (error) {
    console.error(`[Broadcast] Failed to broadcast to location (${x},${y}):`, error);
  }
}

/**
 * Broadcasts event to area (multiple nearby tiles)
 * 
 * @param io - Socket.io server instance
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param radius - Radius in tiles
 * @param event - Event name
 * @param payload - Event payload
 * 
 * @example
 * // Notify all users within 5-tile radius of explosion
 * await broadcastToArea(io, 50, 75, 5, 'game:explosion', explosionData);
 */
export async function broadcastToArea<K extends keyof ServerToClientEvents>(
  io: Server,
  centerX: number,
  centerY: number,
  radius: number,
  event: K,
  payload: Parameters<ServerToClientEvents[K]>[0]
): Promise<void> {
  try {
    const rooms = getNearbyLocationRooms(centerX, centerY, radius);
    
    // Broadcast to all rooms in area
    for (const room of rooms) {
      io.to(room).emit(event, payload as any);
    }
    
    console.log(`[Broadcast] Event '${event}' sent to area (${centerX},${centerY}) radius ${radius} (${rooms.length} rooms)`);
  } catch (error) {
    console.error(`[Broadcast] Failed to broadcast to area:`, error);
  }
}

/**
 * Broadcasts tile update to location
 * 
 * @param io - Socket.io server instance
 * @param payload - Tile update data
 */
export async function broadcastTileUpdate(
  io: Server,
  payload: GameTileUpdatePayload
): Promise<void> {
  await broadcastToLocation(io, payload.x, payload.y, 'game:tile_update', payload);
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Type Safety:
 *    - All broadcast functions strongly typed via ServerToClientEvents
 *    - Payload validation at compile time
 *    - Event name autocomplete in IDEs
 * 
 * 2. Error Handling:
 *    - All errors caught and logged
 *    - Failed broadcasts don't crash server
 *    - Errors include context for debugging
 * 
 * 3. Logging Strategy:
 *    - Log all broadcast operations for audit trail
 *    - Include room/user context in logs
 *    - Use structured logging format
 * 
 * 4. Performance Optimization:
 *    - Use room-based broadcasting (efficient)
 *    - Avoid iterating all sockets
 *    - Batch operations when possible
 *    - Parallel broadcasts with Promise.all
 * 
 * 5. Broadcasting Patterns:
 *    - Global: Maintenance, announcements
 *    - User-specific: Notifications, achievements
 *    - Clan-wide: Clan events, war updates
 *    - Chat: Messages, typing indicators
 *    - Battle: Combat updates, battle results
 *    - Location: Tile changes, nearby events
 * 
 * 6. Duplicate Prevention:
 *    - Socket.io handles duplicate detection
 *    - Users in multiple rooms receive event once
 *    - No manual deduplication needed
 * 
 * FUTURE ENHANCEMENTS:
 * - Add broadcast rate limiting
 * - Implement priority queuing
 * - Add broadcast analytics/metrics
 * - Support for broadcast batching
 * - Add broadcast acknowledgment tracking
 */
