/**
 * Game Event Handler
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Handles game-related WebSocket events such as position updates, resource changes,
 * level-ups, and tile ownership changes. Coordinates with database and broadcasts
 * events to relevant users.
 */

import type { Server, Socket } from 'socket.io';
import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { AuthenticatedUser } from '../auth';
import {
  broadcastToLocation,
  broadcastToUser,
  broadcastToClan,
  broadcastTileUpdate,
} from '../broadcast';
import {
  joinLocationRoom,
  leaveLocationRoom,
  updateLocationRoom,
} from '../rooms';
import type {
  GamePositionUpdatePayload,
  GameResourceChangePayload,
  GameLevelUpPayload,
  GameTileUpdatePayload,
} from '@/types/websocket';

// ============================================================================
// POSITION UPDATE HANDLER
// ============================================================================

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
    const supabase = createServiceClient();
    
    const { data: currentUser, error: findErr } = await supabase
      .from('players')
      .select('current_x, current_y')
      .eq('username', user.username)
      .single();
    
    if (findErr || !currentUser) {
      console.error('[Game Handler] User not found in database');
      return;
    }
    
    const oldX = currentUser.current_x || 0;
    const oldY = currentUser.current_y || 0;
    const { x: newX, y: newY } = data;
    
    if (newX < 0 || newX >= 150 || newY < 0 || newY >= 150) {
      console.error('[Game Handler] Invalid coordinates:', data);
      return;
    }
    
    const now = Date.now();
    
    await supabase
      .from('players')
      .update({ current_x: newX, current_y: newY })
      .eq('username', user.username);
    
    await updateLocationRoom(socket, oldX, oldY, newX, newY);
    
    const payload: GamePositionUpdatePayload = {
      userId: user.userId,
      username: user.username,
      x: newX,
      y: newY,
      timestamp: now,
    };
    
    await broadcastToLocation(io, newX, newY, 'game:position_update', payload);
    
    console.log(`[Game Handler] ${user.username} moved from (${oldX},${oldY}) to (${newX},${newY})`);
    
  } catch (error) {
    console.error('[Game Handler] Failed to handle position update:', error);
  }
}

// ============================================================================
// RESOURCE CHANGE HANDLER
// ============================================================================

export async function handleResourceChange(
  io: Server,
  user: AuthenticatedUser,
  resourceType: 'metal' | 'energy',
  change: number,
  reason: string
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const column = resourceType === 'metal' ? 'resources_metal' : 'resources_energy';
    
    const { data: currentUser, error: findErr } = await supabase
      .from('players')
      .select(column)
      .eq('username', user.username)
      .single();
    
    if (findErr || !currentUser) {
      console.error('[Game Handler] User not found for resource change');
      return;
    }
    
    const previousAmount = (currentUser as Record<string, number>)[column] || 0;
    const newAmount = Math.max(0, previousAmount + change);
    
    await supabase
      .from('players')
      .update(
        resourceType === 'metal'
          ? { resources_metal: newAmount }
          : { resources_energy: newAmount }
      )
      .eq('username', user.username);
    
    const payload: GameResourceChangePayload = {
      userId: user.userId,
      resourceType: resourceType === 'metal' ? 'gold' : 'energy',
      previousAmount,
      newAmount,
      change,
      reason,
    };
    
    await broadcastToUser(io, user.userId, 'game:resource_change', payload);
    
    console.log(`[Game Handler] ${user.username} ${resourceType}: ${previousAmount} \u2192 ${newAmount} (${change >= 0 ? '+' : ''}${change})`);
    
  } catch (error) {
    console.error('[Game Handler] Failed to handle resource change:', error);
  }
}

// ============================================================================
// LEVEL-UP HANDLER
// ============================================================================

export async function handleLevelUp(
  io: Server,
  user: AuthenticatedUser,
  newLevel: number,
  unlockedFeatures?: string[]
): Promise<void> {
  try {
    const supabase = createServiceClient();
    
    const previousLevel = user.level;
    
    await supabase
      .from('players')
      .update({ level: newLevel })
      .eq('username', user.username);
    
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
    
    console.log(`[Game Handler] ${user.username} leveled up: ${previousLevel} \u2192 ${newLevel}`);
    
  } catch (error) {
    console.error('[Game Handler] Failed to handle level-up:', error);
  }
}

// ============================================================================
// TILE UPDATE HANDLER
// ============================================================================

export async function handleTileUpdate(
  io: Server,
  x: number,
  y: number,
  tileType: string,
  owner?: AuthenticatedUser
): Promise<void> {
  try {
    const supabase = createServiceClient();
    
    const { data: existing } = await supabase
      .from('tiles')
      .select('x, y')
      .eq('x', x)
      .eq('y', y)
      .single();

    if (existing) {
      await supabase
        .from('tiles')
        .update({
          terrain: tileType as Database['public']['Enums']['terrain_type'],
          base_owner: owner?.username || null,
          occupied_by_base: !!owner,
        })
        .eq('x', x)
        .eq('y', y);
    } else {
      await supabase
        .from('tiles')
        .insert({
          x,
          y,
          terrain: tileType as Database['public']['Enums']['terrain_type'],
          base_owner: owner?.username || null,
          occupied_by_base: !!owner,
        });
    }
    
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

// ============================================================================
// PLAYER PRESENCE HANDLERS
// ============================================================================

export async function handlePlayerOnline(
  io: Server,
  socket: Socket,
  user: AuthenticatedUser
): Promise<void> {
  try {
    const supabase = createServiceClient();
    
    const { data: userData, error: findErr } = await supabase
      .from('players')
      .select('current_x, current_y')
      .eq('username', user.username)
      .single();
    
    if (findErr || !userData) return;
    
    const x = userData.current_x || 0;
    const y = userData.current_y || 0;
    
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
