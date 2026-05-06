/**
 * @file lib/wmd/websocketIntegration.example.ts
 * @created 2025-10-22
 * @overview WMD WebSocket Integration Examples
 * 
 * OVERVIEW:
 * Example code showing how to integrate WMD WebSocket broadcasts into
 * API routes and background jobs. Copy these patterns into your implementations.
 * 
 * USAGE INSTRUCTIONS:
 * 1. Import the socket server instance in your API route/service
 * 2. Call the appropriate broadcast function after completing an action
 * 3. Ensure you have the necessary data (IDs, names, etc.) before broadcasting
 * 
 * NOTE: This is an EXAMPLE FILE for reference. Do not import directly.
 */

import type { Server } from 'socket.io';
import { wmdHandlers } from '@/lib/websocket/handlers/wmdHandler';

// ============================================================================
// EXAMPLE 1: Missile Launch (in /app/api/wmd/missiles/route.ts)
// ============================================================================

async function exampleMissileLaunch(io: Server) {
  // After successfully creating and launching a missile...
  
  await wmdHandlers.broadcastMissileLaunch(io, {
    missileId: 'missile_123',
    launcherId: 'player_456',
    launcherName: 'PlayerName',
    targetId: 'player_789',
    targetName: 'TargetName',
    warheadType: 'TACTICAL',
    impactAt: new Date(Date.now() + 60000), // 1 minute from now
  });
}

// ============================================================================
// EXAMPLE 2: Research Completion (in background job)
// ============================================================================

async function exampleResearchComplete(io: Server) {
  // After marking research as completed...
  
  await wmdHandlers.broadcastResearchComplete(io, {
    playerId: 'player_123',
    techId: 'missile_tier_3',
    techName: 'Tactical Warheads',
    category: 'MISSILE',
  });
}

// ============================================================================
// EXAMPLE 3: Spy Mission Complete (in background job)
// ============================================================================

async function exampleSpyMissionComplete(io: Server) {
  // After spy mission finishes...
  
  await wmdHandlers.broadcastSpyMissionComplete(io, {
    playerId: 'player_123',
    missionId: 'mission_456',
    spyName: 'Agent Shadow',
    targetName: 'EnemyPlayer',
    missionType: 'SURVEILLANCE',
    success: true,
    intelligence: 'Target has 3 missiles ready',
  });
}

// ============================================================================
// EXAMPLE 4: Clan Vote Update (in /app/api/wmd/voting/route.ts)
// ============================================================================

async function exampleVoteUpdate(io: Server) {
  // After a vote is cast or status changes...
  
  await wmdHandlers.broadcastClanVoteUpdate(io, {
    clanId: 'clan_123',
    voteId: 'vote_456',
    voteType: 'MISSILE_LAUNCH',
    proposer: 'ClanLeader',
    targetName: 'EnemyClan',
    status: 'ACTIVE',
    votesFor: 5,
    votesAgainst: 2,
    requiredVotes: 8,
  });
}

// ============================================================================
// EXAMPLE 5: Defense Battery Deployed (in /app/api/wmd/defense/route.ts)
// ============================================================================

async function exampleBatteryDeployed(io: Server) {
  // After successfully deploying a battery...
  
  await wmdHandlers.broadcastBatteryDeployed(io, {
    playerId: 'player_123',
    batteryId: 'battery_456',
    batteryType: 'ADVANCED',
    interceptChance: 75,
  });
}

// ============================================================================
// HOW TO GET SOCKET.IO SERVER INSTANCE
// ============================================================================

/**
 * Option 1: In API Routes (Next.js App Router)
 * 
 * You'll need to store the Socket.io server instance globally.
 * In your server.ts or websocket initialization:
 * 
 * ```typescript
 * import { Server } from 'socket.io';
 * 
 * let io: Server;
 * 
 * export function initializeWebSocket(httpServer) {
 *   io = new Server(httpServer);
 *   return io;
 * }
 * 
 * export function getSocketServer(): Server {
 *   if (!io) throw new Error('Socket.io not initialized');
 *   return io;
 * }
 * ```
 * 
 * Then in API routes:
 * 
 * ```typescript
 * import { getSocketServer } from '@/lib/websocket/server';
 * import { wmdHandlers } from '@/lib/websocket/handlers/wmdHandler';
 * 
 * export async function POST(req: NextRequest) {
 *   // ... your logic ...
 *   
 *   const io = getSocketServer();
 *   await wmdHandlers.broadcastMissileLaunch(io, {...});
 *   
 *   return NextResponse.json({ success: true });
 * }
 * ```
 */

/**
 * Option 2: In Background Jobs
 * 
 * Same pattern as API routes - import getSocketServer()
 * and use it in your background job functions.
 * 
 * ```typescript
 * import { getSocketServer } from '@/lib/websocket/server';
 * 
 * export async function missileFlightTracker() {
 *   const io = getSocketServer();
 *   
 *   // Check for impacted missiles
 *   const impactedMissiles = await findImpactedMissiles();
 *   
 *   for (const missile of impactedMissiles) {
 *     await wmdHandlers.broadcastMissileImpact(io, {
 *       missileId: missile.id,
 *       launcherId: missile.ownerId,
 *       launcherName: missile.ownerName,
 *       targetId: missile.targetId,
 *       targetName: missile.targetName,
 *       warheadType: missile.warheadType,
 *       damageDealt: missile.damageDealt,
 *       intercepted: false,
 *     });
 *   }
 * }
 * ```
 */

// ============================================================================
// INTEGRATION CHECKLIST
// ============================================================================

/**
 * To fully integrate WMD WebSocket notifications:
 * 
 * ✅ Phase 3 Complete:
 * - [x] Created wmdHandler.ts with broadcast functions
 * - [x] Added WMD event types to types/websocket.ts
 * - [x] Created useWMDNotifications hook
 * - [x] Integrated hook into WMDHub component
 * 
 * ⏳ Phase 4 TODO (Background Jobs):
 * - [ ] Add broadcasts to missile launch API (/app/api/wmd/missiles/route.ts)
 * - [ ] Add broadcasts to defense deploy API (/app/api/wmd/defense/route.ts)
 * - [ ] Add broadcasts to spy recruit API (/app/api/wmd/intelligence/route.ts)
 * - [ ] Add broadcasts to voting API (/app/api/wmd/voting/route.ts)
 * - [ ] Create missile flight tracking job with impact broadcasts
 * - [ ] Create research completion job with broadcast
 * - [ ] Create spy mission completion job with broadcast
 * - [ ] Test real-time updates across multiple browser tabs/users
 * 
 * 📝 Implementation Notes:
 * - Broadcasts are non-blocking (async but don't need await in most cases)
 * - Error handling is built into broadcast functions
 * - All broadcasts automatically log to console
 * - User rooms are formatted as `user:${playerId}`
 * - Clan rooms are formatted as `clan:${clanId}`
 */
