/**
 * @file __tests__/lib/botArmyCaps.test.ts
 * @overview FID-20260912-061 R1 — pins the full 7-tier army cap ladder.
 *
 * Contract: `getMaxArmySize(tier, ageDays)` = TIER_ARMY_CAPS[tier] × age
 * multiplier, with a defined cap for every tier 1-7. Before R1, tiers 4-7
 * fell back to the Tier 1 cap (20), so endgame-zone bots (T5-T7) were
 * army-capped BELOW tier-3 mid-game bots once the hourly build cycle ran.
 */
import { describe, it, expect } from 'vitest';
import { getMaxArmySize } from '@/lib/botGrowthEngine';

describe('FID-20260912-061 R1: bot army tier caps', () => {
  it('defines a full 7-tier ladder of 20 × tier units (young bot)', () => {
    for (let tier = 1; tier <= 7; tier++) {
      expect(getMaxArmySize(tier, 0)).toBe(20 * tier);
    }
  });

  it('tiers 4-7 no longer fall back to the Tier 1 cap', () => {
    expect(getMaxArmySize(5, 0)).toBe(100);
    expect(getMaxArmySize(7, 0)).toBe(140);
    expect(getMaxArmySize(7, 0)).toBeGreaterThan(getMaxArmySize(3, 0));
  });

  it('age multipliers still apply on top of the tier caps', () => {
    expect(getMaxArmySize(1, 10)).toBe(30);  // veteran 1.5x → floor(20 × 1.5)
    expect(getMaxArmySize(7, 45)).toBe(280); // legendary 2x → floor(140 × 2)
  });

  it('is monotonic across tiers for any fixed age', () => {
    for (const age of [0, 10, 45]) {
      for (let tier = 2; tier <= 7; tier++) {
        expect(getMaxArmySize(tier, age)).toBeGreaterThanOrEqual(
          getMaxArmySize(tier - 1, age)
        );
      }
    }
  });
});
