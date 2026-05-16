/**
 * Anti-Cheat Detection Service
 * Created: 2025-01-18
 */

import { createServiceClient } from '@/lib/supabase/server';

export interface DetectionResult {
  suspicious: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flagType: string;
  evidence: string;
  metadata?: Record<string, any>;
}

const THRESHOLDS = {
  MAX_MOVEMENT_RATE: 1.5,
  IMPOSSIBLE_DISTANCE: 10,
  HARVEST_VARIANCE_TOLERANCE: 1.2,
  MAX_SINGLE_HARVEST: 10000,
  MIN_ACTION_DELAY: 500,
  HARVEST_COOLDOWN: 3000,
  ATTACK_COOLDOWN: 5000,
  PERFECT_TIMING_THRESHOLD: 0.98,
  MIN_ACTIONS_FOR_PATTERN: 10,
  MAX_SESSION_HOURS: 14,
  SUSPICIOUS_SESSION_HOURS: 10,
  MAX_RESOURCES_PER_HOUR: 100000,
  MAX_TIER_LEVEL: 6,
  MAX_RANK: 10,
};

export async function detectSpeedHack(
  username: string,
  fromPos: { x: number; y: number },
  toPos: { x: number; y: number },
  timestamp: number
): Promise<DetectionResult> {
  try {
    const MAP_SIZE = 150;
    const dx = Math.abs(toPos.x - fromPos.x);
    const dy = Math.abs(toPos.y - fromPos.y);
    const wrappedDx = Math.min(dx, MAP_SIZE - dx);
    const wrappedDy = Math.min(dy, MAP_SIZE - dy);
    const distance = wrappedDx + wrappedDy;

    if (distance > THRESHOLDS.IMPOSSIBLE_DISTANCE) {
      await createFlag({
        username, flagType: 'SPEED_HACK', severity: 'CRITICAL',
        description: 'Impossible movement distance detected',
        evidence: `Moved ${distance} tiles in single action (max: ${THRESHOLDS.IMPOSSIBLE_DISTANCE})`,
      });
      return { suspicious: true, severity: 'CRITICAL', flagType: 'SPEED_HACK', evidence: `Teleportation detected: ${distance} tiles` };
    }

    return { suspicious: false, severity: 'LOW', flagType: 'SPEED_HACK', evidence: 'Movement rate normal' };
  } catch (error) {
    return { suspicious: false, severity: 'LOW', flagType: 'SPEED_HACK', evidence: 'Detection error' };
  }
}

export async function detectResourceHack(
  username: string,
  resourceType: string,
  amount: number,
  playerTier: number
): Promise<DetectionResult> {
  try {
    const supabase = createServiceClient();
    const { data: player } = await supabase.from('players').select('*').eq('username', username).single();
    if (!player) return { suspicious: false, severity: 'LOW', flagType: 'RESOURCE_HACK', evidence: 'Player not found' };

    const tierMaximumsPerAction: Record<number, number> = { 1: 1500, 2: 2000, 3: 3000, 4: 5000, 5: 8000, 6: 12000 };
    const ABSOLUTE_MAX = 15000;

    if (amount > ABSOLUTE_MAX) {
      await createFlag({
        username, flagType: 'RESOURCE_HACK', severity: 'CRITICAL',
        description: 'Impossible resource gain detected',
        evidence: `Gained ${amount} ${resourceType} in single action (absolute max: ${ABSOLUTE_MAX})`,
      });
      return { suspicious: true, severity: 'CRITICAL', flagType: 'RESOURCE_HACK', evidence: `Impossible gain: ${amount}` };
    }

    return { suspicious: false, severity: 'LOW', flagType: 'RESOURCE_HACK', evidence: 'Resource gain normal' };
  } catch (error) {
    return { suspicious: false, severity: 'LOW', flagType: 'RESOURCE_HACK', evidence: 'Detection error' };
  }
}

export async function detectCooldownViolation(
  username: string,
  actionType: string,
  timestamp: number
): Promise<DetectionResult> {
  return { suspicious: false, severity: 'LOW', flagType: 'COOLDOWN_VIOLATION', evidence: 'First action' };
}

export async function detectBotBehavior(username: string): Promise<DetectionResult> {
  return { suspicious: false, severity: 'LOW', flagType: 'BOT_BEHAVIOR', evidence: 'Insufficient data' };
}

export async function detectSessionAbuse(username: string, sessionDuration: number): Promise<DetectionResult> {
  try {
    const hours = sessionDuration / (1000 * 60 * 60);
    if (hours > THRESHOLDS.MAX_SESSION_HOURS) {
      await createFlag({
        username, flagType: 'SESSION_ABUSE', severity: 'CRITICAL',
        description: 'Excessive session duration detected',
        evidence: `Session duration: ${hours.toFixed(1)} hours`,
      });
      return { suspicious: true, severity: 'CRITICAL', flagType: 'SESSION_ABUSE', evidence: `Session: ${hours.toFixed(1)} hours` };
    }
    return { suspicious: false, severity: 'LOW', flagType: 'SESSION_ABUSE', evidence: 'Session duration normal' };
  } catch (error) {
    return { suspicious: false, severity: 'LOW', flagType: 'SESSION_ABUSE', evidence: 'Detection error' };
  }
}

export async function detectTheoreticalMaxViolation(
  username: string,
  playerData: any
): Promise<DetectionResult> {
  try {
    const violations: string[] = [];
    if (playerData.tier > THRESHOLDS.MAX_TIER_LEVEL) violations.push(`Tier exceeds max`);
    if (playerData.rank > THRESHOLDS.MAX_RANK) violations.push(`Rank exceeds max`);
    if (violations.length > 0) {
      await createFlag({ username, flagType: 'THEORETICAL_MAX_VIOLATION', severity: 'HIGH', description: 'Stats exceed theoretical maximums', evidence: violations.join('; ') });
      return { suspicious: true, severity: 'HIGH', flagType: 'THEORETICAL_MAX_VIOLATION', evidence: violations.join('; ') };
    }
    return { suspicious: false, severity: 'LOW', flagType: 'THEORETICAL_MAX_VIOLATION', evidence: 'Stats within limits' };
  } catch (error) {
    return { suspicious: false, severity: 'LOW', flagType: 'THEORETICAL_MAX_VIOLATION', evidence: 'Detection error' };
  }
}

export async function createFlag(flag: {
  username: string; flagType: string; severity: string; description: string;
  evidence: string; metadata?: Record<string, any>;
}): Promise<string> {
  try {
    const supabase = createServiceClient();
    
    // Check if similar flag exists recently
    const { data: existing } = await supabase
      .from('player_flags')
      .select('id')
      .eq('player_username', flag.username)
      .eq('resolved', false)
      .eq('reason', flag.flagType)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString())
      .limit(1);
    
    if (existing && existing.length > 0) return existing[0].id;
    
    const { data } = await supabase.from('player_flags').insert({
      player_username: flag.username,
      flagged_by: 'SYSTEM',
      reason: `${flag.flagType}: ${flag.evidence}`,
      resolved: false,
    }).select('id').single();
    
    return data?.id || '';
  } catch (error) {
    console.error('Flag creation error:', error);
    return '';
  }
}

export async function getSuspiciousPlayers(): Promise<any[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('player_flags')
    .select('*')
    .eq('resolved', false)
    .order('created_at', { ascending: false });
  return data || [];
}
