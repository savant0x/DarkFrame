/**
 * @file lib/botMagnetService.ts
 * @created 2025-01-18
 * @updated 2026-10-02 (FID-20261002-010 — bounded beacon identifiers + one-transaction deployment)
 * @overview Bot Magnet beacon system for attracting bots to strategic locations.
 */

import { eq, and, lt, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { botMagnetBeacons } from '@/lib/db/schema/config';
import { generateId } from '@/lib/utils';
import {
  withTransactionRetry,
  type TreasuryTx,
} from '@/lib/db/treasuryLock'; // FID-20261002-010 §5.3

const BEACON_CONFIG = {
  DURATION_HOURS: 168,
  COOLDOWN_HOURS: 336,
  ATTRACTION_RADIUS: 100,
  ATTRACTION_CHANCE: 0.30,
  MAX_BEACONS_PER_PLAYER: 1,
} as const;

/** bot_magnet_beacons.id is varchar(24) (lib/db/schema/config.ts). */
const BEACON_ID_MAX_LENGTH = 24;
/** §5.4: bounded primary-key collision retries — then fail honestly. */
const MAX_ID_COLLISION_RETRIES = 3;

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

/**
 * FID-20261002-010 §5.1/§5.4 (boundary audit): the beacon primary key comes
 * from the shared generator whose output length varies with the epoch's digit
 * count (today 13 digits → ≤23 chars; the maximum JavaScript Date epoch → 26).
 * Rather than claim universal schema fit, validate against the ACTUAL
 * varchar(24) budget BEFORE any mutation and refuse oversized ids explicitly.
 */
function generateBeaconId(): string {
  const beaconId = generateId();
  if (beaconId.length > BEACON_ID_MAX_LENGTH) {
    throw new BeaconIdTooLongError(
      `Generated beacon id is ${beaconId.length} characters — exceeds the schema's varchar(${BEACON_ID_MAX_LENGTH}) budget (clock set far in the future?). Deployment refused without mutation.`
    );
  }
  return beaconId;
}

/** §5.4: oversized generator output at a hostile/frozen far-future clock. */
export class BeaconIdTooLongError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BeaconIdTooLongError';
  }
}

/**
 * Deploy a beacon for a researched account (FID-20261002-010).
 *
 * §5.3 the whole deployment — the player-row admission checks, the beacon
 * insert and the cooldown start — runs in ONE `withTransactionRetry`
 * transaction: the player row is FOR UPDATE-locked, active-beacon and
 * cooldown admission re-validated IN-LOCK (no check-then-act gap), and the
 * beacon row commits together with nothing else to write (the cooldown is
 * derived from the beacon row itself, so a committed beacon IS the consumed
 * cooldown — a failed insert changes no state by construction).
 *
 * §5.1 the beacon id is the FULL shared generateId() output (no truncation of
 * the legacy string, no schema widening), length-validated before insert.
 *
 * §5.3 a duplicate-primary-key collision (two deployments deriving the same
 * id within one millisecond + random tail) retries with a FRESH id, bounded
 * at three attempts; every other storage error propagates — never a success
 * response without a beacon row.
 */
export async function deployBeacon(
  playerId: string,
  playerName: string,
  x: number,
  y: number
): Promise<{ success: boolean; message: string; beacon?: BotMagnetBeacon; cooldownRemaining?: number }> {
  try {
    const beacon = await withTransactionRetry('bot-magnet:deploy', () =>
      db.transaction(async (tx: TreasuryTx): Promise<BotMagnetBeacon> => {
        const now = new Date();

        // §5.3: the authoritative admission state, under lock.
        const [player] = await tx
          .select({ username: players.username, unlockedTechs: players.unlockedTechs })
          .from(players)
          .where(eq(players.username, playerId))
          .limit(1)
          .for('update');

        if (!player) {
          throw new BeaconRefusal('Player not found');
        }

        // §5.3: the tech gate rides the locked row — the service enforces it
        // in-lock (the route re-checks for an early friendly 403).
        const unlockedTechs = (player.unlockedTechs as string[]) || [];
        if (!unlockedTechs.includes('bot-magnet')) {
          throw new BeaconRefusal('Requires Bot Magnet technology');
        }

        // In-lock active-beacon admission (MAX_BEACONS_PER_PLAYER = 1).
        const activeBeacon = await tx
          .select({ id: botMagnetBeacons.id })
          .from(botMagnetBeacons)
          .where(and(eq(botMagnetBeacons.playerId, playerId), eq(botMagnetBeacons.active, 1)))
          .limit(1);
        if (activeBeacon.length > 0) {
          throw new BeaconRefusal('You already have an active beacon. Wait for it to expire or cooldown to complete.');
        }

        // In-lock cooldown admission.
        const lastBeacon = await tx
          .select({ cooldownUntil: botMagnetBeacons.cooldownUntil })
          .from(botMagnetBeacons)
          .where(eq(botMagnetBeacons.playerId, playerId))
          .orderBy(desc(botMagnetBeacons.deployedAt))
          .limit(1);
        if (lastBeacon.length > 0 && now < lastBeacon[0].cooldownUntil) {
          const cooldownRemaining = Math.ceil(
            (lastBeacon[0].cooldownUntil.getTime() - now.getTime()) / (1000 * 60 * 60)
          );
          throw new BeaconCooldownError(
            `Beacon on cooldown. ${cooldownRemaining} hours remaining.`,
            cooldownRemaining
          );
        }

        const expiresAt = new Date(now.getTime() + BEACON_CONFIG.DURATION_HOURS * 60 * 60 * 1000);
        const cooldownUntil = new Date(now.getTime() + BEACON_CONFIG.COOLDOWN_HOURS * 60 * 60 * 1000);

        // §5.3: insert with bounded duplicate-key retries (fresh id each try).
        let lastError: unknown;
        for (let attempt = 0; attempt <= MAX_ID_COLLISION_RETRIES; attempt++) {
          let beaconId: string;
          try {
            beaconId = generateBeaconId();
          } catch (error) {
            if (error instanceof BeaconIdTooLongError) throw error; // §5.4: refuse, no mutation
            throw error;
          }

          try {
            const inserted = await tx
              .insert(botMagnetBeacons)
              .values({
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
              })
              .returning({ id: botMagnetBeacons.id });

            if (inserted.length === 0) {
              throw new Error('Beacon insert returned no row — deployment failed');
            }
            const row = inserted[0];

            return {
              id: row.id,
              playerId,
              playerName,
              x,
              y,
              deployedAt: now,
              expiresAt,
              cooldownUntil,
              attractionRadius: BEACON_CONFIG.ATTRACTION_RADIUS,
              attractionChance: BEACON_CONFIG.ATTRACTION_CHANCE,
              botsAttracted: 0,
              active: true,
            };
          } catch (error) {
            // §5.3: only a duplicate-primary-key refusal retries with a fresh
            // id; every other storage error propagates (transaction rolls back).
            const code =
              typeof error === 'object' && error !== null && 'code' in error
                ? String((error as { code: unknown }).code)
                : '';
            if (code === '23505') {
              lastError = error;
              continue;
            }
            throw error;
          }
        }
        // Collision budget exhausted — fail honestly, no partial state.
        throw lastError instanceof Error
          ? lastError
          : new Error(`Beacon id collision persisted after ${MAX_ID_COLLISION_RETRIES + 1} attempts`);
      })
    );

    return {
      success: true,
      message: `Beacon deployed at (${x}, ${y}). Active for ${BEACON_CONFIG.DURATION_HOURS} hours.`,
      beacon,
    };
  } catch (error) {
    if (error instanceof BeaconRefusal) {
      return { success: false, message: error.message };
    }
    if (error instanceof BeaconCooldownError) {
      return { success: false, message: error.message, cooldownRemaining: error.cooldownRemaining };
    }
    if (error instanceof BeaconIdTooLongError) {
      // §5.4: a truthful boundary refusal — the oversized-epoch id never
      // reached the database; nothing was mutated.
      return { success: false, message: error.message };
    }
    console.error('[botMagnet] Beacon deployment failed (transaction rolled back):', error);
    return { success: false, message: 'Beacon deployment failed — no beacon was created and no cooldown was consumed' };
  }
}

/** §5.3: an in-lock admission refusal — rolls the transaction back. */
export class BeaconRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BeaconRefusal';
  }
}

/** §5.3: an in-lock cooldown refusal carrying the remaining hours. */
export class BeaconCooldownError extends Error {
  constructor(
    message: string,
    public readonly cooldownRemaining: number
  ) {
    super(message);
    this.name = 'BeaconCooldownError';
  }
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
    .set({ botsAttracted: sql`bots_attracted + 1` })
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
    .where(and(eq(botMagnetBeacons.playerId, playerId), eq(botMagnetBeacons.active, 1)))
    .returning({ id: botMagnetBeacons.id });
  if (result.length === 0) {
    return { success: false, message: 'No active beacon found.' };
  }
  return { success: true, message: 'Beacon deactivated successfully.' };
}

export async function getBeaconStats(): Promise<{ totalBeacons: number; activeBeacons: number; totalBotsAttracted: number; averageAttraction: number; topBeacons: Array<{ playerName: string; location: string; botsAttracted: number; deployedAt: Date }> }> {
  const all = await db.select().from(botMagnetBeacons).orderBy(desc(botMagnetBeacons.botsAttracted)).limit(10);
  const active = await db.select({ count: sql`count(*)` }).from(botMagnetBeacons).where(eq(botMagnetBeacons.active, 1));
  const total = all.length;
  const activeCount = Number(active[0]?.count ?? 0);
  const totalAttracted = all.reduce((sum, b) => sum + b.botsAttracted, 0);
  return {
    totalBeacons: total,
    activeBeacons: activeCount,
    totalBotsAttracted: totalAttracted,
    averageAttraction: total > 0 ? totalAttracted / total : 0,
    topBeacons: all.map(b => ({ playerName: b.playerName, location: `(${b.x}, ${b.y})`, botsAttracted: b.botsAttracted, deployedAt: b.deployedAt })),
  };
}
