/**
 * @file __tests__/lib/dailyLoginStreak.test.ts
 * @overview Unit pins for the daily-login streak-bonus curve
 * (operator-accepted design: +10/day beyond day 1, +70 cap at day 8+).
 *
 * Contract under test (lib/dailyLoginService.ts `calculateStreakBonus`):
 *  - Day 1 pays no bonus; bonus grows +10 per consecutive day.
 *  - The +70 cap binds from streak day 8 and never exceeds it.
 *  - Non-positive / non-finite inputs pay zero (no negative bonuses).
 */
import { describe, it, expect } from 'vitest';

import { calculateStreakBonus } from '@/lib/dailyLoginService';

describe('calculateStreakBonus', () => {
  it('pays zero bonus on day 1', () => {
    expect(calculateStreakBonus(1)).toBe(0);
  });

  it('ramps +10 per day through the first week', () => {
    expect(calculateStreakBonus(2)).toBe(10);
    expect(calculateStreakBonus(3)).toBe(20);
    expect(calculateStreakBonus(7)).toBe(60);
  });

  it('caps at +70 from streak day 8, unbounded above', () => {
    expect(calculateStreakBonus(8)).toBe(70);
    expect(calculateStreakBonus(30)).toBe(70);
    expect(calculateStreakBonus(365)).toBe(70);
  });

  it('floors fractional streaks and rejects junk input', () => {
    expect(calculateStreakBonus(2.9)).toBe(10);
    expect(calculateStreakBonus(0)).toBe(0);
    expect(calculateStreakBonus(-4)).toBe(0);
    expect(calculateStreakBonus(Number.NaN)).toBe(0);
    expect(calculateStreakBonus(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
