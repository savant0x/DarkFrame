/**
 * Vault economy re-measurement (FID-20260915-006 closure) — runs the SHIPPED
 * production tick, not a mirror:
 *   regenerateBotResources (linear: rate × spawner max, clamped to getVaultCap)
 *   applyGrowthPattern     (70/20/10)
 *   nextGrownVault         (FID-005 growth clamp)
 *   getVaultCap            (2× spawner max; Hoarder 3×)
 *
 * Model: per-axis vaults (metal/energy separately, as stored), 39-bot live-mix
 * map, 0.5 raids/bot/day. Raid semantics (FID-005 + FID-006):
 *   loot = min(vault_axis, cap) × mult; defeated bot zeroes ONLY the raided
 *   axis (declared-resource mix knob; undeclared = legacy loot-both).
 * Counterfactual: the pre-FID-006 exponential curve recomputed on the same
 * RNG stream (v × (1+rate), cap 2×) to quantify the shipped improvement.
 * Read-only: no DB access.
 *
 * Run: npx tsx -r dotenv/config scripts/simulateVaultEconomy.ts dotenv_config_path=.env.local
 */
import { regenerateBotResources, applyGrowthPattern, nextGrownVault } from '@/lib/botGrowthEngine';
import { getVaultCap, getResourceRange } from '@/lib/botService';
import { BotSpecialization, type Player } from '@/types/game.types';

const fmt = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`;

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- shipped tick (real functions) ------------------------------------------

/** One hourly tick on one axis using the shipped engine. */
function shippedTick(v: number, spec: BotSpecialization, tier: number): number {
  const bot = {
    botConfig: { specialization: spec, tier },
    resources: { metal: v, energy: v, food: 0 },
  } as unknown as Player;
  const regen = regenerateBotResources(bot);
  // NOTE: no v===0 guard — the engine's linear regen returns min(0 + rate×max, cap) > 0
  // for a zeroed vault (that IS the revival the acceptance gate proved). Guarding here
  // would re-create the absorbing-zero bug in the model.
  const regenerated = regen.metal; // axis value sits in `metal`
  const grown = applyGrowthPattern(regenerated, spec);
  const write = nextGrownVault(grown, regenerated, getVaultCap(spec, tier));
  return write ?? regenerated;
}

/** Pre-FID-006 counterfactual (exponential regen, 2× cap, uncapped growth write). */
function legacyTick(v: number, spec: BotSpecialization, tier: number, rng: () => number): number {
  const rate: Record<string, number> = { Hoarder: 0.05, Fortress: 0.10, Raider: 0.15, Ghost: 0.20, Balanced: 0.10 };
  const regen = Math.min(v * (1 + (rate[spec] ?? 0.10)), getResourceRange(spec, tier).max * 2);
  return Math.floor(regen * growthFactor(rng));
}
function growthFactor(rng: () => number): number {
  const roll = rng();
  if (roll < 0.7) return 1 + 0.05 + rng() * 0.10;
  if (roll < 0.9) return 1.0;
  return 1 - (0.05 + rng() * 0.05);
}

// ---- map model --------------------------------------------------------------

const SPEC_MIX: Array<[BotSpecialization, number]> = [
  [BotSpecialization.Hoarder, 9], [BotSpecialization.Fortress, 10], [BotSpecialization.Raider, 9],
  [BotSpecialization.Ghost, 6], [BotSpecialization.Balanced, 5],
];
const TIER_MIX: Array<[number, number]> = [[1, 24], [2, 12], [3, 3]];

function pickTier(rng: () => number): number {
  let r = rng() * TIER_MIX.reduce((s, [, n]) => s + n, 0);
  for (const [tier, n] of TIER_MIX) { r -= n; if (r < 0) return tier; }
  return TIER_MIX[TIER_MIX.length - 1][0];
}

type Declared = 'metal' | 'energy' | 'both';

function simulateMap(mode: 'shipped' | 'legacy', declared: Declared, days = 30, trials = 50): number[] {
  const lootPerDay: number[] = new Array(days).fill(0);
  for (let tr = 0; tr < trials; tr++) {
    const rng = mulberry32(77_000 + tr * 131);
    const bots: Array<{ spec: BotSpecialization; tier: number; m: number; e: number }> = [];
    for (const [spec, n] of SPEC_MIX) {
      for (let i = 0; i < n; i++) {
        const tier = pickTier(rng);
        const range = getResourceRange(spec, tier);
        bots.push({ spec, tier, m: range.min + rng() * (range.max - range.min), e: range.min + rng() * (range.max - range.min) });
      }
    }
    for (let d = 0; d < days; d++) {
      for (const b of bots) {
        for (let h = 0; h < 24; h++) {
          if (mode === 'shipped') {
            b.m = shippedTick(b.m, b.spec, b.tier);
            b.e = shippedTick(b.e, b.spec, b.tier);
          } else {
            b.m = legacyTick(b.m, b.spec, b.tier, rng);
            b.e = legacyTick(b.e, b.spec, b.tier, rng);
          }
        }
        if (rng() < 0.5) { // 0.5 raids/bot/day
          const cap = getVaultCap(b.spec, b.tier);
          const lm = declared === 'energy' ? 0 : Math.min(b.m, cap);
          const le = declared === 'metal' ? 0 : Math.min(b.e, cap);
          lootPerDay[d] += lm + le;
          // FID-005 defeat bookkeeping: zero ONLY the looted axis/axes
          if (lm > 0) b.m = 0;
          if (le > 0) b.e = 0;
        }
      }
    }
  }
  return lootPerDay.map((x) => x / trials);
}

function summarize(label: string, loot: number[]): void {
  const avg = (a: number, b: number) => loot.slice(a, b).reduce((s, x) => s + x, 0) / (b - a);
  console.log(
    `${label.padEnd(26)} day1: ${fmt(avg(0, 3)).padStart(7)}   day7: ${fmt(avg(6, 8)).padStart(7)}   day30: ${fmt(avg(28, 30)).padStart(7)}   30d total: ${fmt(loot.reduce((s, x) => s + x, 0)).padStart(8)}`
  );
}

function main(): void {
  console.log('=== SHIPPED ECONOMY re-measurement (real engine functions, per-axis vaults, FID-005 bookkeeping) ===');
  console.log('39-bot live mix, 0.5 raids/bot/day, 50 trials × 30 days. Audit bands: linear 2.24M/day · hoard3x 2.75M/day.\n');
  for (const declared of ['metal', 'energy', 'both'] as const) {
    const label = `shipped · declared=${declared}`;
    summarize(label, simulateMap('shipped', declared));
  }
  console.log('');
  summarize('legacy counterfactual', simulateMap('legacy', 'both'));
  process.exit(0);
}

main();
