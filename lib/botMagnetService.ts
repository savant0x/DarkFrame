/**
 * @file lib/botMagnetService.ts
 * @created 2025-01-18
 * @updated 2026-04-04 (Migrated to Drizzle ORM)
 * @overview Bot Magnet beacon system for attracting bots to strategic locations.
 */

import { eq, and, lt, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { botMagnetBeacons } from '@/lib/db/schema/config';

const BEACON_CONFIG = {
  DURATION_HOURS: 168,
  COOLDOWN_HOURS: 336,
  ATTRACTION_RADIUS: 100,
  ATTRACTION_CHANCE: 0.30,
  MAX_BEACONS_PER_PLAYER: 1,
} as const;

export interface BotMagnetBeacon {
  id: string;
  playerId: string;
  playerName: string;
  x: number;
  y: number;
  deployedAt: Date;
  expiresAt: Date;
  cooldownUntil: Date;
  attractionRadius: number;
  attractionChance: number;
  botsAttracted: number;
  active: boolean;
}

export async function deployBeacon(
  playerId: string,
  playerName: string,
  x: number,
  y: number
): Promise<{ success: boolean; message: string; beacon?: BotMagnetBeacon; cooldownRemaining?: number }> {
  const existingBeacon = await db.select().from(botMagnetBeacons)
    .where(and(eq(botMagnetBeacons.playerId, playerId), eq(botMagnetBeacons.active, 1))).limit(1);

  if (existingBeacon.length > 0) {
    return { success: false, message: 'You already have an active beacon. Wait for it to expire or cooldown to complete.' };
  }

  await cleanupExpiredBeacons();

  const lastBeacon = await db.select().from(botMagnetBeacons)
    .where(eq(botMagnetBeacons.playerId, playerId))
    .orderBy(desc(botMagnetBeacons.deployedAt)).limit(1);

  if (lastBeacon.length > 0) {
    const now = new Date();
    if (now < lastBeacon[0].cooldownUntil) {
      const cooldownRemaining = Math.ceil((lastBeacon[0].cooldownUntil.getTime() - now.getTime()) / (1000 * 60 * 60));
      return { success: false, message: `Beacon on cooldown. ${cooldownRemaining} hours remaining.`, cooldownRemaining };
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + BEACON_CONFIG.DURATION_HOURS * 60 * 60 * 1000);
  const cooldownUntil = new Date(now.getTime() + BEACON_CONFIG.COOLDOWN_HOURS * 60 * 60 * 1000);
  const beaconId = `beacon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await db.insert(botMagnetBeacons).values({
    id: beaconId,
    playerId,
    playerName,
    x,
    y,
    deployedAt: now,
    expiresAt,
    cooldownUntil,
    attractionRadius: BEACON_CONFIG.ATTRACTION_RADIUS,
    attractionChance: Math.round(BEACON_CONFIG.ATTRACTION_CHANCE * 100),
    botsAttracted: 0,
    active: 1,
  });

  return { success: true, message: `Beacon deployed at (${x}, ${y}). Active for ${BEACON_CONFIG.DURATION_HOURS} hours.`,
    beacon: { id: beaconId, playerId, playerName, x, y, deployedAt: now, expiresAt, cooldownUntil, attractionRadius: BEACON_CONFIG.ATTRACTION_RADIUS, attractionChance: BEACON_CONFIG.ATTRACTION_CHANCE, botsAttracted: 0, active: true }
  };
}

export async function getBeaconStatus(playerId: string): Promise<{ hasActiveBeacon: boolean; beacon?: BotMagnetBeacon; cooldownRemaining?: number; canDeploy: boolean }> {
  await cleanupExpiredBeacons();

  const activeBeacon = await db.select().from(botMagnetBeacons)
    .where(and(eq(botMagnetBeacons.playerId, playerId), eq(botMagnetBeacons.active, 1))).limit(1);

  if (activeBeacon.length > 0) {
    const b = activeBeacon[0];
    return { hasActiveBeacon: true, canDeploy: false,
      beacon: { id: b.id, playerId: b.playerId, playerName: b.playerName, x: b.x, y: b.y, deployedAt: b.deployedAt, expiresAt: b.expiresAt, cooldownUntil: b.cooldownUntil, attractionRadius: b.attractionRadius, attractionChance: b.attractionChance / 100, botsAttracted: b.botsAttracted, active: b.active === 1 }
    };
  }

  const lastBeacon = await db.select().from(botMagnetBeacons)
    .where(eq(botMagnetBeacons.playerId, playerId)).orderBy(desc(botMagnetBeacons.deployedAt)).limit(1);

  if (lastBeacon.length > 0) {
    const now = new Date();
    if (now < lastBeacon[0].cooldownUntil) {
      return { hasActiveBeacon: false, canDeploy: false,
        cooldownRemaining: Math.ceil((lastBeacon[0].cooldownUntil.getTime() - now.getTime()) / (1000 * 60 * 60))
      };
    }
  }

  return { hasActiveBeacon: false, canDeploy: true };
}

export async function getActiveBeacons(): Promise<BotMagnetBeacon[]> {
  await cleanupExpiredBeacons();
  const results = await db.select().from(botMagnetBeacons).where(eq(botMagnetBeacons.active, 1));
  return results.map(b => ({
    id: b.id, playerId: b.playerId, playerName: b.playerName, x: b.x, y: b.y,
    deployedAt: b.deployedAt, expiresAt: b.expiresAt, cooldownUntil: b.cooldownUntil,
    attractionRadius: b.attractionRadius, attractionChance: b.attractionChance / 100,
    botsAttracted: b.botsAttracted, active: b.active === 1
  }));
}

export async function shouldAttractToBeacon(x: number, y: number): Promise<{ attracted: boolean; targetX?: number; targetY?: number; beaconId?: string }> {
  const beacons = await getActiveBeacons();
  for (const beacon of beacons) {
    const distance = Math.sqrt(Math.pow(x - beacon.x, 2) + Math.pow(y - beacon.y, 2));
    if (distance <= beacon.attractionRadius && Math.random() < beacon.attractionChance) {
      const offsetX = Math.floor(Math.random() * 41) - 20;
      const offsetY = Math.floor(Math.random() * 41) - 20;
      return { attracted: true, targetX: beacon.x + offsetX, targetY: beacon.y + offsetY, beaconId: beacon.id };
    }
  }
  return { attracted: false };
}

export async function incrementAttractedCount(beaconId: string): Promise<void> {
  await db.update(botMagnetBeacons)
    .set({ botsAttracted: sql`bots_attracted + 1` } as any)
    .where(eq(botMagnetBeacons.id, beaconId));
}

export async function cleanupExpiredBeacons(): Promise<number> {
  const now = new Date();
  const _result = await db.update(botMagnetBeacons)
    .set({ active: 0 })
    .where(and(eq(botMagnetBeacons.active, 1), lt(botMagnetBeacons.expiresAt, now)));
  return 0;
}

export async function deactivateBeacon(playerId: string): Promise<{ success: boolean; message: string }> {
  const result = await db.update(botMagnetBeacons)
    .set({ active: 0 })
    .where(and(eq(botMagnetBeacons.playerId, playerId), eq(botMagnetBeacons.active, 1))) as any;
  if ((result as any)?.affectedRows === 0) {
    return { success: false, message: 'No active beacon found.' };
  }
  return { success: true, message: 'Beacon deactivated successfully.' };
}

export async function getBeaconStats(): Promise<{ totalBeacons: number; activeBeacons: number; totalBotsAttracted: number; averageAttraction: number; topBeacons: Array<{ playerName: string; location: string; botsAttracted: number; deployedAt: Date }> }> {
  const all = await db.select().from(botMagnetBeacons).orderBy(desc(botMagnetBeacons.botsAttracted)).limit(10);
  const active = await db.select({ count: sql`count(*)` }).from(botMagnetBeacons).where(eq(botMagnetBeacons.active, 1));
  const total = all.length;
  const activeCount = Number((active[0] as any)?.count || 0);
  const totalAttracted = all.reduce((sum, b) => sum + b.botsAttracted, 0);
  return {
    totalBeacons: total,
    activeBeacons: activeCount,
    totalBotsAttracted: totalAttracted,
    averageAttraction: total > 0 ? totalAttracted / total : 0,
    topBeacons: all.map(b => ({ playerName: b.playerName, location: `(${b.x}, ${b.y})`, botsAttracted: b.botsAttracted, deployedAt: b.deployedAt })),
  };
}
