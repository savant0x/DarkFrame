/**
 * @file lib/botSummoningService.ts
 * @created 2025-01-18
 * 
 * OVERVIEW:
 * Bot Summoning Circle system for spawning bots of chosen specialization.
 * 
 * FEATURES:
 * - Spawn 5 bots of selected specialization
 * - Bots spawn within 20-tile radius of player position
 * - Summoned bots have 1.5x base resources
 * - 7-day (168 hour) cooldown per summon
 * - Tech requirement: bot-summoning-circle
 * - Cooldown tracked per player
 * 
 * INTEGRATION:
 * - Called via API endpoint /api/bot-summoning
 * - Uses createBot from botService with resource multiplier
 * - Cooldown stored in player document (lastBotSummon field)
 * 
 * SUMMONING MECHANICS:
 * - Player selects specialization (Hoarder, Fortress, Raider, Balanced, Ghost)
 * - 5 bots created with chosen specialization
 * - Each bot spawns at random position within 20-tile radius
 * - Resource multiplier: 1.5x (NOT Beer Base level, but significant boost)
 * - Cooldown: 168 hours (7 days) from last summon
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq, isNotNull, desc, sql } from 'drizzle-orm';
import { type Player, BotSpecialization } from '@/types/game.types';
import { createBotPlayer, claimBotTilesInRadius, generateBotName, InsufficientLegalTilesError } from '@/lib/botService';
import { mapDomainPlayerToRow } from '@/lib/playerService';
import { withTransactionRetry } from '@/lib/db/treasuryLock'; // FID-20261002-009 §5.4

/**
 * Summoning configuration — exported for the row-51 contract test
 * (__tests__/lib/headerTruthPins.test.ts), which pins the player-facing
 * header promises (1.5× resources, 168h cooldown) to these constants.
 */
export const SUMMONING_CONFIG = {
  BOT_COUNT: 5,
  SPAWN_RADIUS: 20,
  RESOURCE_MULTIPLIER: 1.5,
  COOLDOWN_HOURS: 168, // 7 days
} as const;

/**
 * Summon bots around the summoner's LOCKED position (FID-20261002-009).
 *
 * R18 (RED): createBotPlayer claimed a Wasteland tile, then this service
 * substituted unchecked client-derived offsets — the claimed tile stayed at
 * the old location while the rows/response said otherwise (positions could
 * collide or leave the map entirely).
 *
 * §5.1 the summoner's position is read from the AUTHENTICATED locked player
 * row (client coordinates are advisory and no longer accepted at all); tech
 * and cooldown are validated IN-LOCK. §5.4 the whole operation — five distinct
 * legal tile claims, five bot inserts, the 168h cooldown — commits in ONE
 * transaction: fewer than five legal positions refuses and rolls back every
 * claim/insert rather than returning a misleading five-bot success. §5.2/§5.3
 * the claimed tiles are the ONE source for base/current position, inserted
 * rows and the response — post-claim relocation no longer exists, and the
 * zone derives from each ACTUAL tile via the repository's convention.
 */
export async function summonBots(
  playerId: string,
  specialization: BotSpecialization
): Promise<{
  success: boolean;
  message: string;
  bots?: Array<{ username: string; position: { x: number; y: number } }>;
}> {
  try {
    const now = new Date();
    const botInfo = await withTransactionRetry('bots:summon', () =>
      db.transaction(async (tx) => {
        // §5.1: the authoritative summoner identity + position, under lock.
        const [player] = await tx
          .select()
          .from(players)
          .where(eq(players.username, playerId))
          .limit(1)
          .for('update');

        if (!player) {
          throw new SummonRefusal('Player not found');
        }

        // §5.1: tech + cooldown re-validated IN-LOCK (no check-then-act gap).
        const unlockedTechs = (player.unlockedTechs as string[]) || [];
        if (!unlockedTechs.includes('bot-summoning-circle')) {
          throw new SummonRefusal('Requires Bot Summoning Circle technology');
        }

        const lastSummon = player.lastBotSummon as Date | undefined;
        if (lastSummon) {
          const cooldownMs = SUMMONING_CONFIG.COOLDOWN_HOURS * 60 * 60 * 1000;
          const nextSummonTime = new Date(new Date(lastSummon).getTime() + cooldownMs);
          if (now < nextSummonTime) {
            const hoursRemaining = Math.ceil(
              (nextSummonTime.getTime() - now.getTime()) / (1000 * 60 * 60)
            );
            throw new SummonRefusal(`Summoning on cooldown. ${hoursRemaining} hours remaining.`);
          }
        }

        // §5.1: the LOCKED row's position is the truth (current position, then
        // base — the same precedence the route used to pass through).
        const center = {
          x: player.currentPositionX || player.baseX,
          y: player.currentPositionY || player.baseY,
        };
        if (!center.x || !center.y) {
          throw new SummonRefusal('Player position not found');
        }

        // §5.5: identities BEFORE claims, so every claim is attributed to its
        // actual bot from the first write.
        const ownerUsernames = Array.from({ length: SUMMONING_CONFIG.BOT_COUNT }, () => generateBotName());

        // §5.5: the FULL five-tile candidate set is sorted, locked and claimed
        // before any insert; fewer than five legal tiles throws and rolls the
        // whole batch back.
        const claimedTiles = await claimBotTilesInRadius({
          tx,
          center,
          radius: SUMMONING_CONFIG.SPAWN_RADIUS,
          ownerUsernames,
          specialization,
        });

        // §5.3: the claimed tile is the ONE source — createBotPlayer pins the
        // bot to it (identity, stats, 1.5× resources applied below) with zero
        // post-claim relocation.
        const botsToInsert: Array<Partial<Player> & { username: string }> = [];
        const botInfo: Array<{ username: string; position: { x: number; y: number } }> = [];
        for (let i = 0; i < claimedTiles.length; i++) {
          const tile = claimedTiles[i];
          // §5.3: the pre-generated identity rides with its tile — the claim
          // owner and the inserted bot row are the SAME username.
          const bot = await createBotPlayer(null, specialization, false, null, {
            claimedTile: tile,
            username: ownerUsernames[i],
          });

          if (bot.resources) {
            bot.resources.metal = Math.floor(bot.resources.metal * SUMMONING_CONFIG.RESOURCE_MULTIPLIER);
            bot.resources.energy = Math.floor(bot.resources.energy * SUMMONING_CONFIG.RESOURCE_MULTIPLIER);
          }

          if (bot.botConfig) {
            const config = bot.botConfig as { summonedBy?: string; summonedAt?: Date };
            config.summonedBy = playerId;
            config.summonedAt = now;
          }

          botsToInsert.push({ ...bot, username: bot.username || ownerUsernames[i] });
          botInfo.push({ username: bot.username || ownerUsernames[i], position: { x: tile.x, y: tile.y } });
        }

        // Domain→row mapping — raw domain objects (boolean isBot, nested
        // base/resources) crash or silently drop on direct drizzle inserts.
        await tx.insert(players).values(botsToInsert.map(mapDomainPlayerToRow));

        // §5.4: the cooldown consumes in the SAME transaction.
        await tx
          .update(players)
          .set({ lastBotSummon: now })
          .where(eq(players.username, playerId));

        return botInfo;
      })
    );

    return {
      success: true,
      message: `Summoned ${SUMMONING_CONFIG.BOT_COUNT} ${specialization} bots`,
      bots: botInfo,
    };
  } catch (error) {
    if (error instanceof SummonRefusal) {
      return { success: false, message: error.message };
    }
    if (error instanceof InsufficientLegalTilesError) {
      // §5.4: a truthful refusal — the player sees WHY (fewer legal positions
      // than bots), and the rolled-back batch consumed nothing.
      return { success: false, message: error.message };
    }
    console.error('[botSummoning] Summon failed (transaction rolled back):', error);
    return { success: false, message: 'Summoning failed — no bots, claims or cooldown were consumed' };
  }
}

/** §5.1/§5.4: an in-lock admission refusal — rolls the whole batch back. */
export class SummonRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SummonRefusal';
  }
}

/**
 * Get summoning cooldown status
 */
export async function getSummoningStatus(
  playerId: string
): Promise<{
  canSummon: boolean;
  hoursRemaining?: number;
  lastSummon?: Date;
  nextSummonTime?: Date;
}> {
  const playerRows = await db.select({ lastBotSummon: players.lastBotSummon }).from(players).where(eq(players.username, playerId)).limit(1);
  const player = playerRows[0];

  if (!player) {
    return { canSummon: false };
  }

  const lastSummon = player.lastBotSummon as Date | undefined;

  if (!lastSummon) {
    return { canSummon: true };
  }

  const now = new Date();
  const cooldownMs = SUMMONING_CONFIG.COOLDOWN_HOURS * 60 * 60 * 1000;
  const nextSummonTime = new Date(new Date(lastSummon).getTime() + cooldownMs);

  if (now >= nextSummonTime) {
    return {
      canSummon: true,
      lastSummon: new Date(lastSummon),
    };
  }

  const hoursRemaining = Math.ceil(
    (nextSummonTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  );

  return {
    canSummon: false,
    hoursRemaining,
    lastSummon: new Date(lastSummon),
    nextSummonTime,
  };
}

/**
 * Get summoning statistics (admin)
 */
export async function getSummoningStats(): Promise<{
  totalSummons: number;
  activePlayerSummoners: number;
  summonsBySpecialization: Record<BotSpecialization, number>;
  recentSummons: Array<{
    playerName: string;
    specialization: BotSpecialization;
    botCount: number;
    summonedAt: Date;
  }>;
}> {
  const summonersResult = await db.select({ count: sql<number>`count(*)` }).from(players).where(isNotNull(players.lastBotSummon));
  const summoners = summonersResult[0]?.count || 0;

  const allPlayers = await db.select({
    username: players.username,
    isBot: players.isBot,
    botConfig: players.botConfig,
    lastBotSummon: players.lastBotSummon,
  }).from(players).where(eq(players.isBot, 1));

  const summonedBots = allPlayers.filter(p => {
    const config = p.botConfig as { summonedBy?: string } | null;
    return config?.summonedBy;
  });

  const summonsBySpec: Record<string, number> = {
    Hoarder: 0,
    Fortress: 0,
    Raider: 0,
    Balanced: 0,
    Ghost: 0,
  };

  summonedBots.forEach((bot) => {
    const config = bot.botConfig as { specialization?: string } | null;
    const spec = config?.specialization || 'Balanced';
    summonsBySpec[spec] = (summonsBySpec[spec] || 0) + 1;
  });

  const recentSummoners = await db.select({
    username: players.username,
    lastBotSummon: players.lastBotSummon,
  }).from(players).where(isNotNull(players.lastBotSummon)).orderBy(desc(players.lastBotSummon)).limit(10);

  const recentSummons = recentSummoners.map((player) => ({
    playerName: player.username,
    specialization: 'Unknown' as BotSpecialization,
    botCount: SUMMONING_CONFIG.BOT_COUNT,
    summonedAt: player.lastBotSummon as Date,
  }));

  return {
    totalSummons: summonedBots.length,
    activePlayerSummoners: summoners,
    summonsBySpecialization: summonsBySpec as Record<BotSpecialization, number>,
    recentSummons,
  };
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(hours: number): string {
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  
  if (days > 0) {
    return `${days}d ${remainingHours}h`;
  }
  return `${remainingHours}h`;
}

/**
 * IMPLEMENTATION NOTES:
 * - Summons 5 bots of chosen specialization
 * - Bots spawn within 20-tile radius of player position
 * - Resource multiplier: 1.5x base resources (significant but not Beer Base level)
 * - Cooldown: 168 hours (7 days) stored in player.lastBotSummon
 * - Tech requirement: 'bot-summoning-circle' (enforced at API level)
 * - Summoned bots marked with botConfig.summonedBy and botConfig.summonedAt
 * - Spawn positions use polar coordinates for circular distribution
 * - Zone calculated from final position for proper bot placement
 * - All 5 bots inserted in single database operation
 * - Cooldown timer starts immediately after successful summon
 */
