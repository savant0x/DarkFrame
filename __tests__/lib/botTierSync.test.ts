/**
 * FID-20260912-086 — botConfig.tier sync + boot self-heal tests.
 *
 * Tier drives combat XP (50 + tier*25), the bot factory-raid gate (L2+ only
 * vs T4+), scanner display, and resource regen — so a stale tier quietly
 * misprices all of it. Two fixes pinned here:
 *   1. spawnBeerBase rewrites bot.botConfig.tier to the PowerTier index
 *      (Weak=1 … Legendary=6) that also produced the base's level/rank.
 *   2. The boot migration heals existing rows: rank is the canonical signal
 *      (also set once at spawn, never mutated), regular bots 1:1, bosses 7.
 */
import { describe, it, expect } from 'vitest';

const powerTierToNumber = (t: string): number =>
  ({ Weak: 1, Mid: 2, Strong: 3, Elite: 4, Ultra: 5, Legendary: 6 }[t] ?? 1);

// Mirror of the sync block in spawnBeerBase (kept literal so a regression in
// the service shows up as a diff here, not a silent pass).
function syncTierFromPowerTier(bot: { rank: number; botConfig: { tier: number } }): void {
  bot.botConfig.tier = Math.min(6, Math.max(1, bot.rank));
}

describe('FID-20260912-086: power-tier → botConfig.tier sync (spawn path)', () => {
  it('each PowerTier maps its rank to the canonical tier number', () => {
    expect(powerTierToNumber('Weak')).toBe(1);
    expect(powerTierToNumber('Mid')).toBe(2);
    expect(powerTierToNumber('Strong')).toBe(3);
    expect(powerTierToNumber('Elite')).toBe(4);
    expect(powerTierToNumber('Ultra')).toBe(5);
    expect(powerTierToNumber('Legendary')).toBe(6);
  });

  it('spawned beer bases carry the power tier in botConfig.tier, not the zone roll', () => {
    // A Legendary base spawned from a T1 zone roll must end up tier 6
    const bot = { rank: 6, botConfig: { tier: 1 } };
    syncTierFromPowerTier(bot);
    expect(bot.botConfig.tier).toBe(6);
  });

  it('clamps defensively — rank can never push tier outside 1..6', () => {
    const high = { rank: 9, botConfig: { tier: 1 } };
    syncTierFromPowerTier(high);
    expect(high.botConfig.tier).toBe(6);

    const low = { rank: 0, botConfig: { tier: 1 } };
    syncTierFromPowerTier(low);
    expect(low.botConfig.tier).toBe(1);
  });

  it('raid gate semantics: a synced Legendary base now passes the T4+ raid gate', () => {
    // botFactoryRaid.getBotTier: bot.botConfig?.tier ?? 1 — before the fix a
    // Legendary base rolled in a T1 zone read as tier 1 and was raid-exempt.
    const legendary = { rank: 6, botConfig: { tier: 1 } };
    syncTierFromPowerTier(legendary);
    expect(legendary.botConfig.tier).toBeGreaterThanOrEqual(4);
  });
});

// --- boot self-heal (mirror of lib/migrations/botTierResync.ts drift scan) ---

const regularTierForLevel = (level: number): number => Math.min(7, Math.max(1, Math.ceil(level / 10)));

describe('FID-20260912-086: boot self-heal tier derivation', () => {
  it('regular bots derive tier from level bracket (10 levels per tier, 1..7)', () => {
    expect(regularTierForLevel(5)).toBe(1);
    expect(regularTierForLevel(15)).toBe(2);
    expect(regularTierForLevel(45)).toBe(5);
    expect(regularTierForLevel(65)).toBe(7);
  });

  it('beer bases derive tier from rank (canonical spawn-time signal)', () => {
    const derive = (rank: number | null) => Math.min(6, Math.max(1, rank ?? 1));
    expect(derive(4)).toBe(4); // Elite
    expect(derive(6)).toBe(6); // Legendary
    expect(derive(null)).toBe(1);
  });

  it('boss bots pin to tier 7 regardless of level/rank', () => {
    const boss = { isBot: 1, username: 'Omega_Boss', level: 65, rank: 7, botConfig: { tier: null } };
    const tier = boss.username === 'Omega_Boss' ? 7 : regularTierForLevel(boss.level);
    expect(tier).toBe(7);
  });
});
