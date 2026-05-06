/**
 * Bot Magnet beacon system for attracting bots to strategic locations.
 * 
 * Created: 2025-01-18
 * 
 * FEATURES:
 * - Deploy beacons at chosen coordinates (requires bot-magnet tech)
 * - Attract 30% of bots within 100-tile radius during spawn
 * - 7-day beacon duration (168 hours)
 * - 14-day cooldown between deployments
 * - Single active beacon per player
 * - Automatic beacon expiration cleanup
 */

import { createServiceClient } from '@/lib/supabase/server';

export interface BotMagnetBeacon {
  id?: string;
  player_id: string;
  player_name: string;
  x: number;
  y: number;
  deployed_at: string | null;
  expires_at: string;
  cooldown_until: string | null;
  attraction_radius: number | null;
  attraction_chance: number | null;
  bots_attracted: number | null;
  active: boolean | null;
}

const BEACON_CONFIG = {
  DURATION_HOURS: 168,
  COOLDOWN_HOURS: 336,
  ATTRACTION_RADIUS: 100,
  ATTRACTION_CHANCE: 0.30,
  MAX_BEACONS_PER_PLAYER: 1,
} as const;

const TABLE = 'bot_magnet_beacons';

export async function deployBeacon(
  playerId: string,
  playerName: string,
  x: number,
  y: number
): Promise<{
  success: boolean;
  message: string;
  beacon?: BotMagnetBeacon;
  cooldownRemaining?: number;
}> {
  const supabase = createServiceClient();

  const { data: existingBeacon, error: findErr } = await supabase
    .from(TABLE)
    .select('*')
    .eq('player_id', playerId)
    .eq('active', true)
    .single();

  if (findErr && findErr.code !== 'PGRST116') {
    console.error('[BotMagnet] Failed to check existing beacon:', findErr);
  }

  if (existingBeacon) {
    return {
      success: false,
      message: 'You already have an active beacon. Wait for it to expire or cooldown to complete.',
    };
  }

  const { data: lastBeaconArr } = await supabase
    .from(TABLE)
    .select('cooldown_until')
    .eq('player_id', playerId)
    .order('deployed_at', { ascending: false })
    .limit(1);

  if (lastBeaconArr && lastBeaconArr.length > 0 && lastBeaconArr[0].cooldown_until) {
    const now = new Date();
    const cooldownUntil = new Date(lastBeaconArr[0].cooldown_until);
    if (now < cooldownUntil) {
      const cooldownRemaining = Math.ceil(
        (cooldownUntil.getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      return {
        success: false,
        message: `Beacon on cooldown. ${cooldownRemaining} hours remaining.`,
        cooldownRemaining,
      };
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + BEACON_CONFIG.DURATION_HOURS * 60 * 60 * 1000);
  const cooldownUntil = new Date(now.getTime() + BEACON_CONFIG.COOLDOWN_HOURS * 60 * 60 * 1000);

  const beaconData = {
    player_id: playerId,
    player_name: playerName,
    x,
    y,
    deployed_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    cooldown_until: cooldownUntil.toISOString(),
    attraction_radius: BEACON_CONFIG.ATTRACTION_RADIUS,
    attraction_chance: BEACON_CONFIG.ATTRACTION_CHANCE,
    bots_attracted: 0,
    active: true,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from(TABLE)
    .insert(beaconData)
    .select()
    .single();

  if (insertErr || !inserted) {
    console.error('[BotMagnet] Failed to deploy beacon:', insertErr);
    return {
      success: false,
      message: 'Failed to deploy beacon',
    };
  }

  const beacon: BotMagnetBeacon = {
    ...beaconData,
    id: inserted.id,
  };

  return {
    success: true,
    message: `Beacon deployed at (${x}, ${y}). Active for ${BEACON_CONFIG.DURATION_HOURS} hours.`,
    beacon,
  };
}

export async function getBeaconStatus(playerId: string): Promise<{
  hasActiveBeacon: boolean;
  beacon?: BotMagnetBeacon;
  cooldownRemaining?: number;
  canDeploy: boolean;
}> {
  await cleanupExpiredBeacons();

  const supabase = createServiceClient();

  const { data: activeBeacon, error: findErr } = await supabase
    .from(TABLE)
    .select('*')
    .eq('player_id', playerId)
    .eq('active', true)
    .single();

  if (findErr && findErr.code !== 'PGRST116') {
    console.error('[BotMagnet] Failed to get beacon status:', findErr);
  }

  if (activeBeacon) {
    return {
      hasActiveBeacon: true,
      beacon: {
        id: activeBeacon.id,
        player_id: activeBeacon.player_id,
        player_name: activeBeacon.player_name,
        x: activeBeacon.x,
        y: activeBeacon.y,
        deployed_at: activeBeacon.deployed_at,
        expires_at: activeBeacon.expires_at,
        cooldown_until: activeBeacon.cooldown_until,
        attraction_radius: activeBeacon.attraction_radius,
        attraction_chance: activeBeacon.attraction_chance,
        bots_attracted: activeBeacon.bots_attracted,
        active: activeBeacon.active,
      },
      canDeploy: false,
    };
  }

  const { data: lastBeaconArr } = await supabase
    .from(TABLE)
    .select('cooldown_until')
    .eq('player_id', playerId)
    .order('deployed_at', { ascending: false })
    .limit(1);

  if (lastBeaconArr && lastBeaconArr.length > 0 && lastBeaconArr[0].cooldown_until) {
    const now = new Date();
    const cooldownUntil = new Date(lastBeaconArr[0].cooldown_until);
    if (now < cooldownUntil) {
      const cooldownRemaining = Math.ceil(
        (cooldownUntil.getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      return {
        hasActiveBeacon: false,
        cooldownRemaining,
        canDeploy: false,
      };
    }
  }

  return {
    hasActiveBeacon: false,
    canDeploy: true,
  };
}

export async function getActiveBeacons(): Promise<BotMagnetBeacon[]> {
  await cleanupExpiredBeacons();

  const supabase = createServiceClient();

  const { data } = await supabase
    .from(TABLE)
    .select('*')
    .eq('active', true);

  return (data || []).map(row => ({
    id: row.id,
    player_id: row.player_id,
    player_name: row.player_name,
    x: row.x,
    y: row.y,
    deployed_at: row.deployed_at,
    expires_at: row.expires_at,
    cooldown_until: row.cooldown_until,
    attraction_radius: row.attraction_radius,
    attraction_chance: row.attraction_chance,
    bots_attracted: row.bots_attracted,
    active: row.active,
  }));
}

export async function shouldAttractToBeacon(
  x: number,
  y: number
): Promise<{
  attracted: boolean;
  targetX?: number;
  targetY?: number;
  beaconId?: string;
}> {
  const beacons = await getActiveBeacons();

  for (const beacon of beacons) {
    const distance = Math.sqrt(
      Math.pow(x - beacon.x, 2) + Math.pow(y - beacon.y, 2)
    );

    if (distance <= (beacon.attraction_radius || 0)) {
      if (Math.random() < (beacon.attraction_chance || 0)) {
        const offsetX = Math.floor(Math.random() * 41) - 20;
        const offsetY = Math.floor(Math.random() * 41) - 20;

        return {
          attracted: true,
          targetX: beacon.x + offsetX,
          targetY: beacon.y + offsetY,
          beaconId: beacon.id,
        };
      }
    }
  }

  return { attracted: false };
}

export async function incrementAttractedCount(beaconId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: beacon } = await supabase
    .from(TABLE)
    .select('bots_attracted')
    .eq('id', beaconId)
    .single();

  if (beacon) {
    await supabase
      .from(TABLE)
      .update({ bots_attracted: (beacon.bots_attracted || 0) + 1 })
      .eq('id', beaconId);
  }
}

export async function cleanupExpiredBeacons(): Promise<number> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { count } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .lt('expires_at', now);

  if (count) {
    await supabase
      .from(TABLE)
      .update({ active: false })
      .eq('active', true)
      .lt('expires_at', now);
  }

  return count || 0;
}

export async function deactivateBeacon(playerId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = createServiceClient();

  const { data: updated, error } = await supabase
    .from(TABLE)
    .update({ active: false })
    .eq('player_id', playerId)
    .eq('active', true)
    .select();

  if (error) {
    console.error('[BotMagnet] Failed to deactivate beacon:', error);
    return {
      success: false,
      message: 'Failed to deactivate beacon.',
    };
  }

  if (!updated || updated.length === 0) {
    return {
      success: false,
      message: 'No active beacon found.',
    };
  }

  return {
    success: true,
    message: 'Beacon deactivated successfully.',
  };
}

export async function getBeaconStats(): Promise<{
  totalBeacons: number;
  activeBeacons: number;
  totalBotsAttracted: number;
  averageAttraction: number;
  topBeacons: Array<{
    playerName: string;
    location: string;
    botsAttracted: number;
    deployedAt: string;
  }>;
}> {
  const supabase = createServiceClient();

  const { count: total } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true });

  const { count: active } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('active', true);

  const { data: beacons } = await supabase
    .from(TABLE)
    .select('*')
    .order('bots_attracted', { ascending: false })
    .limit(10);

  const beaconList = beacons || [];
  const totalAttracted = beaconList.reduce((sum, b) => sum + (b.bots_attracted || 0), 0);

  return {
    totalBeacons: total || 0,
    activeBeacons: active || 0,
    totalBotsAttracted: totalAttracted,
    averageAttraction: (total || 0) > 0 ? totalAttracted / (total || 1) : 0,
    topBeacons: beaconList.map(b => ({
      playerName: b.player_name,
      location: `(${b.x}, ${b.y})`,
      botsAttracted: b.bots_attracted || 0,
      deployedAt: b.deployed_at || '',
    })),
  };
}
