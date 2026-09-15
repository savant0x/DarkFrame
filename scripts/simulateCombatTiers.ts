/**
 * Tier-mismatch combat simulation (FID-20260915-001 Phase 3 follow-up).
 *
 * Question from the operator: does the new power-proportional HP scale have
 * matchmaking holes — tiers where raids are free wins or unwinnable?
 *
 * Method: this runs the REAL engine (`resolveBattle` with applyCasualties:
 * false — full combat loop, zero persistence) across an attacker tier ×
 * defender tier × composition matrix. Defender profiles come in two flavors:
 *   - FRESH base (units: [] on spawn): the route's synthesizeGarrison path,
 *     constants mirrored exactly from app/api/combat/attack/route.ts.
 *   - MATURE base: band-shaped army of real UNIT_CONFIGS (pure STR/DEF mix),
 *     the shape generateBeerBaseUnits produces after regrowth.
 * Read-only: no DB access happens (battleService's dynamic service imports
 * are consumed inside try/catch and never resolve here).
 */
import { resolveBattle } from '@/lib/battleService';
import { UNIT_CONFIGS, UnitType, UnitTier, BattleType, BattleOutcome } from '@/types';
import type { Unit } from '@/types';

// ---- knobs mirrored from app/api/combat/attack/route.ts (doc: BASE_RAID_BALANCE.md) ----
// Tier-sim Flag 1 fix: DEF floor drives the counter (engine counters with DEF),
// STR floor pads the HP pool only.
const GARRISON_DEF = 20;
const GARRISON_STR = 10;
const SIZE_DIVISOR = 20;
const SIZE_FLOOR = 8;
const SIZE_CAP = 60;
const STR_RATIO = 0.2;
const DEF_RATIO = 0.65;
// Mirrored from app/api/combat/attack/route.ts (FID-20260915-003).
const TIER_MULT: Record<number, number> = { 1: 1.0, 2: 1.05, 3: 1.1, 4: 1.2, 5: 1.35, 6: 1.5 };

// Bot tier ladders (lib/botService.ts getBotDefenseForTier / getPlayerLevelForTier)
function botDefenseForTier(tier: number): number {
  return Math.floor((100 + tier * 50) * Math.pow(2, tier - 1) * 0.1);
}
const BOT_LEVEL: Record<number, number> = { 1: 5, 2: 15, 3: 25, 4: 35, 5: 45, 6: 55, 7: 65 };

// ---- helpers ----
let uid = 0;
function mk(type: UnitType, quantity: number): Unit[] {
  const cfg = UNIT_CONFIGS[type];
  return Array.from({ length: quantity }, () => ({
    id: `sim-${uid++}`,
    type,
    strength: cfg.strength,
    defense: cfg.defense,
    producedAt: { x: 0, y: 0 },
    producedDate: new Date(),
    owner: 'sim',
  }));
}
function stats(units: Unit[]) {
  let str = 0, def = 0;
  for (const u of units) { str += u.strength; def += u.defense; }
  return { str, def };
}
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`);
const pct = (n: number, d: number) => (d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`);

/** Best pure-STR unit of a tier (real attacker armies are STR-heavy). */
function bestStrUnit(tier: UnitTier): UnitType {
  const entry = Object.values(UNIT_CONFIGS)
    .filter((c) => c.tier === tier && c.strength > 0 && c.defense === 0)
    .sort((a, b) => b.strength - a.strength)[0];
  return entry.type;
}
/** Army of N units of the tier's best STR unit. */
function monoArmy(tier: UnitTier, count: number): Unit[] {
  return mk(bestStrUnit(tier), count);
}

/** Route-accurate synthesized fresh-base garrison. */
function synthGarrison(totalDefense: number, attackerSTR: number, tierMult = 1, sizeCap = SIZE_CAP): Unit[] {
  const unitCount = Math.min(sizeCap, Math.max(SIZE_FLOOR, Math.ceil(totalDefense / SIZE_DIVISOR)));
  const strengthFloor = Math.ceil(attackerSTR * STR_RATIO * tierMult);
  const defenseFloor = Math.ceil(attackerSTR * DEF_RATIO * tierMult);
  const perUnitSTR = Math.max(GARRISON_STR, Math.ceil(strengthFloor / unitCount));
  const perUnitDEF = Math.max(GARRISON_DEF, Math.ceil(defenseFloor / unitCount));
  return Array.from({ length: unitCount }, () => {
    uid++;
    return {
      id: `sim-g-${uid}`,
      type: UnitType.T1_Rifleman,
      strength: perUnitSTR,
      defense: perUnitDEF,
      producedAt: { x: 0, y: 0 },
      producedDate: new Date(),
      owner: 'sim-def',
    } as Unit;
  });
}

/** Band-shaped MATURE army: pure STR units (odd tiers) + pure DEF walls (even tiers). */
function bandArmy(budget: number, tierCap: UnitTier): Unit[] {
  const units: Unit[] = [];
  const axes: Array<{ share: number; stat: 'str' | 'def'; tiers: number[] }> = [
    { share: 0.55, stat: 'str', tiers: [1, 3, 5] },
    { share: 0.45, stat: 'def', tiers: [2, 4] },
  ];
  for (const ax of axes) {
    const perTier = (budget * ax.share) / ax.tiers.length;
    for (const t of ax.tiers) {
      if (t > tierCap) continue;
      const pool = Object.values(UNIT_CONFIGS)
        .filter((c) => c.tier === (t as UnitTier) && (ax.stat === 'str'
          ? (c.strength > 0 && c.defense === 0)
          : (c.defense > 0 && c.strength === 0)))
        .sort((a, b) => (ax.stat === 'str' ? b.strength - a.strength : b.defense - a.defense));
      const use = pool[0];
      if (!use) continue;
      const qty = Math.floor(perTier / (use.strength + use.defense));
      if (qty >= 1) units.push(...mk(use.type, qty));
    }
  }
  return units;
}

async function run(
  scenario: string, atkTier: string, defTier: string,
  attacker: { units: Unit[]; level: number },
  defender: { units: Unit[]; level: number },
  flags: string[]
): Promise<void> {
  const a = stats(attacker.units);
  const d = stats(defender.units);
  const log = await resolveBattle(
    attacker.units, defender.units, 'sim-attacker', 'sim-defender',
    BattleType.BaseRaid, { x: 0, y: 0 },
    { attackerLevel: attacker.level, defenderLevel: defender.level, applyCasualties: false }
  );
  const attLostN = log.attacker.unitsLost;
  const defLostN = log.defender.unitsLost;
  const attN = attacker.units.length;
  const defN = defender.units.length;
  const powerRatio = a.str / Math.max(1, d.def);
  let flag = '';
  if (log.outcome === BattleOutcome.AttackerWin && log.totalRounds <= 2 && defLostN / defN > 0.9) flag = 'FREE-WIN';
  if (log.outcome === BattleOutcome.DefenderWin && attLostN / attN > 0.9 && powerRatio >= 1) flag = 'UNWINNABLE';
  if (log.outcome === BattleOutcome.DefenderWin && log.totalRounds >= 100) flag = 'STALL';
  if (flag) flags.push(`${scenario}: ${flag} (A ${fmt(a.str)} vs D def ${fmt(d.def)}, ${log.totalRounds}r)`);

  console.log(
    [
      scenario.padEnd(14), atkTier.padEnd(9), defTier.padEnd(9),
      `${powerRatio.toFixed(1)}x`.padStart(6),
      log.outcome.padEnd(13), String(log.totalRounds).padStart(3),
      pct(attLostN, attN).padStart(5), pct(defLostN, defN).padStart(5),
      fmt(a.str).padStart(7), fmt(d.def).padStart(7), flag,
    ].join(' ')
  );
}

async function main() {
  const flags: string[] = [];
  console.log('scenario      atkTier   defTier   ratio  outcome       rnd att%  def%  atkSTR  defDEF  flag');
  console.log('-'.repeat(108));

  // ---- Matrix 1: FRESH bases (synthesis path) — attacker tier sweep × defender tier ----
  // Attacker armies: real mono-STR builds, 40 units, tiered level per the bot level brackets.
  const attackers: Array<{ tier: UnitTier; name: string; count: number; level: number }> = [
    { tier: UnitTier.Tier1, name: 'T1@lv5', count: 40, level: 5 },
    { tier: UnitTier.Tier3, name: 'T3@lv25', count: 40, level: 25 },
    { tier: UnitTier.Tier5, name: 'T5@lv45', count: 40, level: 45 },
  ];
  for (const atk of attackers) {
    const aUnits = monoArmy(atk.tier, atk.count);
    const aStr = stats(aUnits).str;
    for (let t = 1; t <= 7; t++) {
      const dUnits = synthGarrison(botDefenseForTier(t), aStr, TIER_MULT[Math.min(t, 6)] ?? 1);
      await run('fresh-synth', atk.name, `T${t}@lv${BOT_LEVEL[t]}`, { units: aUnits, level: atk.level }, { units: dUnits, level: BOT_LEVEL[t] }, flags);
    }
  }

  console.log('-'.repeat(108));

  // ---- Matrix 2: MATURE band bases — attacker budget sweep × band tier ----
  // Bands span two tiers (STR units on odd tiers, DEF walls on even) — matching
  // generateBeerBaseUnits' dual-axis budgets. WEAK(T1/T2) … TOP(T5).
  const bands: Array<{ name: string; budget: number; tierCap: UnitTier; level: number }> = [
    { name: 'WEAK(15k)', budget: 15_000, tierCap: UnitTier.Tier2, level: 5 },
    { name: 'MID(50k)', budget: 50_000, tierCap: UnitTier.Tier3, level: 15 },
    { name: 'STRONG(150k)', budget: 150_000, tierCap: UnitTier.Tier4, level: 25 },
    { name: 'ELITE(500k)', budget: 500_000, tierCap: UnitTier.Tier5, level: 35 },
    { name: 'TOP(1M)', budget: 1_000_000, tierCap: UnitTier.Tier5, level: 45 },
  ];
  for (const band of bands) {
    const dUnits = bandArmy(band.budget, band.tierCap);
    for (const atk of attackers) {
      const aUnits = monoArmy(atk.tier, atk.count);
      await run('mature-band', atk.name, band.name, { units: aUnits, level: atk.level }, { units: dUnits, level: band.level }, flags);
    }
  }

  console.log('-'.repeat(108));

  // ---- Matrix 3: level-gap stress (same power, wrong bracket) ----
  const aT3 = monoArmy(UnitTier.Tier3, 40);
  const aStr3 = stats(aT3).str;
  await run('gap-stress', 'T3@lv25', 'T1@lv5', { units: aT3, level: 25 }, { units: synthGarrison(botDefenseForTier(1), aStr3), level: 5 }, flags);
  const aT1 = monoArmy(UnitTier.Tier1, 40);
  const aStr1 = stats(aT1).str;
  await run('gap-stress', 'T1@lv5', 'T7@lv65', { units: aT1, level: 5 }, { units: synthGarrison(botDefenseForTier(7), aStr1), level: 65 }, flags);
  const aT5 = monoArmy(UnitTier.Tier5, 40);
  const aStr5 = stats(aT5).str;
  await run('gap-stress', 'T5@lv45', 'T7@lv65', { units: aT5, level: 45 }, { units: synthGarrison(botDefenseForTier(7), aStr5), level: 65 }, flags);

  console.log('-'.repeat(108));

  // ---- Matrix 4: ENDGAME TUNING sweep (operator directive: raise SIZE_CAP) ----
  // Question: does raising GARRISON_SIZE_CAP alone make high-tier bases fight
  // multi-round against endgame raiders, or is the weight floor scale-invariant
  // w.r.t. unit count? Sweeps cap × tier-multiplier on the T5/T7 fresh-synth
  // cells with the biggest endgame raider (T5 band, 220k STR).
  const endgameAtk = monoArmy(UnitTier.Tier5, 40); // 220k STR T5 band
  const eStr = stats(endgameAtk).str;
  const endgameAtkCtx = { units: endgameAtk, level: 45 };
  for (const tm of [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9]) {
    const dUnits = synthGarrison(botDefenseForTier(7), eStr, tm, 60);
    await run('tune-tiermult', 'T7@lv65', `×${tm}`, endgameAtkCtx, { units: dUnits, level: 65 }, flags);
  }

  console.log('\n=== FLAGS (matchmaking holes) ===');
  if (flags.length === 0) console.log('none — no free-win / unwinnable / stall cells detected');
  for (const f of flags) console.log(` • ${f}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
