/**
 * @file lib/playerService.ts
 * @created 2025-10-16
 * @updated 2026-04-04 (Migrated to Drizzle ORM)
 * @overview Player management service with spawn logic
 */

import { db } from '@/lib/db';
import { players, tiles } from '@/lib/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { GAME_CONSTANTS, UnitTier } from '@/types';
import type { Player } from '@/types/game.types';

/**
 * Map a flat pg `players` row to the nested domain `Player` shape the client
 * and API contract expect (Mongo-era documents embedded base/currentPosition/
 * resources/bank; Postgres stores them as flat columns).
 *
 * Single source of truth for this mapping (Law 13) — every getter must go
 * through this; returning raw rows leaks `currentPositionX/Y`-style columns
 * and crashes the game client (`player.currentPosition.x` etc.).
 */
function mapRowToPlayer(row: typeof players.$inferSelect): Player {
  return {
    ...row,
    isAdmin: row.isAdmin === 1,
    vip: row.vip === 1,
    base: { x: row.baseX, y: row.baseY },
    currentPosition: { x: row.currentPositionX, y: row.currentPositionY },
    resources: { metal: row.resourcesMetal, energy: row.resourcesEnergy },
    bank: { metal: row.bankMetal, energy: row.bankEnergy, lastDeposit: row.bankLastDeposit },
    rank: row.rank ?? 1,
    inventory: {
      items: row.inventoryItems,
      capacity: row.inventoryCapacity,
      metalDiggerCount: row.inventoryMetalDiggerCount,
      energyDiggerCount: row.inventoryEnergyDiggerCount,
    },
    // pg numeric columns arrive as strings — convert to the domain's numbers
    gatheringBonus: {
      metalBonus: Number(row.gatheringBonusMetalBonus),
      energyBonus: Number(row.gatheringBonusEnergyBonus),
    },
    activeBoosts: {
      gatheringBoost: row.activeBoostsGatheringBoost === null ? null : Number(row.activeBoostsGatheringBoost),
      expiresAt: row.activeBoostsExpiresAt,
    },
  } as unknown as Player;
}

export async function usernameExists(username: string): Promise<boolean> {
  try {
    const result = await db.select({ count: sql`count(*)` }).from(players).where(eq(players.username, username));
    return Number(result[0]?.count ?? 0) > 0;
  } catch (error) {
    console.error('Error checking username:', error);
    throw error;
  }
}

export async function getPlayerByUsername(username: string): Promise<Player | null> {
  try {
    const result = await db.select().from(players).where(eq(players.username, username)).limit(1);
    return result[0] ? mapRowToPlayer(result[0]) : null;
  } catch (error) {
    console.error('Error fetching player:', error);
    throw error;
  }
}

export async function findAndClaimSpawnTile(): Promise<typeof tiles.$inferSelect | null> {
  try {
    const availableTiles = await db.select().from(tiles).where(and(eq(tiles.terrain, 'Wasteland'), isNull(tiles.occupiedByBase)));
    if (availableTiles.length === 0) {
      console.error('No available Wasteland tiles for spawning');
      return null;
    }
    const randomIndex = Math.floor(Math.random() * availableTiles.length);
    const selectedTile = availableTiles[randomIndex];
    await db.update(tiles).set({ occupiedByBase: 1 }).where(and(eq(tiles.x, selectedTile.x), eq(tiles.y, selectedTile.y), isNull(tiles.occupiedByBase)));
    console.log('Claimed spawn tile at (' + selectedTile.x + ', ' + selectedTile.y + ')');
    return selectedTile;
  } catch (error) {
    console.error('Error finding spawn tile:', error);
    throw error;
  }
}

export async function createPlayer(username: string): Promise<Player> {
  try {
    if (!username || username.trim().length === 0) throw new Error('Username cannot be empty');
    if (username.length < 3 || username.length > 20) throw new Error('Username must be between 3 and 20 characters');
    const exists = await usernameExists(username);
    if (exists) throw new Error('Username already taken');
    const spawnTile = await findAndClaimSpawnTile();
    if (!spawnTile) throw new Error('No available spawn locations');
    const newPlayer = {
      username: username.trim(),
      email: '',
      password: '',
      baseX: spawnTile.x,
      baseY: spawnTile.y,
      currentPositionX: spawnTile.x,
      currentPositionY: spawnTile.y,
      resourcesMetal: GAME_CONSTANTS.STARTING_RESOURCES.metal,
      resourcesEnergy: GAME_CONSTANTS.STARTING_RESOURCES.energy,
      bankMetal: 0,
      bankEnergy: 0,
      rank: 1,
      inventoryItems: [],
      inventoryCapacity: GAME_CONSTANTS.HARVEST.DEFAULT_INVENTORY_CAPACITY,
      inventoryMetalDiggerCount: 0,
      inventoryEnergyDiggerCount: 0,
      gatheringBonusMetalBonus: '0',
      gatheringBonusEnergyBonus: '0',
      shrineBoosts: [],
      units: [],
      totalStrength: 0,
      totalDefense: 0,
      xp: 0,
      level: 1,
      researchPoints: 0,
      unlockedTiers: [UnitTier.Tier1],
      createdAt: new Date(),
    };
    await db.insert(players).values(newPlayer);
    console.log('Created player: ' + username + ' at (' + spawnTile.x + ', ' + spawnTile.y + ')');
    // Return the full domain Player from the inserted row (single mapping path)
    const created = await getPlayerByUsername(username.trim());
    if (!created) throw new Error('Player creation failed: row not found after insert');
    return created;
  } catch (error) {
    console.error('Error creating player:', error);
    throw error;
  }
}

export async function emailInUse(email: string): Promise<boolean> {
  try {
    const result = await db.select({ count: sql`count(*)` }).from(players).where(eq(players.email, email.toLowerCase().trim()));
    return Number(result[0]?.count ?? 0) > 0;
  } catch (error) {
    console.error('Error checking email:', error);
    throw error;
  }
}

export async function getPlayerByEmail(email: string): Promise<Player | null> {
  try {
    const result = await db.select().from(players).where(eq(players.email, email.toLowerCase().trim())).limit(1);
    const row = result[0];
    if (!row) return null;
    return mapRowToPlayer(row);
  } catch (error) {
    console.error('Error getting player by email:', error);
    throw error;
  }
}

export async function createPlayerWithAuth(username: string, email: string, hashedPassword: string): Promise<Player> {
  try {
    if (!username || username.trim().length === 0) throw new Error('Username cannot be empty');
    if (username.length < 3 || username.length > 20) throw new Error('Username must be between 3 and 20 characters');
    const exists = await usernameExists(username);
    if (exists) throw new Error('Username already taken');
    const emailExists = await emailInUse(email);
    if (emailExists) throw new Error('Email already registered');
    const spawnTile = await findAndClaimSpawnTile();
    if (!spawnTile) throw new Error('No available spawn locations');
    const newPlayer = {
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      baseX: spawnTile.x,
      baseY: spawnTile.y,
      currentPositionX: spawnTile.x,
      currentPositionY: spawnTile.y,
      resourcesMetal: GAME_CONSTANTS.STARTING_RESOURCES.metal,
      resourcesEnergy: GAME_CONSTANTS.STARTING_RESOURCES.energy,
      bankMetal: 0,
      bankEnergy: 0,
      rank: 1,
      inventoryItems: [],
      inventoryCapacity: GAME_CONSTANTS.HARVEST.DEFAULT_INVENTORY_CAPACITY,
      inventoryMetalDiggerCount: 0,
      inventoryEnergyDiggerCount: 0,
      gatheringBonusMetalBonus: '0',
      gatheringBonusEnergyBonus: '0',
      shrineBoosts: [],
      units: [],
      totalStrength: 0,
      totalDefense: 0,
      xp: 0,
      level: 1,
      researchPoints: 0,
      unlockedTiers: [UnitTier.Tier1],
      createdAt: new Date(),
    };
    await db.insert(players).values(newPlayer);
    console.log('Created player with auth: ' + username + ' at (' + spawnTile.x + ', ' + spawnTile.y + ')');
    // Return the full domain Player from the inserted row (single mapping path)
    const created = await getPlayerByUsername(username.trim());
    if (!created) throw new Error('Player creation failed: row not found after insert');
    return created;
  } catch (error) {
    console.error('Error creating player with auth:', error);
    throw error;
  }
}

export async function getPlayer(username: string): Promise<Player | null> {
  return getPlayerByUsername(username);
}

