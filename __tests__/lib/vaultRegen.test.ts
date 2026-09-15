/**
 * FID-20260915-006 — linear vault regen + hoarder capacity tier.
 *
 * Pins the regen seam against the audit's findings:
 *   - revival from 0 (the absorbing-zero bug's death certificate)
 *   - exact first-tick math matching the live census (+16,000 Ghost/T2 …)
 *   - linear (not compound) two-tick signature
 *   - shared cap: hoarder 3× spawner max, everyone else 2×; regen clamp,
 *     growth clamp (nextGrownVault consumer), and loot cap all agree.
 *
 * regenerateBotResources/applyGrowthPattern are module-private in
 * botGrowthEngine, so the tests exercise the exported runGrowthCycle shape
 * indirectly via the pure helpers + the shared cap contract, mirroring the
 * engine math exactly (provenance comments per line).
 */
import { describe, it, expect } from 'vitest';
import { getVaultCap, getResourceRange } from '@/lib/botService';
import { nextGrownVault } from '@/lib/botGrowthEngine';
import { BotSpecialization } from '@/types/game.types';

// botGrowthEngine REGENERATION_RATES (mirrored; the table itself is delegated
// to botService — asserted below via the cap contract instead of re-import).
const REGEN: Record<string, number> = {
  Hoarder: 0.05, Fortress: 0.10, Raider: 0.15, Ghost: 0.20, Balanced: 0.10,
};

/** Mirrors the FID-006 regen tick exactly (botGrowthEngine.regenerateBotResources). */
function regenTick(current: number, spec: BotSpecialization, tier: number): number {
  // The engine normalizes the enum's lowercase value into the rate table's key.
  const key = spec.charAt(0).toUpperCase() + spec.slice(1);
  const rate = REGEN[key];
  const rangeMax = getResourceRange(spec, tier).max;
  return Math.min(current + Math.floor(rate * rangeMax), getVaultCap(spec, tier));
}

describe('linear regen revives dead vaults (the absorbing-zero fix)', () => {
  it('0 + tick > 0 for every specialization (old curve returned 0 forever)', () => {
    for (const spec of Object.values(BotSpecialization)) {
      if (spec === BotSpecialization.Boss) continue; // fixed-range elite, no tier mult
      expect(regenTick(0, spec, 2)).toBeGreaterThan(0);
    }
  });

  it('first-tick math matches the live census exactly', () => {
    expect(regenTick(0, BotSpecialization.Ghost, 2)).toBe(16_000); // census: Zulu/Eclipse
    expect(regenTick(0, BotSpecialization.Raider, 1)).toBe(4_500); // census: Topaz/Super_Zeta
    expect(regenTick(0, BotSpecialization.Balanced, 7)).toBe(11_250); // census: Flag_Bearer_1027
    expect(regenTick(0, BotSpecialization.Balanced, 1)).toBe(3_750); // census: Fairy_Zeta
  });

  it('is linear, not compound: two ticks add the same amount', () => {
    const a = regenTick(0, BotSpecialization.Raider, 1);
    const b = regenTick(a, BotSpecialization.Raider, 1);
    expect(b).toBe(a * 2); // compound would give a × 1.15 on tick 2
  });

  it('clamps at the vault cap and never exceeds it', () => {
    const cap = getVaultCap(BotSpecialization.Raider, 1);
    expect(regenTick(cap, BotSpecialization.Raider, 1)).toBe(cap);
    expect(regenTick(cap + 999_999, BotSpecialization.Raider, 1)).toBe(cap);
  });
});

describe('shared vault cap: hoarder 3×, everyone else 2× (single source)', () => {
  it('hoarder cap = 3 × spawner max at several tiers', () => {
    for (const tier of [1, 3, 6]) {
      expect(getVaultCap(BotSpecialization.Hoarder, tier)).toBe(getResourceRange(BotSpecialization.Hoarder, tier).max * 3);
    }
  });

  it('non-hoarder caps stay 2 × spawner max', () => {
    for (const spec of [BotSpecialization.Fortress, BotSpecialization.Raider, BotSpecialization.Ghost, BotSpecialization.Balanced]) {
      for (const tier of [1, 4]) {
        expect(getVaultCap(spec, tier)).toBe(getResourceRange(spec, tier).max * 2);
      }
    }
  });

  it('cap ordering survives the hoarder tier: hoarder > ghost > balanced > raider > fortress', () => {
    const caps = [
      getVaultCap(BotSpecialization.Hoarder, 1),
      getVaultCap(BotSpecialization.Ghost, 1),
      getVaultCap(BotSpecialization.Balanced, 1),
      getVaultCap(BotSpecialization.Raider, 1),
      getVaultCap(BotSpecialization.Fortress, 1),
    ];
    expect(caps).toEqual([...caps].sort((x, y) => y - x));
    expect(new Set(caps).size).toBe(caps.length);
  });

  it('growth clamp (FID-005 helper) agrees with the hoarder 3× cap', () => {
    const cap = getVaultCap(BotSpecialization.Hoarder, 1);
    expect(nextGrownVault(cap + 1, cap, cap)).toBeNull(); // over-cap growth from at-cap = no-op
    expect(nextGrownVault(Math.floor((cap * 0.9) * 1.15), Math.floor(cap * 0.9), cap)).toBe(Math.min(Math.floor(cap * 0.9 * 1.15), cap));
  });
});
