/**
 * FID-20260912-058 — RP Economy v2 end-to-end simulation.
 *
 * Proves the rebalanced curve coheres end to end: income scenarios (from the
 * Milestones v2 table) → sink pacing (tech tree, WMD track, clan research)
 * → verdicts. Pure math over the real catalog constants — no DB needed.
 *
 * Run: npx tsx scripts/rp-economy-sim.ts
 */
import {
  TECH_CATALOG,
  TECH_CATALOG_TOTAL_RP,
} from '../lib/research/techCatalog';
import { WMD_RESEARCH_TRACK, TOTAL_RP_REQUIRED } from '../types/wmd/research.types';
import { DAILY_HARVEST_MILESTONES } from '../lib/researchPointService';

// ---------------------------------------------------------------------------
// Income scenarios (per day, both half-day reset periods)
// ---------------------------------------------------------------------------

const perPeriod = Object.values(DAILY_HARVEST_MILESTONES).reduce((a, b) => a + b, 0);
const perDayBase = perPeriod * 2; // two reset periods per day (AM/PM)

const VIP = 1.5;
const FLAG = 2;

const scenarios = [
  // Casual crosses rung 1 (1,000 harvests) per period, no multipliers.
  { name: 'Casual (1,000 harvests/period, no stack)', rp: 200, vip: 1, flag: 1 },
  { name: 'Dedicated human (full sweep, no stack)', rp: perDayBase, vip: 1, flag: 1 },
  { name: 'Dedicated VIP', rp: perDayBase, vip: VIP, flag: 1 },
  { name: 'VIP flag-bearer (best case)', rp: perDayBase, vip: VIP, flag: FLAG },
];

console.log('=== RP Economy v2 — income (from the live Milestones v2 table) ===');
console.log(`milestone table: ${Object.values(DAILY_HARVEST_MILESTONES).join(' + ')} = ${perPeriod} RP/period → ${perDayBase.toLocaleString()} RP/day base\n`);
for (const s of scenarios) {
  const daily = Math.floor(s.rp * s.vip) * s.flag;
  console.log(`${s.name.padEnd(46)} ${daily.toLocaleString().padStart(7)} RP/day`);
}
const bestCase = Math.floor(perDayBase * VIP) * FLAG;
const humanCase = perDayBase;
// Milestone-only income for a casual (no battle/login/achievement RP).
const casualCase = Math.floor(200 * 2) * 1;

// ---------------------------------------------------------------------------
// Sink 1 — personal tech tree (T1/T2)
// ---------------------------------------------------------------------------

console.log('\n=== Sink: personal tech tree (repriced, all-functional) ===');
console.log(`catalog: ${TECH_CATALOG.length} techs, ${TECH_CATALOG_TOTAL_RP.toLocaleString()} RP total`);
for (const s of scenarios) {
  const daily = Math.floor(s.rp * s.vip) * s.flag;
  console.log(`  ${s.name.padEnd(44)} full tree in ${(TECH_CATALOG_TOTAL_RP / daily).toFixed(1)} days`);
}
const firstTechCasualDays = TECH_CATALOG[0].cost / casualCase;

// ---------------------------------------------------------------------------
// Sink 2 — WMD single track (W1)
// ---------------------------------------------------------------------------

console.log(`\n=== Sink: WMD research (single track, ${(TOTAL_RP_REQUIRED / 1000).toFixed(0)}k RP) ===`);
let cumulative = 0;
for (const tech of WMD_RESEARCH_TRACK) {
  cumulative += tech.rpCost;
  console.log(
    `  T${String(tech.tier).padStart(2)} ${tech.name.padEnd(36)} ${tech.rpCost.toLocaleString().padStart(7)} RP  cum ${cumulative.toLocaleString().padStart(7)}  ${tech.estimatedTime.padStart(8)}  L${tech.requiredLevel}`
  );
}
for (const s of scenarios) {
  const daily = Math.floor(s.rp * s.vip) * s.flag;
  console.log(`  ${s.name.padEnd(44)} full arc in ${(TOTAL_RP_REQUIRED / daily).toFixed(0)} days`);
}
const firstUnlockDays = WMD_RESEARCH_TRACK[0].rpCost / bestCase;
console.log(`  first unlock (T1) best case: ${firstUnlockDays.toFixed(1)} days (${(WMD_RESEARCH_TRACK[0].rpCost / humanCase).toFixed(1)}d for a dedicated human)`);

// ---------------------------------------------------------------------------
// Sink 3 — clan research (military-only)
// ---------------------------------------------------------------------------

console.log('\n=== Sink: clan research (military-only after C1) ===');
// Combat Training → Advanced Tactics → War Machine → Total Domination
const clanTotal = 5000 + 15000 + 40000 + 100000;
console.log(`  tree: 4 nodes, ${clanTotal.toLocaleString()} RP of clan-wide sinks (was 480k with 3 dead branches)`);
const clanPool = Math.round(bestCase * 0.2); // clans route ~20% of member RP output
console.log(`  clan pool ≈ 20% of a VIP flag-bearer's output (${clanPool.toLocaleString()} RP/day): full tree in ${(clanTotal / clanPool).toFixed(0)} days`);

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

console.log('\n=== Verdicts ===');
const checks: Array<[string, boolean, string]> = [
  ['Tech tree full line ≤ 12 best-case days', TECH_CATALOG_TOTAL_RP / bestCase <= 12, `${(TECH_CATALOG_TOTAL_RP / bestCase).toFixed(1)}d`],
  ['Tech tree first unlock ≤ 10 days (milestone-only casual)', firstTechCasualDays <= 10, `${firstTechCasualDays.toFixed(1)}d`],
  ['WMD tier-1 ≤ 5 days best case', firstUnlockDays <= 5, `${firstUnlockDays.toFixed(1)}d`],
  ['WMD full arc 30-90 days best case', TOTAL_RP_REQUIRED / bestCase >= 30 && TOTAL_RP_REQUIRED / bestCase <= 90, `${(TOTAL_RP_REQUIRED / bestCase).toFixed(0)}d`],
  ['Milestone rungs all ≤ 5,300 ceiling', Object.keys(DAILY_HARVEST_MILESTONES).every((t) => Number(t) <= 5300), '5 rungs'],
  ['Milestone base envelope = 4,300/day', perDayBase === 4300, `${perDayBase}/day`],
];
let failed = 0;
for (const [name, ok, detail] of checks) {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
}
process.exit(failed ? 1 : 0);
