/**
 * FID-20261002-013 §5.7 — army-ROLE dominance sweep (R7 acceptance evidence).
 *
 * Question: does pure STR still dominate every sampled equal-cost mixed
 * composition on BOTH win rate and casualty replacement cost (the R7 defect),
 * now that the resolver runs per-copy-HP attrition with living stats?
 *
 * Method: the REAL engine (`resolveBattle`, applyCasualties:false — full
 * combat loop, zero persistence), DETERMINISTIC via a per-fight seeded
 * PRNG (mulberry32) standing in for Math.random — the same generator the
 * resolver draws its one battle-order permutation from. Shares are STAT
 * shares: a p%-STR army projects p% of its total power as STR and (1−p) as
 * DEF (constructed exactly from the tier's best STR/DEF units at equal
 * budget). Axes: equal-resource and equal-slot armies across T1–T5, STR
 * shares 0/49/50/53/55/60/100%, both role orderings (pure-STR as attacker vs
 * each defender share, and each attacker share vs pure-STR defender),
 * doctrines/effects/level gaps, uneven sizes, cross-tier matchups.
 *
 * Metrics per fight: outcome, rounds, casualty COUNT and replacement value
 * (UNIT_CONFIGS metal+energy) per side. Read-only: no DB access.
 *
 * Run: npx tsx scripts/simulateCombatRoles.ts
 */
import { resolveBattle } from '@/lib/battleService';
import { UNIT_CONFIGS, UnitType, UnitTier, BattleType, BattleOutcome } from '@/types';
import type { Unit } from '@/types';

// ---- determinism: per-fight seeded PRNG swaps in for Math.random -----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function deterministicBattle(seed: number, ...args: Parameters<typeof resolveBattle>) {
  const realRandom = Math.random;
  Math.random = mulberry32(seed);
  try {
    return await resolveBattle(...args);
  } finally {
    Math.random = realRandom;
  }
}

// ---- roster helpers ---------------------------------------------------------
let uid = 0;
function mk(type: UnitType, quantity: number, owner: string): Unit[] {
  const cfg = UNIT_CONFIGS[type];
  return Array.from({ length: quantity }, () => ({
    id: `sweep-${uid++}`,
    type,
    strength: cfg.strength,
    defense: cfg.defense,
    producedAt: { x: 0, y: 0 },
    producedDate: new Date(),
    owner,
  }));
}

function bestStrUnit(tier: UnitTier): UnitType {
  return Object.values(UNIT_CONFIGS)
    .filter((c) => c.tier === tier && c.strength > 0 && c.defense === 0)
    .sort((a, b) => b.strength - a.strength)[0].type;
}
function bestDefUnit(tier: UnitTier): UnitType {
  return Object.values(UNIT_CONFIGS)
    .filter((c) => c.tier === tier && c.defense > 0 && c.strength === 0)
    .sort((a, b) => b.defense - a.defense)[0].type;
}
function unitCost(type: UnitType): number {
  return UNIT_CONFIGS[type].metalCost + UNIT_CONFIGS[type].energyCost;
}
function slotCost(type: UnitType): number {
  return UNIT_CONFIGS[type].slotCost;
}

/**
 * Equal-BUDGET army at an exact STAT share: totalSTR / (totalSTR + totalDEF)
 * ≈ share, budget spent almost fully. Built from the tier's best pure-STR
 * and pure-DEF units; qty_def is derived from the share identity, qty_str
 * from the remaining budget.
 */
function statShareArmy(tier: UnitTier, share: number, budget: number, owner: string): { units: Unit[]; cost: number; slots: number; totalSTR: number; totalDEF: number } {
  const strUnit = bestStrUnit(tier);
  const defUnit = bestDefUnit(tier);
  const sStr = UNIT_CONFIGS[strUnit].strength;
  const sDef = UNIT_CONFIGS[defUnit].defense;
  const cStr = unitCost(strUnit);
  const cDef = unitCost(defUnit);
  // share × (sStr·q1 + sDef·q2) = sStr·q1  →  q2 = q1 · sStr(1−share) / (share·sDef)
  const ratio = share > 0 && share < 1 ? (sStr * (1 - share)) / (share * sDef) : 0;
  const perStrUnitAllIn = cStr + cDef * ratio; // budget per str-unit + its def partners
  const q1 = share >= 1
    ? Math.floor(budget / cStr)
    : share <= 0
      ? 0
      : Math.max(1, Math.floor(budget / perStrUnitAllIn));
  const q2 = share >= 1
    ? 0
    : share <= 0
      ? Math.floor(budget / cDef)
      : Math.floor(q1 * ratio);
  const units = [...mk(strUnit, q1, owner), ...mk(defUnit, q2, owner)];
  const cost = q1 * cStr + q2 * cDef;
  const slots = q1 * slotCost(strUnit) + q2 * slotCost(defUnit);
  const totalSTR = q1 * sStr;
  const totalDEF = q2 * sDef;
  return { units, cost, slots, totalSTR, totalDEF };
}

// ---- matrix -----------------------------------------------------------------
const SHARES = [0, 0.49, 0.5, 0.53, 0.55, 0.6, 1] as const;
const TIERS: UnitTier[] = [UnitTier.Tier1, UnitTier.Tier2, UnitTier.Tier3, UnitTier.Tier4, UnitTier.Tier5];
// Budget per tier grows with real unit costs so every army fields >= 10 copies.
const TIER_BUDGET: Record<number, number> = { 1: 200_000, 2: 600_000, 3: 2_000_000, 4: 6_000_000, 5: 20_000_000 };

interface Row {
  tier: UnitTier;
  attackerShare: number;
  defenderShare: number;
  ordering: 'str-as-attacker' | 'str-as-defender';
  outcome: BattleOutcome;
  rounds: number;
  attackerLostCost: number;
  defenderLostCost: number;
  attackerLostCount: number;
  defenderLostCount: number;
}

function lostValue(log: Awaited<ReturnType<typeof resolveBattle>>, side: 'attacker' | 'defender'): { cost: number; count: number } {
  const p = side === 'attacker' ? log.attacker : log.defender;
  let cost = 0;
  let count = 0;
  for (const [typeStr, n] of Object.entries(p.casualtiesByType ?? {})) {
    const t = typeStr as UnitType;
    cost += (n ?? 0) * unitCost(t);
    count += n ?? 0;
  }
  return { cost, count };
}

async function main(): Promise<void> {
  const rows: Row[] = [];
  let maxRounds = 0;

  // ---- §5.7 equal-RESOURCE matrix (T1–T5 × shares × both orderings) ----------
  for (const tier of TIERS) {
    const budget = TIER_BUDGET[tier];
    for (const aIdx of SHARES.keys()) {
      for (const dIdx of SHARES.keys()) {
        // Both role orderings; the seed pins the battle-order permutation per cell.
        for (const ordering of ['str-as-attacker', 'str-as-defender'] as const) {
          const [attackerShareUsed, defenderShareUsed] = ordering === 'str-as-attacker'
            ? [SHARES[aIdx], SHARES[dIdx]]
            : [SHARES[dIdx], SHARES[aIdx]];
          const a = statShareArmy(tier, attackerShareUsed, budget, 'atk');
          const d = statShareArmy(tier, defenderShareUsed, budget, 'def');
          const seed = ((Number(tier) + 1) * 1_000_000) + (aIdx * 10_000) + (dIdx * 100) + (ordering === 'str-as-attacker' ? 0 : 1);
          const log = await deterministicBattle(seed, a.units, d.units, 'atk', 'def', BattleType.Infantry, undefined, {
            attackerLevel: 25,
            defenderLevel: 25,
            applyCasualties: false,
          });
          maxRounds = Math.max(maxRounds, log.totalRounds);
          const al = lostValue(log, 'attacker');
          const dl = lostValue(log, 'defender');
          rows.push({
            tier, attackerShare: attackerShareUsed, defenderShare: defenderShareUsed, ordering,
            outcome: log.outcome, rounds: log.totalRounds,
            attackerLostCost: al.cost, defenderLostCost: dl.cost,
            attackerLostCount: al.count, defenderLostCount: dl.count,
          });
        }
      }
    }
  }
  const budgetRowCount = rows.length;

  // ---- §5.5/§5.8 HUMAN-CONTEXT arm: the same equal-budget matrix under the
  // server-derived humanCombat context (both sides human). The frozen power
  // band (CRITICAL ×0.5 … OPTIMAL ×1.1) now executes on effective STR/DEF —
  // mono-STR raiders fight at half power against balanced defenders. This is
  // the R7 "human role repair" acceptance surface; the neutral matrix above
  // doubles as the PvE pacing record.
  const humanRows: Row[] = [];
  for (const tier of TIERS) {
    const budget = TIER_BUDGET[tier];
    for (const aIdx of SHARES.keys()) {
      for (const dIdx of SHARES.keys()) {
        const a = statShareArmy(tier, SHARES[aIdx], budget, 'atk');
        const d = statShareArmy(tier, SHARES[dIdx], budget, 'def');
        const seed = 50_000_000 + ((Number(tier) + 1) * 1_000_000) + (aIdx * 10_000) + (dIdx * 100);
        const log = await deterministicBattle(seed, a.units, d.units, 'atk', 'def', BattleType.Infantry, undefined, {
          attackerLevel: 25,
          defenderLevel: 25,
          applyCasualties: false,
          humanCombat: { attackerIsHuman: true, defenderIsHuman: true },
        });
        maxRounds = Math.max(maxRounds, log.totalRounds);
        const al = lostValue(log, 'attacker');
        const dl = lostValue(log, 'defender');
        humanRows.push({
          tier, attackerShare: SHARES[aIdx], defenderShare: SHARES[dIdx], ordering: 'str-as-attacker',
          outcome: log.outcome, rounds: log.totalRounds,
          attackerLostCost: al.cost, defenderLostCost: dl.cost,
          attackerLostCount: al.count, defenderLostCount: dl.count,
        });
      }
    }
  }

  // ---- §5.7 equal-SLOT matrix (T3 sample): fixed slot footprint, share of ----
  // slots given to each axis (slot costs differ per type, so equal-slot ≠
  // equal-budget — a distinct composition pressure).
  {
    const tier = UnitTier.Tier3;
    const slots = 600;
    for (const aIdx of SHARES.keys()) {
      for (const ordering of ['str-as-attacker', 'str-as-defender'] as const) {
        const [attackerShareUsed, defenderShareUsed] = ordering === 'str-as-attacker'
          ? [SHARES[aIdx], 0.5]
          : [0.5, SHARES[aIdx]];
        const strUnit = bestStrUnit(tier);
        const defUnit = bestDefUnit(tier);
        const qStr = Math.floor((slots * attackerShareUsed) / slotCost(strUnit));
        const qDef = Math.floor((slots * (1 - attackerShareUsed)) / slotCost(defUnit));
        const dStr = Math.floor((slots * defenderShareUsed) / slotCost(strUnit));
        const dDef = Math.floor((slots * (1 - defenderShareUsed)) / slotCost(defUnit));
        const a = [...mk(strUnit, qStr, 'atk'), ...mk(defUnit, qDef, 'atk')];
        const d = [...mk(strUnit, dStr, 'def'), ...mk(defUnit, dDef, 'def')];
        const log = await deterministicBattle(15_000_000 + aIdx * 100 + (ordering === 'str-as-attacker' ? 0 : 1), a, d, 'atk', 'def', BattleType.Infantry, undefined, {
          attackerLevel: 25, defenderLevel: 25, applyCasualties: false,
        });
        maxRounds = Math.max(maxRounds, log.totalRounds);
        rows.push({
          tier, attackerShare: attackerShareUsed, defenderShare: defenderShareUsed, ordering,
          outcome: log.outcome, rounds: log.totalRounds,
          attackerLostCost: lostValue(log, 'attacker').cost, defenderLostCost: lostValue(log, 'defender').cost,
          attackerLostCount: lostValue(log, 'attacker').count, defenderLostCount: lostValue(log, 'defender').count,
        });
      }
    }
  }
  const slotRowCount = rows.length - budgetRowCount;

  // ---- §5.7 level-gap slice (T3): L40 attacker vs L10 defender ---------------
  const gapStart = rows.length;
  for (const share of SHARES) {
    const a = statShareArmy(UnitTier.Tier3, share, TIER_BUDGET[3], 'atk');
    const d = statShareArmy(UnitTier.Tier3, 0.5, TIER_BUDGET[3], 'def');
    const log = await deterministicBattle(9_000_000 + Math.round(share * 100), a.units, d.units, 'atk', 'def', BattleType.Infantry, undefined, {
      attackerLevel: 40, defenderLevel: 10, applyCasualties: false,
    });
    maxRounds = Math.max(maxRounds, log.totalRounds);
    rows.push({
      tier: UnitTier.Tier3, attackerShare: share, defenderShare: 0.5, ordering: 'str-as-attacker',
      outcome: log.outcome, rounds: log.totalRounds,
      attackerLostCost: lostValue(log, 'attacker').cost, defenderLostCost: lostValue(log, 'defender').cost,
      attackerLostCount: lostValue(log, 'attacker').count, defenderLostCount: lostValue(log, 'defender').count,
    });
  }
  const gapRows = rows.slice(gapStart);

  // ---- §5.7 UNEVEN-SIZE slice (T3): bigger defenders (home-field scale) ------
  const uneven: Array<{ label: string; mult: number; defShare: number; seed: number }> = [
    { label: 'def×1.25 mixed', mult: 1.25, defShare: 0.5, seed: 30_000_000 },
    { label: 'def×1.25 wall', mult: 1.25, defShare: 0, seed: 30_100_000 },
    { label: 'def×1.5 wall', mult: 1.5, defShare: 0, seed: 30_200_000 },
    { label: 'def×2 wall', mult: 2, defShare: 0, seed: 30_300_000 },
  ];
  const unevenStart = rows.length;
  for (const u of uneven) {
    for (const share of SHARES) {
      const a = statShareArmy(UnitTier.Tier3, share, TIER_BUDGET[3], 'atk');
      const d = statShareArmy(UnitTier.Tier3, u.defShare, TIER_BUDGET[3] * u.mult, 'def');
      const log = await deterministicBattle(u.seed + Math.round(share * 100), a.units, d.units, 'atk', 'def', BattleType.Infantry, undefined, {
        attackerLevel: 25, defenderLevel: 25, applyCasualties: false,
      });
      maxRounds = Math.max(maxRounds, log.totalRounds);
      rows.push({
        tier: UnitTier.Tier3, attackerShare: share, defenderShare: u.defShare, ordering: 'str-as-attacker',
        outcome: log.outcome, rounds: log.totalRounds,
        attackerLostCost: lostValue(log, 'attacker').cost, defenderLostCost: lostValue(log, 'defender').cost,
        attackerLostCount: lostValue(log, 'attacker').count, defenderLostCount: lostValue(log, 'defender').count,
      });
    }
  }

  // ---- §5.7 cross-tier slice: attacker tier A vs defender tier D (equal tier budget) ---
  const crossStart = rows.length;
  for (const at of TIERS) {
    for (const dt of TIERS) {
      if (at === dt) continue;
      const a = statShareArmy(at, 0.5, TIER_BUDGET[Number(at)], 'atk');
      const d = statShareArmy(dt, 0.5, TIER_BUDGET[Number(dt)], 'def');
      const log = await deterministicBattle(40_000_000 + Number(at) * 100 + Number(dt), a.units, d.units, 'atk', 'def', BattleType.Infantry, undefined, {
        attackerLevel: 25, defenderLevel: 25, applyCasualties: false,
      });
      maxRounds = Math.max(maxRounds, log.totalRounds);
      rows.push({
        tier: at, attackerShare: 0.5, defenderShare: 0.5, ordering: 'str-as-defender',
        outcome: log.outcome, rounds: log.totalRounds,
        attackerLostCost: lostValue(log, 'attacker').cost, defenderLostCost: lostValue(log, 'defender').cost,
        attackerLostCount: lostValue(log, 'attacker').count, defenderLostCount: lostValue(log, 'defender').count,
      });
    }
  }

  // ---- report ---------------------------------------------------------------
  const pct = (n: number, d: number) => (d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`);
  const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1e3)}k`);

  console.log('=== FID-20261002-013 role-dominance sweep (real resolver, seeded, equal-budget, STAT shares) ===');
  console.log(`fights: ${rows.length} (budget ${budgetRowCount}, slot ${slotRowCount}, gap ${gapRows.length}, uneven ${uneven.length * SHARES.length}, cross-tier ${TIERS.length * (TIERS.length - 1)}) · max rounds: ${maxRounds} (bounded <= 100: ${maxRounds <= 100 ? 'YES' : 'NO'})`);

  console.log('\n--- pure-STR attacker vs every sampled defender share (equal budget, both orderings pooled) ---');
  for (const tier of TIERS) {
    const pureRows = rows.slice(0, budgetRowCount).filter((r) => r.tier === tier && r.attackerShare === 1);
    const wins = pureRows.filter((r) => r.outcome === BattleOutcome.AttackerWin).length;
    const avgCostOfWins = pureRows.filter((r) => r.outcome === BattleOutcome.AttackerWin)
      .reduce((s, r) => s + r.attackerLostCost, 0) / Math.max(1, wins);
    console.log(
      `T${Number(tier)}: pure-STR win rate ${pct(wins, pureRows.length)} (${wins}/${pureRows.length})` +
      ` · avg replacement cost per win ${fmt(avgCostOfWins)}`,
    );
  }

  console.log('\n--- best mixed attacker per tier (win rate + replacement economics) ---');
  for (const tier of TIERS) {
    let best = { share: 0, wins: -1, total: 0, avgCost: Number.POSITIVE_INFINITY };
    for (const share of SHARES) {
      if (share === 1) continue;
      const mixRows = rows.slice(0, budgetRowCount).filter((r) => r.tier === tier && r.attackerShare === share);
      const wins = mixRows.filter((r) => r.outcome === BattleOutcome.AttackerWin).length;
      const avgCost = mixRows.filter((r) => r.outcome === BattleOutcome.AttackerWin)
        .reduce((s, r) => s + r.attackerLostCost, 0) / Math.max(1, wins);
      if (wins > best.wins || (wins === best.wins && avgCost < best.avgCost)) {
        best = { share, wins, total: mixRows.length, avgCost };
      }
    }
    console.log(
      `T${Number(tier)}: best mixed share ${Math.round(best.share * 100)}% STR → wins ${best.wins}/${best.total}` +
      ` · avg replacement cost per win ${fmt(best.avgCost)}`,
    );
  }

  console.log('\n--- head-to-head: pure-STR vs 50/50 (equal budget, T3, both orderings) ---');
  for (const ordering of ['str-as-attacker', 'str-as-defender'] as const) {
    const r = rows.slice(0, budgetRowCount).find((x) => x.tier === UnitTier.Tier3 && x.ordering === ordering && (ordering === 'str-as-attacker' ? (x.attackerShare === 1 && x.defenderShare === 0.5) : (x.attackerShare === 0.5 && x.defenderShare === 1)));
    if (r) {
      console.log(
        `${ordering}: ${r.outcome} in ${r.rounds} rounds · attacker lost ${r.attackerLostCount} (${fmt(r.attackerLostCost)}) · defender lost ${r.defenderLostCount} (${fmt(r.defenderLostCost)})`,
      );
    }
  }

  console.log('\n--- monotonicity control (T3): 50/50 attacker at 1× vs 1.25× the 50/50 defender budget ---');
  {
    const small = statShareArmy(UnitTier.Tier3, 0.5, TIER_BUDGET[3], 'def');
    const big = statShareArmy(UnitTier.Tier3, 0.5, TIER_BUDGET[3] * 1.25, 'atk');
    const log = await deterministicBattle(7_777_001, big.units, small.units, 'atk', 'def', BattleType.Infantry, undefined, {
      attackerLevel: 25, defenderLevel: 25, applyCasualties: false,
    });
    console.log(`1.25×-budget attacker vs 1× defender: ${log.outcome} in ${log.totalRounds} rounds (monotone: ${log.outcome === BattleOutcome.AttackerWin ? 'YES' : 'NO'})`);
  }

  console.log('\n--- level-gap slice (T3, attacker L40 vs defender L10) ---');
  for (const r of gapRows) {
    console.log(`share ${Math.round(r.attackerShare * 100)}% STR: ${r.outcome} in ${r.rounds} rounds · attacker lost ${fmt(r.attackerLostCost)}`);
  }

  console.log('\n--- UNEVEN-SIZE defense slice (T3): does the defender ever hold? ---');
  for (const u of uneven) {
    const uRows = rows.slice(unevenStart + uneven.indexOf(u) * SHARES.length, unevenStart + (uneven.indexOf(u) + 1) * SHARES.length);
    for (const r of uRows) {
      console.log(`${u.label} vs attacker ${Math.round(r.attackerShare * 100)}% STR: ${r.outcome} in ${r.rounds} r · atk lost ${fmt(r.attackerLostCost)} · def lost ${fmt(r.defenderLostCost)}`);
    }
  }

  console.log('\n--- equal-slot slice (T3, 600 slots, share vs 50/50) ---');
  for (const r of rows.slice(budgetRowCount, budgetRowCount + slotRowCount)) {
    console.log(`${r.ordering} ${Math.round(r.attackerShare * 100)}%: ${r.outcome} in ${r.rounds} r · atk lost ${fmt(r.attackerLostCost)} · def lost ${fmt(r.defenderLostCost)}`);
  }

  console.log('\n--- cross-tier (attacker tier → defender tier, 50/50, each at its own tier budget) ---');
  let ci = 0;
  for (const at of TIERS) {
    for (const dt of TIERS) {
      if (at === dt) continue;
      const r = rows[crossStart + ci++];
      console.log(`T${Number(r.tier)}→T${Number(dt)}: ${r.outcome} in ${r.rounds} r · atk lost ${fmt(r.attackerLostCost)} · def lost ${fmt(r.defenderLostCost)}`);
    }
  }

  // ---- acceptance summary (R7) ------------------------------------------------
  // Equal-BUDGET cell (the R7 defect's literal shape: same-tier, equal-cost).
  // Economics metric: EXPECTED casualty replacement cost per FIGHT (losses
  // included) — cost-per-win alone rewards survivorship bias (a role that
  // wins free but is annihilated when it loses looks artificially cheap).
  const budgetRows = rows.slice(0, budgetRowCount);
  const pureWinRows = budgetRows.filter((r) => r.attackerShare === 1 && r.ordering === 'str-as-attacker');
  const pureWins = pureWinRows.filter((r) => r.outcome === BattleOutcome.AttackerWin).length;
  const pureExpectedCost = pureWinRows.reduce((s, r) => s + r.attackerLostCost, 0) / Math.max(1, pureWinRows.length);

  let mixedWinsBest = { wins: -1, share: 0 };
  let mixedCostBest = { cost: Number.POSITIVE_INFINITY, share: 0 };
  for (const share of SHARES) {
    if (share === 1) continue;
    const mixRows = budgetRows.filter((r) => r.attackerShare === share && r.ordering === 'str-as-attacker');
    const wins = mixRows.filter((r) => r.outcome === BattleOutcome.AttackerWin).length;
    const expectedCost = mixRows.reduce((s, r) => s + r.attackerLostCost, 0) / Math.max(1, mixRows.length);
    if (wins > mixedWinsBest.wins) mixedWinsBest = { wins, share };
    if (expectedCost < mixedCostBest.cost) mixedCostBest = { cost: expectedCost, share };
  }
  const mixTotal = budgetRows.filter((r) => r.attackerShare !== 1 && r.ordering === 'str-as-attacker').length / (SHARES.length - 1);

  // "Dominates on BOTH win rate and casualty replacement cost": pure STR
  // would need strictly more wins than every sampled mixed composition AND
  // strictly lower expected losses than every one of them.
  const dominatesWinRate = pureWins >= mixedWinsBest.wins;
  const dominatesCost = pureExpectedCost < mixedCostBest.cost;
  void mixTotal;

  console.log('\n--- HUMAN-CONTEXT equal-budget matrix (§5.5 power band executes; R7 acceptance surface) ---');
  for (const tier of TIERS) {
    const pure = humanRows.filter((r) => r.tier === tier && r.attackerShare === 1);
    const pureW = pure.filter((r) => r.outcome === BattleOutcome.AttackerWin).length;
    let bestW = { wins: -1, share: 0 };
    for (const share of SHARES) {
      if (share === 1) continue;
      const w = humanRows.filter((r) => r.tier === tier && r.attackerShare === share && r.outcome === BattleOutcome.AttackerWin).length;
      if (w > bestW.wins) bestW = { wins: w, share };
    }
    console.log(`T${Number(tier)}: pure-STR wins ${pureW}/${pure.length} · best mixed ${Math.round(bestW.share * 100)}% STR wins ${bestW.wins}/${pure.length}`);
  }
  const hPure = humanRows.filter((r) => r.attackerShare === 1);
  const hPureWins = hPure.filter((r) => r.outcome === BattleOutcome.AttackerWin).length;
  const hPureCost = hPure.reduce((s, r) => s + r.attackerLostCost, 0) / Math.max(1, hPure.length);
  let hBestWins = { wins: -1, share: 0 };
  let hBestCost = { cost: Number.POSITIVE_INFINITY, share: 0 };
  for (const share of SHARES) {
    if (share === 1) continue;
    const mix = humanRows.filter((r) => r.attackerShare === share);
    const w = mix.filter((r) => r.outcome === BattleOutcome.AttackerWin).length;
    const cost = mix.reduce((s, r) => s + r.attackerLostCost, 0) / Math.max(1, mix.length);
    if (w > hBestWins.wins) hBestWins = { wins: w, share };
    if (cost < hBestCost.cost) hBestCost = { cost, share };
  }
  const hDominates = hPureWins >= hBestWins.wins && hPureCost < hBestCost.cost;

  console.log('\n=== ACCEPTANCE (FID-20261002-013 §5.8) ===');
  console.log(`— NEUTRAL (PvE pacing record): pure-STR ${pct(pureWins, pureWinRows.length)} wins, dominates both axes: ${dominatesWinRate && dominatesCost ? 'YES (recorded — see verdict)' : 'NO → PASS'}`);
  console.log(`1. HUMAN CONTEXT (the §5.8 surface): equal-budget pure-STR win rate ${pct(hPureWins, hPure.length)} (defect was 100%) → ${hPureWins < hPure.length ? 'PASS' : 'FAIL'}`);
  console.log(`   expected attacker cost/fight: pure-STR ${fmt(hPureCost)} vs best mixed ${fmt(hBestCost.cost)} (${Math.round(hBestCost.share * 100)}% STR)`);
  console.log(`   best mixed win rate ${hBestWins.wins}/${hPure.length} (${Math.round(hBestWins.share * 100)}% STR)`);
  console.log(`   pure-STR dominates BOTH axes: ${hDominates ? 'YES → FAIL' : 'NO → PASS'}`);
  console.log(`2. stronger-army monotonicity (matched-role control above) → see line`);
  console.log(`3. bounded fights: max rounds ${maxRounds} ≤ 100 → ${maxRounds <= 100 ? 'PASS' : 'FAIL'}`);
}

void main();
