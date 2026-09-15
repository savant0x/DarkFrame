/**
 * Ladder-truth gate — the FID-20260915-006a lesson made executable.
 *
 * The bot tier ladders drifted for months because the documented tables lived
 * only in comments while the truth lived in formulas; nothing ever EXECUTED
 * the comments. This gate parses the documented ladders out of
 * `lib/botService.ts` itself and asserts each documented value equals the
 * live function output, so:
 *   - a comment edit that drifts from code fails CI (the original sin), and
 *   - a formula change without a doc update fails too.
 *
 * The scanner (scripts/ladderTruth.ts) executes at import and throws loudly
 * if a documented table disappears or its format changes — the gate cannot
 * silently degrade to zero assertions. Independent truth spot-pins below
 * guard against the scanner itself lying.
 */
import { describe, it, expect } from 'vitest';
import {
  ladders,
  resourceLadder,
  defenseLadder,
  bracketLadder,
} from '@/scripts/ladderTruth';
import {
  getResourceRange,
  getBotDefenseForTier,
  getPlayerLevelBonus,
} from '@/lib/botService';
import { BotSpecialization } from '@/types/game.types';

describe('ladder truth: documented tier tables equal code (FID-20260915-006a lesson)', () => {
  it('scanner is alive — all three ladders found with full expected coverage', () => {
    expect(ladders).toHaveLength(3);
    // Resource: 7 header tiers × 2 specs + 7 function-comment tiers = 21.
    // Defense: 7 × 2 sites = 14. Brackets: 7 rows × 1 site.
    expect(resourceLadder.cellsChecked).toBe(21);
    expect(defenseLadder.cellsChecked).toBe(14);
    expect(bracketLadder.cellsChecked).toBe(7);
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

  it('aggregate: zero drift anywhere (failure lists every offending cell)', () => {
    const bad = ladders.flatMap((l) =>
      l.mismatches.map((m) => `${l.ladder} [${m.site}] ${m.key}: documented ${m.documented} ≠ actual ${m.actual}`)
    );
    expect(bad).toEqual([]);
  });

  // --- Independent truth spot-pins (do not trust the scanner blindly) ---
  it('truth spot-pins: the ladders are what FID-20260915-006a established', () => {
    expect(getBotDefenseForTier(1)).toBe(15);
    expect(getBotDefenseForTier(7)).toBe(2880);
    expect(getResourceRange(BotSpecialization.Hoarder, 1).max).toBe(112500); // 150k × 0.75
    expect(getResourceRange(BotSpecialization.Hoarder, 7).max).toBe(337500); // 150k × 2.25
    expect(getPlayerLevelBonus(5)).toBe(1.0);
    expect(getPlayerLevelBonus(65)).toBe(2.5);
  });
});
