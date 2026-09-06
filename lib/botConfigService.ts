/**
 * @file lib/botConfigService.ts
 * @created 2026-09-06
 * @overview Global bot-system configuration (FID-20260906-003 S1).
 *
 * The admin panel's five global bot settings persist in the `bot_config`
 * `global` row (migration 0017). This module is the single seam between the
 * admin API (writes) and the bot engine (reads): spawn cap/cadence, migration
 * percentage, and per-specialization regen rates. Reads are cached for 60s so
 * hot paths (spawn attempts, migration cycles, growth ticks) don't add a query
 * each; writes invalidate the cache immediately.
 *
 * Every read falls back to the historical code constants if the row is missing
 * or the DB is unreachable — config failure must never hard-block the bot
 * engine (fail-open with defaults, matching the pre-FID behavior).
 */

import { db } from '@/lib/db';
import { botConfig } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const GLOBAL_BOT_CONFIG_ID = 'global';

/** The five admin-facing settings, in the UI's vocabulary. */
export interface GlobalBotConfig {
  /** Maximum simultaneous bots; spawn attempts beyond this are refused. */
  totalBotCap: number;
  /** Bots the growth cycle may spawn per day (informational for manual spawns). */
  dailySpawnCount: number;
  /** Fraction of the bot population a migration cycle moves (0..1). */
  migrationPercent: number;
  /** Resource regen fraction per hour, per specialization. */
  regenRates: Record<string, number>;
}

/** Historical code constants — the fail-open defaults (FID-003 R3). */
export const DEFAULT_GLOBAL_BOT_CONFIG: GlobalBotConfig = {
  totalBotCap: 1000,
  dailySpawnCount: 75,
  migrationPercent: 0.3,
  regenRates: {
    hoarder: 0.05,
    fortress: 0.1,
    raider: 0.15,
    ghost: 0.2,
    balanced: 0.1,
  },
};

const CACHE_TTL_MS = 60_000;
let cache: { value: GlobalBotConfig; at: number } | null = null;

function rowToConfig(row: {
  spawnRate: number;
  totalBots: number;
  migrationPercent: number;
  regenRates: Record<string, number> | null;
}): GlobalBotConfig {
  return {
    totalBotCap: row.totalBots,
    dailySpawnCount: row.spawnRate,
    migrationPercent: row.migrationPercent,
    regenRates: { ...DEFAULT_GLOBAL_BOT_CONFIG.regenRates, ...(row.regenRates ?? {}) },
  };
}

/** Read the global config (60s cache; falls back to defaults on any failure). */
export async function getGlobalBotConfig(): Promise<GlobalBotConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }
  try {
    const rows = await db
      .select()
      .from(botConfig)
      .where(eq(botConfig.id, GLOBAL_BOT_CONFIG_ID))
      .limit(1);
    const value = rows.length > 0
      ? rowToConfig(rows[0])
      : DEFAULT_GLOBAL_BOT_CONFIG;
    cache = { value, at: Date.now() };
    return value;
  } catch {
    // Fail open with defaults; next read retries the DB.
    return DEFAULT_GLOBAL_BOT_CONFIG;
  }
}

/** Persist the global config from the admin API (cache-invalidating). */
export async function saveGlobalBotConfig(config: GlobalBotConfig): Promise<void> {
  await db
    .insert(botConfig)
    .values({
      id: GLOBAL_BOT_CONFIG_ID,
      spawnRate: config.dailySpawnCount,
      totalBots: config.totalBotCap,
      migrationPercent: config.migrationPercent,
      regenRates: config.regenRates,
    })
    .onConflictDoUpdate({
      target: botConfig.id,
      set: {
        spawnRate: config.dailySpawnCount,
        totalBots: config.totalBotCap,
        migrationPercent: config.migrationPercent,
        regenRates: config.regenRates,
      },
    });
  cache = { value: config, at: Date.now() };
}

/** Invalidate the read cache (call after any out-of-band write). */
export function invalidateBotConfigCache(): void {
  cache = null;
}
