/**
 * PvP army-balance seam simulation (FID-20260915-004 follow-up).
 *
 * Operator question: how do mixed vs mono armies now compare at equal power?
 *
 * Method: six archetypes built at an IDENTICAL pool (power = STR + DEF =
 * HP pool since FID-20260915-001 Phase 3). At equal pool, only the STR/DEF
 * distribution differs — so any outcome delta is attributable to exactly two
 * mechanisms: the balance band (dealt/taken multipliers) and the damage
 * algebra (strike = STR − DEF/2, counter = DEF − attackerSTR/2, both min 5).
 * Archetypes span all four balance bands:
 *   monoStr 100/0 → CRITICAL · 60/40 → CRITICAL (ratio .667) ·
 *   55/45 → IMBALANCED (.818) · 50/50 → BALANCED (1.0) ·
 *   ~49/51 → OPTIMAL (~.96) · monoDef 0/100 → CRITICAL
 *
 * Each ordered pairing runs TWICE through the REAL engine:
 *   seam ON : balance auto-computed from raw stats (production path)
 *   seam OFF: neutral ×1.0 overrides (the pre-FID-004 behavior)
 * Delta flags between the two runs isolate the seam's effect. Read-only:
 * resolveBattle with applyCasualties:false never touches the DB.
 */
import { resolveBattle } from '@/lib/battleService';
import { UNIT_CONFIGS, UnitType, UnitTier, BattleType, BattleOutcome } from '@/types';
import type { Unit } from '@/types';
import { calculateBalanceEffects } from '@/lib/balanceService';
import type { BalanceEffects } from '@/lib/balanceService';

const BUDGET = 200_000; // pool (STR+DEF) for every archetype
const LEVEL = 25; // equal levels → no level-gap protection in any cell

// ---- army construction ------------------------------------------------------

let uid = 0;
function mk(type: UnitType, perUnit: { str: number; def: number }, count: number, owner: string): Unit[] {
  return Array.from({ length: count }, () => ({
    id: `pvp-${uid++}`,
    type,
    strength: perUnit.str,
    defense: perUnit.def,
    producedAt: { x: 0, y: 0 },
    producedDate: new Date(),
    owner,
  }));
}

function bestPure(tier: UnitTier, stat: 'strength' | 'defense'): { type: UnitType; stat: number } {
  const entry = Object.values(UNIT_CONFIGS)
    .filter((c) => c.tier === tier && c[stat] > 0 && (stat === 'strength' ? c.defense === 0 : c.strength === 0))
    .sort((a, b) => b[stat] - a[stat])[0];
  return { type: entry.type, stat: entry[stat] };
}

/**
 * Mixed army: spend `strFrac` of BUDGET on the tier's best pure-STR unit,
 * the rest on the best pure-DEF unit; top up remainders with T2 filler so
 * every archetype lands within a few hundred of the exact pool.
 */
function buildArchetype(tier: UnitTier, strFrac: number, owner: string): Unit[] {
  const strSpec = bestPure(tier, 'strength');
  const defSpec = bestPure(tier, 'defense');
  const strBudget = Math.floor(BUDGET * strFrac);
  const defBudget = BUDGET - strBudget;

  const units: Unit[] = [];
  units.push(...mk(strSpec.type, { str: strSpec.stat, def: 0 }, Math.floor(strBudget / strSpec.stat), owner));
  units.push(...mk(defSpec.type, { str: 0, def: defSpec.stat }, Math.floor(defBudget / defSpec.stat), owner));

  // Remainder filler: T2_Marksman (STR) / T2_Wall (DEF) keeps the archetype pure-axis.
  const built = units.reduce((s, u) => s + u.strength + u.defense, 0);
  const remain = BUDGET - built;
  if (remain > 0) {
    const mark = UNIT_CONFIGS[UnitType.T2_Marksman];
    const wall = UNIT_CONFIGS[UnitType.T2_Wall];
    if (strFrac > 0 && remain >= mark.strength) {
      units.push(...mk(UnitType.T2_Marksman, { str: mark.strength, def: 0 }, 1, owner));
    } else if (remain >= wall.defense) {
      units.push(...mk(UnitType.T2_Wall, { str: 0, def: wall.defense }, 1, owner));
    }
  }
  return units;
}

function stats(units: Unit[]) {
  let str = 0, def = 0;
  for (const u of units) { str += u.strength; def += u.defense; }
  return { str, def, pool: str + def };
}

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1e3)}k`);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ---- archetype roster -------------------------------------------------------

const ARCHETYPES: Array<{ name: string; strFrac: number }> = [
  { name: 'monoStr', strFrac: 1.0 },
  { name: 'skew60', strFrac: 0.6 },
  { name: 'skew55', strFrac: 0.55 },
  { name: 'bal53', strFrac: 0.53 }, // ratio ~0.887 → BALANCED band (all multipliers ×1.0 = neutral control)
  { name: 'even', strFrac: 0.5 },
  { name: 'nearOpt', strFrac: 0.49 },
  { name: 'monoDef', strFrac: 0.0 },
];

const NEUTRAL: BalanceEffects = {
  ratio: 1, status: 'BALANCED', powerMultiplier: 1, damageTakenMultiplier: 1,
  damageDealtMultiplier: 1, gatheringMultiplier: 1, slotRegenMultiplier: 1,
  effectivePower: 0, warnings: [], bonuses: [], recommendation: '',
};

interface FightResult {
  outcome: string; rounds: number;
  aPoolLost: number; dPoolLost: number; aUnitLostPct: number; dUnitLostPct: number;
  strikeAR1: number; counterDR1: number; // round-1 damage both ways (suppression probe)
}

interface Row {
  a: string; d: string; seam: 'ON' | 'OFF';
  outcome: string; rounds: number;
  aPoolLost: number; dPoolLost: number; aUnitLostPct: number; dUnitLostPct: number;
  strikeAR1: number; counterDR1: number;
  flag: string;
}

async function fight(aUnits: Unit[], dUnits: Unit[], seam: 'ON' | 'OFF'): Promise<FightResult> {
  const aStats = stats(aUnits);
  const dStats = stats(dUnits);
  const overrides = seam === 'OFF'
    ? { attackerBalance: NEUTRAL, defenderBalance: NEUTRAL }
    : {};
  const log = await resolveBattle(
    aUnits, dUnits, 'sim-attacker', 'sim-defender',
    BattleType.Infantry, undefined,
    { attackerLevel: LEVEL, defenderLevel: LEVEL, applyCasualties: false, ...overrides }
  );
  return {
    outcome: log.outcome,
    rounds: log.totalRounds,
    aPoolLost: (log.attacker.initialHP - log.attacker.finalHP) / aStats.pool,
    dPoolLost: (log.defender.initialHP - log.defender.finalHP) / dStats.pool,
    aUnitLostPct: log.attacker.unitsLost / aUnits.length,
    dUnitLostPct: log.defender.unitsLost / dUnits.length,
    strikeAR1: log.rounds[0]?.attackerDamage ?? 0,
    counterDR1: log.rounds[0]?.defenderDamage ?? 0,
  };
}

async function main() {
  const tierArg = Number(process.argv[2] ?? 3);
  const tier: UnitTier = (Math.min(5, Math.max(1, tierArg)) as UnitTier);
  const built = ARCHETYPES.map(({ name, strFrac }) => {
    const units = buildArchetype(tier, strFrac, name);
    const s = stats(units);
    const bal = calculateBalanceEffects(s.str, s.def);
    return { name, units, s, band: bal.status };
  });

  console.log('='.repeat(100));
  console.log(`PvP ARMY-BALANCE SEAM SIM — pool ${fmt(BUDGET)} each, tier ${tier}, level ${LEVEL}, ${ARCHETYPES.length} archetypes`);
  console.log('='.repeat(100));
  console.log('ARCHETYPES (engine-verified bands):');
  for (const a of built) {
    console.log(
      `  ${a.name.padEnd(9)} STR ${fmt(a.s.str).padStart(7)}  DEF ${fmt(a.s.def).padStart(7)}  ` +
      `pool ${fmt(a.s.pool).padStart(7)}  ratio ${(Math.min(a.s.str, a.s.def) / Math.max(a.s.str, a.s.def)).toFixed(3)}  → ${a.band}  (${a.units.length} units)`
    );
  }

  const rows: Row[] = [];
  for (const atk of built) {
    for (const def of built) {
      for (const seam of ['ON', 'OFF'] as const) {
        const r = await fight(atk.units, def.units, seam);
        let flag = '';
        if (r.outcome === BattleOutcome.Draw) flag = 'DRAW';
        if (r.outcome === BattleOutcome.DefenderWin && r.rounds >= 100) flag = 'STALL';
        rows.push({ a: atk.name, d: def.name, seam, ...r, flag });
      }
    }
  }

  // Pairing report with seam deltas
  console.log('\nPAIRING MATRIX (each cell: seam ON line, then seam OFF line):');
  console.log('  A→D          seam  outcome        rnd  A-pool-lost  D-pool-lost  A-units  D-units  flag');
  for (const atk of built) {
    for (const def of built) {
      const on = rows.find((r) => r.a === atk.name && r.d === def.name && r.seam === 'ON')!;
      const off = rows.find((r) => r.a === atk.name && r.d === def.name && r.seam === 'OFF')!;
      for (const r of [on, off]) {
        console.log(
          `  ${`${r.a}→${r.d}`.padEnd(13)} ${r.seam.padEnd(5)} ${r.outcome.padEnd(12)} ${String(r.rounds).padStart(3)}  ` +
          `${pct(r.aPoolLost).padStart(11)} ${pct(r.dPoolLost).padStart(12)} ${pct(r.aUnitLostPct).padStart(7)} ${pct(r.dUnitLostPct).padStart(8)}  ${r.flag}`
        );
      }
      if (on.outcome !== off.outcome) console.log(`    ⚡ SEAM-FLIP: ${off.outcome} → ${on.outcome}`);
      else if (on.rounds !== off.rounds) console.log(`    ~ rounds ${off.rounds} → ${on.rounds} (seam effect)`);
    }
    console.log('');
  }

  // Archetype league table (seam ON): record + survival across all 36 cells
  console.log('LEAGUE TABLE (seam ON, 6 matchups as attacker + 6 as defender):');
  console.log('  archetype   band          W-D-L   avg-rounds  avg-pool-lost  worst-pool-lost');
  for (const atk of built) {
    const mine = rows.filter((r) => (r.a === atk.name || r.d === atk.name) && r.seam === 'ON');
    let w = 0, d = 0, l = 0, rSum = 0, lostSum = 0, worst = 0;
    for (const r of mine) {
      const mineLost = r.a === atk.name ? r.aPoolLost : r.dPoolLost;
      const won = r.a === atk.name ? r.outcome === BattleOutcome.AttackerWin : r.outcome === BattleOutcome.DefenderWin;
      const drew = r.outcome === BattleOutcome.Draw || r.rounds >= 100;
      if (drew) d++; else if (won) w++; else l++;
      rSum += r.rounds; lostSum += mineLost; worst = Math.max(worst, mineLost);
    }
    const band = built.find((b) => b.name === atk.name)!.band;
    console.log(
      `  ${atk.name.padEnd(11)} ${band.padEnd(13)} ${String(w).padStart(1)}-${d}-${String(l).padEnd(1)}   ` +
      `${(rSum / mine.length).toFixed(1).padStart(10)}  ${pct(lostSum / mine.length).padStart(13)}  ${pct(worst).padStart(15)}`
    );
  }

  // Seam effect summary: aggregate pool-lost per archetype, ON vs OFF
  console.log('\nSEAM EFFECT (avg pool lost across all cells, ON vs OFF — lower is better):');
  for (const atk of built) {
    const mine = rows.filter((r) => (r.a === atk.name || r.d === atk.name));
    const on = mine.filter((r) => r.seam === 'ON');
    const off = mine.filter((r) => r.seam === 'OFF');
    const avgLost = (rs: Row[]) => rs.reduce((s, r) => s + (r.a === atk.name ? r.aPoolLost : r.dPoolLost), 0) / rs.length;
    const onW = on.filter((r) => (r.a === atk.name ? r.outcome === BattleOutcome.AttackerWin : r.outcome === BattleOutcome.DefenderWin) && r.rounds < 100).length;
    const offW = off.filter((r) => (r.a === atk.name ? r.outcome === BattleOutcome.AttackerWin : r.outcome === BattleOutcome.DefenderWin) && r.rounds < 100).length;
    console.log(`  ${atk.name.padEnd(9)} lost ${pct(avgLost(on))} (ON) vs ${pct(avgLost(off))} (OFF)   wins ${onW} (ON) vs ${offW} (OFF)`);
  }

  // Neutral-control invariant: when BOTH sides are BALANCED (all multipliers
  // ×1.0), seam ON (auto-computed) must be bit-identical to seam OFF (explicit
  // NEUTRAL). Cross cells with a non-balanced opponent are NOT controls — the
  // opponent's band legitimately applies in the ON run (e.g. skew60's CRITICAL
  // tax) — those are informational only.
  let controlFails = 0;
  const controlCells = rows.filter((r) => r.a === 'bal53' && r.d === 'bal53');
  for (const on of controlCells.filter((r) => r.seam === 'ON')) {
    const off = rows.find((r) => r.a === on.a && r.d === on.d && r.seam === 'OFF')!;
    if (on.outcome !== off.outcome || on.rounds !== off.rounds ||
        on.aPoolLost !== off.aPoolLost || on.dPoolLost !== off.dPoolLost) {
      controlFails++;
      console.log(`  ✗ CONTROL MISMATCH ${on.a}→${on.d}: ON ${on.outcome}/${on.rounds}r/${pct(on.aPoolLost)} vs OFF ${off.outcome}/${off.rounds}r/${pct(off.aPoolLost)}`);
    }
  }
  console.log(`\nNEUTRAL CONTROL (bal53→bal53, both BALANCED ×1.0): ${controlFails === 0 ? 'PASS — seam ON ≡ OFF bit-identical' : `FAIL in ${controlFails} cells`}`);

  // Suppression sweep: mono-STR attacker vs defender DEF-share ladder at equal
  // pool. counter = DEF − attackerSTR/2 (min 5) ⇒ defenders with DEF ≤ STR/2
  // of a mono-STR attacker counter ~nothing. Quantifies the dead zone.
  console.log('\nSUPPRESSION SWEEP — mono-STR attacker (200k STR, seam ON) vs defender DEF share:');
  console.log('  DEF-share  D-STR    D-DEF   band         outcome        rnd  A-pool-lost  counter-R1');
  for (const share of [0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.49, 0.5, 0.55, 0.6, 0.7]) {
    const atk = buildArchetype(UnitTier.Tier3, 1.0, 'sweep-atk');
    const def = buildArchetype(UnitTier.Tier3, 1 - share, `sweep-${share}`);
    const r = await fight(atk, def, 'ON');
    const dS = stats(def);
    const bal = calculateBalanceEffects(dS.str, dS.def);
    console.log(
      `  ${pct(share).padStart(8)} ${fmt(dS.str).padStart(8)} ${fmt(dS.def).padStart(7)} ${bal.status.padEnd(12)} ` +
      `${r.outcome.padEnd(12)} ${String(r.rounds).padStart(4)}  ${pct(r.aPoolLost).padStart(11)}  ${fmt(r.counterDR1).padStart(10)}`
    );
  }

  const flips = rows.filter((r) => r.flag);
  console.log(`\nFLAGS: ${flips.length === 0 ? 'none' : ''}`);
  for (const f of flips) console.log(`  ⚠ ${f.a}→${f.d} [${f.seam}] ${f.flag} (${f.outcome}, ${f.rounds}r)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
