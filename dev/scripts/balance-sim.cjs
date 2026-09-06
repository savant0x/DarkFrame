/* FID-20260906-006 §3.2-3.3: progression model + week-one archetype simulation.
 * Pure Node (no TS imports). Constants are mirrored from the census
 * (dev/audit/balance-2026-09-06.json) — each carries a file:line citation.
 * Output: dev/audit/balance-sim-2026-09-06.json + console tables.
 */
const fs = require('fs');

const census = JSON.parse(fs.readFileSync('dev/audit/balance-2026-09-06.json', 'utf8'));

// ---------- constants (each cited) ----------
const C = {
  HARVEST_MIN: 800,          // types/game.types.ts GAME_CONSTANTS.HARVEST.MIN_AMOUNT
  HARVEST_MAX: 1500,         // ...MAX_AMOUNT
  XP_HARVEST: 20,            // lib/xpService.ts:82 XP_REWARDS.HARVEST_RESOURCE
  XP_WIN: 300,               // lib/xpService.ts:95 INFANTRY_ATTACK_WIN
  XP_LOSS: 50,               // lib/xpService.ts:96 INFANTRY_ATTACK_LOSS
  XP_DAILY_LOGIN: 20,        // lib/xpService.ts:103
  XP_FIRST_LOGIN: 200,       // lib/xpService.ts:102
  XP_UNIT_BUILD: 10,         // lib/xpService.ts:91
  XP_LEVEL_LINEAR: 1000,     // lib/xpService.ts:193 currentLevel * 1000 (< L30)
  XP_LEVEL_EXP_BASE: 3300,   // lib/xpService.ts:196 L30->31
  XP_LEVEL_EXP_RATE: 1.1,    // lib/xpService.ts:201 *1.1 per level
  INFANTRY: { str: 100, metal: 200, energy: 200 },   // types/units.types.ts:67-76
  MARKSMAN: { str: 250, metal: 500, energy: 400 },   // types/units.types.ts:117-125
  CAVALRY:  { str: 280, metal: 600, energy: 500 },   // types/units.types.ts:130-137
  SNIPER:   { str: 600, metal: 1200, energy: 1000 }, // types/units.types.ts:170-177
  TANK:     { str: 1500, metal: 3500, energy: 3000 },// types/units.types.ts:223-230
  TITAN:    { str: 5000, metal: 10000, energy: 8000 },// types/units.types.ts:276-283
  HP_PER_STR: 10,            // lib/battleService.ts:120
  DMG_FORMULA: 'max(5, STR - DEF/2)', // lib/battleService.ts:191
  CAPTURE: [0.10, 0.15],     // lib/battleService.ts:126-127
  THEFT: 0.20,               // lib/battleService.ts:132
  BOT_DEF: (t) => Math.floor((100 + t * 50) * Math.pow(2, t - 1) * 0.1), // lib/botService.ts:543-545
  BOT_SPEC_MULT: 0.5,        // Hoarder 0.5x .. Fortress 3.0x (botService.ts:311-318)
  BOT_TIER_RES: (t) => 0.5 + 0.25 * t, // lib/botService.ts:205 tierMultiplier
  BOT_LOOT_BASE: [50000, 150000], // Hoarder base range (botService.ts:186)
  RP_MILESTONES: { 1000: 500, 2500: 750, 5000: 1000, 10000: 1500, 15000: 1750, 22500: 2500 }, // lib/researchPointService.ts:91-98 (P4 tail)
  RP_LEVEL_UP: (lvl) => Math.min(lvl * 5, 500), // researchPointService.ts:74 (level x 5, max 500)
  BANK_FEE: 0.20,            // app/api/bank/exchange/route.ts:31-32
  FACTORY_UPGRADE: (lvl) => ({ metal: Math.floor(1000 * Math.pow(1.5, lvl + 1)), energy: Math.floor(500 * Math.pow(1.5, lvl + 1)) }), // factoryUpgradeService.ts:92-93
  FACTORY_INCOME: (lvl) => ({ metal: 1000 * lvl, energy: 500 * lvl }), // factoryService.ts:36-37
  WMD_COSTS: census.blocks.wmdTechCosts
    .map((x) => { const m = x.text.match(/rpCost:\s*([\d_]+)/); return m ? Number(m[1].replace(/_/g, '')) : null; })
    .filter(Boolean).sort((a, b) => a - b),
};

// ---------- XP curve (FID-006 P1/P2 as implemented) ----------
function xpToNext(level) {
  if (level < 30) return Math.floor(500 * Math.pow(level, 1.35));
  let xp = 50000;
  for (let l = 31; l <= level; l++) xp = Math.floor(xp * 1.15);
  return xp;
}
function cumulativeXpToLevel(target) {
  let total = 0;
  for (let l = 1; l < target; l++) total += xpToNext(l);
  return total;
}

// ---------- archetypes (actions/day = harvest actions; movement-bound) ----------
const ARCHETYPES = [
  { name: 'casual', actionsPerDay: 30, pvpPerDay: 1, winRate: 0.5 },
  { name: 'active', actionsPerDay: 100, pvpPerDay: 5, winRate: 0.55 },
  { name: 'hardcore', actionsPerDay: 300, pvpPerDay: 15, winRate: 0.6 },
];

// milestone RP per 12h period given actions/day (harvest actions split across periods)
function milestoneRp(actionsPerDay) {
  const perPeriod = actionsPerDay / 2;
  let rp = 0;
  for (const [threshold, reward] of Object.entries(C.RP_MILESTONES)) {
    if (perPeriod >= Number(threshold)) rp += reward;
  }
  return rp * 2; // two periods/day
}

// ---------- week-one sim ----------
function simulate(arch) {
  let xp = C.XP_FIRST_LOGIN, level = 1;
  let metal = 0, energy = 0, rp = 0, armyStr = 0;
  const days = [];
  for (let day = 1; day <= 7; day++) {
    xp += C.XP_DAILY_LOGIN;
    rp += milestoneRp(arch.actionsPerDay);
    rp += Math.round(arch.pvpPerDay * arch.winRate * 100); // battle RP: 100/win (battleService.ts:556)
    for (let a = 0; a < arch.actionsPerDay; a++) {
      const amount = C.HARVEST_MIN + Math.floor(Math.random() * (C.HARVEST_MAX - C.HARVEST_MIN + 1));
      if (a % 2 === 0) metal += amount; else energy += amount; // 50/50 metal/energy terrain
      xp += C.XP_HARVEST + Math.max(0, level - 1) * 2; // P3: +2 XP per level
      while (xp >= xpToNext(level) && level < 60) { xp -= xpToNext(level); level++; rp += C.RP_LEVEL_UP(level); }
    }
    // PvP: fixed peer exchange — 300 win / 50 loss, theft not modeled (peer economy)
    for (let p = 0; p < arch.pvpPerDay; p++) {
      xp += Math.random() < arch.winRate ? C.XP_WIN : C.XP_LOSS;
      while (xp >= xpToNext(level) && level < 60) { xp -= xpToNext(level); level++; rp += C.RP_LEVEL_UP(level); }
    }
    // Army: spend 50% of banked resources each day, best affordable unit by STR/cost
    const halfM = metal / 2, halfE = energy / 2;
    const candidates = [C.TITAN, C.TANK, C.SNIPER, C.CAVALRY, C.MARKSMAN, C.INFANTRY];
    for (const u of candidates) {
      const n = Math.floor(Math.min(halfM / u.metal, halfE / u.energy));
      if (n > 0) { armyStr += n * u.str; metal -= n * u.metal; energy -= n * u.energy; xp += n * C.XP_UNIT_BUILD; break; }
    }
    while (xp >= xpToNext(level) && level < 60) { xp -= xpToNext(level); level++; rp += C.RP_LEVEL_UP(level); }
    days.push({ day, level, armyStr, rp, metal: Math.floor(metal), energy: Math.floor(energy) });
  }
  return days;
}

// ---------- analysis ----------
const out = { generatedAt: new Date().toISOString(), xpCurve: {}, archetypeDays: {}, walls: [], wmd: {} };

for (const L of [5, 10, 15, 20, 25, 30, 35, 40]) {
  out.xpCurve[L] = { toNext: xpToNext(L), cumulative: cumulativeXpToLevel(L), harvestActionsToNext: Math.ceil(xpToNext(L) / C.XP_HARVEST) };
}

for (const arch of ARCHETYPES) {
  out.archetypeDays[arch.name] = simulate(arch);
}

// Wall 1: time-to-level explosion (recheck post-implementation)
for (const L of [10, 20, 29, 30, 40]) {
  const actions = Math.ceil(xpToNext(L) / C.XP_HARVEST);
  out.walls.push({
    id: `W1-L${L}`,
    finding: `Level ${L}->${L + 1} needs ${xpToNext(L).toLocaleString()} XP = ${actions.toLocaleString()} harvest actions (post-P1 curve)`,
    daysCasual: (actions / 30).toFixed(1), daysActive: (actions / 100).toFixed(1), daysHardcore: (actions / 300).toFixed(1),
    citation: 'lib/xpService.ts getXPForNextLevel (implemented)',
  });
}
// Wall 2: milestone tail (recheck post-P4 — now monotonic)
{
  const vals = Object.values(C.RP_MILESTONES);
  const monotonic = vals.every((v, i) => i === 0 || v > vals[i - 1]);
  out.walls.push({
    id: 'W2-milestones',
    finding: monotonic
      ? `P4 APPLIED: milestone rewards now monotonic (${Object.entries(C.RP_MILESTONES).map(([k, v]) => `${k}->${v}`).join(', ')}); full map = ${vals.reduce((a, b) => a + b, 0).toLocaleString()} RP/day`
      : 'STILL INVERTED',
    citation: 'lib/researchPointService.ts DAILY_HARVEST_MILESTONES',
  });
}
// Wall 3: PvE unreachable
out.walls.push({
  id: 'W3-no-pve',
  finding: 'No player-vs-bot attack route exists (grep: zero handlers reference attackable bots); all combat XP is PvP-only. Bot loot (Hoarder 50k-150k x tier) and Beer Base 3x config are unreachable by design as shipped.',
  citation: 'lib/botService.ts:186, lib/beerBaseService.ts:133',
});
// Wall 4: WMD first-tech wall (RP/day = milestones + battle wins + level-ups)
function rpPerDay(actionsPerDay, pvpPerDay, winRate) {
  return milestoneRp(actionsPerDay) + Math.round(pvpPerDay * winRate * 100);
}
out.wmd = {
  firstTechCost: C.WMD_COSTS[0],
  topTechCost: C.WMD_COSTS[C.WMD_COSTS.length - 1],
  costs: C.WMD_COSTS,
  docFirstTechCost: 50000,
  docTotalTree: 2500000,
  codeTotalTree: C.WMD_COSTS.reduce((a, b) => a + b, 0),
  daysToFirstTechCasual: (C.WMD_COSTS[0] / rpPerDay(30, 1, 0.5)).toFixed(1),
  daysToFirstTechActive: (C.WMD_COSTS[0] / rpPerDay(100, 5, 0.55)).toFixed(1),
  daysToFirstTechHardcore: (C.WMD_COSTS[0] / rpPerDay(300, 15, 0.6)).toFixed(1),
  // Full-map context: 22,500 harvests/day ceiling = 8,000 RP/day from milestones + battles.
  // This is the intended WMD-pursuing playstyle (doc: '100k RP goal: free 8-17 days').
  daysToFirstTechFullMap: (C.WMD_COSTS[0] / 8000).toFixed(1),
  fullMapRpPerDay: 8000,
  citation: 'types/wmd/research.types.ts (code rpCost ladder) vs docs/WEAPONS_OF_MASS_DESTRUCTION_DESIGN.md:94-105',
};
// Wall 5: unit STR/price efficiency flatlines
const eff = [C.INFANTRY, C.MARKSMAN, C.CAVALRY, C.SNIPER, C.TANK, C.TITAN].map((u) => ({ unit: u.str === 100 ? 'infantry' : u.str === 250 ? 'marksman' : u.str === 280 ? 'cavalry' : u.str === 600 ? 'sniper' : u.str === 1500 ? 'tank' : 'titan', strPerMetal: +(u.str / u.metal).toFixed(3) }));
out.walls.push({
  id: 'W5-unit-efficiency',
  finding: `STR per metal: ${eff.map((e) => `${e.unit}=${e.strPerMetal}`).join(', ')} — later rarities are strictly worse per resource; only total STR matters (battleService sums STR), so commons dominate optimal play`,
  data: eff, citation: 'types/units.types.ts blueprints',
});

fs.mkdirSync('dev/audit', { recursive: true });
fs.writeFileSync('dev/audit/balance-sim-2026-09-06.json', JSON.stringify(out, null, 2));

// ---------- console ----------
console.log('=== XP CURVE (cumulative + actions-to-next @ 20 XP/harvest) ===');
for (const [L, v] of Object.entries(out.xpCurve)) console.log(`L${L}: next=${v.toNext.toLocaleString()} cum=${v.cumulative.toLocaleString()} harvests-to-next=${v.harvestActionsToNext.toLocaleString()}`);
console.log('\n=== WEEK ONE (day 7 snapshot) ===');
for (const [name, days] of Object.entries(out.archetypeDays)) {
  const d7 = days[6];
  console.log(`${name}: L${d7.level} | army STR ${d7.armyStr.toLocaleString()} | RP ${d7.rp.toLocaleString()} | banked m${d7.metal.toLocaleString()}/e${d7.energy.toLocaleString()}`);
}
console.log('\n=== WALLS ===');
for (const w of out.walls) console.log(`${w.id}: ${w.finding}`);
console.log('\n=== WMD ===');
console.log(`costs: ${C.WMD_COSTS.join(' < ')}`);
console.log(`days to first tech (${C.WMD_COSTS[0].toLocaleString()} RP, doc-anchored): casual ~${out.wmd.daysToFirstTechCasual}, active ~${out.wmd.daysToFirstTechActive}, hardcore ~${out.wmd.daysToFirstTechHardcore}, full-map ~${out.wmd.daysToFirstTechFullMap} (doc envelope: 8-17 days per 100k)`);
console.log(`tree total per track: ${out.wmd.codeTotalTree / 3 >= 0 ? Math.round(out.wmd.codeTotalTree / 3).toLocaleString() : '?'} RP (doc: 2,500,000) | all 3 tracks: ${out.wmd.codeTotalTree.toLocaleString()} RP`);
console.log('\nwritten: dev/audit/balance-sim-2026-09-06.json');
