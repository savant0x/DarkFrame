/**
 * FID-20260915-005 — defeat bookkeeping + growth-clamp contract tests.
 *
 * Two refinements shipped together:
 *   1. Raid defeat bookkeeping zeroes ONLY the stockpile(s) the raid actually
 *      looted (mirroring the FID-038 D4 declared-resource rule). Previously
 *      BOTH vaults were wiped regardless of the declared resource.
 *   2. The growth cycle's 70/20/10 pattern write is clamped to the vault cap
 *      (the regen step's clamp) — previously growth wrote up to cap × 1.15
 *      and the stored vault idled above cap until the next tick.
 *
 * The route logic is mirrored locally (raidLogFidelity pattern): these tests
 * pin the CONTRACT so a regression that reintroduces zero-both or over-cap
 * growth writes fails loudly in review.
 */
import { describe, it, expect } from 'vitest';
import { nextGrownVault } from '@/lib/botGrowthEngine';

// ---- mirrored route logic (app/api/combat/attack/route.ts) ------------------

/** Loot per resource: declared resource only (both when undeclared), capped. */
function routeLoot(
  base: { metal: number; energy: number },
  opts: { resource?: 'metal' | 'energy'; multiplier: number; cap: number }
): { lootMetal: number; lootEnergy: number } {
  const lootMetal = opts.resource && opts.resource !== 'metal' ? 0 : Math.floor(Math.min(base.metal, opts.cap) * opts.multiplier);
  const lootEnergy = opts.resource && opts.resource !== 'energy' ? 0 : Math.floor(Math.min(base.energy, opts.cap) * opts.multiplier);
  return { lootMetal, lootEnergy };
}

/** Defeat bookkeeping write (the fix under test): zero only what was looted. */
function defeatWrites(
  base: { metal: number; energy: number },
  loot: { lootMetal: number; lootEnergy: number }
): { resourcesMetal: number; resourcesEnergy: number } {
  return {
    resourcesMetal: loot.lootMetal > 0 ? 0 : base.metal,
    resourcesEnergy: loot.lootEnergy > 0 ? 0 : base.energy,
  };
}

describe('defeat bookkeeping zeroes only the looted stockpile (FID-20260915-005)', () => {
  const base = { metal: 200_000, energy: 150_000 };
  const cap = 225_000; // hoarder T1: 2 × 112,500

  it('declared-metal raid: metal zeroed, energy preserved', () => {
    const loot = routeLoot(base, { resource: 'metal', multiplier: 1, cap });
    expect(loot.lootMetal).toBe(200_000);
    expect(loot.lootEnergy).toBe(0);
    expect(defeatWrites(base, loot)).toEqual({ resourcesMetal: 0, resourcesEnergy: 150_000 });
  });

  it('declared-energy raid: energy zeroed, metal preserved', () => {
    const loot = routeLoot(base, { resource: 'energy', multiplier: 1, cap });
    expect(loot.lootMetal).toBe(0);
    expect(loot.lootEnergy).toBe(150_000);
    expect(defeatWrites(base, loot)).toEqual({ resourcesMetal: 200_000, resourcesEnergy: 0 });
  });

  it('undeclared raid (legacy loot-both): both zeroed', () => {
    const loot = routeLoot(base, { multiplier: 1, cap });
    expect(defeatWrites(base, loot)).toEqual({ resourcesMetal: 0, resourcesEnergy: 0 });
  });

  it('over-cap vault: capped loot still zeroes the raided stockpile', () => {
    const rich = { metal: 1_500_000_000, energy: 0 };
    const loot = routeLoot(rich, { resource: 'metal', multiplier: 3, cap });
    expect(loot.lootMetal).toBe(cap * 3); // capped payout, not the vault
    expect(defeatWrites(rich, loot)).toEqual({ resourcesMetal: 0, resourcesEnergy: 0 });
  });

  it('empty stockpile: loot 0 preserves (no phantom write)', () => {
    const empty = { metal: 0, energy: 150_000 };
    const loot = routeLoot(empty, { resource: 'metal', multiplier: 3, cap });
    expect(loot.lootMetal).toBe(0);
    expect(defeatWrites(empty, loot)).toEqual({ resourcesMetal: 0, resourcesEnergy: 150_000 });
  });
});

describe('growth write clamps to the vault cap (FID-20260915-005)', () => {
  const CAP = 225_000;

  it('grown below cap: writes the grown value', () => {
    expect(nextGrownVault(210_000, 200_000, CAP)).toBe(210_000);
  });

  it('growth-cycle over-cap case: clamp applies via the regenerated-below-cap shape', () => {
    // Real cycle: regen clamps to CAP, growth ×1.15 over-caps, clamp returns
    // the capped value — BUT the cycle then compares against `regenerated`.
    // When regenerated already sits AT cap, the clamped value equals it and
    // the write is correctly skipped (null). The clamped write only fires
    // when the regenerated base was below cap (e.g. a 70%-roll shrink tick).
    expect(nextGrownVault(Math.floor(180_000 * 1.15), 180_000, CAP)).toBe(206_999); // float: 207000 − ε
    expect(nextGrownVault(Math.floor(CAP * 1.15), CAP, CAP)).toBeNull();
  });

  it('grown equals regenerated: null (cycle skips the no-op write)', () => {
    expect(nextGrownVault(200_000, 200_000, CAP)).toBeNull();
  });

  it('grown below regenerated (10% shrink): still writes the decrease', () => {
    expect(nextGrownVault(190_000, 200_000, CAP)).toBe(190_000);
  });

  it('exact-cap growth: null (no-op, not an over-cap write)', () => {
    expect(nextGrownVault(CAP, CAP, CAP)).toBeNull();
  });
});
