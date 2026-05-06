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
 * - Updates player.current_x/current_y for instant teleport
 * - Cooldown stored in player.last_fast_travel field
 * - Waypoints stored in player_fast_travel_waypoints table
 * 
 * TRAVEL MECHANICS:
 * - Player sets waypoint at chosen coordinates with custom name
 * - Maximum 5 waypoints per player
 * - Instant teleportation to any waypoint (no travel time)
 * - 12-hour cooldown starts after each travel
 * - Setting waypoints has no cooldown
 * - Can overwrite existing waypoints
 */

import { createServiceClient } from '@/lib/supabase/server';

/**
 * Waypoint definition
 */
export interface Waypoint {
  name: string;
  x: number;
  y: number;
  setAt: string;
}

/**
 * Fast travel configuration
 */
const TRAVEL_CONFIG = {
  MAX_WAYPOINTS: 5,
  COOLDOWN_HOURS: 12,
} as const;

// ============================================================================
// HELPERS
// ============================================================================

function toISO(d: Date): string {
  return d.toISOString();
}

function fromISO(s: string): Date {
  return new Date(s);
}

// ============================================================================
// WAYPOINT MANAGEMENT
// ============================================================================

/**
 * Set a waypoint
 */
export async function setWaypoint(
  playerUsername: string,
  waypoint: Omit<Waypoint, 'setAt'>
): Promise<{
  success: boolean;
  message: string;
  waypoints?: Waypoint[];
}> {
  const supabase = createServiceClient();

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('unlocked_techs')
    .eq('username', playerUsername)
    .single();

  if (playerError || !player) {
    return {
      success: false,
      message: 'Player not found',
    };
  }

  const unlockedTechs = player.unlocked_techs || [];
  if (!unlockedTechs.includes('fast-travel-network')) {
    return {
      success: false,
      message: 'Requires Fast Travel Network technology',
    };
  }

  const { data: existingWaypoints, error: fetchError } = await supabase
    .from('player_fast_travel_waypoints')
    .select('*')
    .eq('player_username', playerUsername);

  if (fetchError) {
    return { success: false, message: 'Failed to fetch waypoints' };
  }

  const currentWaypoints = existingWaypoints || [];
  const existingIndex = currentWaypoints.findIndex((w: any) => w.name === waypoint.name);

  const now = toISO(new Date());

  if (existingIndex >= 0) {
    const { data, error } = await supabase
      .from('player_fast_travel_waypoints')
      .update({
        x: waypoint.x,
        y: waypoint.y,
        set_at: now,
      })
      .eq('player_username', playerUsername)
      .eq('name', waypoint.name)
      .select('*');

    if (error) {
      return { success: false, message: 'Failed to update waypoint' };
    }

    const updatedWaypoints: Waypoint[] = (data || []).map((w: any) => ({
      name: w.name,
      x: w.x,
      y: w.y,
      setAt: w.set_at,
    }));

    return {
      success: true,
      message: `Waypoint "${waypoint.name}" updated`,
      waypoints: updatedWaypoints,
    };
  }

  if (currentWaypoints.length >= TRAVEL_CONFIG.MAX_WAYPOINTS) {
    return {
      success: false,
      message: `Maximum ${TRAVEL_CONFIG.MAX_WAYPOINTS} waypoints allowed. Delete or replace an existing one.`,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('player_fast_travel_waypoints')
    .insert({
      player_username: playerUsername,
      name: waypoint.name,
      x: waypoint.x,
      y: waypoint.y,
      set_at: now,
    })
    .select('*');

  if (insertError) {
    return { success: false, message: 'Failed to create waypoint' };
  }

  const allWaypoints = [...currentWaypoints];
  if (inserted?.[0]) {
    allWaypoints.push(inserted[0]);
  }

  const waypointList: Waypoint[] = allWaypoints.map((w: any) => ({
    name: w.name,
    x: w.x,
    y: w.y,
    setAt: w.set_at || now,
  }));

  return {
    success: true,
    message: `Waypoint "${waypoint.name}" created`,
    waypoints: waypointList,
  };
}

/**
 * Delete a waypoint
 */
export async function deleteWaypoint(
  playerUsername: string,
  waypointName: string
): Promise<{
  success: boolean;
  message: string;
  waypoints?: Waypoint[];
}> {
  const supabase = createServiceClient();

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('username')
    .eq('username', playerUsername)
    .single();

  if (playerError || !player) {
    return {
      success: false,
      message: 'Player not found',
    };
  }

  const { data: existing, error: fetchError } = await supabase
    .from('player_fast_travel_waypoints')
    .select('*')
    .eq('player_username', playerUsername)
    .eq('name', waypointName);

  if (fetchError || !existing || existing.length === 0) {
    return {
      success: false,
      message: `Waypoint "${waypointName}" not found`,
    };
  }

  const { error: deleteError } = await supabase
    .from('player_fast_travel_waypoints')
    .delete()
    .eq('player_username', playerUsername)
    .eq('name', waypointName);

  if (deleteError) {
    return { success: false, message: 'Failed to delete waypoint' };
  }

  const { data: remaining } = await supabase
    .from('player_fast_travel_waypoints')
    .select('*')
    .eq('player_username', playerUsername);

  const waypoints: Waypoint[] = (remaining || []).map((w: any) => ({
    name: w.name,
    x: w.x,
    y: w.y,
    setAt: w.set_at,
  }));

  return {
    success: true,
    message: `Waypoint "${waypointName}" deleted`,
    waypoints,
  };
}

/**
 * Travel to waypoint
 */
export async function travelToWaypoint(
  playerUsername: string,
  waypointName: string
): Promise<{
  success: boolean;
  message: string;
  position?: { x: number; y: number };
}> {
  const supabase = createServiceClient();

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('unlocked_techs, last_fast_travel')
    .eq('username', playerUsername)
    .single();

  if (playerError || !player) {
    return {
      success: false,
      message: 'Player not found',
    };
  }

  const unlockedTechs = player.unlocked_techs || [];
  if (!unlockedTechs.includes('fast-travel-network')) {
    return {
      success: false,
      message: 'Requires Fast Travel Network technology',
    };
  }

  const lastTravel = player.last_fast_travel;
  if (lastTravel) {
    const now = new Date();
    const cooldownMs = TRAVEL_CONFIG.COOLDOWN_HOURS * 60 * 60 * 1000;
    const nextTravelTime = new Date(fromISO(lastTravel).getTime() + cooldownMs);

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

  const { data: waypointRows, error: wpError } = await supabase
    .from('player_fast_travel_waypoints')
    .select('*')
    .eq('player_username', playerUsername)
    .eq('name', waypointName);

  if (wpError || !waypointRows || waypointRows.length === 0) {
    return {
      success: false,
      message: `Waypoint "${waypointName}" not found`,
    };
  }

  const waypoint = waypointRows[0];
  const newPosition = { x: waypoint.x, y: waypoint.y };

  const { error: updateError } = await supabase
    .from('players')
    .update({
      current_x: newPosition.x,
      current_y: newPosition.y,
      last_fast_travel: toISO(new Date()),
    })
    .eq('username', playerUsername);

  if (updateError) {
    return { success: false, message: 'Failed to teleport' };
  }

  return {
    success: true,
    message: `Traveled to "${waypointName}" at (${waypoint.x}, ${waypoint.y})`,
    position: newPosition,
  };
}

/**
 * Get player's waypoints
 */
export async function getWaypoints(playerUsername: string): Promise<Waypoint[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('player_fast_travel_waypoints')
    .select('*')
    .eq('player_username', playerUsername);

  if (error || !data) {
    return [];
  }

  return data.map((w: any) => ({
    name: w.name,
    x: w.x,
    y: w.y,
    setAt: w.set_at,
  }));
}

/**
 * Get fast travel status
 */
export async function getFastTravelStatus(
  playerUsername: string
): Promise<{
  canTravel: boolean;
  hoursRemaining?: number;
  lastTravel?: string;
  nextTravelTime?: string;
  waypoints: Waypoint[];
  waypointCount: number;
  maxWaypoints: number;
}> {
  const supabase = createServiceClient();

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('last_fast_travel')
    .eq('username', playerUsername)
    .single();

  if (playerError || !player) {
    return {
      canTravel: false,
      waypoints: [],
      waypointCount: 0,
      maxWaypoints: TRAVEL_CONFIG.MAX_WAYPOINTS,
    };
  }

  const { data: waypointRows, error: wpError } = await supabase
    .from('player_fast_travel_waypoints')
    .select('*')
    .eq('player_username', playerUsername);

  const waypoints: Waypoint[] = (waypointRows || []).map((w: any) => ({
    name: w.name,
    x: w.x,
    y: w.y,
    setAt: w.set_at,
  }));

  const lastTravel = player.last_fast_travel;

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
  const nextTravelTime = new Date(fromISO(lastTravel).getTime() + cooldownMs);

  if (now >= nextTravelTime) {
    return {
      canTravel: true,
      lastTravel,
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
    lastTravel,
    nextTravelTime: toISO(nextTravelTime),
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
    lastTravel?: string;
  }>;
}> {
  const supabase = createServiceClient();

  const { data: waypointRows, error: wpError } = await supabase
    .from('player_fast_travel_waypoints')
    .select('player_username');

  if (wpError || !waypointRows) {
    return {
      totalWaypoints: 0,
      playersWithWaypoints: 0,
      averageWaypointsPerPlayer: 0,
      totalTravels: 0,
      topTravelers: [],
    };
  }

  const waypointsByPlayer = new Map<string, number>();
  for (const row of waypointRows) {
    const count = waypointsByPlayer.get(row.player_username) || 0;
    waypointsByPlayer.set(row.player_username, count + 1);
  }

  const totalWaypoints = waypointRows.length;
  const playersWithWaypoints = waypointsByPlayer.size;

  const { count: totalTravels } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('last_fast_travel', 'is', null);

  const uniquePlayers = Array.from(waypointsByPlayer.keys());
  const { data: playerRows } = await supabase
    .from('players')
    .select('username, last_fast_travel')
    .in('username', uniquePlayers.length > 0 ? uniquePlayers : ['__none__']);

  const playerMap = new Map<string, { lastFastTravel: string | null }>();
  if (playerRows) {
    for (const p of playerRows) {
      playerMap.set(p.username, { lastFastTravel: p.last_fast_travel });
    }
  }

  const topTravelers = Array.from(waypointsByPlayer.entries())
    .map(([playerName, waypointCount]) => ({
      playerName,
      waypointCount,
      lastTravel: playerMap.get(playerName)?.lastFastTravel || undefined,
    }))
    .sort((a, b) => b.waypointCount - a.waypointCount)
    .slice(0, 10);

  return {
    totalWaypoints,
    playersWithWaypoints,
    averageWaypointsPerPlayer:
      playersWithWaypoints > 0
        ? totalWaypoints / playersWithWaypoints
        : 0,
    totalTravels: totalTravels || 0,
    topTravelers,
  };
}

/**
 * IMPLEMENTATION NOTES:
 * - Waypoints stored in player_fast_travel_waypoints table (max 5)
 * - Each waypoint has name, x, y, set_at timestamp
 * - Setting waypoints has no cooldown, only travel does
 * - Travel cooldown: 12 hours stored in player.last_fast_travel
 * - Tech requirement: 'fast-travel-network' (enforced at API level)
 * - Waypoints can be replaced by setting same name
 * - Instant teleportation updates player.current_x/current_y
 * - Waypoint names must be unique per player
 * - Persistent until manually deleted or replaced
 * - No validation on coordinates (can set anywhere)
 */
