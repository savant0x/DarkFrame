/**
 * WebSocket Room Management Utilities
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Helper functions for managing Socket.io rooms and user presence.
 * Rooms enable targeted broadcasting to specific groups of connected users.
 * 
 * Room Types:
 * 1. Global: All connected users (announcements, server events)
 * 2. User-specific: Individual user's private channel (notifications, DMs)
 * 3. Clan-specific: All clan members (clan events, chat)
 * 4. Clan chat: Dedicated chat room per clan
 * 5. Battle-specific: Participants in a specific battle
 * 6. Location-based: Users near a specific coordinate
 * 
 * Usage:
 * - Auto-join user to their personal room on connection
 * - Join/leave clan rooms on membership changes
 * - Dynamic battle rooms for combat events
 * - Location rooms for proximity-based events
 */

import type { Socket, Server } from 'socket.io';
import { WebSocketRooms } from '@/types/websocket';
import type { AuthenticatedUser } from './auth';

// ============================================================================
// ROOM JOIN/LEAVE OPERATIONS
// ============================================================================

/**
 * Joins socket to user-specific room
 * Called automatically on successful authentication
 * 
 * @param socket - Socket.io socket instance
 * @param userId - User's unique identifier
 * 
 * @example
 * await joinUserRoom(socket, 'user123');
 * // Socket can now receive events via: io.to('user:user123').emit(...)
 */
export async function joinUserRoom(socket: Socket, userId: string): Promise<void> {
  const roomName = WebSocketRooms.user(userId);
  await socket.join(roomName);
  console.log(`[Room] User ${userId} joined personal room: ${roomName}`);
}

/**
 * Joins socket to global room
 * Global room receives server-wide announcements
 * 
 * @param socket - Socket.io socket instance
 * 
 * @example
 * await joinGlobalRoom(socket);
 * // Socket receives global broadcasts: io.to('global').emit('system:maintenance_alert', ...)
 */
export async function joinGlobalRoom(socket: Socket): Promise<void> {
  const roomName = WebSocketRooms.global();
  await socket.join(roomName);
  console.log(`[Room] Socket ${socket.id} joined global room`);
}

/**
 * Joins socket to clan room
 * Clan room receives all clan-specific events
 * 
 * @param socket - Socket.io socket instance
 * @param clanId - Clan's unique identifier
 * 
 * @example
 * await joinClanRoom(socket, 'clan456');
 * // Socket receives clan events: io.to('clan:clan456').emit('clan:war_declared', ...)
 */
export async function joinClanRoom(socket: Socket, clanId: string): Promise<void> {
  const roomName = WebSocketRooms.clan(clanId);
  await socket.join(roomName);
  console.log(`[Room] Socket ${socket.id} joined clan room: ${roomName}`);
}

/**
 * Joins socket to clan chat room
 * Separate from main clan room for chat-specific events
 * 
 * @param socket - Socket.io socket instance
 * @param clanId - Clan's unique identifier
 * 
 * @example
 * await joinClanChatRoom(socket, 'clan456');
 * // Socket receives chat messages: io.to('clan:clan456:chat').emit('chat:message', ...)
 */
export async function joinClanChatRoom(socket: Socket, clanId: string): Promise<void> {
  const roomName = WebSocketRooms.clanChat(clanId);
  await socket.join(roomName);
  console.log(`[Room] Socket ${socket.id} joined clan chat room: ${roomName}`);
}

/**
 * Joins socket to battle room
 * Battle room receives real-time combat updates
 * 
 * @param socket - Socket.io socket instance
 * @param battleId - Battle's unique identifier
 * 
 * @example
 * await joinBattleRoom(socket, 'battle789');
 * // Socket receives battle updates: io.to('battle:battle789').emit('combat:unit_destroyed', ...)
 */
export async function joinBattleRoom(socket: Socket, battleId: string): Promise<void> {
  const roomName = WebSocketRooms.battle(battleId);
  await socket.join(roomName);
  console.log(`[Room] Socket ${socket.id} joined battle room: ${roomName}`);
}

/**
 * Joins socket to location-based room
 * Location room receives events for nearby users
 * 
 * @param socket - Socket.io socket instance
 * @param x - X coordinate
 * @param y - Y coordinate
 * 
 * @example
 * await joinLocationRoom(socket, 50, 75);
 * // Socket receives nearby events: io.to('location:50:75').emit('game:tile_update', ...)
 */
export async function joinLocationRoom(socket: Socket, x: number, y: number): Promise<void> {
  const roomName = WebSocketRooms.location(x, y);
  await socket.join(roomName);
  console.log(`[Room] Socket ${socket.id} joined location room: ${roomName}`);
}

/**
 * Leaves clan room
 * Called when user leaves clan or disconnects
 * 
 * @param socket - Socket.io socket instance
 * @param clanId - Clan's unique identifier
 * 
 * @example
 * await leaveClanRoom(socket, 'clan456');
 */
export async function leaveClanRoom(socket: Socket, clanId: string): Promise<void> {
  const roomName = WebSocketRooms.clan(clanId);
  await socket.leave(roomName);
  console.log(`[Room] Socket ${socket.id} left clan room: ${roomName}`);
}

/**
 * Leaves clan chat room
 * 
 * @param socket - Socket.io socket instance
 * @param clanId - Clan's unique identifier
 */
export async function leaveClanChatRoom(socket: Socket, clanId: string): Promise<void> {
  const roomName = WebSocketRooms.clanChat(clanId);
  await socket.leave(roomName);
  console.log(`[Room] Socket ${socket.id} left clan chat room: ${roomName}`);
}

/**
 * Leaves battle room
 * Called when battle ends or user disconnects
 * 
 * @param socket - Socket.io socket instance
 * @param battleId - Battle's unique identifier
 */
export async function leaveBattleRoom(socket: Socket, battleId: string): Promise<void> {
  const roomName = WebSocketRooms.battle(battleId);
  await socket.leave(roomName);
  console.log(`[Room] Socket ${socket.id} left battle room: ${roomName}`);
}

/**
 * Leaves location-based room
 * Called when user moves to new location
 * 
 * @param socket - Socket.io socket instance
 * @param x - X coordinate
 * @param y - Y coordinate
 */
export async function leaveLocationRoom(socket: Socket, x: number, y: number): Promise<void> {
  const roomName = WebSocketRooms.location(x, y);
  await socket.leave(roomName);
  console.log(`[Room] Socket ${socket.id} left location room: ${roomName}`);
}

// ============================================================================
// AUTOMATIC ROOM MANAGEMENT
// ============================================================================

/**
 * Automatically joins user to all appropriate rooms on connection
 * Called after successful authentication
 * 
 * Rooms joined:
 * - Global room (always)
 * - User's personal room (always)
 * - Clan room (if member of clan)
 * - Clan chat room (if member of clan)
 * 
 * @param socket - Socket.io socket instance
 * @param user - Authenticated user data
 * 
 * @example
 * const result = await authenticateSocket(socket);
 * if (result.success && result.user) {
 *   await autoJoinRooms(socket, result.user);
 * }
 */
export async function autoJoinRooms(socket: Socket, user: AuthenticatedUser): Promise<void> {
  // Always join global and user-specific rooms
  await joinGlobalRoom(socket);
  await joinUserRoom(socket, user.userId);
  
  // Join clan rooms if user is in a clan
  if (user.clanId) {
    await joinClanRoom(socket, user.clanId);
    await joinClanChatRoom(socket, user.clanId);
  }
  
  console.log(`[Room] User ${user.username} auto-joined appropriate rooms`, {
    userId: user.userId,
    clanId: user.clanId || 'none',
  });
}

/**
 * Automatically leaves all clan rooms
 * Called when user leaves clan or is kicked
 * 
 * @param socket - Socket.io socket instance
 * @param clanId - Clan's unique identifier
 */
export async function autoLeaveClanRooms(socket: Socket, clanId: string): Promise<void> {
  await leaveClanRoom(socket, clanId);
  await leaveClanChatRoom(socket, clanId);
  console.log(`[Room] Socket ${socket.id} left all clan rooms for clan ${clanId}`);
}

// ============================================================================
// ROOM PRESENCE QUERIES
// ============================================================================

/**
 * Gets all sockets in a specific room
 * 
 * @param io - Socket.io server instance
 * @param roomName - Room name
 * @returns Set of socket IDs in the room
 * 
 * @example
 * const sockets = await getSocketsInRoom(io, 'clan:clan456');
 * console.log(`${sockets.size} users online in clan`);
 */
export async function getSocketsInRoom(io: Server, roomName: string): Promise<Set<string>> {
  const sockets = await io.in(roomName).fetchSockets();
  return new Set(sockets.map(s => s.id));
}

/**
 * Gets count of users in a room
 * 
 * @param io - Socket.io server instance
 * @param roomName - Room name
 * @returns Number of connected users
 * 
 * @example
 * const count = await getRoomUserCount(io, 'clan:clan456');
 * console.log(`${count} clan members online`);
 */
export async function getRoomUserCount(io: Server, roomName: string): Promise<number> {
  const sockets = await getSocketsInRoom(io, roomName);
  return sockets.size;
}

/**
 * Gets list of online users in a clan
 * Returns array of authenticated user data
 * 
 * @param io - Socket.io server instance
 * @param clanId - Clan's unique identifier
 * @returns Array of online clan members
 * 
 * @example
 * const onlineMembers = await getOnlineClanMembers(io, 'clan456');
 * onlineMembers.forEach(user => {
 *   console.log(`${user.username} is online`);
 * });
 */
export async function getOnlineClanMembers(
  io: Server,
  clanId: string
): Promise<AuthenticatedUser[]> {
  const roomName = WebSocketRooms.clan(clanId);
  const sockets = await io.in(roomName).fetchSockets();
  
  // Extract user data from each socket
  const users: AuthenticatedUser[] = [];
  for (const socket of sockets) {
    const user = socket.data.user as AuthenticatedUser | undefined;
    if (user) {
      users.push(user);
    }
  }
  
  // Remove duplicates (same user, multiple connections)
  const uniqueUsers = users.filter((user, index, self) =>
    index === self.findIndex(u => u.userId === user.userId)
  );
  
  return uniqueUsers;
}

/**
 * Checks if a specific user is online
 * 
 * @param io - Socket.io server instance
 * @param userId - User's unique identifier
 * @returns True if user has at least one active connection
 * 
 * @example
 * const isOnline = await isUserOnline(io, 'user123');
 * if (isOnline) {
 *   console.log('User is currently online');
 * }
 */
export async function isUserOnline(io: Server, userId: string): Promise<boolean> {
  const roomName = WebSocketRooms.user(userId);
  const count = await getRoomUserCount(io, roomName);
  return count > 0;
}

/**
 * Gets all rooms a socket is currently in
 * 
 * @param socket - Socket.io socket instance
 * @returns Array of room names
 * 
 * @example
 * const rooms = getSocketRooms(socket);
 * console.log('User is in rooms:', rooms);
 */
export function getSocketRooms(socket: Socket): string[] {
  // Socket.rooms is a Set that includes the socket ID itself
  // Filter out the socket ID to get only actual room names
  return Array.from(socket.rooms).filter(room => room !== socket.id);
}

// ============================================================================
// LOCATION-BASED ROOM MANAGEMENT
// ============================================================================

/**
 * Updates user's location-based room subscription
 * Leaves old location room and joins new one
 * 
 * @param socket - Socket.io socket instance
 * @param oldX - Previous X coordinate
 * @param oldY - Previous Y coordinate
 * @param newX - New X coordinate
 * @param newY - New Y coordinate
 * 
 * @example
 * await updateLocationRoom(socket, 50, 75, 51, 75);
 * // User moved from (50,75) to (51,75), room subscriptions updated
 */
export async function updateLocationRoom(
  socket: Socket,
  oldX: number,
  oldY: number,
  newX: number,
  newY: number
): Promise<void> {
  // Only update if location actually changed
  if (oldX !== newX || oldY !== newY) {
    await leaveLocationRoom(socket, oldX, oldY);
    await joinLocationRoom(socket, newX, newY);
    console.log(`[Room] Socket ${socket.id} moved from (${oldX},${oldY}) to (${newX},${newY})`);
  }
}

/**
 * Gets all nearby location rooms within a radius
 * Useful for area-of-effect events
 * 
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param radius - Radius in tiles
 * @returns Array of room names
 * 
 * @example
 * const rooms = getNearbyLocationRooms(50, 75, 3);
 * // Returns rooms for all tiles within 3-tile radius
 * rooms.forEach(room => {
 *   io.to(room).emit('game:explosion', { x: 50, y: 75 });
 * });
 */
export function getNearbyLocationRooms(
  centerX: number,
  centerY: number,
  radius: number
): string[] {
  const rooms: string[] = [];
  
  for (let x = centerX - radius; x <= centerX + radius; x++) {
    for (let y = centerY - radius; y <= centerY + radius; y++) {
      // Check if within circular radius (optional, for circular AOE)
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      if (distance <= radius) {
        rooms.push(WebSocketRooms.location(x, y));
      }
    }
  }
  
  return rooms;
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Room Naming Strategy:
 *    - Use consistent naming via WebSocketRooms helper
 *    - Format: `category:identifier` (e.g., 'clan:abc123')
 *    - Enables easy filtering and querying
 * 
 * 2. Performance Optimization:
 *    - Rooms are lightweight (just socket ID sets)
 *    - Minimal overhead for joining/leaving
 *    - Use targeted rooms instead of iterating all sockets
 * 
 * 3. Auto-Join Strategy:
 *    - Join essential rooms on connection (global, user, clan)
 *    - Join optional rooms on demand (battle, location)
 *    - Auto-leave rooms on disconnect (Socket.io handles this)
 * 
 * 4. Presence Tracking:
 *    - Use room membership for online/offline status
 *    - Support multiple connections per user (mobile + desktop)
 *    - Filter duplicates when listing online users
 * 
 * 5. Location-Based Rooms:
 *    - One room per tile coordinate
 *    - Efficient for proximity-based events
 *    - Update rooms when player moves
 *    - Use radius queries for area-of-effect events
 * 
 * 6. Cleanup:
 *    - Socket.io auto-removes sockets from rooms on disconnect
 *    - No manual cleanup required for most cases
 *    - Explicitly leave rooms only for mid-session changes (clan leave, battle end)
 * 
 * FUTURE ENHANCEMENTS:
 * - Add room capacity limits
 * - Implement room-level rate limiting
 * - Add room analytics (join/leave frequency)
 * - Support for temporary rooms with TTL
 * - Private rooms with password protection
 */
