/**
 * Ladder-truth scanner — the FID-20260915-006a lesson made executable.
 *
 * The bot tier ladders drifted for months because the documented tables lived
 * only in comments while the truth lived in formulas; nothing ever EXECUTED
 * the comments. This module parses the documented ladders out of
 * `lib/botService.ts` itself and pairs every documented value with the live
 * function output, so a comment-only edit that drifts from code fails CI
 * (and a formula change without a comment update fails too).
 *
 * Executed at module import (collectionCensus pattern). Consumer:
 *   __tests__/lib/ladderTruth.test.ts
 *
 * Scanner errors (table removed, format changed) throw at import so the gate
 * fails loudly instead of silently degrading to zero assertions.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  getResourceRange,
  getBotDefenseForTier,
  getPlayerLevelBonus,
} from '@/lib/botService';
import { regenerateBotResources, BUILD_RATES, ARMY_COMPOSITION } from '@/lib/botGrowthEngine';
import {
  UNIT_CONFIGS,
  UnitType,
  UnitTier,
  TIER_UNLOCK_REQUIREMENTS,
} from '@/types/game.types';
import { BotSpecialization, type Player } from '@/types/game.types';

export interface LadderMismatch {
  site: string;
  key: string;
  documented: number;
  actual: number;
}

export interface LadderRow {
  ladder: string;
  /** Number of distinct documented sites found (drift-by-deletion guard). */
  sites: Array<{ name: string; cells: number }>;
  mismatches: LadderMismatch[];
  cellsChecked: number;
}

const SOURCE_PATH = join(process.cwd(), 'lib', 'botService.ts');
const SRC = readFileSync(SOURCE_PATH, 'utf8').replace(/\r\n/g, '\n');
const LINES = SRC.split('\n');
// FID-20260915-007: the gate now covers the regen-rate table (documented in
// botGrowthEngine + botService) and the unit-cost curve (documented in
// game.types) — every documented game-math table is CI-pinned.
const ENGINE_SRC = readFileSync(join(process.cwd(), 'lib', 'botGrowthEngine.ts'), 'utf8').replace(/\r\n/g, '\n');
const ENGINE_LINES = ENGINE_SRC.split('\n');
const TYPES_SRC = readFileSync(join(process.cwd(), 'types', 'game.types.ts'), 'utf8').replace(/\r\n/g, '\n');
const TYPES_LINES = TYPES_SRC.split('\n');

function parseAll(line: string, re: RegExp, what: string): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  for (const m of line.matchAll(re)) out.push([m[1], Number(m[2].replace(/,/g, ''))]);
  if (out.length === 0) {
    throw new Error(`ladder-truth scanner: cannot parse ${what} from line: ${line.trim()}`);
  }
  return out;
}

function parseOne(line: string, re: RegExp, what: string): [string, number] {
  const m = line.match(re);
  if (!m) throw new Error(`ladder-truth scanner: cannot parse ${what} from line: ${line.trim()}`);
  return [m[1], Number(m[2].replace(/,/g, ''))];
}

function makeLadder(
  ladder: string,
  expectedSiteCount: number,
  cells: Array<{ site: string; key: string; documented: number; actual: number }>
): LadderRow {
  // Site-count guard: if a documented table is deleted or moved, the site
  // count changes and this fails — the gate cannot silently lose coverage.
  const sites = [...new Set(cells.map((c) => c.site))].map((site) => ({
    name: site,
    cells: cells.filter((c) => c.site === site).length,
  }));
  if (sites.length !== expectedSiteCount) {
    throw new Error(
      `ladder-truth scanner: ${ladder} documented in ${sites.length} site(s), expected ${expectedSiteCount} — ` +
        `a table was removed/added. Update the scanner AND the docs together.`
    );
  }
  return {
    ladder,
    sites,
    cellsChecked: cells.length,
    mismatches: cells.filter((c) => c.documented !== c.actual).map(({ site, key, documented, actual }) => ({ site, key, documented, actual })),
  };
}

// ---------------------------------------------------------------------------
// 1. Resource multiplier ladder (documented in TWO sites; truth: the
//    `0.5 + tier * 0.25` multiplier applied inside getResourceRange).
//    Header rows:      "- Tier 1 (Level 1-10): 0.75x resources, 15 base defense"
//    Function comment: "// T1: 0.75x, T2: 1.0x, T3: 1.25x, ..."
// ---------------------------------------------------------------------------
const resourceCells: Array<{ site: string; key: string; documented: number; actual: number }> = [];
for (const line of LINES) {
  if (/-\s*Tier\s+\d\s*\(Level[^)]*\):\s*[\d.]+x\s+resources/.test(line)) {
    const [tier, mult] = parseOne(line, /-\s*Tier\s+(\d)\s*\(Level[^)]*\):\s*([\d.]+)x\s+resources/, 'header resource ladder');
    for (const spec of [BotSpecialization.Hoarder, BotSpecialization.Fortress]) {
      const range = getResourceRange(spec, Number(tier));
      const base = getResourceRange(spec, 1);
      // The documented multiplier's real contract: max = floor(base.max × mult),
      // where base.max is the same table the function multiplies. Recover the
      // base from the T1 documented multiplier to avoid pinning it twice.
      const baseMax = Math.round(base.max / 0.75); // T1 documented = 0.75x
      resourceCells.push({
        site: 'file header (tier table)',
        key: `${spec} T${tier} max`,
        documented: Math.floor(baseMax * mult),
        actual: range.max,
      });
    }
  }
  if (/\/\/\s*T1:\s*[\d.]+x,\s*T2:/.test(line)) {
    for (const [tier, mult] of parseAll(line, /T(\d):\s*([\d.]+)x/g, 'function resource ladder')) {
      const range = getResourceRange(BotSpecialization.Hoarder, Number(tier));
      const baseMax = Math.round(getResourceRange(BotSpecialization.Hoarder, 1).max / 0.75);
      resourceCells.push({
        site: 'getResourceRange comment',
        key: `Hoarder T${tier} max`,
        documented: Math.floor(baseMax * mult),
        actual: range.max,
      });
    }
  }
}
export const resourceLadder = makeLadder('resource multiplier', 2, resourceCells);

// ---------------------------------------------------------------------------
// 2. Base defense ladder (documented in TWO sites; truth: getBotDefenseForTier).
//    Header rows:      "- Tier 1 (Level 1-10): 0.75x resources, 15 base defense"
//    Function comment: "// T1: 15, T2: 40, T3: 100, ..."
// ---------------------------------------------------------------------------
const defenseCells: Array<{ site: string; key: string; documented: number; actual: number }> = [];
for (const line of LINES) {
  if (/-\s*Tier\s+\d\s*\(Level[^)]*\):.*base\s+defense/.test(line)) {
    const [tier, def] = parseOne(line, /-\s*Tier\s+(\d)\s*\(Level[^)]*\):.*?,\s*([\d,]+)\s+base\s+defense/, 'header defense ladder');
    defenseCells.push({
      site: 'file header (tier table)',
      key: `T${tier}`,
      documented: def,
      actual: getBotDefenseForTier(Number(tier)),
    });
  }
  if (/\/\/\s*T1:\s*[\d,]+,\s*T2:/.test(line)) {
    for (const [tier, def] of parseAll(line, /T(\d):\s*([\d,]+)/g, 'function defense ladder')) {
      defenseCells.push({ site: 'getBotDefenseForTier comment', key: `T${tier}`, documented: def, actual: getBotDefenseForTier(Number(tier)) });
    }
  }
}
export const defenseLadder = makeLadder('base defense', 2, defenseCells);

// ---------------------------------------------------------------------------
// 3. Player level-bracket ladder (documented in ONE site; truth:
//    getPlayerLevelBonus — +25% per 10-level bracket, capped at bracket 6).
//    Header rows: "- Level 10-19 (Bracket 1): 1.25x multiplier (+25%)"
// ---------------------------------------------------------------------------
const bracketCells: Array<{ site: string; key: string; documented: number; actual: number }> = [];
for (const line of LINES) {
  if (/-\s*Level\s+[\d+-]+\s*\(Bracket\s+\d\):\s*[\d.]+x\s+multiplier/.test(line)) {
    const [bracket, mult] = parseOne(line, /-\s*Level\s+[\d+-]+\s*\(Bracket\s+(\d)\):\s*([\d.]+)x\s+multiplier/, 'bracket ladder');
    // Probe a level inside each bracket (bracket 6 = 60+, probe 65).
    const level = Number(bracket) * 10 + 5;
    bracketCells.push({
      site: 'file header (bracket table)',
      key: `bracket ${bracket} (L${level})`,
      documented: mult,
      actual: getPlayerLevelBonus(level),
    });
  }
}
export const bracketLadder = makeLadder('player level bracket', 1, bracketCells);

// ---------------------------------------------------------------------------
// 4. Regeneration-rate ladder (FID-20260915-007; documented in FOUR sites;
//    truth: regenerateBotResources — rate derived as tick(0) ÷ spawner-max,
//    same engine-derived philosophy as the property suite, no table import).
//    Table rows:    "  Hoarder: 0.05,   // 5% per hour - slow regeneration…"
//    Engine header: "Bots regenerate resources hourly (2-20% by type …)"
//    botService:    header + implementation-notes summaries of the range.
//    NOTE: the range claims ("2-20%") pin the table's min/max — this is the
//    cell that caught the live "5-20%" falsehood (Boss regenerates at 2%).
// ---------------------------------------------------------------------------
const RATE_KEYS = ['Hoarder', 'Fortress', 'Raider', 'Ghost', 'Balanced', 'Boss'] as const;
/** Engine-derived effective rate per specialization: tick(0) / spawner-max. */
function derivedRegenRate(specKey: (typeof RATE_KEYS)[number]): number {
  const spec = BotSpecialization[specKey];
  const zeroBot = {
    botConfig: { specialization: spec, tier: 1 },
    resources: { metal: 0, energy: 0, food: 0 },
  } as unknown as Player;
  const firstTick = regenerateBotResources(zeroBot).metal;
  const rangeMax = getResourceRange(spec, 1).max;
  return firstTick / rangeMax; // exact integers for the shipped table
}

const regenCells: Array<{ site: string; key: string; documented: number; actual: number }> = [];
for (const line of ENGINE_LINES) {
  const tableRow = line.match(/^\s*(Hoarder|Fortress|Raider|Ghost|Balanced|Boss):\s*[\d.]+,\s*\/\/\s*([\d.]+)%\s+per hour/);
  if (tableRow) {
    const key = tableRow[1] as (typeof RATE_KEYS)[number];
    regenCells.push({
      site: 'REGENERATION_RATES table',
      key: `${key} %`,
      documented: Number(tableRow[2]),
      actual: derivedRegenRate(key) * 100,
    });
  }
  const range = line.match(/Bots regenerate resources hourly \(([\d.]+)-([\d.]+)% by type/);
  if (range) {
    const rates = RATE_KEYS.map(derivedRegenRate).map((r) => r * 100);
    regenCells.push({ site: 'file header (KEY FEATURES)', key: 'range low %', documented: Number(range[1]), actual: Math.min(...rates) });
    regenCells.push({ site: 'file header (KEY FEATURES)', key: 'range high %', documented: Number(range[2]), actual: Math.max(...rates) });
  }
}
for (const line of LINES) {
  const header = line.match(/regenerate resources hourly \(([\d.]+)-([\d.]+)% by type/);
  if (header) {
    const rates = RATE_KEYS.map(derivedRegenRate).map((r) => r * 100);
    regenCells.push({ site: 'botService header', key: 'range low %', documented: Number(header[1]), actual: Math.min(...rates) });
    regenCells.push({ site: 'botService header', key: 'range high %', documented: Number(header[2]), actual: Math.max(...rates) });
  }
  const notes = line.match(/Resource regeneration rates: ([\d.]+)-([\d.]+)% per hour/);
  if (notes) {
    const rates = RATE_KEYS.map(derivedRegenRate).map((r) => r * 100);
    regenCells.push({ site: 'botService implementation notes', key: 'range low %', documented: Number(notes[1]), actual: Math.min(...rates) });
    regenCells.push({ site: 'botService implementation notes', key: 'range high %', documented: Number(notes[2]), actual: Math.max(...rates) });
  }
}
export const regenRateLadder = makeLadder('regeneration rate', 4, regenCells);

// ---------------------------------------------------------------------------
// 5. Unit-cost ladder (FID-20260915-007; documented in TWO comment blocks in
//    types/game.types.ts; truth: UNIT_CONFIGS / UnitType / TIER_UNLOCK_REQUIREMENTS).
//    Header block: "all 65 units", "40-unit core roster", the 5-row
//    BALANCING PHILOSOPHY table (level + RP per tier), slot ladder "1/3/7/15/30".
//    Derivation block: "40-unit T1–T5 core", slot ladder repeated.
//    Blueprint field parity of the core roster is ALREADY pinned by
//    __tests__/unit/catalog-unification.test.ts — the gate does not duplicate it.
// ---------------------------------------------------------------------------
const valueToMember = new Map(Object.entries(UnitType).map(([member, value]) => [value as string, member]));
const coreConfigs = Object.values(UNIT_CONFIGS).filter((c) => /^T[1-5]_/.test(valueToMember.get(c.type) ?? ''));

const unitCostCells: Array<{ site: string; key: string; documented: number; actual: number }> = [];
// Site cursor: the two doc blocks sit back-to-back in the same comment wall;
// cells are attributed to the block they were parsed from (site-count guard
// integrity — a block losing all its rows must fail the count, not hide in
// the other site's bucket).
let unitCostSite = 'UNIT_CONFIGS header (balancing philosophy)';
for (const line of TYPES_LINES) {
  if (/BALANCING PHILOSOPHY/.test(line)) unitCostSite = 'UNIT_CONFIGS header (balancing philosophy)';
  if (/UNIT_CONFIGS is DERIVED from UNIT_BLUEPRINTS/.test(line)) unitCostSite = 'UNIT_CONFIGS derivation note';
  const total = line.match(/configurations for all (\d+) units/);
  if (total) {
    unitCostCells.push({ site: unitCostSite, key: 'total configs', documented: Number(total[1]), actual: Object.values(UNIT_CONFIGS).length });
  }
  const core = line.match(/the (\d+)-unit core roster/);
  if (core) {
    unitCostCells.push({ site: unitCostSite, key: 'core roster', documented: Number(core[1]), actual: coreConfigs.length });
  }
  // Tier-1's row reads "0 RP" (no "to unlock tier" tail) — both row shapes parse.
  const philosophy = line.match(/-\s*Tier (\d):\s*.*Level (\d+)\+,\s*(\d+) RP(?: to unlock tier)?/);
  if (philosophy) {
    const tier = Number(philosophy[1]) as UnitTier;
    const req = TIER_UNLOCK_REQUIREMENTS[tier];
    unitCostCells.push({ site: unitCostSite, key: `T${tier} level`, documented: Number(philosophy[2]), actual: req.level });
    unitCostCells.push({ site: unitCostSite, key: `T${tier} rp`, documented: Number(philosophy[3]), actual: req.rp });
  }
  const slots = line.match(/\(?(?:core roster:\s*)?([\d]+\/[\d/]+)\)?;?/);
  if (slots && /slot|1\/3/.test(line)) {
    for (const [i, doc] of slots[1].split('/').entries()) {
      const tier = (i + 1) as UnitTier;
      const inTier = coreConfigs.filter((c) => c.tier === tier);
      const slotValues = [...new Set(inTier.map((c) => c.slotCost))];
      // Actual = the tier's slot cost iff uniform; NaN (no units) or mixed
      // values mismatch the documented ladder.
      const actual = slotValues.length === 1 ? slotValues[0] : NaN;
      unitCostCells.push({ site: unitCostSite, key: `T${tier} slotCost`, documented: Number(doc), actual });
    }
  }
  const deriveCore = line.match(/the (\d+)-unit T1.T5 core/);
  if (deriveCore) {
    unitCostCells.push({ site: unitCostSite, key: 'core roster (derivation)', documented: Number(deriveCore[1]), actual: coreConfigs.length });
  }
}
export const unitCostLadder = makeLadder('unit cost curve', 2, unitCostCells);

// ---------------------------------------------------------------------------
// 6. Build-rate ladder (FID-20260915-007; documented in TWO sites in
//    botGrowthEngine; truth: BUILD_RATES — units/hour, doc quotes hours/unit).
//    Header bullets: "* Fortress: 1 unit/2 hours (slow, defensive focus)"
//    Table comments: "Fortress: 0.5,  // 1 unit every 2 hours - …"
//    PRECISION: Ghost's rate 0.67 is a rounded reciprocal of 1/1.5 (exactly
//    1.4925 h/unit), so documented intervals pin at the docs' one-decimal
//    precision: actual = round(10 / rate) / 10. A real drift (0.67 → 0.75)
//    still fails; a last-digit re-round (0.67 → 0.667) does not.
// ---------------------------------------------------------------------------
type BuildKey = 'Fortress' | 'Raider' | 'Hoarder' | 'Ghost' | 'Balanced';
const buildCells: Array<{ site: string; key: string; documented: number; actual: number }> = [];
const buildActual = (key: BuildKey): number => Math.round(10 / BUILD_RATES[key]) / 10;
for (const line of ENGINE_LINES) {
  const header = line.match(/\*\s+(Fortress|Raider|Hoarder|Ghost|Balanced):\s+1 unit\/(?:([\d.]+) hours?|hour)/);
  if (header) {
    const key = header[1] as BuildKey;
    buildCells.push({ site: 'file header (unit building)', key: `${key} hours/unit`, documented: header[2] ? Number(header[2]) : 1, actual: buildActual(key) });
  }
  const tableRow = line.match(/^\s*(Fortress|Raider|Hoarder|Ghost|Balanced):\s*[\d.]+,\s*\/\/\s*1 unit (?:every ([\d.]+) hours?|per hour)/);
  if (tableRow) {
    const key = tableRow[1] as BuildKey;
    buildCells.push({ site: 'BUILD_RATES table', key: `${key} hours/unit`, documented: tableRow[2] ? Number(tableRow[2]) : 1, actual: buildActual(key) });
  }
}
export const buildRateLadder = makeLadder('build rate', 2, buildCells);

// ---------------------------------------------------------------------------
// 7. Army-composition ladder (FID-20260915-007; documented in TWO sites in
//    botGrowthEngine; truth: ARMY_COMPOSITION — str/def fractions).
//    Header bullets: "* Fortress: 70% DEF, 30% STR (defensive wall)"
//    Table comments: "// 30% STR, 70% DEF - defensive wall"
//    Labels parsed (STR/DEF order varies by row); both cells per row pinned.
// ---------------------------------------------------------------------------
type CompKey = 'Fortress' | 'Raider' | 'Hoarder' | 'Ghost' | 'Balanced';
const compCells: Array<{ site: string; key: string; documented: number; actual: number }> = [];
for (const line of ENGINE_LINES) {
  const header = line.match(/\*\s+(Fortress|Raider|Hoarder|Ghost|Balanced):\s+(\d+)%\s+(STR|DEF),\s*(\d+)%\s+(STR|DEF)/);
  if (header) {
    const key = header[1] as CompKey;
    const parts: Array<[string, number]> = [[header[3], Number(header[2])], [header[5], Number(header[4])]];
    for (const [stat, pct] of parts) {
      compCells.push({ site: 'file header (army composition)', key: `${key} ${stat}%`, documented: pct, actual: ARMY_COMPOSITION[key][stat.toLowerCase() as 'str' | 'def'] * 100 });
    }
  }
  const tableRow = line.match(/^\s*(Fortress|Raider|Hoarder|Ghost|Balanced):\s*\{[^}]+},\s*\/\/\s*(\d+)%\s+(STR|DEF),\s*(\d+)%\s+(STR|DEF)/);
  if (tableRow) {
    const key = tableRow[1] as CompKey;
    const parts: Array<[string, number]> = [[tableRow[3], Number(tableRow[2])], [tableRow[5], Number(tableRow[4])]];
    for (const [stat, pct] of parts) {
      compCells.push({ site: 'ARMY_COMPOSITION table', key: `${key} ${stat}%`, documented: pct, actual: ARMY_COMPOSITION[key][stat.toLowerCase() as 'str' | 'def'] * 100 });
    }
  }
  // Bare "50/50" rows (no STR/DEF labels): str-first per this file's comment
  // convention — and symmetric in the shipped table, so the pin is
  // interpretation-invariant today. If a row ever becomes asymmetric it must
  // switch to the labeled form (caught by the labeled regex above).
  const bareRow = line.match(/^\s*(Fortress|Raider|Hoarder|Ghost|Balanced):\s*\{[^}]+},\s*\/\/\s*(\d+)\/(\d+)\s*-/);
  if (bareRow && !tableRow) {
    const key = bareRow[1] as CompKey;
    compCells.push({ site: 'ARMY_COMPOSITION table', key: `${key} str%`, documented: Number(bareRow[2]), actual: ARMY_COMPOSITION[key].str * 100 });
    compCells.push({ site: 'ARMY_COMPOSITION table', key: `${key} def%`, documented: Number(bareRow[3]), actual: ARMY_COMPOSITION[key].def * 100 });
  }
}
export const armyCompositionLadder = makeLadder('army composition', 2, compCells);

export const ladders: LadderRow[] = [resourceLadder, defenseLadder, bracketLadder, regenRateLadder, unitCostLadder, buildRateLadder, armyCompositionLadder];
