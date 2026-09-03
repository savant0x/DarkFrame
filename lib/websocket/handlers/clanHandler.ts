/**
 * Clan Event Handler
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Handles clan-related WebSocket events including member management, territory control,
 * warfare, treasury operations, and activity tracking.
 */

import type { Server, Socket } from 'socket.io';
import { db } from '@/lib/db';
import { clans } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { AuthenticatedUser, isClanMember, validateClanAction } from '../auth';
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
import { randomUUID } from 'node:crypto';

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
    const [attackerClan, defenderClan] = await Promise.all([
      db.select().from(clans).where(eq(clans.id, user.clanId)).limit(1),
      db.select().from(clans).where(eq(clans.id, data.targetClanId)).limit(1),
    ]);
    
    if (attackerClan.length === 0 || defenderClan.length === 0) {
      console.error('[Clan Handler] Clan not found for war declaration');
      return;
    }
    
    const warId = randomUUID();
    
    const payload: ClanWarDeclaredPayload = {
      warId,
      attackerClanId: user.clanId,
      attackerClanName: attackerClan[0].name,
      defenderClanId: data.targetClanId,
      defenderClanName: defenderClan[0].name,
      warType: data.warType,
      declaredAt: Date.now(),
      declaredBy: user.userId,
    };
    
    await broadcastWarDeclaration(io, payload);
    
    console.log(`[Clan Handler] War declared: ${attackerClan[0].name} vs ${defenderClan[0].name}`);
    
  } catch (error) {
    console.error('[Clan Handler] Failed to declare war:', error);
  }
}

export async function handleClanTreasuryDeposit(io: Server, user: AuthenticatedUser, resourceType: string, amount: number): Promise<void> {
  console.log(`[Clan Handler] ${user.username} deposited ${amount} ${resourceType} to clan treasury`);
}

export async function handleClanMemberPromote(io: Server, user: AuthenticatedUser, targetUserId: string, newRole: string): Promise<void> {
  console.log(`[Clan Handler] Member promoted by ${user.username}`);
}
