/**
 * Ladder-truth gate — the FID-20260915-006a lesson made executable.
 *
 * Documented game-math tables are parsed out of the production source itself
 * and paired with live function/constant output, so:
 *   - a comment edit that drifts from code fails CI (the original sin), and
 *   - a formula change without a doc update fails too.
 *
 * Seven ladders (FID-20260915-007 extended the original three to every
 * documented game-math table):
 *   1. resource multiplier   (botService, 2 sites, 21 cells)
 *   2. base defense          (botService, 2 sites, 14 cells)
 *   3. player level bracket  (botService, 1 site,   7 cells)
 *   4. regeneration rate     (botGrowthEngine + botService, 4 sites, 12 cells)
 *   5. unit cost curve       (game.types, 2 sites, 23 cells)
 *   6. build rate            (botGrowthEngine, 2 sites, 10 cells)
 *   7. army composition      (botGrowthEngine, 2 sites, 20 cells)
 *
 * The scanner (scripts/ladderTruth.ts) executes at import and throws loudly
 * if a documented table disappears or its format changes — the gate cannot
 * silently degrade to zero assertions. Site counts AND cell counts are
 * asserted here (a parser silently skipping a row shape must fail, not
 * shrink). Independent truth spot-pins guard against the scanner lying.
 * Blueprint↔config field parity of the unit roster is pinned separately by
 * __tests__/unit/catalog-unification.test.ts (behavior) — this gate covers
 * the documented claims (docs ↔ code).
 */
import { describe, it, expect } from 'vitest';
import {
  ladders,
  resourceLadder,
  defenseLadder,
  bracketLadder,
  regenRateLadder,
  unitCostLadder,
  buildRateLadder,
  armyCompositionLadder,
} from '@/scripts/ladderTruth';
import {
  getResourceRange,
  getBotDefenseForTier,
  getPlayerLevelBonus,
} from '@/lib/botService';
import { regenerateBotResources, BUILD_RATES, ARMY_COMPOSITION } from '@/lib/botGrowthEngine';
import { BotSpecialization, type Player } from '@/types/game.types';

const EXPECTED_CELLS: Record<string, number> = {
  'resource multiplier': 21,
  'base defense': 14,
  'player level bracket': 7,
  'regeneration rate': 12,
  'unit cost curve': 23,
  'build rate': 10,
  'army composition': 20,
};

describe('ladder truth: documented game-math tables equal code (FID-20260915-006a/-007)', () => {
  it('scanner is alive — all seven ladders found at full expected coverage', () => {
    expect(ladders).toHaveLength(7);
    for (const ladder of ladders) {
      expect(ladder.cellsChecked, `${ladder.ladder} coverage`).toBe(EXPECTED_CELLS[ladder.ladder]);
    }
    // Site-count guards hold (drift-by-deletion protection)
    expect(regenRateLadder.sites).toHaveLength(4);
    expect(unitCostLadder.sites).toHaveLength(2);
    expect(buildRateLadder.sites).toHaveLength(2);
    expect(armyCompositionLadder.sites).toHaveLength(2);
  });

  it('resource multiplier ladder: header table and function comment match getResourceRange', () => {
    expect(resourceLadder.mismatches).toEqual([]);
  });

  it('base defense ladder: header table and function comment match getBotDefenseForTier', () => {
    expect(defenseLadder.mismatches).toEqual([]);
  });

  it('player level-bracket ladder: header table matches getPlayerLevelBonus', () => {
    expect(bracketLadder.mismatches).toEqual([]);
  });

  it('regeneration-rate ladder: rate table, range summaries, and engine agree', () => {
    expect(regenRateLadder.mismatches).toEqual([]);
  });

  it('unit-cost ladder: roster counts, philosophy table, and slot ladder match code', () => {
    expect(unitCostLadder.mismatches).toEqual([]);
  });

  it('build-rate ladder: header intervals and table comments match BUILD_RATES', () => {
    expect(buildRateLadder.mismatches).toEqual([]);
  });

  it('army-composition ladder: header bullets and table comments match ARMY_COMPOSITION', () => {
    expect(armyCompositionLadder.mismatches).toEqual([]);
  });

  it('aggregate: zero drift anywhere (failure lists every offending cell)', () => {
    const bad = ladders.flatMap((l) =>
      l.mismatches.map((m) => `${l.ladder} [${m.site}] ${m.key}: documented ${m.documented} ≠ actual ${m.actual}`)
    );
    expect(bad).toEqual([]);
  });

  // --- Independent truth spot-pins (do not trust the scanner blindly) ---
  it('truth spot-pins: the ladders are what FID-006a/-007 established', () => {
    expect(getBotDefenseForTier(1)).toBe(15);
    expect(getBotDefenseForTier(7)).toBe(2880);
    expect(getResourceRange(BotSpecialization.Hoarder, 1).max).toBe(112500); // 150k × 0.75
    expect(getResourceRange(BotSpecialization.Hoarder, 7).max).toBe(337500); // 150k × 2.25
    expect(getPlayerLevelBonus(5)).toBe(1.0);
    expect(getPlayerLevelBonus(65)).toBe(2.5);
    // regen: Boss's 0.02 entry → 120,000/h on the 6M fixed range (the cell
    // whose existence the "5-20%" falsehood hid)
    const boss = {
      botConfig: { specialization: BotSpecialization.Boss, tier: 1 },
      resources: { metal: 0, energy: 0, food: 0 },
    } as unknown as Player;
    expect(regenerateBotResources(boss).metal).toBe(120_000);
    // build rates: the rounded-reciprocal pairs (0.5 ↔ 2h, 0.67 ↔ 1.5h)
    expect(BUILD_RATES.Fortress).toBe(0.5);
    expect(BUILD_RATES.Ghost).toBe(0.67);
    // composition: Fortress 30/70 wall
    expect(ARMY_COMPOSITION.Fortress).toEqual({ str: 0.3, def: 0.7 });
  });
});
