/**
 * @file lib/fastTravelService.ts
 * @created 2025-01-18
 * 
 * OVERVIEW:
 * Fast Travel Network system for instant teleportation to waypoints.
 * 
 * FEATURES:
 * - Set up to 5 waypoints at any location
 * - Instant travel to any set waypoint
 * - 12-hour cooldown per travel use
 * - Waypoints persist forever until manually changed
 * - Tech requirement: fast-travel-network
 * - Named waypoints for easy identification
 * 
 * INTEGRATION:
 * - Called via API endpoint /api/fast-travel
 * - Updates player.currentPosition for instant teleport
 * - Cooldown stored in player document (lastFastTravel field)
 * - Waypoints stored in player document (fastTravelWaypoints array)
 * 
 * TRAVEL MECHANICS:
 * - Player sets waypoint at chosen coordinates with custom name
 * - Maximum 5 waypoints per player
 * - Instant teleportation to any waypoint (no travel time)
 * - 12-hour cooldown starts after each travel
 * - Setting waypoints has no cooldown
 * - Can overwrite existing waypoints
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq, isNotNull, sql } from 'drizzle-orm';

/**
 * Waypoint definition
 */
export interface Waypoint {
  name: string;
  x: number;
  y: number;
  setAt: Date;
}

/**
 * Fast travel configuration
 */
const TRAVEL_CONFIG = {
  MAX_WAYPOINTS: 5,
  COOLDOWN_HOURS: 12,
} as const;

/**
 * Set a waypoint
 */
export async function setWaypoint(
  playerId: string,
  waypoint: Omit<Waypoint, 'setAt'>
): Promise<{
  success: boolean;
  message: string;
  waypoints?: Waypoint[];
}> {
  const playerRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
  const player = playerRows[0];

  if (!player) {
    return {
      success: false,
      message: 'Player not found',
    };
  }

  // Check tech requirement
  const unlockedTechs = (player.unlockedTechs as string[]) || [];
  if (!unlockedTechs.includes('fast-travel-network')) {
    return {
      success: false,
      message: 'Requires Fast Travel Network technology',
    };
  }

  // Get current waypoints
  const currentWaypoints = (player.fastTravelWaypoints as Waypoint[]) || [];

  // Check if waypoint name already exists (replace it)
  const existingIndex = currentWaypoints.findIndex((w) => w.name === waypoint.name);

  const newWaypoint: Waypoint = {
    ...waypoint,
    setAt: new Date(),
  };

  let updatedWaypoints: Waypoint[];

  if (existingIndex >= 0) {
    // Replace existing waypoint
    updatedWaypoints = [...currentWaypoints];
    updatedWaypoints[existingIndex] = newWaypoint;
  } else {
    // Check max waypoints
    if (currentWaypoints.length >= TRAVEL_CONFIG.MAX_WAYPOINTS) {
      return {
        success: false,
        message: `Maximum ${TRAVEL_CONFIG.MAX_WAYPOINTS} waypoints allowed. Delete or replace an existing one.`,
      };
    }

    // Add new waypoint
    updatedWaypoints = [...currentWaypoints, newWaypoint];
  }

  // Update player document
  await db.update(players).set({
    fastTravelWaypoints: updatedWaypoints as any
  }).where(eq(players.username, playerId));

  return {
    success: true,
    message: existingIndex >= 0
      ? `Waypoint "${waypoint.name}" updated`
      : `Waypoint "${waypoint.name}" created`,
    waypoints: updatedWaypoints,
  };
}

/**
 * Delete a waypoint
 */
export async function deleteWaypoint(
  playerId: string,
  waypointName: string
): Promise<{
  success: boolean;
  message: string;
  waypoints?: Waypoint[];
}> {
  const playerRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
  const player = playerRows[0];

  if (!player) {
    return {
      success: false,
      message: 'Player not found',
    };
  }

  const currentWaypoints = (player.fastTravelWaypoints as Waypoint[]) || [];
  const updatedWaypoints = currentWaypoints.filter((w) => w.name !== waypointName);

  if (updatedWaypoints.length === currentWaypoints.length) {
    return {
      success: false,
      message: `Waypoint "${waypointName}" not found`,
    };
  }

  await db.update(players).set({
    fastTravelWaypoints: updatedWaypoints as any
  }).where(eq(players.username, playerId));

  return {
    success: true,
    message: `Waypoint "${waypointName}" deleted`,
    waypoints: updatedWaypoints,
  };
}

/**
 * Travel to waypoint
 */
export async function travelToWaypoint(
  playerId: string,
  waypointName: string
): Promise<{
  success: boolean;
  message: string;
  position?: { x: number; y: number };
}> {
  const playerRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
  const player = playerRows[0];

  if (!player) {
    return {
      success: false,
      message: 'Player not found',
    };
  }

  // Check tech requirement
  const unlockedTechs = (player.unlockedTechs as string[]) || [];
  if (!unlockedTechs.includes('fast-travel-network')) {
    return {
      success: false,
      message: 'Requires Fast Travel Network technology',
    };
  }

  // Check cooldown
  const lastTravel = player.lastFastTravel as Date | undefined;
  if (lastTravel) {
    const now = new Date();
    const cooldownMs = TRAVEL_CONFIG.COOLDOWN_HOURS * 60 * 60 * 1000;
    const nextTravelTime = new Date(new Date(lastTravel).getTime() + cooldownMs);

    if (now < nextTravelTime) {
      const hoursRemaining = Math.ceil(
        (nextTravelTime.getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      return {
        success: false,
        message: `Fast travel on cooldown. ${hoursRemaining} hours remaining.`,
      };
    }
  }

  // Find waypoint
  const waypoints = (player.fastTravelWaypoints as Waypoint[]) || [];
  const waypoint = waypoints.find((w) => w.name === waypointName);

  if (!waypoint) {
    return {
      success: false,
      message: `Waypoint "${waypointName}" not found`,
    };
  }

  // Teleport player
  const newPosition = { x: waypoint.x, y: waypoint.y };

  await db.update(players).set({
    currentPositionX: newPosition.x,
    currentPositionY: newPosition.y,
    lastFastTravel: new Date(),
  }).where(eq(players.username, playerId));

  return {
    success: true,
    message: `Traveled to "${waypointName}" at (${waypoint.x}, ${waypoint.y})`,
    position: newPosition,
  };
}

/**
 * Get player's waypoints
 */
export async function getWaypoints(playerId: string): Promise<Waypoint[]> {
  const playerRows = await db.select({
    fastTravelWaypoints: players.fastTravelWaypoints
  }).from(players).where(eq(players.username, playerId)).limit(1);

  const player = playerRows[0];
  return (player?.fastTravelWaypoints as Waypoint[]) || [];
}

/**
 * Get fast travel status
 */
export async function getFastTravelStatus(
  playerId: string
): Promise<{
  canTravel: boolean;
  hoursRemaining?: number;
  lastTravel?: Date;
  nextTravelTime?: Date;
  waypoints: Waypoint[];
  waypointCount: number;
  maxWaypoints: number;
}> {
  const playerRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
  const player = playerRows[0];

  if (!player) {
    return {
      canTravel: false,
      waypoints: [],
      waypointCount: 0,
      maxWaypoints: TRAVEL_CONFIG.MAX_WAYPOINTS,
    };
  }

  const waypoints = (player.fastTravelWaypoints as Waypoint[]) || [];
  const lastTravel = player.lastFastTravel as Date | undefined;

  if (!lastTravel) {
    return {
      canTravel: true,
      waypoints,
      waypointCount: waypoints.length,
      maxWaypoints: TRAVEL_CONFIG.MAX_WAYPOINTS,
    };
  }

  const now = new Date();
  const cooldownMs = TRAVEL_CONFIG.COOLDOWN_HOURS * 60 * 60 * 1000;
  const nextTravelTime = new Date(new Date(lastTravel).getTime() + cooldownMs);

  if (now >= nextTravelTime) {
    return {
      canTravel: true,
      lastTravel: new Date(lastTravel),
      waypoints,
      waypointCount: waypoints.length,
      maxWaypoints: TRAVEL_CONFIG.MAX_WAYPOINTS,
    };
  }

  const hoursRemaining = Math.ceil(
    (nextTravelTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  );

  return {
    canTravel: false,
    hoursRemaining,
    lastTravel: new Date(lastTravel),
    nextTravelTime,
    waypoints,
    waypointCount: waypoints.length,
    maxWaypoints: TRAVEL_CONFIG.MAX_WAYPOINTS,
  };
}

/**
 * Get fast travel statistics (admin)
 */
export async function getFastTravelStats(): Promise<{
  totalWaypoints: number;
  playersWithWaypoints: number;
  averageWaypointsPerPlayer: number;
  totalTravels: number;
  topTravelers: Array<{
    playerName: string;
    waypointCount: number;
    lastTravel?: Date;
  }>;
}> {
  const playersWithWaypoints = await db.select({
    username: players.username,
    fastTravelWaypoints: players.fastTravelWaypoints,
    lastFastTravel: players.lastFastTravel,
  }).from(players).where(
    isNotNull(players.fastTravelWaypoints)
  );

  const totalWaypoints = playersWithWaypoints.reduce((sum, p) => {
    const waypoints = (p.fastTravelWaypoints as Waypoint[]) || [];
    return sum + waypoints.length;
  }, 0);

  const totalTravelsResult = await db.select({ count: sql<number>`count(*)` }).from(players).where(
    isNotNull(players.lastFastTravel)
  );
  const totalTravels = totalTravelsResult[0]?.count || 0;

  const topTravelers = playersWithWaypoints
    .map((p) => ({
      playerName: p.username,
      waypointCount: ((p.fastTravelWaypoints as Waypoint[]) || []).length,
      lastTravel: p.lastFastTravel ? new Date(p.lastFastTravel) : undefined,
    }))
    .sort((a, b) => b.waypointCount - a.waypointCount)
    .slice(0, 10);

  return {
    totalWaypoints,
    playersWithWaypoints: playersWithWaypoints.length,
    averageWaypointsPerPlayer:
      playersWithWaypoints.length > 0
        ? totalWaypoints / playersWithWaypoints.length
        : 0,
    totalTravels,
    topTravelers,
  };
}

/**
 * IMPLEMENTATION NOTES:
 * - Waypoints stored in player.fastTravelWaypoints array (max 5)
 * - Each waypoint has name, x, y, setAt timestamp
 * - Setting waypoints has no cooldown, only travel does
 * - Travel cooldown: 12 hours stored in player.lastFastTravel
 * - Tech requirement: 'fast-travel-network' (enforced at API level)
 * - Waypoints can be replaced by setting same name
 * - Instant teleportation updates player.currentPosition
 * - Waypoint names must be unique per player
 * - Persistent until manually deleted or replaced
 * - No validation on coordinates (can set anywhere)
 */
