/**
 * FID-20260909-035 follow-up — initial bot ecosystem repopulation.
 *
 * Spawns a batch of regular bots entirely through production paths:
 *  - createBotPlayer: themed name (FID-20260906-007), legal Wasteland tile
 *    claim in a tier-appropriate zone (FID-20260909-030), tier resources,
 *    Full Permanence botConfig
 *  - generateBeerBaseUnits (FID-20260909-034): band-compliant unified-pool
 *    army — power band mapped 1:1 from bot tier (T1→WEAK … T5+→ULTRA),
 *    mirroring the player-bracket alignment (T1 ≈ levels 1-10 = WEAK …)
 *
 * Tier distribution matched to the live player brackets (83% L1-10, 17%
 * L11-20) with a forward-looking aspirational tail:
 *   T1 50% · T2 25% · T3 15% · T4 7% · T5+ 3%
 * Zones follow tier geography: T1-2 → zones 0-2, T3-4 → zones 3-5, T5+ → 6-8.
 *
 * Idempotence: every spawn claims a fresh tile; re-running just adds more.
 * Usage: npx tsx --env-file=.env.local scripts/repopulate-bots.ts [count]
 */
import { connectToDatabase } from '../lib/mongodb';
import { createBotPlayer } from '../lib/botService';
import { generateBeerBaseUnits, POWER_TIER_FOR_BOT_TIER } from '../lib/beerBaseService';
import type { PowerTier } from '../lib/beerBaseService';
import { BotSpecialization } from '../types/game.types';
import type { Player } from '../types/game.types';

const TIER_DISTRIBUTION: Array<{ tier: number; weight: number }> = [
  { tier: 1, weight: 50 },
  { tier: 2, weight: 25 },
  { tier: 3, weight: 15 },
  { tier: 4, weight: 7 },
  { tier: 5, weight: 3 },
];

function zoneBandForTier(tier: number): number[] {
  if (tier <= 2) return [0, 1, 2];
  if (tier <= 4) return [3, 4, 5];
  return [6, 7, 8];
}

function drawTier(): number {
  const total = TIER_DISTRIBUTION.reduce((s, t) => s + t.weight, 0);
  let roll = Math.random() * total;
  for (const { tier, weight } of TIER_DISTRIBUTION) {
    roll -= weight;
    if (roll < 0) return tier;
  }
  return 1;
}

(async () => {
  const count = Math.max(1, Math.min(Number(process.argv[2] ?? 50), 500));
  const db = await connectToDatabase();
  const collection = db.collection<Player>('players');

  const perTier: Record<number, number> = {};
  const perBand: Record<string, number> = {};
  const spawned: Array<{ name: string; tier: number; band: string; x: number; y: number; str: number; def: number }> = [];

  for (let i = 0; i < count; i++) {
    const tier = drawTier();
    const zones = zoneBandForTier(tier);
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const powerTier: PowerTier = POWER_TIER_FOR_BOT_TIER[tier] ?? POWER_TIER_FOR_BOT_TIER[1];

    // createBotPlayer claims a legal tile in the zone under the generated name.
    const bot = (await createBotPlayer(zone, null, false, tier)) as Partial<Player> & {
      botConfig: { specialization: BotSpecialization };
    };

    // Arm in place — band-compliant unified-pool army (FID-034 generator).
    const units = generateBeerBaseUnits(bot.botConfig.specialization, powerTier);
    const totalStrength = units.reduce((s, u) => s + u.strength * u.quantity, 0);
    const totalDefense = units.reduce((s, u) => s + u.defense * u.quantity, 0);
    bot.units = units;
    bot.totalStrength = totalStrength;
    bot.totalDefense = totalDefense;
    bot.isSpecialBase = false; // regular bot — explicit top-level flag for the column

    // Insert with name-collision retry (tile claim follows the rename).
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      try {
        await collection.insertOne(bot);
        inserted = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('duplicate key') || attempt === 4) throw error;
        const { releaseBotBaseTile, claimBotBaseTile, generateBotName } = await import('../lib/botService');
        const pos = bot.base!;
        await releaseBotBaseTile(pos.x, pos.y, bot.username!);
        bot.username = generateBotName();
        const reclaimed = await claimBotBaseTile({ zone, ownerUsername: bot.username });
        bot.base = { x: reclaimed.x, y: reclaimed.y };
        bot.currentPosition = bot.base;
      }
    }

    perTier[tier] = (perTier[tier] ?? 0) + 1;
    const bandName = String(powerTier);
    perBand[bandName] = (perBand[bandName] ?? 0) + 1;
    spawned.push({
      name: bot.username!, tier, band: bandName,
      x: bot.base!.x, y: bot.base!.y, str: totalStrength, def: totalDefense,
    });
    if ((i + 1) % 10 === 0) console.log(`  … ${i + 1}/${count} spawned`);
  }

  console.log(`\n=== Repopulation complete: ${spawned.length} bots ===`);
  console.log('Per bot tier:', JSON.stringify(perTier));
  console.log('Per power band:', JSON.stringify(perBand));
  for (const b of spawned) {
    console.log(`  ${b.name} (T${b.tier}, ${b.band}) at (${b.x},${b.y}) — STR ${b.str.toLocaleString()} / DEF ${b.def.toLocaleString()}`);
  }
  process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
