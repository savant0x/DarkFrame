/**
 * @file lib/botNestService.ts
 * @created 2025-10-18
 * @overview Bot Nest management system with fixed strategic locations
 * 
 * OVERVIEW:
 * Manages 8 permanent bot nest locations across the map at strategic positions.
 * Each nest attracts 15-20 bots and serves as a guaranteed bot farming location.
 * Nests are positioned near banks, map center, corners, borders, and shrine.
 */

import { type Position } from '@/types/game.types';
import { type BotNestLocation } from '@/types/botConfig.types';

// ============================================================
// BOT NEST LOCATIONS (8 Fixed Strategic Positions)
// ============================================================

/**
 * Permanent bot nest locations on the 150×150 map
 * Strategically positioned for gameplay variety
 */
export const BOT_NESTS: BotNestLocation[] = [
  {
    id: 0,
    position: { x: 75, y: 75 },
    name: 'Central Nexus',
    theme: 'Map center - mixed bot types, high traffic',
    active: true,
    currentBotCount: 0
  },
  {
    id: 1,
    position: { x: 25, y: 25 },
    name: 'Northwest Outpost',
    theme: 'Corner position - defensive bots (Fortress heavy)',
    active: true,
    currentBotCount: 0
  },
  {
    id: 2,
    position: { x: 125, y: 25 },
    name: 'Northeast Stronghold',
    theme: 'Corner position - aggressive bots (Raider heavy)',
    active: true,
    currentBotCount: 0
  },
  {
    id: 3,
    position: { x: 25, y: 125 },
    name: 'Southwest Haven',
    theme: 'Corner position - resource bots (Hoarder heavy)',
    active: true,
    currentBotCount: 0
  },
  {
    id: 4,
    position: { x: 125, y: 125 },
    name: 'Southeast Enclave',
    theme: 'Corner position - elusive bots (Ghost heavy)',
    active: true,
    currentBotCount: 0
  },
  {
    id: 5,
    position: { x: 1, y: 1 },
    name: 'Shrine Guardians',
    theme: 'Near shrine - balanced mix, high rewards',
    active: true,
    currentBotCount: 0
  },
  {
    id: 6,
    position: { x: 75, y: 10 },
    name: 'North Bank Nest',
    theme: 'Near north border - banking bots',
    active: true,
    currentBotCount: 0
  },
  {
    id: 7,
    position: { x: 75, y: 140 },
    name: 'South Border Camp',
    theme: 'Near south border - patrol bots',
    active: true,
    currentBotCount: 0
  }
];

/**
 * Get nest by ID
 * 
 * @param nestId Nest identifier (0-7)
 * @returns Nest location data or null if not found
 */
export function getNestById(nestId: number): BotNestLocation | null {
  return BOT_NESTS.find(nest => nest.id === nestId) || null;
}

/**
 * Get all active nests
 * 
 * @returns Array of active nest locations
 */
export function getActiveNests(): BotNestLocation[] {
  return BOT_NESTS.filter(nest => nest.active);
}

/**
 * Calculate distance between two positions
 * 
 * @param pos1 First position
 * @param pos2 Second position
 * @returns Euclidean distance
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find nearest nest to a position
 * 
 * @param position Map coordinates
 * @returns Nearest nest data with distance
 */
export function findNearestNest(position: Position): { nest: BotNestLocation; distance: number } | null {
  const activeNests = getActiveNests();
  
  if (activeNests.length === 0) {
    return null;
  }
  
  let nearestNest = activeNests[0];
  let minDistance = calculateDistance(position, nearestNest.position);
  
  for (let i = 1; i < activeNests.length; i++) {
    const distance = calculateDistance(position, activeNests[i].position);
    if (distance < minDistance) {
      minDistance = distance;
      nearestNest = activeNests[i];
    }
  }
  
  return { nest: nearestNest, distance: minDistance };
}

/**
 * Check if position is within nest radius
 * 
 * @param position Map coordinates
 * @param nestRadius Radius to check (default: 15 tiles)
 * @returns Nest if within radius, null otherwise
 */
export function isInNestRadius(position: Position, nestRadius: number = 15): BotNestLocation | null {
  const result = findNearestNest(position);
  
  if (!result) {
    return null;
  }
  
  return result.distance <= nestRadius ? result.nest : null;
}

/**
 * Get random position near a nest
 * 
 * @param nestId Nest identifier
 * @param radius Max distance from nest (default: 10 tiles)
 * @returns Random position near nest
 */
export function getRandomPositionNearNest(nestId: number, radius: number = 10): Position | null {
  const nest = getNestById(nestId);
  
  if (!nest) {
    return null;
  }
  
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * radius;
  
  const x = Math.round(nest.position.x + distance * Math.cos(angle));
  const y = Math.round(nest.position.y + distance * Math.sin(angle));
  
  // Clamp to map bounds (1-150)
  return {
    x: Math.max(1, Math.min(150, x)),
    y: Math.max(1, Math.min(150, y))
  };
}

/**
 * Get all positions within nest radius
 * 
 * @param nestId Nest identifier
 * @param radius Radius in tiles (default: 15)
 * @returns Array of positions within radius
 */
export function getPositionsInNestRadius(nestId: number, radius: number = 15): Position[] {
  const nest = getNestById(nestId);
  
  if (!nest) {
    return [];
  }
  
  const positions: Position[] = [];
  const radiusSquared = radius * radius;
  
  for (let x = Math.max(1, nest.position.x - radius); x <= Math.min(150, nest.position.x + radius); x++) {
    for (let y = Math.max(1, nest.position.y - radius); y <= Math.min(150, nest.position.y + radius); y++) {
      const dx = x - nest.position.x;
      const dy = y - nest.position.y;
      
      if (dx * dx + dy * dy <= radiusSquared) {
        positions.push({ x, y });
      }
    }
  }
  
  return positions;
}

/**
 * Update nest bot count
 * 
 * @param nestId Nest identifier
 * @param count New bot count
 */
export function updateNestBotCount(nestId: number, count: number): void {
  const nest = BOT_NESTS.find(n => n.id === nestId);
  if (nest) {
    nest.currentBotCount = count;
  }
}

/**
 * Get nest statistics
 * 
 * @returns Summary of all nests with bot counts
 */
export function getNestStatistics() {
  return BOT_NESTS.map(nest => ({
    id: nest.id,
    name: nest.name,
    position: nest.position,
    theme: nest.theme,
    active: nest.active,
    currentBotCount: nest.currentBotCount,
    targetBotCount: { min: 15, max: 20 }
  }));
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - 8 permanent nests at strategic locations
// - Each nest attracts 15-20 bots within 10-15 tile radius
// - Nest affinity stored in botConfig.nestAffinity field
// - Scanner shows nest locations to players
// - Nests create guaranteed bot farming zones
// ============================================================
