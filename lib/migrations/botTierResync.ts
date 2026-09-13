/**
 * @file lib/migrations/botTierResync.ts
 * @created 2026-09-12
 * @overview FID-20260912-086 — boot self-heal that keeps botConfig.tier
 * canonical for every bot row.
 *
 * Why this exists: `botConfig.tier` drives combat XP (50 + tier*25), the bot
 * factory-raid gate (only T4+ bases may be raided — FID-067), scanner display,
 * and resource-regen scaling. The field was written reliably for regular bots
 * at spawn (their level never changes), but spawnBeerBase rewrote level/rank
 * from the smart PowerTier and left botConfig.tier at the zone roll — so an
 * Elite base rolled into a T1 zone read as tier 1 everywhere (raid-exempt,
 * underpaid XP, wrong scanner tier). Same self-heal shape as
 * factoryStatResync.ts: migrations marker + drift scan (re-running is free
 * when healthy, corrective when not).
 *
 * Canonical derivation:
 *   • beer bases (isSpecialBase): rank is the PowerTier (Weak=1..Legendary=6),
 *     set once at spawn and never mutated → tier = rank, clamped 1..6
 *   • bosses (specialization 'boss'): pinned tier 7
 *   • regular bots: tier bracket = level (10 levels per tier, 1..7), matching
 *     getPlayerLevelForTier's spawn-time level↔tier mapping
 */
import { sql, eq } from 'drizzle-orm';
import { db } from '../db';
import { players, migrations } from '../db/schema';
import type { BotConfig } from '../../types/game.types';

const MIGRATION_ID = '0029_bot_tier_resync';

export function regularBotTierForLevel(level: number): number {
  return Math.min(7, Math.max(1, Math.ceil(level / 10)));
}

export function beerBaseTierForRank(rank: number | null): number {
  return Math.min(6, Math.max(1, rank ?? 1));
}

export async function runBotTierResyncMigration(): Promise<{
  success: boolean;
  message: string;
  modified?: number;
  alreadyApplied?: boolean;
}> {
  // Self-heal the bookkeeping table (same as factoryStatResync.ts).
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "migrations" (
      "id" varchar(100) PRIMARY KEY,
      "applied_at" timestamp NOT NULL,
      "details" jsonb
    )
  `);

  const existing = await db.select().from(migrations).where(eq(migrations.id, MIGRATION_ID));
  const markerExists = existing.length > 0;

  const bots = await db
    .select({
      username: players.username,
      level: players.level,
      rank: players.rank,
      isBot: players.isBot,
      isSpecialBase: players.isSpecialBase,
      botConfig: players.botConfig,
    })
    .from(players)
    .where(eq(players.isBot, 1));

  const needingUpdate = bots.filter((b) => {
    const currentTier = b.botConfig?.tier ?? null;
    let canonical: number;
    if (b.isSpecialBase === 1 || b.botConfig?.isSpecialBase === true) {
      canonical = beerBaseTierForRank(b.rank);
    } else if (b.botConfig?.specialization === 'boss') {
      canonical = 7;
    } else {
      canonical = regularBotTierForLevel(b.level ?? 1);
    }
    return currentTier !== canonical;
  });

  if (needingUpdate.length === 0 && markerExists) {
    return {
      success: true,
      message: 'Bot tier resync already applied (no drift)',
      modified: 0,
      alreadyApplied: true,
    };
  }

  let modified = 0;
  for (const b of needingUpdate) {
    let canonical: number;
    if (b.isSpecialBase === 1 || b.botConfig?.isSpecialBase === true) {
      canonical = beerBaseTierForRank(b.rank);
    } else if (b.botConfig?.specialization === 'boss') {
      canonical = 7;
    } else {
      canonical = regularBotTierForLevel(b.level ?? 1);
    }

    const updatedConfig: BotConfig = { ...(b.botConfig ?? ({} as BotConfig)), tier: canonical };

    await db
      .update(players)
      .set({ botConfig: updatedConfig })
      .where(eq(players.username, b.username));
    modified++;
  }

  if (!markerExists) {
    await db.insert(migrations).values({
      id: MIGRATION_ID,
      appliedAt: new Date(),
      details: { modified, total: bots.length },
    });
  } else {
    await db
      .update(migrations)
      .set({ appliedAt: new Date(), details: { modified, total: bots.length } })
      .where(eq(migrations.id, MIGRATION_ID));
  }

  return {
    success: true,
    message: `Bot tier resync complete: ${modified} of ${bots.length} bot rows healed`,
    modified,
    alreadyApplied: false,
  };
}
