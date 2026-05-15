/**
 * @file lib/concentrationZoneService.ts
 * @created 2025-01-18
 * 
 * OVERVIEW:
 * Bot Concentration Zone system for controlling bot spawn distribution.
 * 
 * FEATURES:
 * - Players define up to 3 zones (30×30 tiles each)
 * - 70% of new bot spawns directed to player's zones
 * - Zones persistent until manually changed
 * - Tech requirement: bot-concentration-zones
 * - Zone validation (no overlapping, within map bounds)
 * - Zone visualization data for UI
 * 
 * INTEGRATION:
 * - Called by bot spawn logic in scripts/spawnBots.ts
 * - API endpoints for zone management
 * - Stored in player document (concentrationZones field)
 * 
 * ZONE MECHANICS:
 * - Each zone: center (x,y) + 30×30 area (±15 from center)
 * - 70% spawn chance when player has zones defined
 * - Random zone selection if multiple zones configured
 * - Falls back to normal spawn if no zones or 30% chance
 */

import { createServiceClient } from '@/lib/supabase/server';
import { toJsonb, fromJsonbArray } from '@/lib/supabase/jsonb';
import type { Json } from '@/types/database';
import { type Player } from '@/types/game.types';

/**
 * Concentration zone definition
 */
export interface ConcentrationZone {
  centerX: number;
  centerY: number;
  size: number;  // Default 30×30
  name?: string; // Optional label for UI
}

/**
 * Zone configuration
 */
const ZONE_CONFIG = {
  MAX_ZONES: 3,
  ZONE_SIZE: 30,
  SPAWN_CHANCE: 0.70,  // 70% of spawns
  HALF_SIZE: 15,       // ±15 from center
} as const;

/**
 * Validate zone placement
 */
function validateZone(zone: ConcentrationZone): { valid: boolean; error?: string } {
  // Check bounds (assuming 5000×5000 map)
  const MAP_SIZE = 5000;
  const minX = zone.centerX - ZONE_CONFIG.HALF_SIZE;
  const maxX = zone.centerX + ZONE_CONFIG.HALF_SIZE;
  const minY = zone.centerY - ZONE_CONFIG.HALF_SIZE;
  const maxY = zone.centerY + ZONE_CONFIG.HALF_SIZE;

  if (minX < 0 || maxX > MAP_SIZE || minY < 0 || maxY > MAP_SIZE) {
    return {
      valid: false,
      error: `Zone extends outside map bounds (0-${MAP_SIZE})`,
    };
  }

  return { valid: true };
}

/**
 * Check if zones overlap
 */
function checkOverlap(zone1: ConcentrationZone, zone2: ConcentrationZone): boolean {
  const dx = Math.abs(zone1.centerX - zone2.centerX);
  const dy = Math.abs(zone1.centerY - zone2.centerY);
  
  // If centers are less than zone size apart, they overlap
  return dx < ZONE_CONFIG.ZONE_SIZE && dy < ZONE_CONFIG.ZONE_SIZE;
}

/**
 * Set player's concentration zones
 */
export async function setConcentrationZones(
  playerId: string,
  zones: ConcentrationZone[]
): Promise<{
  success: boolean;
  message: string;
  zones?: ConcentrationZone[];
}> {
  // Validate zone count
  if (zones.length > ZONE_CONFIG.MAX_ZONES) {
    return {
      success: false,
      message: `Maximum ${ZONE_CONFIG.MAX_ZONES} zones allowed`,
    };
  }

  // Validate each zone
  for (let i = 0; i < zones.length; i++) {
    const validation = validateZone(zones[i]);
    if (!validation.valid) {
      return {
        success: false,
        message: `Zone ${i + 1}: ${validation.error}`,
      };
    }

    // Ensure zone has size property
    zones[i].size = ZONE_CONFIG.ZONE_SIZE;
  }

  // Check for overlaps
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      if (checkOverlap(zones[i], zones[j])) {
        return {
          success: false,
          message: `Zones ${i + 1} and ${j + 1} overlap`,
        };
      }
    }
  }

  // Update player document
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('players')
    .update({ concentration_zones: toJsonb({ zones } as Record<string, unknown>) })
    .eq('username', playerId);

  if (error) {
    return {
      success: false,
      message: 'Failed to update zones',
    };
  }

  return {
    success: true,
    message: `${zones.length} concentration zone(s) set successfully`,
    zones,
  };
}

/**
 * Get player's concentration zones
 */
export async function getConcentrationZones(
  playerId: string
): Promise<ConcentrationZone[]> {
  const supabase = createServiceClient();
  const { data: player } = await supabase
    .from('players')
    .select('concentration_zones')
    .eq('username', playerId)
    .single();

  return fromJsonbArray<ConcentrationZone>(player?.concentration_zones);
}

/**
 * Clear player's concentration zones
 */
export async function clearConcentrationZones(
  playerId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('players')
    .update({ concentration_zones: null })
    .eq('username', playerId);

  return {
    success: true,
    message: 'Concentration zones cleared',
  };
}

/**
 * Get spawn position within player's zones
 * Returns null if no zones or 30% random spawn chance
 */
export async function getZoneSpawnPosition(): Promise<{
  x: number;
  y: number;
  playerId?: string;
} | null> {
  // 70% chance to use zones
  if (Math.random() > ZONE_CONFIG.SPAWN_CHANCE) {
    return null;
  }

  // Get all players with concentration zones
  const supabase = createServiceClient();
  const { data: playersWithZones } = await supabase
    .from('players')
    .select('username, concentration_zones')
    .not('concentration_zones', 'is', null)
    .neq('concentration_zones', '[]');

  if (!playersWithZones || playersWithZones.length === 0) {
    return null;
  }

  // Pick random player
  const player = playersWithZones[Math.floor(Math.random() * playersWithZones.length)];
  const zones = fromJsonbArray<ConcentrationZone>(player.concentration_zones);

  if (!zones || zones.length === 0) {
    return null;
  }

  // Pick random zone
  const zone = zones[Math.floor(Math.random() * zones.length)];

  // Generate random position within zone (±15 from center)
  const offsetX = Math.floor(Math.random() * ZONE_CONFIG.ZONE_SIZE) - ZONE_CONFIG.HALF_SIZE;
  const offsetY = Math.floor(Math.random() * ZONE_CONFIG.ZONE_SIZE) - ZONE_CONFIG.HALF_SIZE;

  return {
    x: zone.centerX + offsetX,
    y: zone.centerY + offsetY,
    playerId: player.username,
  };
}

/**
 * Get zone boundaries for visualization
 */
export function getZoneBoundaries(zone: ConcentrationZone): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  return {
    minX: zone.centerX - ZONE_CONFIG.HALF_SIZE,
    maxX: zone.centerX + ZONE_CONFIG.HALF_SIZE,
    minY: zone.centerY - ZONE_CONFIG.HALF_SIZE,
    maxY: zone.centerY + ZONE_CONFIG.HALF_SIZE,
  };
}

/**
 * Check if position is within any player zone
 */
export async function isInConcentrationZone(
  x: number,
  y: number
): Promise<{ inZone: boolean; playerId?: string; zoneName?: string }> {
  const supabase = createServiceClient();
  const { data: playersWithZones } = await supabase
    .from('players')
    .select('username, concentration_zones')
    .not('concentration_zones', 'is', null)
    .neq('concentration_zones', '[]');

  for (const player of (playersWithZones || [])) {
    const zones = fromJsonbArray<ConcentrationZone>(player.concentration_zones);
    
    for (const zone of zones) {
      const bounds = getZoneBoundaries(zone);
      
      if (
        x >= bounds.minX &&
        x <= bounds.maxX &&
        y >= bounds.minY &&
        y <= bounds.maxY
      ) {
        return {
          inZone: true,
          playerId: player.username,
          zoneName: zone.name || `${player.username}'s Zone`,
        };
      }
    }
  }

  return { inZone: false };
}

/**
 * Get concentration zone statistics
 */
export async function getZoneStats(): Promise<{
  totalZones: number;
  playersWithZones: number;
  averageZonesPerPlayer: number;
  zoneDistribution: Array<{
    playerName: string;
    zoneCount: number;
    zones: Array<{ center: string; name?: string }>;
  }>;
}> {
  const supabase = createServiceClient();
  const { data: playersWithZones } = await supabase
    .from('players')
    .select('username, concentration_zones')
    .not('concentration_zones', 'is', null)
    .neq('concentration_zones', '[]');

  const players = playersWithZones || [];

  const totalZones = players.reduce((sum, p) => {
    const zones = fromJsonbArray<ConcentrationZone>(p.concentration_zones);
    return sum + zones.length;
  }, 0);

  const distribution = players.map((p: any) => {
    const zones = fromJsonbArray<ConcentrationZone>(p.concentration_zones);
    return {
      playerName: p.username,
      zoneCount: zones.length,
      zones: zones.map((z) => ({
        center: `(${z.centerX}, ${z.centerY})`,
        name: z.name,
      })),
    };
  });

  return {
    totalZones,
    playersWithZones: players.length,
    averageZonesPerPlayer:
      players.length > 0 ? totalZones / players.length : 0,
    zoneDistribution: distribution,
  };
}

/**
 * IMPLEMENTATION NOTES:
 * - Zones stored directly in player document (concentration_zones field)
 * - Each zone is 30×30 tiles (±15 from center)
 * - Maximum 3 zones per player
 * - 70% of new bot spawns directed to random zone from random player
 * - Zones cannot overlap (same player)
 * - Zones must be within map bounds (0-5000)
 * - Zone boundaries: [centerX-15, centerX+15] × [centerY-15, centerY+15]
 * - Spawn position randomized within selected zone
 * - Persistent until player changes them
 * - Requires 'bot-concentration-zones' tech (enforced at API level)
 */
