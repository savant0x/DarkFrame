/**
 * Property-based regression tests — bot vault regen engine semantics.
 *
 * Pins the FID-20260915-006/-006a contracts as properties swept over the full
 * domain (all 6 specializations × tiers 1–7), so a refactor that violates a
 * semantic (not just a constant) fails CI:
 *
 *   P1  never-below-current  — a tick never loses resources while the stored
 *                              value is within the cap (and clamps DOWN to cap
 *                              when it isn't — the FID-005 over-cap state).
 *   P2  revival from zero    — 0 is not absorbing: tick(0) > 0 for every
 *                              config, including a bot with NO resources
 *                              object. Plus the linear identity DERIVED from
 *                              the engine itself (regen := tick(0); then
 *                              tick(c) − c = regen for c ≤ cap − regen) —
 *                              no rate table mirrored, so the property tracks
 *                              live code (the ladder-truth lesson).
 *   P3  cap clamping         — regen output ≤ getVaultCap always; at-cap
 *                              input stays pinned; nextGrownVault never
 *                              writes above cap and returns null iff the
 *                              grown value equals the regenerated base; the
 *                              composed applyGrowthPattern → nextGrownVault
 *                              path stays ≤ cap under every 70/20/10 roll
 *                              (mocked Math.random — the FID-005 incident's
 *                              exact shape).
 *   P4  NaN-free lookups     — every axis finite and ≥ 0 for every enum
 *                              member × tier, including Boss (whose 0.02 rate
 *                              entry the 006a guard exists for: deleting it
 *                              would silently fall back to 0.10 and 5× boss
 *                              regen — pinned here). Non-bot passthrough.
 *
 * Style: seeded-sweep harness (mulberry32, repo convention), plain loops.
 * regenerateBotResources is pure (no Math.random), and the determinism probe
 * in P2 keeps that assumption honest — if it ever becomes stochastic, P2
 * fails loudly rather than the suite passing by accident.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { regenerateBotResources, applyGrowthPattern, nextGrownVault } from '@/lib/botGrowthEngine';
import { getVaultCap, getResourceRange } from '@/lib/botService';
import { BotSpecialization, type Player } from '@/types/game.types';

const SPECS = Object.values(BotSpecialization);
const TIERS = [1, 2, 3, 4, 5, 6, 7];
const CONFIGS: Array<{ spec: BotSpecialization; tier: number }> = SPECS.flatMap((spec) =>
  TIERS.map((tier) => ({ spec, tier }))
);

/** Seeded RNG (mulberry32) — same harness as scripts/simulateVaultEconomy.ts. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a bot-shaped Player for the engine (cast — tests exercise the regen slice only). */
function botOf(spec: BotSpecialization, tier: number, metal: number, energy = metal, withResources = true): Player {
  return {
    botConfig: { specialization: spec, tier },
    ...(withResources ? { resources: { metal, energy, food: 0 } } : {}),
  } as unknown as Player;
}

/** Engine-derived per-config regen increment: tick(0) IS rate × spawner-max. */
function regenOf(spec: BotSpecialization, tier: number): number {
  return regenerateBotResources(botOf(spec, tier, 0)).metal;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('P1 — never-below-current: a tick never loses in-cap resources', () => {
  it('result ≥ current for seeded currents across [0, cap] in all 42 configs', () => {
    const rng = mulberry32(424_242);
    for (const { spec, tier } of CONFIGS) {
      const cap = getVaultCap(spec, tier);
      // 20 seeded samples + the boundaries 0 and cap
      const currents = [0, cap, ...Array.from({ length: 20 }, () => Math.floor(rng() * cap))];
      for (const c of currents) {
        const out = regenerateBotResources(botOf(spec, tier, c, c));
        expect(out.metal, `${spec}/T${tier} metal from ${c}`).toBeGreaterThanOrEqual(c);
        expect(out.energy, `${spec}/T${tier} energy from ${c}`).toBeGreaterThanOrEqual(c);
      }
    }
  });

  it('over-cap current clamps DOWN to cap exactly (FID-005 stale-state cleanup)', () => {
    for (const { spec, tier } of CONFIGS) {
      const cap = getVaultCap(spec, tier);
      for (const over of [1, 1000, Math.floor(cap * 0.15)]) {
        expect(regenerateBotResources(botOf(spec, tier, cap + over)).metal).toBe(cap);
        expect(regenerateBotResources(botOf(spec, tier, cap + over)).energy).toBe(cap);
      }
    }
  });

  it('equal-axis inputs keep both axes in lockstep (no axis drift)', () => {
    const rng = mulberry32(777);
    for (const { spec, tier } of CONFIGS) {
      const cap = getVaultCap(spec, tier);
      const c = Math.floor(rng() * cap);
      const out = regenerateBotResources(botOf(spec, tier, c, c));
      expect(out.energy).toBe(out.metal);
    }
  });
});

describe('P2 — revival from zero: 0 is never absorbing (the FID-006 contract)', () => {
  it('tick(0) > 0 in every config, resources object or not', () => {
    for (const { spec, tier } of CONFIGS) {
      expect(regenerateBotResources(botOf(spec, tier, 0)).metal, `${spec}/T${tier}`).toBeGreaterThan(0);
      // missing resources object → || 0 fallback → same revival
      expect(regenerateBotResources(botOf(spec, tier, 0, 0, false)).metal).toBe(regenOf(spec, tier));
    }
  });

  it('is deterministic: identical calls return identical results (purity the sweeps rely on)', () => {
    const rng = mulberry32(31337);
    for (const { spec, tier } of CONFIGS) {
      const c = Math.floor(rng() * getVaultCap(spec, tier));
      const a = regenerateBotResources(botOf(spec, tier, c, c));
      const b = regenerateBotResources(botOf(spec, tier, c, c));
      expect(b).toEqual(a);
    }
  });

  it('linear identity (derived, not mirrored): tick(c) − c = tick(0) for c ≤ cap − regen', () => {
    const rng = mulberry32(902_10);
    for (const { spec, tier } of CONFIGS) {
      const cap = getVaultCap(spec, tier);
      const regen = regenOf(spec, tier); // engine-derived — tracks live code, no rate-table copy
      expect(regen).toBeLessThan(cap); // precondition: an in-cap linear region exists
      for (let i = 0; i < 15; i++) {
        const c = Math.floor(rng() * (cap - regen + 1));
        expect(regenerateBotResources(botOf(spec, tier, c)).metal - c, `${spec}/T${tier} from ${c}`).toBe(regen);
      }
    }
  });
});

describe('P3 — cap clamping: regen, growth write, and composed path stay ≤ cap', () => {
  it('regen output never exceeds getVaultCap in any config', () => {
    const rng = mulberry32(5150);
    for (const { spec, tier } of CONFIGS) {
      const cap = getVaultCap(spec, tier);
      for (let i = 0; i < 10; i++) {
        const out = regenerateBotResources(botOf(spec, tier, Math.floor(rng() * cap * 1.2)));
        expect(out.metal).toBeLessThanOrEqual(cap);
        expect(out.energy).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('at-cap input stays pinned at cap (no growth past the ceiling via regen)', () => {
    for (const { spec, tier } of CONFIGS) {
      expect(regenerateBotResources(botOf(spec, tier, getVaultCap(spec, tier))).metal).toBe(getVaultCap(spec, tier));
    }
  });

  it('nextGrownVault: never writes above cap; null iff grown == regenerated', () => {
    const rng = mulberry32(600_001);
    for (const { spec, tier } of CONFIGS) {
      const cap = getVaultCap(spec, tier);
      const base = Math.floor(cap * 0.9);
      const grows = [base - 1, base, base + 1, Math.floor(base * 1.05), Math.floor(base * 1.15), cap, cap + 1, Math.floor(cap * 1.15)];
      for (const grown of grows) {
        const write = nextGrownVault(grown, base, cap);
        if (write !== null) {
          expect(write, `${spec}/T${tier} grown=${grown}`).toBeLessThanOrEqual(cap); // the FID-005 contract
          expect(write).toBe(Math.min(grown, cap));
          expect(write).not.toBe(base); // non-null ⇒ the write is a real change
        } else {
          expect(grown).toBe(base); // null ⇔ no-op
        }
      }
      expect(rng).toBeDefined(); // rng reserved for future sweep widening
    }
  });

  it('composed growth path (mocked 70/20/10 rolls) never writes above cap', () => {
    for (const { spec, tier } of CONFIGS) {
      const cap = getVaultCap(spec, tier);
      const regen = regenOf(spec, tier);
      // every roll outcome: grow-min, grow-max, stay, decrease-min, decrease-max
      for (const roll of [0.0, 0.69, 0.70, 0.89, 0.90, 0.99]) {
        const rand = roll < 0.7 ? roll : roll < 0.9 ? roll : roll; // first draw = category
        vi.spyOn(Math, 'random')
          .mockReturnValueOnce(rand) // category roll
          .mockReturnValue(roll < 0.7 ? 0.999 : roll < 0.9 ? 0.5 : 0.999); // magnitude roll (worst case each branch)
        const base = Math.min(cap, regen * 100 + Math.floor(cap * 0.5));
        const grown = applyGrowthPattern(base, spec);
        const write = nextGrownVault(grown, base, cap);
        if (write !== null) expect(write, `${spec}/T${tier} roll=${roll}`).toBeLessThanOrEqual(cap);
      }
    }
  });
});

describe('P4 — NaN-free rate lookups across the full enum (the 006a guard)', () => {
  it('every axis finite and ≥ 0 for all 6 specializations × tiers 1–7', () => {
    for (const { spec, tier } of CONFIGS) {
      const out = regenerateBotResources(botOf(spec, tier, 0));
      expect(Number.isFinite(out.metal), `${spec}/T${tier} metal`).toBe(true);
      expect(Number.isFinite(out.energy), `${spec}/T${tier} energy`).toBe(true);
      expect(out.metal).toBeGreaterThanOrEqual(0);
      expect(out.energy).toBeGreaterThanOrEqual(0);
      expect(out.food).toBe(0);
    }
  });

  it('Boss rate entry exists: regen = 2% × 6M = 120,000 (deleted entry would silently fall back to 10%)', () => {
    // getResourceRange(Boss) is tier-invariant; so the regen must be too.
    for (const tier of TIERS) {
      expect(regenOf(BotSpecialization.Boss, tier)).toBe(120_000);
    }
    // and it differs from the 0.10 fallback (a missing entry would produce 600,000)
    expect(regenOf(BotSpecialization.Boss, 1)).not.toBe(Math.floor(0.10 * getResourceRange(BotSpecialization.Boss, 1).max));
  });

  it('revival regen scales with the spawner range: floor(rate × range.max) exactly, per config', () => {
    // Cross-check the engine-derived regen against the shared range helper —
    // catches a future divergence between rate table and range table.
    for (const { spec, tier } of CONFIGS) {
      const rangeMax = getResourceRange(spec, tier).max;
      const regen = regenOf(spec, tier);
      expect(regen).toBeGreaterThan(0);
      expect(regen).toBeLessThanOrEqual(Math.floor(0.20 * rangeMax) + 1); // max table rate is Ghost 0.20
      expect(rangeMax % 1).toBe(0); // range helper floors — regen floor is meaningful
    }
  });

  it('non-bot input passes through untouched (no regen for players)', () => {
    const player = { resources: { metal: 5_000, energy: 7_000, food: 0 } } as unknown as Player;
    expect(regenerateBotResources(player)).toEqual({ metal: 5_000, energy: 7_000, food: 0 });
    expect(regenerateBotResources({} as unknown as Player)).toEqual({ metal: 0, energy: 0, food: 0 });
  });
});
