/**
 * @file lib/botFactoryRaid.ts
 * @created 2026-09-12
 * @overview FID-20260912-073 — bots capture factories (the missing half of the
 * factory war loop).
 *
 * FID-072 smoothed the defense curve specifically so mid-game factory war
 * could exist — but no bot path ever called attackFactory; only players could
 * engage. This module gives strong bots a bounded capture attempt inside the
 * hourly growth cycle:
 *
 * - Eligibility: tier-2/3 bots only, STR ≥ the L2 defense threshold, standing
 *   near a wild (owner-less) factory within RAID_RADIUS.
 * - Frequency: 20% chance per eligible bot per hourly cycle → ~1 raid per
 *   strong bot every ~5 hours on average; a per-bot factory cooldown
 *   (botConfig.lastFactoryRaid, reuse of the attackCooldown field pattern)
 *   prevents chained captures.
 * - Ownership cap: bots hold at most BOT_MAX_FACTORIES (2) — enough to
 *   contest districts, not enough to starve players of targets.
 * - Combat resolution: the SAME attackFactory() players use — identical
 *   power/defense math, cooldown bookkeeping, XP skipped for bots.
 * - Capture effects: factory flips to the bot (usedSlots reset, income clock
 *   starts), the bot becomes a contestable target — players can raid it back.
 *
 * Tier-1 bots never raid (they're the starter-district population).
 */
import type { Player } from '@/types/game.types';
import { getFactoryDefense, FACTORY_UPGRADE } from './factoryUpgradeService';
import { attackFactory, findNearestWildFactory } from './factoryService';
import { db, factories } from './db';
import { eq, sql } from 'drizzle-orm';
import { getCollection } from './mongodb';

/** A bot only considers wild factories within this radius (tiles). */
const RAID_RADIUS = 20;
/** Chance an eligible bot attempts a raid in one growth cycle. */
const RAID_CHANCE = 0.2;
/** Bots hold at most this many factories (players: 10). */
const BOT_MAX_FACTORIES = 2;
/** Minimum bot STR to attempt a raid (L2 defense = first meaningful wall). */
const MIN_RAID_STRENGTH = getFactoryDefense(2);
/** Tiers allowed to raid (tier 1 = starter population, stays peaceful). */
const RAID_ELIGIBLE_TIERS = [2, 3];

interface RaidOutcome {
  attempts: number;
  captures: number;
  details: string[];
}

/** Tier gate: read from botConfig.tier (botService writes it at spawn). */
function botTier(bot: Player): number {
  return bot.botConfig?.tier ?? 1;
}

/** Bot's cooldown check — one factory raid attempt per cooldown window. */
function raidOnCooldown(bot: Player, now: Date): boolean {
  const last = bot.botConfig?.attackCooldown;
  if (!last) return false;
  // Reuse the player-vs-player cooldown magnitude: 6h between factory raids.
  return now.getTime() - new Date(last).getTime() < 6 * 60 * 60 * 1000;
}

/**
 * One growth-cycle raid phase for the whole bot population.
 * Called from runGrowthCycle AFTER movement (bots raid where they ended up).
 */
export async function runBotFactoryRaids(bots: Player[]): Promise<RaidOutcome> {
  const outcome: RaidOutcome = { attempts: 0, captures: 0, details: [] };
  const now = new Date();

  for (const bot of bots) {
    try {
      if (!RAID_ELIGIBLE_TIERS.includes(botTier(bot))) continue;
      if ((bot.totalStrength ?? 0) < MIN_RAID_STRENGTH) continue;
      if (raidOnCooldown(bot, now)) continue;
      if (Math.random() > RAID_CHANCE) continue;

      // Count factories the bot already owns (ownership cap).
      const ownedRows = await db
        .select({ count: sql`count(*)` })
        .from(factories)
        .where(eq(factories.owner, bot.username));
      if (Number(ownedRows[0]?.count ?? 0) >= BOT_MAX_FACTORIES) continue;

      // Find the nearest wild factory within radius of the bot's position.
      const bx = bot.currentPosition?.x;
      const by = bot.currentPosition?.y;
      if (typeof bx !== 'number' || typeof by !== 'number') continue;

      const target = await findNearestWildFactory(bx, by, RAID_RADIUS);
      if (!target) continue;

      outcome.attempts += 1;
      const result = await attackFactory(bot.username, target.x, target.y);
      if (result.success) {
        outcome.captures += 1;
        outcome.details.push(
          `${bot.username} (T${botTier(bot)}, STR ${(bot.totalStrength ?? 0).toLocaleString()}) captured L${target.level} factory at (${target.x}, ${target.y})`
        );
      }

      // Set the raid cooldown regardless of outcome (failed scouts back off).
      const players = await getCollection<Player>('players');
      await players.updateOne(
        { username: bot.username },
        { $set: { 'botConfig.attackCooldown': now } }
      );
    } catch (err) {
      outcome.details.push(`raid error for ${bot.username}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return outcome;
}

/** Exported for tests + the admin jobs panel readout. */
export const BOT_FACTORY_RAID_CONFIG = {
  RAID_RADIUS,
  RAID_CHANCE,
  BOT_MAX_FACTORIES,
  MIN_RAID_STRENGTH,
  RAID_ELIGIBLE_TIERS,
  MAX_LEVEL: FACTORY_UPGRADE.MAX_LEVEL,
} as const;
