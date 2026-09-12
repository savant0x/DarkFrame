/**
 * FID-20260912-066 — procedural item name generator contract tests.
 *
 * The generator must be: deterministic under a fixed rand, rarity-differentiated
 * (a Legendary name should read heavier than a Common), collision-light across
 * draws, and mechanically inert (pure string output, no ItemRarity leakage into
 * names since rarity is a separate field).
 */
import { describe, it, expect } from 'vitest';
import {
  generateTradeableItemName,
  generateDiggerName,
  rollRarity,
} from '@/lib/itemNameGenerator';
import { ItemRarity } from '@/types/game.types';

/** Deterministic LCG so every run reproduces the same sequence. */
function makeRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('generateTradeableItemName', () => {
  it('is deterministic under a fixed rand', () => {
    const a = generateTradeableItemName(ItemRarity.Rare, makeRand(42));
    const b = generateTradeableItemName(ItemRarity.Rare, makeRand(42));
    expect(a).toBe(b);
  });

  it('produces varied names across draws (no placeholder regression)', () => {
    const rand = makeRand(7);
    const names = new Set(Array.from({ length: 40 }, () => generateTradeableItemName(ItemRarity.Uncommon, rand)));
    expect(names.size).toBeGreaterThan(20);
    for (const n of names) {
      expect(n).not.toMatch(/Tradeable Item$/); // old placeholder shape
    }
  });

  it('never leaks the raw rarity enum into the name', () => {
    const rand = makeRand(99);
    for (let i = 0; i < 50; i++) {
      const n = generateTradeableItemName(ItemRarity.Epic, rand);
      expect(n).not.toMatch(/epic/i);
    }
  });
});

describe('generateDiggerName', () => {
  it('covers all three digger kinds with kind-specific nouns', () => {
    const rand = makeRand(5);
    const metal = generateDiggerName('metal', ItemRarity.Rare, rand);
    const energy = generateDiggerName('energy', ItemRarity.Rare, rand);
    const universal = generateDiggerName('universal', ItemRarity.Rare, rand);
    expect(metal).not.toBe(energy);
    expect(energy).not.toBe(universal);
    expect(metal).toMatch(/Borehead|Drill|Claw|Ore-Biter/);
    expect(energy).toMatch(/Siphon|Arc-Lance|Flux Drill|Coil Harvester/);
    expect(universal).toMatch(/Rig|Engine|Extractor|Auger/);
  });

  it('Legendary diggers always carry an MK revision', () => {
    const rand = makeRand(11);
    for (let i = 0; i < 20; i++) {
      expect(generateDiggerName('metal', ItemRarity.Legendary, rand)).toMatch(/MK-\d+/);
    }
  });
});

describe('rollRarity', () => {
  it('matches the documented 60/25/10/4/1 curve', () => {
    const rand = makeRand(2024);
    const counts = new Map<ItemRarity, number>();
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const r = rollRarity(rand);
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    const pct = (r: ItemRarity) => ((counts.get(r) ?? 0) / N) * 100;
    expect(pct(ItemRarity.Common)).toBeGreaterThan(58);
    expect(pct(ItemRarity.Common)).toBeLessThan(62);
    expect(pct(ItemRarity.Uncommon)).toBeGreaterThan(23);
    expect(pct(ItemRarity.Uncommon)).toBeLessThan(27);
    expect(pct(ItemRarity.Rare)).toBeGreaterThan(8.5);
    expect(pct(ItemRarity.Rare)).toBeLessThan(11.5);
    expect(pct(ItemRarity.Epic)).toBeGreaterThan(3);
    expect(pct(ItemRarity.Epic)).toBeLessThan(5);
    expect(pct(ItemRarity.Legendary)).toBeGreaterThan(0.5);
    expect(pct(ItemRarity.Legendary)).toBeLessThan(1.5);
  });
});
