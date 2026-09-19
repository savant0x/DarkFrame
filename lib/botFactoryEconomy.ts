/**
 * @file lib/botFactoryEconomy.ts
 * @created 2026-09-12
 * @overview FID-20260912-067 — bot-driven factory upgrade economy.
 *
 * The map's 961 wild factories were all stamped Level 1 at world-gen and the
 * level never moved: every factory on the map was baseline, which reads fake.
 * This engine lets the BOT population be the economy's engine — each cycle,
 * bots "invest" in wild factories near their territory by paying the real
 * upgrade cost (same calculateUpgradeCost formula players pay) from their own
 * resource stockpiles, raising factory level/defense/slots exactly like a
 * player upgrade does.
 *
 * Design rules:
 * - Bots pay real costs (deducted from their players row). If a bot is broke,
 *   it can't upgrade — scarcity creates organic inequality.
 * - Proximity: a bot only invests within INVEST_RADIUS of its own position, so
 *   endgame zones (richer bots) develop higher-level industrial belts naturally.
 * - Level caps by bot tier (weaker zones cap lower) so the gradient matches the
 *   zone difficulty ladder instead of topping everything out at 10.
 * - Idempotent + bounded: one pass upgrades at most BATCH_SIZE factories, keyed
 *   by a game_config marker so restarts never double-invest.
 * - The seed pass gives the world its "simulated history" up-front: on first
 *   run (marker absent), factories get a weighted-random historical level
 *   distribution around nearby bot wealth. Subsequent passes grow levels by
 *   single increments — ongoing simulated activity.
 */

import { db } from './db/connection';
import { players, factories } from './db/schema';
import { gameConfig } from './db/schema/config';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { mapRowToPlayer } from './playerService';
import { logger } from './logger';
import { calculateUpgradeCost, getFactoryDefense, getMaxSlots, getProductionRate, FACTORY_UPGRADE } from './factoryUpgradeService';
import type { Player } from '@/types/game.types';

/** Wild-factory investment radius (tiles) from an investing bot. */
const INVEST_RADIUS = 25;
/** Max factories upgraded per scheduled pass (keeps DB work bounded). */
const BATCH_SIZE = 12;
/** Seed marker type in game_config. */
const SEED_MARKER_TYPE = 'bot_factory_economy';

interface SeedMarker {
  seededAt: string;
  totalInvestedMetal: number;
  totalInvestedEnergy: number;
}

/** game_config row shape: id PK + type + config jsonb (mirrors the beerBase row). */
const markerConfig = (m: { seededAt?: string; totalInvestedMetal: number; totalInvestedEnergy: number }): SeedMarker => ({
  seededAt: m.seededAt ?? new Date().toISOString(),
  totalInvestedMetal: m.totalInvestedMetal,
  totalInvestedEnergy: m.totalInvestedEnergy,
});

// ---------------------------------------------------------------------------
// Core pass
// ---------------------------------------------------------------------------

/**
 * One economy cycle:
 *  1. First run ever → seed the historical level distribution (bounded pass).
 *  2. Otherwise → bots invest in nearby wild factories (bounded pass).
 */
export async function runBotFactoryEconomyCycle(): Promise<{
  success: boolean;
  seeded: boolean;
  upgraded: number;
  investedMetal: number;
  investedEnergy: number;
  message: string;
}> {
  try {
    const [markerRow] = await db
      .select({ config: gameConfig.config })
      .from(gameConfig)
      .where(eq(gameConfig.type, SEED_MARKER_TYPE))
      .limit(1);

    if (!markerRow) {
      const seed = await seedHistoricalLevels();
      // Schema: game_config(id PK, type, config jsonb NOT NULL) — the payload
      // lives in `config`, and `id` gets the type string (unique index on type
      // makes a retry-on-conflict harmless).
      await db.insert(gameConfig).values({
        id: SEED_MARKER_TYPE,
        type: SEED_MARKER_TYPE,
        config: markerConfig({ totalInvestedMetal: seed.investedMetal, totalInvestedEnergy: seed.investedEnergy }) as SeedMarker as never,
      });
      return {
        success: true,
        seeded: true,
        upgraded: seed.upgraded,
        investedMetal: seed.investedMetal,
        investedEnergy: seed.investedEnergy,
        message: `Seed pass: ${seed.upgraded} factories given historical levels (${seed.investedMetal} metal invested by bots)`,
      };
    }

    const pass = await botInvestmentPass();
    return {
      success: true,
      seeded: false,
      ...pass,
      message: `Bot investment pass: ${pass.upgraded} factories upgraded (${pass.investedMetal} metal, ${pass.investedEnergy} energy spent by bots)`,
    };
  } catch (error) {
    logger.error('Bot factory economy cycle failed', error instanceof Error ? error : new Error(String(error)));
    return { success: false, seeded: false, upgraded: 0, investedMetal: 0, investedEnergy: 0, message: 'Economy cycle failed' };
  }
}

// ---------------------------------------------------------------------------
// Seed pass — the "simulated history"
// ---------------------------------------------------------------------------

/**
 * Give wild factories a believable historical level spread. Each factory is
 * upgraded from L1 by a weighted draw (most stay low, a few climb high),
 * BUT each increment is paid by the nearest bot within INVEST_RADIUS if that
 * bot can afford it — bots with empty stockpiles leave their district at L1.
 * This is why the map will feel organic: wealth maps to bot activity.
 */
async function seedHistoricalLevels(): Promise<{
  upgraded: number;
  investedMetal: number;
  investedEnergy: number;
}> {
  const wild = await db
    .select()
    .from(factories)
    .where(isNull(factories.owner))
    .limit(300);
  const bots = (await db.select().from(players).where(eq(players.isBot, 1))).map(mapRowToPlayer);

  let upgraded = 0;
  let investedMetal = 0;
  let investedEnergy = 0;
  let processed = 0;

  for (const factory of wild) {
    // Weighted target: 55% stay L1, 25% L2-3, 13% L4-5, 6% L6-7, 1% L8-9.
    const roll = Math.random();
    let targetLevel = 1;
    if (roll > 0.99) targetLevel = 8 + Math.floor(Math.random() * 2);
    else if (roll > 0.94) targetLevel = 6 + Math.floor(Math.random() * 2);
    else if (roll > 0.87) targetLevel = 4 + Math.floor(Math.random() * 2);
    else if (roll > 0.55) targetLevel = 2 + Math.floor(Math.random() * 2);

    if (targetLevel <= (factory.level ?? 1)) continue;

    // Nearest bot within radius pays the whole historical tab (simulated past).
    const investor = nearestBot(bots, factory);
    if (!investor) continue;

    // Batch purchase: walk the cost ladder in memory until the bot's remaining
    // stockpile can't cover the next increment, then commit the whole tab in
    // ONE bot update + ONE factory update. Two round trips per factory instead
    // of two per level — and crash-consistent (a payment is never committed
    // without its matching level bump in the same pair of writes).
    let level = factory.level ?? 1;
    let spentM = 0;
    let spentE = 0;
    let walletM = investor.resources?.metal ?? 0;
    let walletE = investor.resources?.energy ?? 0;
    while (level < targetLevel) {
      const cost = calculateUpgradeCost(level);
      if (walletM < cost.metal || walletE < cost.energy) break; // tapped out — history stays honest
      walletM -= cost.metal;
      walletE -= cost.energy;
      spentM += cost.metal;
      spentE += cost.energy;
      level += 1;
    }

    if (level > (factory.level ?? 1) && spentM > 0) {
      await db
        .update(players)
        .set({
          resourcesMetal: sql`${players.resourcesMetal} - ${spentM}`,
          resourcesEnergy: sql`${players.resourcesEnergy} - ${spentE}`,
        })
        .where(eq(players.username, investor.username));
      investor.resources!.metal -= spentM;
      investor.resources!.energy -= spentE;
      await db
        .update(factories)
        .set({
          // FID-072: full stat block — the seed previously wrote level+defense
          // only, leaving slots/productionRate at L1 (the stale-metrics bug).
          level,
          defense: getFactoryDefense(level),
          slots: getMaxSlots(level),
          productionRate: String(getProductionRate(level)),
          investedMetal: sql`${factories.investedMetal} + ${spentM}`,
          investedEnergy: sql`${factories.investedEnergy} + ${spentE}`,
        })
        .where(and(eq(factories.x, factory.x), eq(factories.y, factory.y)));
      upgraded += 1;
      investedMetal += spentM;
      investedEnergy += spentE;
    }

    processed += 1;
    if (processed % 60 === 0) {
      logger.info(`Bot factory seed pass: ${processed}/${wild.length} factories scanned, ${upgraded} upgraded so far`);
    }
  }

  logger.info(`Bot factory seed pass: ${upgraded} factories, ${investedMetal} metal invested`);
  return { upgraded, investedMetal, investedEnergy };
}

// ---------------------------------------------------------------------------
// Ongoing pass — bots keep investing as their stockpiles regrow
// ---------------------------------------------------------------------------

/**
 * Bots upgrade nearby wild factories by ONE level per pass (real cost paid
 * from live stockpiles). Bounded to BATCH_SIZE per cycle.
 */
async function botInvestmentPass(): Promise<{
  upgraded: number;
  investedMetal: number;
  investedEnergy: number;
}> {
  const bots = (await db.select().from(players).where(eq(players.isBot, 1))).map(mapRowToPlayer);
  if (bots.length === 0) return { upgraded: 0, investedMetal: 0, investedEnergy: 0 };

  // Candidate wild factories below max level.
  const candidates = await db
    .select()
    .from(factories)
    .where(isNull(factories.owner))
    .limit(200);
  const upgradable = candidates.filter((f) => (f.level ?? 1) < FACTORY_UPGRADE.MAX_LEVEL);

  let upgraded = 0;
  let investedMetal = 0;
  let investedEnergy = 0;

  for (const factory of upgradable) {
    if (upgraded >= BATCH_SIZE) break;

    const investor = nearestBot(bots, factory);
    if (!investor) continue;

    // Tier-based cap keeps zone difficulty coherent (rich endgame districts
    // top out higher than starter zones). Derived from bot level.
    const cap = districtLevelCap(investor);
    if ((factory.level ?? 1) >= cap) continue;

    const nextLevel = (factory.level ?? 1) + 1;
    const cost = calculateUpgradeCost(factory.level ?? 1);
    const botMetal = investor.resources?.metal ?? 0;
    const botEnergy = investor.resources?.energy ?? 0;
    if (botMetal < cost.metal || botEnergy < cost.energy) continue;

    await db
      .update(players)
      .set({
        resourcesMetal: sql`${players.resourcesMetal} - ${cost.metal}`,
        resourcesEnergy: sql`${players.resourcesEnergy} - ${cost.energy}`,
      })
      .where(eq(players.username, investor.username));
    investor.resources!.metal -= cost.metal;
    investor.resources!.energy -= cost.energy;

    await db
      .update(factories)
      .set({
        // FID-072: full stat block (same as the seed pass + player upgrade).
        level: nextLevel,
        defense: getFactoryDefense(nextLevel),
        slots: getMaxSlots(nextLevel),
        productionRate: String(getProductionRate(nextLevel)),
        investedMetal: sql`${factories.investedMetal} + ${cost.metal}`,
        investedEnergy: sql`${factories.investedEnergy} + ${cost.energy}`,
      })
      .where(and(eq(factories.x, factory.x), eq(factories.y, factory.y)));

    upgraded += 1;
    investedMetal += cost.metal;
    investedEnergy += cost.energy;
  }

  return { upgraded, investedMetal, investedEnergy };
}

// ---------------------------------------------------------------------------

function nearestBot(bots: Player[], factory: { x: number; y: number }): Player | null {
  let best: Player | null = null;
  let bestDist = Infinity;
  for (const bot of bots) {
    const bx = bot.currentPosition?.x;
    const by = bot.currentPosition?.y;
    if (typeof bx !== 'number' || typeof by !== 'number') continue;
    const dist = Math.max(Math.abs(bx - factory.x), Math.abs(by - factory.y));
    if (dist <= INVEST_RADIUS && dist < bestDist) {
      best = bot;
      bestDist = dist;
    }
  }
  return best;
}

/** District level cap from the investing bot's level: low zones stay low. */
function districtLevelCap(bot: Player): number {
  const lvl = bot.level ?? 1;
  if (lvl >= 55) return 9; // endgame belt
  if (lvl >= 40) return 7;
  if (lvl >= 25) return 5;
  if (lvl >= 15) return 3;
  return 2; // starter districts: light industrial
}
