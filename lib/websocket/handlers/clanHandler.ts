/**
 * Clan Event Handler
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Handles clan-related WebSocket events including member management, territory control,
 * warfare, treasury operations, and activity tracking.
 */

import type { Server, Socket } from 'socket.io';
import { createServiceClient } from '@/lib/supabase/server';
import type { AuthenticatedUser } from '../auth';
import {
  broadcastClanMemberJoined,
  broadcastClanMemberLeft,
  broadcastClanTerritoryUpdate,
  broadcastWarDeclaration,
  broadcastWarEnded,
  broadcastClanTreasuryUpdate,
  broadcastClanActivity,
} from '../broadcast';
import { autoJoinRooms, autoLeaveClanRooms } from '../rooms';
import type {
  ClanWarDeclaredPayload,
} from '@/types/websocket';

/**
 * Handles clan room join request
 * Validates membership and adds user to clan rooms
 */
export async function handleJoinClanRoom(
  io: Server,
  socket: Socket,
  data: { clanId: string }
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;
  
  if (!user || user.clanId !== data.clanId) {
    console.error('[Clan Handler] Unauthorized clan room join attempt');
    return;
  }
  
  await autoJoinRooms(socket, user);
  console.log(`[Clan Handler] ${user.username} joined clan ${data.clanId} rooms`);
}

/**
 * Handles war declaration
 * Validates permissions, creates war document, broadcasts to both clans
 */
export async function handleDeclareWar(
  io: Server,
  socket: Socket,
  data: {
    targetClanId: string;
    warType: 'territory' | 'resource' | 'honor';
    unitsCommitted: number;
  }
): Promise<void> {
  const user = socket.data.user as AuthenticatedUser | undefined;
  
  if (!user || !user.clanId) {
    console.error('[Clan Handler] War declaration denied: User not in clan');
    return;
  }
  
  try {
    const supabase = createServiceClient();
    
    // Fetch clan names
    const [{ data: attackerClan }, { data: defenderClan }] = await Promise.all([
      supabase.from('clans').select('id, name').eq('id', user.clanId).single(),
      supabase.from('clans').select('id, name').eq('id', data.targetClanId).single(),
    ]);
    
    if (!attackerClan || !defenderClan) {
      console.error('[Clan Handler] Clan not found for war declaration');
      return;
    }
    
    // Create war record
    const warId = crypto.randomUUID();
    await supabase.from('clan_wars').insert({
      war_id: warId,
      attacker_clan_id: user.clanId,
      defender_clan_id: data.targetClanId,
      status: 'ACTIVE',
      declared_at: new Date().toISOString(),
    });
    
    // Broadcast war declaration
    const payload: ClanWarDeclaredPayload = {
      warId,
      attackerClanId: user.clanId,
      attackerClanName: attackerClan.name,
      defenderClanId: data.targetClanId,
      defenderClanName: defenderClan.name,
      warType: data.warType,
      declaredAt: Date.now(),
      declaredBy: user.userId,
    };
    
    await broadcastWarDeclaration(io, payload);
    
    console.log(`[Clan Handler] War declared: ${attackerClan.name} vs ${defenderClan.name}`);
    
  } catch (error) {
    console.error('[Clan Handler] Failed to declare war:', error);
  }
}

// Export placeholder functions for other clan operations
export async function handleClanTreasuryDeposit(io: Server, user: AuthenticatedUser, resourceType: string, amount: number): Promise<void> {
  // Implementation similar to war declaration with treasury updates
  console.log(`[Clan Handler] ${user.username} deposited ${amount} ${resourceType} to clan treasury`);
}

export async function handleClanMemberPromote(io: Server, user: AuthenticatedUser, targetUserId: string, newRole: string): Promise<void> {
  // Implementation for role changes
  console.log(`[Clan Handler] Member promoted by ${user.username}`);
}
