/**
 * Raid-pressure stress sweep (vault-economy audit follow-up).
 *
 * Question: at how many raids/bot/day does the map start starving?
 *
 * Runs the SHIPPED economy tick (real engine functions — same harness as
 * scripts/simulateVaultEconomy.ts) across a pressure ladder. Raid pressure is
 * modeled with intra-day windows so P > 1/day is honest: a bot raided twice
 * in a day pays the second time only what regrew between raids. Raids are
 * aggressive (loot both axes, FID-005 bookkeeping zeroes the looted axes) —
 * the worst case for the map. Anchor: P=0.5 must reproduce the
 * re-measurement's undeclared row (~5.5M/day day1, decay ≈ 1.0).
 *
 * Metrics per pressure: day1/day7/day30 loot, 30d total, DECAY RATIO
 * (day30/day1 — the starvation signal), and mean per-raid take (raid-quality
 * signal: linear regen floors this at the hourly regen; legacy decays to 0).
 * Knee = first pressure where decay < 50%.
 *
 * Supply ceiling executes the REAL rate table (no re-hardcoded copy): a
 * zeroed vault's regenerateBotResources return IS 1h × rate × spawner-max.
 *
 * Read-only: no DB access.
 * Run: npx tsx -r dotenv/config scripts/simulateVaultPressure.ts dotenv_config_path=.env.local
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

// ---- shipped tick (real functions, identical to simulateVaultEconomy) -------

function shippedTick(v: number, spec: BotSpecialization, tier: number): number {
  const bot = {
    botConfig: { specialization: spec, tier },
    resources: { metal: v, energy: v, food: 0 },
  } as unknown as Player;
  const regen = regenerateBotResources(bot);
  // NOTE: no v===0 guard — linear regen returns min(0 + rate×max, cap) > 0 for a
  // zeroed vault (the revival the acceptance gate proved). Guarding would
  // re-create the absorbing-zero bug in the model.
  const regenerated = regen.metal; // axis value sits in `metal`
  const grown = applyGrowthPattern(regenerated, spec);
  const write = nextGrownVault(grown, regenerated, getVaultCap(spec, tier));
  return write ?? regenerated;
}

/** Pre-FID-006 counterfactual (exponential regen, 2× cap, absorbing zero). */
const LEGACY_RATE: Record<string, number> = { Hoarder: 0.05, Fortress: 0.10, Raider: 0.15, Ghost: 0.20, Balanced: 0.10 };
function legacyTick(v: number, spec: BotSpecialization, tier: number, rng: () => number): number {
  const regen = Math.min(v * (1 + (LEGACY_RATE[spec] ?? 0.10)), getResourceRange(spec, tier).max * 2);
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

/**
 * Supply ceiling: executes the real rate table — a zeroed vault's
 * regenerateBotResources return IS 1h × rate × spawner-max (grounded: the T2
 * hoarder entry must print 7,500, the value the live hoarder raids measured).
 * Bots are distributed across tiers proportionally to TIER_MIX.
 */
function supplyCeiling(): { total: number; grounded: string } {
  const tierWeights = TIER_MIX.map(([t, n]) => [t, n / TIER_MIX.reduce((s, [, x]) => s + x, 0)] as const);
  let perAxisPerDay = 0;
  const lines: string[] = [];
  for (const [spec, n] of SPEC_MIX) {
    for (const [tier, w] of tierWeights) {
      const zeroBot = {
        botConfig: { specialization: spec, tier },
        resources: { metal: 0, energy: 0, food: 0 },
      } as unknown as Player;
      const hourly = regenerateBotResources(zeroBot).metal;
      perAxisPerDay += n * w * 24 * hourly;
      lines.push(`${spec} T${tier}: ${Math.round(hourly)}/h ×${Math.round(n * w)}`);
    }
  }
  const grounded = lines.join(' · ');
  return { total: perAxisPerDay * 2, grounded }; // metal + energy axes regenerate independently
}

function simulateMap(mode: 'shipped' | 'legacy', pressure: number, days = 30, trials = 25, warmup = 5): { loot: number[]; raidsPerDay: number } {
  const lootPerDay: number[] = new Array(days).fill(0);
  let totalRaids = 0;
  const totalDays = warmup + days; // warmup discarded: decay must measure steady state, not the initial-stock flush
  const windows = Math.max(1, Math.ceil(pressure));
  const windowProb = Math.min(1, pressure / windows);
  const raidHours = Array.from({ length: windows }, (_, w) => Math.floor((24 * (w + 1)) / windows) - 1);
  for (let tr = 0; tr < trials; tr++) {
    const rng = mulberry32(90_000 + tr * 197);
    const bots: Array<{ spec: BotSpecialization; tier: number; m: number; e: number }> = [];
    for (const [spec, n] of SPEC_MIX) {
      for (let i = 0; i < n; i++) {
        const tier = pickTier(rng);
        const range = getResourceRange(spec, tier);
        bots.push({ spec, tier, m: range.min + rng() * (range.max - range.min), e: range.min + rng() * (range.max - range.min) });
      }
    }
    for (let d = 0; d < totalDays; d++) {
      for (let h = 0; h < 24; h++) {
        for (const b of bots) {
          if (mode === 'shipped') {
            b.m = shippedTick(b.m, b.spec, b.tier);
            b.e = shippedTick(b.e, b.spec, b.tier);
          } else {
            b.m = legacyTick(b.m, b.spec, b.tier, rng);
            b.e = legacyTick(b.e, b.spec, b.tier, rng);
          }
        }
        if (raidHours.includes(h)) {
          for (const b of bots) {
            if (rng() < windowProb) {
              const cap = getVaultCap(b.spec, b.tier);
              const lm = Math.min(b.m, cap), le = Math.min(b.e, cap);
              if (d >= warmup) lootPerDay[d - warmup] += lm + le;
              // aggressive raid: both axes looted; FID-005 zeroes only looted axes
              if (lm > 0) b.m = 0;
              if (le > 0) b.e = 0;
              if (d >= warmup) totalRaids++;
            }
          }
        }
      }
    }
  }
  return { loot: lootPerDay.map((x) => x / trials), raidsPerDay: totalRaids / trials / days };
}

interface Row { p: number; day1: number; day7: number; day30: number; total: number; decay: number; perRaid: number }

function ladder(mode: 'shipped' | 'legacy', pressures: number[]): Row[] {
  return pressures.map((p) => {
    const { loot, raidsPerDay } = simulateMap(mode, p);
    const avg = (a: number, b: number) => loot.slice(a, b).reduce((s, x) => s + x, 0) / (b - a);
    const day1 = avg(0, 3), day30 = avg(28, 30);
    return { p, day1, day7: avg(6, 8), day30, total: loot.reduce((s, x) => s + x, 0), decay: day1 > 0 ? day30 / day1 : 0, perRaid: raidsPerDay > 0 ? day30 / raidsPerDay : 0 };
  });
}

function print(rows: Row[], label: string): void {
  console.log(`\n--- ${label} ---`);
  console.log('P(r/b/d)   day1      day7      day30     30d total   decay d30/d1   per-raid take');
  for (const r of rows) {
    const knee = r.decay < 0.5 && r.p > 0 && rows.findIndex((x) => x.decay < 0.5 && x.p > 0) === rows.indexOf(r) ? '  ← knee' : '';
    console.log(
      `${String(r.p).padStart(6)}   ${fmt(r.day1).padStart(7)}  ${fmt(r.day7).padStart(7)}  ${fmt(r.day30).padStart(7)}  ${fmt(r.total).padStart(9)}   ` +
      `${(r.decay * 100).toFixed(0).padStart(5)}%        ${fmt(r.perRaid).padStart(8)}${knee}`
    );
  }
}

function main(): void {
  const pressures = [0.25, 0.5, 1, 1.5, 2, 3, 5, 8, 12, 20];
  console.log('=== RAID-PRESSURE STRESS SWEEP (shipped linear economy, real engine tick) ===');
  console.log(`39-bot live mix · aggressive raids (loot both axes) · ${pressures.length} pressures × 25 trials × 30 days`);
  const { total: ceiling, grounded } = supplyCeiling();
  console.log(`\nSupply ceiling (Σ 24 × real rate table × spawner-max, both axes): ${fmt(ceiling)}/day — the max the map can regrow.`);
  console.log(`Rate table (real engine, zeroed-vault regen; T2 hoarder must be 7,500/h per the live raid evidence):\n  ${grounded}`);
  console.log('Anchor: P=0.5 should land near the re-measurement\'s undeclared row (day1 ≈ 5.5M, decay ≈ 1.0). 5-day warmup discarded before day1.');
  print(ladder('shipped', pressures), 'shipped economy (linear regen, hoarder 3× cap)');
  print(ladder('legacy', pressures), 'legacy counterfactual (exponential regen, absorbing zero)');
  process.exit(0);
}

main();
