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
import { BotSpecialization } from '@/types/game.types';

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

export const ladders: LadderRow[] = [resourceLadder, defenseLadder, bracketLadder];
