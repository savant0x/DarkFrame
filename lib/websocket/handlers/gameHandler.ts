/**
 * Game Event Handler
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Handles game-related WebSocket events such as position updates, resource changes,
 * level-ups, and tile ownership changes. Coordinates with database and broadcasts
 * events to relevant users.
 * 
 * Event Categories:
 * - Position Updates: Player movement on the game grid
 * - Resource Changes: Wood, stone, iron, gold, food, energy
 * - Level-ups: Player progression events
 * - Tile Updates: Ownership changes, building construction
 * - Player Presence: Online/offline status
 * 
 * Usage:
 * - Called from Socket.io main event router
 * - Updates database when necessary
 * - Broadcasts to appropriate rooms (location, user, clan)
 */

import type { Server, Socket } from 'socket.io';
import { db } from '@/lib/db';
import { players, tiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth';
import {
  broadcastToLocation,
  broadcastToUser,
  broadcastToClan,
  broadcastTileUpdate,
} from '../broadcast';
import {
  joinLocationRoom,

  updateLocationRoom,
} from '../rooms';
import type {
  GamePositionUpdatePayload,
  GameResourceChangePayload,
  GameLevelUpPayload,
  GameTileUpdatePayload,
} from '@/types/websocket';

export async function handlePositionUpdate(
  io: Server,
  socket: Socket,
  data: { x: number; y: number }
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;
  
  if (!user) {
    console.error('[Game Handler] Position update denied: User not authenticated');
    return;
  }
  
  try {
    const currentUser = await db.select({
      currentPositionX: players.currentPositionX,
      currentPositionY: players.currentPositionY,
    }).from(players).where(eq(players.username, user.userId)).limit(1);
    
    if (currentUser.length === 0) {
      console.error('[Game Handler] User not found in database');
      return;
    }
    
    const oldX = currentUser[0].currentPositionX || 0;
    const oldY = currentUser[0].currentPositionY || 0;
    const { x: newX, y: newY } = data;
    
    if (newX < 0 || newX >= 150 || newY < 0 || newY >= 150) {
      console.error('[Game Handler] Invalid coordinates:', data);
      return;
    }
    
    await db.update(players).set({ 
      currentPositionX: newX, 
      currentPositionY: newY,
    }).where(eq(players.username, user.userId));
    
    await updateLocationRoom(socket, oldX, oldY, newX, newY);
    
    const payload: GamePositionUpdatePayload = {
      userId: user.userId,
      username: user.username,
      x: newX,
      y: newY,
      timestamp: Date.now(),
    };
    
    await broadcastToLocation(io, newX, newY, 'game:position_update', payload);
    
    console.log(`[Game Handler] ${user.username} moved from (${oldX},${oldY}) to (${newX},${newY})`);
    
  } catch (error) {
    console.error('[Game Handler] Failed to handle position update:', error);
  }
}

export async function handleResourceChange(
  io: Server,
  user: AuthenticatedUser,
  resourceType: 'wood' | 'stone' | 'iron' | 'gold' | 'food' | 'energy',
  change: number,
  reason: string
): Promise<void> {
  try {
    const currentUser = await db.select({
      resourcesMetal: players.resourcesMetal,
      resourcesEnergy: players.resourcesEnergy,
    }).from(players).where(eq(players.username, user.userId)).limit(1);
    
    if (currentUser.length === 0) {
      console.error('[Game Handler] User not found for resource change');
      return;
    }
    
    const currentAmount = Number(currentUser[0][resourceType === 'energy' ? 'resourcesEnergy' : 'resourcesMetal'] || 0n);
    const newAmount = Math.max(0, currentAmount + change);
    
    const updateData = resourceType === 'energy'
      ? { resourcesEnergy: newAmount }
      : { resourcesMetal: newAmount };
    
    await db.update(players).set(updateData).where(eq(players.username, user.userId));
    
    const payload: GameResourceChangePayload = {
      userId: user.userId,
      resourceType,
      previousAmount: currentAmount,
      newAmount,
      change,
      reason,
    };
    
    await broadcastToUser(io, user.userId, 'game:resource_change', payload);
    
    console.log(`[Game Handler] ${user.username} ${resourceType}: ${currentAmount} → ${newAmount} (${change >= 0 ? '+' : ''}${change})`);
    
  } catch (error) {
    console.error('[Game Handler] Failed to handle resource change:', error);
  }
}

export async function handleLevelUp(
  io: Server,
  user: AuthenticatedUser,
  newLevel: number,
  unlockedFeatures?: string[]
): Promise<void> {
  try {
    const previousLevel = user.level;
    
    await db.update(players).set({ 
      level: newLevel,
      lastLevelUp: new Date(),
    }).where(eq(players.username, user.userId));
    
    const payload: GameLevelUpPayload = {
      userId: user.userId,
      username: user.username,
      previousLevel,
      newLevel,
      unlockedFeatures,
    };
    
    await broadcastToUser(io, user.userId, 'game:level_up', payload);
    
    if (user.clanId) {
      await broadcastToClan(io, user.clanId, 'game:level_up', payload);
    }
    
    console.log(`[Game Handler] ${user.username} leveled up: ${previousLevel} → ${newLevel}`);
    
  } catch (error) {
    console.error('[Game Handler] Failed to handle level-up:', error);
  }
}

export async function handleTileUpdate(
  io: Server,
  x: number,
  y: number,
  tileType: string,
  owner?: AuthenticatedUser
): Promise<void> {
  try {
    await db.insert(tiles).values({
      x,
      y,
      terrain: tileType,
      baseOwner: owner?.username || null,
    }).onConflictDoUpdate({
      // tiles has a composite primary key (x, y)
      target: [tiles.x, tiles.y],
      set: {
        terrain: tileType,
        baseOwner: owner?.username || null,
      },
    });
    
    const payload: GameTileUpdatePayload = {
      x,
      y,
      tileType,
      ownerId: owner?.userId,
      ownerName: owner?.username,
      clanId: owner?.clanId,
      clanName: owner?.clanName,
    };
    
    await broadcastTileUpdate(io, payload);
    
    console.log(`[Game Handler] Tile (${x},${y}) updated: ${tileType} owned by ${owner?.username || 'none'}`);
    
  } catch (error) {
    console.error('[Game Handler] Failed to handle tile update:', error);
  }
}

export async function handlePlayerOnline(
  io: Server,
  socket: Socket,
  user: AuthenticatedUser
): Promise<void> {
  try {
    const userData = await db.select({
      currentPositionX: players.currentPositionX,
      currentPositionY: players.currentPositionY,
    }).from(players).where(eq(players.username, user.userId)).limit(1);
    
    if (userData.length === 0) return;
    
    const x = userData[0].currentPositionX || 0;
    const y = userData[0].currentPositionY || 0;
    
    await joinLocationRoom(socket, x, y);
    
    await broadcastToLocation(io, x, y, 'game:player_online', {
      userId: user.userId,
      username: user.username,
      level: user.level,
      x,
      y,
    });
    
    if (user.clanId) {
      await broadcastToClan(io, user.clanId, 'game:player_online', {
        userId: user.userId,
        username: user.username,
        level: user.level,
        x,
        y,
      });
    }
    
    console.log(`[Game Handler] ${user.username} came online at (${x},${y})`);
    
  } catch (error) {
    console.error('[Game Handler] Failed to handle player online:', error);
  }
}

export async function handlePlayerOffline(
  io: Server,
  user: AuthenticatedUser
): Promise<void> {
  try {
    if (user.clanId) {
      await broadcastToClan(io, user.clanId, 'game:player_offline', {
        userId: user.userId,
        username: user.username,
      });
    }
    
    console.log(`[Game Handler] ${user.username} went offline`);
    
  } catch (error) {
    console.error('[Game Handler] Failed to handle player offline:', error);
  }
}
