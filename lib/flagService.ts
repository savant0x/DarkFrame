/**
 * @file lib/flagService.ts
 * @created 2025-10-20
 * @updated 2026-05-04 — Full spec rebuild (FID-20260504-FLAG)
 * @overview Flag bearer service — distance, direction, flee cost, challenge validation
 */
import { createServiceClient } from '@/lib/supabase/server';
import { CompassDirection, FLAG_CONFIG } from '@/types/flag.types';

export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export function roundDistance(d: number): number {
  return Math.round(d);
}

export function getCompassDirection(fromX: number, fromY: number, toX: number, toY: number): CompassDirection {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle >= -22.5 && angle < 22.5) return CompassDirection.East;
  if (angle >= 22.5 && angle < 67.5) return CompassDirection.SouthEast;
  if (angle >= 67.5 && angle < 112.5) return CompassDirection.South;
  if (angle >= 112.5 && angle < 157.5) return CompassDirection.SouthWest;
  if (angle >= 157.5 || angle < -157.5) return CompassDirection.West;
  if (angle >= -157.5 && angle < -112.5) return CompassDirection.NorthWest;
  if (angle >= -112.5 && angle < -67.5) return CompassDirection.North;
  return CompassDirection.NorthEast;
}

export function isInChallengeRange(distance: number): boolean {
  return distance <= FLAG_CONFIG.CHALLENGE_RANGE;
}

export function calculateFleeCost(sessionMetal: number, sessionEnergy: number, fleeCount: number): { metal: number; energy: number } {
  const pct = FLAG_CONFIG.FLEE_COSTS[Math.min(fleeCount, FLAG_CONFIG.MAX_FLEES - 1)];
  return {
    metal: Math.floor(sessionMetal * pct),
    energy: Math.floor(sessionEnergy * pct),
  };
}

export function canAffordFlee(playerMetal: number, playerEnergy: number, fleeCost: { metal: number; energy: number }): boolean {
  return playerMetal >= fleeCost.metal && playerEnergy >= fleeCost.energy;
}

export function getRandomFleePosition(currentX: number, currentY: number): { x: number; y: number } {
  const directions = [
    { dx: 0, dy: -FLAG_CONFIG.FLEE_DISTANCE },
    { dx: FLAG_CONFIG.FLEE_DISTANCE, dy: -FLAG_CONFIG.FLEE_DISTANCE },
    { dx: FLAG_CONFIG.FLEE_DISTANCE, dy: 0 },
    { dx: FLAG_CONFIG.FLEE_DISTANCE, dy: FLAG_CONFIG.FLEE_DISTANCE },
    { dx: 0, dy: FLAG_CONFIG.FLEE_DISTANCE },
    { dx: -FLAG_CONFIG.FLEE_DISTANCE, dy: FLAG_CONFIG.FLEE_DISTANCE },
    { dx: -FLAG_CONFIG.FLEE_DISTANCE, dy: 0 },
    { dx: -FLAG_CONFIG.FLEE_DISTANCE, dy: -FLAG_CONFIG.FLEE_DISTANCE },
  ];
  const d = directions[Math.floor(Math.random() * directions.length)];
  return {
    x: Math.max(1, Math.min(FLAG_CONFIG.MAP_SIZE, currentX + d.dx)),
    y: Math.max(1, Math.min(FLAG_CONFIG.MAP_SIZE, currentY + d.dy)),
  };
}

export function buildTrackerData(
  bearer: import('@/types/flag.types').FlagBearer | null,
  trackerPos: { x: number; y: number }
): import('@/types/flag.types').FlagTrackerData {
  if (!bearer) {
    return { bearer: null, distance: 0, direction: CompassDirection.North, inChallengeRange: false, trackerPosition: trackerPos };
  }
  const dist = calculateDistance(trackerPos.x, trackerPos.y, bearer.position.x, bearer.position.y);
  return {
    bearer,
    distance: roundDistance(dist),
    direction: getCompassDirection(trackerPos.x, trackerPos.y, bearer.position.x, bearer.position.y),
    inChallengeRange: isInChallengeRange(dist),
    trackerPosition: trackerPos,
  };
}

export function formatDistance(distance: number): string {
  return `${distance} tiles`;
}

export function formatHoldDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

export function getCompassArrow(direction: CompassDirection): string {
  const arrows: Record<CompassDirection, string> = {
    [CompassDirection.North]: '↑', [CompassDirection.NorthEast]: '↗', [CompassDirection.East]: '→',
    [CompassDirection.SouthEast]: '↘', [CompassDirection.South]: '↓', [CompassDirection.SouthWest]: '↙',
    [CompassDirection.West]: '←', [CompassDirection.NorthWest]: '↖',
  };
  return arrows[direction];
}

// Backward-compat aliases for existing code
export const isInAttackRange = isInChallengeRange;
export function getTimeRemaining(_holdDuration: number): string { return ''; }
export function isFlagExpiringSoon(_holdDuration: number): boolean { return false; }
