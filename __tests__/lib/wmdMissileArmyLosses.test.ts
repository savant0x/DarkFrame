// @vitest-environment node
/**
 * @file __tests__/lib/wmdMissileArmyLosses.test.ts
 * @overview FID-20261002-006 §5 acceptance — unit pins for the
 *           representation-independent proportional-loss engine
 *           (`applyProportionalUnitLosses` in lib/wmd/jobs/missileTracker.ts).
 *
 * The RED defect (R11): WMD floored `quantity × fraction` PER STACK, so a
 * 100-singleton army lost ZERO units where one 100-stack lost 17, and cached
 * army totals were left stale. These pins establish the corrected contract:
 *
 *  - Equivalent singleton/stack/partitioned/reordered armies lose the SAME
 *    number of units and the same total power (deaths depend on the group's
 *    total quantity, never on its representation).
 *  - The fraction is normalized to [0,1] AFTER critical/share math — 0% is a
 *    no-op, 100% is a total wipe, over-100% clamps to a total wipe.
 *  - Heterogeneous per-copy stats stay distinct groups (tier weighting
 *    preserved); removals distribute across a group's entries in stable
 *    instance order; splitting/merging equivalent stacks cannot alter losses.
 *  - Survivors keep instance identity/metadata and positive integral
 *    quantities; zero-quantity remnants are removed.
 *  - Corrupt arrays (non-integer/negative quantities, non-finite stats, NaN
 *    fraction) fail explicitly through ArmyIntegrityError — assets are never
 *    silently dropped.
 *
 * The transactional/claim/rollback behavior is pinned separately on a real
 * disposable PostgreSQL (__tests__/lib/wmdMissileArmyDamage.integration.test.ts).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/websocket/server', () => ({ getIO: () => null }));
vi.mock('@/lib/websocket/handlers', () => ({
  wmdHandlers: { broadcastMissileImpact: async () => {} },
}));

import {
  applyProportionalUnitLosses,
  ArmyIntegrityError,
} from '@/lib/wmd/jobs/missileTracker';
import type { PlayerUnit } from '@/types/game.types';

function singleton(id: string, opts: { strength?: number; defense?: number; quantity?: number; unitId?: string; name?: string } = {}): PlayerUnit {
  return {
    id,
    unitId: opts.unitId ?? 'titan',
    unitType: opts.unitId === 'rifleman' ? ('Rifleman' as never) : ('Titan' as never),
    name: opts.name ?? (opts.unitId === 'rifleman' ? 'Rifleman' : 'Titan'),
    category: 'STR',
    rarity: 'epic',
    strength: opts.strength ?? 100,
    defense: opts.defense ?? 50,
    quantity: opts.quantity ?? 1,
    createdAt: new Date('2026-10-01T00:00:00Z'),
  } as PlayerUnit;
}

const powerOf = (units: PlayerUnit[]) =>
  units.reduce((s, u) => s + u.strength * u.quantity, 0);

describe('FID-20261002-006 — representation-independent proportional unit losses', () => {
  it('singleton, stacked, partitioned and reordered armies of the same 100 units lose IDENTICAL deaths and power at a fractional effect', () => {
    const fraction = 0.17; // 17% of the army (TACTICAL-class effect)

    const singletons = Array.from({ length: 100 }, (_, i) => singleton(`S${i}`));
    const stacked = [singleton('STACK', { quantity: 100 })];
    const partitioned = [
      singleton('P1', { quantity: 40 }),
      singleton('P2', { quantity: 30 }),
      singleton('P3', { quantity: 30 }),
    ];
    const reordered = [partitioned[2], partitioned[0], partitioned[1]];

    const a = applyProportionalUnitLosses(singletons, fraction);
    const b = applyProportionalUnitLosses(stacked, fraction);
    const c = applyProportionalUnitLosses(partitioned, fraction);
    const d = applyProportionalUnitLosses(reordered, fraction);

    // floor(100 × 0.17) = 17 regardless of representation (the RED behavior
    // destroyed 0 of 100 singletons).
    expect(a.destroyed).toBe(17);
    expect(b.destroyed).toBe(17);
    expect(c.destroyed).toBe(17);
    expect(d.destroyed).toBe(17);

    const survivingPower = 83 * 100;
    expect(powerOf(a.survivors)).toBe(survivingPower);
    expect(powerOf(b.survivors)).toBe(survivingPower);
    expect(powerOf(c.survivors)).toBe(survivingPower);
    expect(powerOf(d.survivors)).toBe(survivingPower);

    // Survivors stay integral and nonnegative in every representation.
    for (const result of [a, b, c, d]) {
      for (const u of result.survivors) {
        expect(Number.isInteger(u.quantity)).toBe(true);
        expect(u.quantity).toBeGreaterThan(0);
      }
    }
  });

  it('0% effect is a no-op that returns the army untouched; 100% destroys everything; over-100% clamps to a total wipe', () => {
    const army = [singleton('A', { quantity: 7 }), singleton('B', { quantity: 3, unitId: 'rifleman' })];

    const zero = applyProportionalUnitLosses(army, 0);
    expect(zero.destroyed).toBe(0);
    expect(zero.survivors).toHaveLength(2);
    expect(zero.survivors[0]).toMatchObject({ id: 'A', quantity: 7, createdAt: army[0].createdAt });

    const all = applyProportionalUnitLosses(army, 1);
    expect(all.destroyed).toBe(10);
    expect(all.survivors).toHaveLength(0);

    const over = applyProportionalUnitLosses(army, 1.5); // over-100% critical effect
    expect(over.destroyed).toBe(10);
    expect(over.survivors).toHaveLength(0);
  });

  it('heterogeneous per-copy stats stay distinct groups — tier weighting is preserved', () => {
    const army = [
      singleton(`T1`, { quantity: 10, strength: 5, unitId: 'rifleman', name: 'Rifleman' }),   // 50 power
      singleton(`T2`, { quantity: 4, strength: 500, unitId: 'titan', name: 'Titan' }),        // 2000 power
    ];

    const result = applyProportionalUnitLosses(army, 0.5);
    // floor(10×0.5) = 5 riflemen, floor(4×0.5) = 2 titans — a count-only or
    // unweighted aggregate could not produce this split.
    expect(result.destroyed).toBe(7);
    const survivors = result.survivors;
    expect(survivors.find((u) => u.unitId === 'rifleman')!.quantity).toBe(5);
    expect(survivors.find((u) => u.unitId === 'titan')!.quantity).toBe(2);
    expect(powerOf(survivors)).toBe(5 * 5 + 2 * 500);
  });

  it('removals distribute across a group in stable instance order; zero-quantity remnants are removed; identity/metadata survive', () => {
    const army = [
      singleton('G1', { quantity: 3 }),
      singleton('G2', { quantity: 3 }),
      singleton('G3', { quantity: 4 }),
    ];

    const result = applyProportionalUnitLosses(army, 0.5); // group total 10 → 5 destroyed
    expect(result.destroyed).toBe(5);
    // Stable order: G1 drains fully (removed), G2 loses 2, G3 untouched.
    expect(result.survivors.map((u) => u.id)).toEqual(['G2', 'G3']);
    expect(result.survivors.find((u) => u.id === 'G2')!.quantity).toBe(1);
    expect(result.survivors.find((u) => u.id === 'G3')!.quantity).toBe(4);
    // Metadata/identity preserved on survivors.
    const g2 = result.survivors.find((u) => u.id === 'G2')!;
    expect(g2.unitId).toBe('titan');
    expect(g2.strength).toBe(100);
    expect(g2.createdAt).toEqual(army[1].createdAt);
  });

  it('splitting or merging equivalent stacks cannot alter deaths or surviving power', () => {
    const fraction = 0.35;
    const merged = applyProportionalUnitLosses([singleton('M', { quantity: 10 })], fraction);
    const split = applyProportionalUnitLosses(
      [singleton('X', { quantity: 4 }), singleton('Y', { quantity: 6 })],
      fraction
    );
    expect(merged.destroyed).toBe(split.destroyed);
    expect(merged.destroyed).toBe(3); // floor(10 × 0.35), once per group
    expect(powerOf(merged.survivors)).toBe(powerOf(split.survivors));
    expect(split.survivors.map((u) => u.quantity).sort()).toEqual([1, 6]); // 4−3 then 6
  });

  it('corrupt quantities and stats fail explicitly through ArmyIntegrityError — never silently dropped', () => {
    const fraction = 0.5;
    expect(() => applyProportionalUnitLosses([singleton('Z', { quantity: 0 })], fraction)).toThrow(ArmyIntegrityError);
    expect(() => applyProportionalUnitLosses([singleton('N', { quantity: -5 })], fraction)).toThrow(ArmyIntegrityError);
    expect(() => applyProportionalUnitLosses(
      [{ ...singleton('F'), quantity: 2.5 }],
      fraction
    )).toThrow(ArmyIntegrityError);
    expect(() => applyProportionalUnitLosses(
      [{ ...singleton('S'), strength: Number.NaN }],
      fraction
    )).toThrow(ArmyIntegrityError);
    expect(() => applyProportionalUnitLosses([singleton('D', { defense: Number.NaN })], fraction)).toThrow(ArmyIntegrityError);
    expect(() => applyProportionalUnitLosses([singleton('OK')], Number.NaN)).toThrow(ArmyIntegrityError);

    // The empty army is legitimate, not corrupt.
    expect(applyProportionalUnitLosses([], fraction)).toEqual({ survivors: [], destroyed: 0 });
  });
});
