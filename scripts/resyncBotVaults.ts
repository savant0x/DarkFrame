/**
 * FID-20260915-004 Fix C — one-time resync: clamp every bot's vault to the new
 * cap (2× its specialization/tier spawner maximum). Idempotent; player rows are
 * NEVER touched (earned loot stays). Prints a before/after summary of the worst
 * offenders and a total-economy-drain figure.
 *
 * Run: npx tsx -r dotenv/config scripts/resyncBotVaults.ts dotenv_config_path=.env.local
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/db/connection';
import { getVaultCap } from '@/lib/botService'; // FID-20260915-006: shared cap (hoarder 3×)
import { BotSpecialization } from '@/types/game.types';

async function main(): Promise<void> {
  const db = await connectToDatabase();

  const bots = await db.execute(sql`
    SELECT username, bot_config AS bot_config, resources_metal, resources_energy
    FROM players WHERE is_bot = 1 AND banned = 0`);
  const rows = bots.rows as Array<{
    username: string; bot_config: { specialization?: string; tier?: number } | null;
    resources_metal: number; resources_energy: number;
  }>;

  let drained = 0;
  let clamped = 0;
  const offenders: Array<{ username: string; before: number; after: number }> = [];

  for (const bot of rows) {
    const spec = (bot.bot_config?.specialization as BotSpecialization) ?? BotSpecialization.Balanced;
    const tier = Number(bot.bot_config?.tier) || 1;
    const cap = getVaultCap(spec, tier);
    const before = Number(bot.resources_metal || 0) + Number(bot.resources_energy || 0);
    const newMetal = Math.min(Number(bot.resources_metal || 0), cap);
    const newEnergy = Math.min(Number(bot.resources_energy || 0), cap);
    const after = newMetal + newEnergy;
    if (newMetal !== Number(bot.resources_metal || 0) || newEnergy !== Number(bot.resources_energy || 0)) {
      await db.execute(sql`
        UPDATE players SET resources_metal = ${newMetal}, resources_energy = ${newEnergy}
        WHERE username = ${bot.username}`);
      clamped++;
      drained += before - after;
      offenders.push({ username: bot.username, before, after });
    }
  }

  offenders.sort((a, b) => (b.before - b.after) - (a.before - a.after));
  console.log(`resync: ${clamped}/${rows.length} bot vaults clamped; total economy drain ${drained.toLocaleString()}`);
  for (const o of offenders.slice(0, 8)) {
    console.log(`  ${o.username}: ${(o.before / 1e6).toFixed(1)}M → ${(o.after / 1e6).toFixed(1)}M`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
