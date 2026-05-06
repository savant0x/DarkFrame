/**
 * @file lib/websocket/handlers/wmdHandler.ts
 * @created 2025-10-22
 * @overview WMD WebSocket Event Handlers
 * 
 * OVERVIEW:
 * Handles real-time WebSocket events for WMD system including missile launches,
 * defense intercepts, research completions, spy operations, and clan votes.
 * 
 * Features:
 * - Missile launch/impact notifications
 * - Defense interception alerts
 * - Research completion broadcasts
 * - Spy mission results
 * - Clan vote updates
 * - Real-time status updates
 * 
 * Dependencies:
 * - /lib/websocket/broadcast.ts for broadcasting
 * - /lib/websocket/rooms.ts for room management
 * - /types/websocket for event types
 */

import type { Server, Socket } from 'socket.io';
import { WebSocketRooms } from '@/types/websocket';

// ============================================================================
// WMD EVENT BROADCASTERS
// ============================================================================

/**
 * Broadcast missile launch event to launcher and target
 */
export async function broadcastMissileLaunch(
  io: Server,
  data: {
    missileId: string;
    launcherId: string;
    launcherName: string;
    targetId: string;
    targetName: string;
    warheadType: string;
    impactAt: Date;
  }
): Promise<void> {
  try {
    // Notify launcher
    io.to(`user:${data.launcherId}`).emit('wmd:missile_launched', {
      missileId: data.missileId,
      targetName: data.targetName,
      warheadType: data.warheadType,
      impactAt: data.impactAt.toISOString(),
      message: `🚀 Missile launched at ${data.targetName}!`,
    });

    // Alert target
    io.to(`user:${data.targetId}`).emit('wmd:incoming_missile', {
      missileId: data.missileId,
      launcherName: data.launcherName,
      warheadType: data.warheadType,
      impactAt: data.impactAt.toISOString(),
      message: `⚠️ INCOMING MISSILE from ${data.launcherName}!`,
    });

    console.log(`[WMD] Missile ${data.missileId} launched: ${data.launcherName} → ${data.targetName}`);
  } catch (error) {
    console.error('[WMD] Error broadcasting missile launch:', error);
  }
}

/**
 * Broadcast missile impact event
 */
export async function broadcastMissileImpact(
  io: Server,
  data: {
    missileId: string;
    launcherId: string;
    launcherName: string;
    targetId: string;
    targetName: string;
    warheadType: string;
    damageDealt: number;
    intercepted: boolean;
    interceptedBy?: string;
  }
): Promise<void> {
  try {
    if (data.intercepted && data.interceptedBy) {
      // Notify all parties about interception
      io.to(`user:${data.launcherId}`).emit('wmd:missile_intercepted', {
        missileId: data.missileId,
        targetName: data.targetName,
        interceptedBy: data.interceptedBy,
        message: `🛡️ Your missile was intercepted by ${data.interceptedBy}!`,
      });

      io.to(`user:${data.targetId}`).emit('wmd:missile_intercepted', {
        missileId: data.missileId,
        launcherName: data.launcherName,
        interceptedBy: data.interceptedBy,
        message: `🛡️ Missile from ${data.launcherName} was intercepted!`,
      });

      io.to(`user:${data.interceptedBy}`).emit('wmd:interception_success', {
        missileId: data.missileId,
        launcherName: data.launcherName,
        message: `✅ Successfully intercepted missile from ${data.launcherName}!`,
      });
    } else {
      // Notify about impact
      io.to(`user:${data.launcherId}`).emit('wmd:missile_impact', {
        missileId: data.missileId,
        targetName: data.targetName,
        warheadType: data.warheadType,
        damageDealt: data.damageDealt,
        message: `💥 Missile hit ${data.targetName} for ${data.damageDealt} damage!`,
      });

      io.to(`user:${data.targetId}`).emit('wmd:missile_impact', {
        missileId: data.missileId,
        launcherName: data.launcherName,
        warheadType: data.warheadType,
        damageDealt: data.damageDealt,
        message: `💥 Hit by ${data.launcherName}'s ${data.warheadType} missile!`,
      });
    }

    console.log(`[WMD] Missile ${data.missileId} impact: intercepted=${data.intercepted}`);
  } catch (error) {
    console.error('[WMD] Error broadcasting missile impact:', error);
  }
}

/**
 * Broadcast research completion to player
 */
export async function broadcastResearchComplete(
  io: Server,
  data: {
    playerId: string;
    techId: string;
    techName: string;
    category: string;
  }
): Promise<void> {
  try {
    io.to(`user:${data.playerId}`).emit('wmd:research_complete', {
      techId: data.techId,
      techName: data.techName,
      category: data.category,
      message: `🔬 Research complete: ${data.techName}!`,
    });

    console.log(`[WMD] Research complete: ${data.playerId} → ${data.techName}`);
  } catch (error) {
    console.error('[WMD] Error broadcasting research completion:', error);
  }
}

/**
 * Broadcast spy mission result to player
 */
export async function broadcastSpyMissionComplete(
  io: Server,
  data: {
    playerId: string;
    missionId: string;
    spyName: string;
    targetName: string;
    missionType: string;
    success: boolean;
    intelligence?: string;
  }
): Promise<void> {
  try {
    io.to(`user:${data.playerId}`).emit('wmd:spy_mission_complete', {
      missionId: data.missionId,
      spyName: data.spyName,
      targetName: data.targetName,
      missionType: data.missionType,
      success: data.success,
      intelligence: data.intelligence,
      message: data.success
        ? `🕵️ ${data.spyName} completed mission against ${data.targetName}`
        : `❌ ${data.spyName} mission failed against ${data.targetName}`,
    });

    console.log(`[WMD] Spy mission complete: ${data.missionId} success=${data.success}`);
  } catch (error) {
    console.error('[WMD] Error broadcasting spy mission:', error);
  }
}

/**
 * Broadcast clan vote update to all clan members
 */
export async function broadcastClanVoteUpdate(
  io: Server,
  data: {
    clanId: string;
    voteId: string;
    voteType: string;
    proposer: string;
    targetName?: string;
    status: string;
    votesFor: number;
    votesAgainst: number;
    requiredVotes: number;
  }
): Promise<void> {
  try {
    const roomName = `clan:${data.clanId}`;
    
    io.to(roomName).emit('wmd:vote_update', {
      voteId: data.voteId,
      voteType: data.voteType,
      proposer: data.proposer,
      targetName: data.targetName,
      status: data.status,
      votesFor: data.votesFor,
      votesAgainst: data.votesAgainst,
      requiredVotes: data.requiredVotes,
      message: data.status === 'ACTIVE'
        ? `🗳️ ${data.proposer} proposed ${data.voteType}`
        : `🗳️ Vote ${data.status}: ${data.voteType}`,
    });

    console.log(`[WMD] Clan vote update: ${data.voteId} status=${data.status}`);
  } catch (error) {
    console.error('[WMD] Error broadcasting clan vote:', error);
  }
}

/**
 * Broadcast defense battery deployed
 */
export async function broadcastBatteryDeployed(
  io: Server,
  data: {
    playerId: string;
    batteryId: string;
    batteryType: string;
    interceptChance: number;
  }
): Promise<void> {
  try {
    io.to(`user:${data.playerId}`).emit('wmd:battery_deployed', {
      batteryId: data.batteryId,
      batteryType: data.batteryType,
      interceptChance: data.interceptChance,
      message: `🛡️ ${data.batteryType} defense battery deployed!`,
    });

    console.log(`[WMD] Battery deployed: ${data.batteryId} type=${data.batteryType}`);
  } catch (error) {
    console.error('[WMD] Error broadcasting battery deployment:', error);
  }
}

/**
 * Broadcast spy recruited
 */
export async function broadcastSpyRecruited(
  io: Server,
  data: {
    playerId: string;
    spyId: string;
    spyName: string;
    specialization: string;
  }
): Promise<void> {
  try {
    io.to(`user:${data.playerId}`).emit('wmd:spy_recruited', {
      spyId: data.spyId,
      spyName: data.spyName,
      specialization: data.specialization,
      message: `🕵️ Recruited ${data.spyName} (${data.specialization})!`,
    });

    console.log(`[WMD] Spy recruited: ${data.spyId} spec=${data.specialization}`);
  } catch (error) {
    console.error('[WMD] Error broadcasting spy recruitment:', error);
  }
}

/**
 * Broadcast counter-intelligence detection
 */
export async function broadcastCounterIntelDetection(
  io: Server,
  data: {
    playerId: string;
    spiesDetected: Array<{ codename: string; specialization: string }>;
  }
): Promise<void> {
  try {
    io.to(`user:${data.playerId}`).emit('wmd:counter_intel_alert', {
      spiesDetected: data.spiesDetected,
      message: data.spiesDetected.length > 0
        ? `⚠️ Detected ${data.spiesDetected.length} enemy spy(ies)!`
        : '✅ No enemy spies detected',
    });

    console.log(`[WMD] Counter-intel: ${data.playerId} detected ${data.spiesDetected.length} spies`);
  } catch (error) {
    console.error('[WMD] Error broadcasting counter-intel:', error);
  }
}

// ============================================================================
// EXPORT ALL HANDLERS
// ============================================================================

export const wmdHandlers = {
  broadcastMissileLaunch,
  broadcastMissileImpact,
  broadcastResearchComplete,
  broadcastSpyMissionComplete,
  broadcastClanVoteUpdate,
  broadcastBatteryDeployed,
  broadcastSpyRecruited,
  broadcastCounterIntelDetection,
};
