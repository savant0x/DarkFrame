import { describe, it, expect } from 'vitest';
import { normalizePushOperand } from '@/lib/mongodb';
import { sanitizePlayer } from '@/lib/playerSanitize';

describe('shim $push operand normalization (FID-20260908-003)', () => {
  it('unwraps $each into its elements (Mongo array-operator parity)', () => {
    const units = [{ unitId: 'infantry', strength: 10 }, { unitId: 'infantry', strength: 10 }];
    const operand = { $each: units };
    const result = normalizePushOperand(operand);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ unitId: 'infantry', strength: 10 });
    expect(result[1]).toEqual({ unitId: 'infantry', strength: 10 });
  });

  it('appends a bare object as a single element (legacy behavior preserved)', () => {
    const entry = { amount: -50, reason: 'unit_build' };
    expect(normalizePushOperand(entry)).toEqual([entry]);
  });

  it('appends a bare scalar as a single element', () => {
    expect(normalizePushOperand('flag-bearer')).toEqual(['flag-bearer']);
    expect(normalizePushOperand(42)).toEqual([42]);
  });

  it('treats a plain array operand as ONE element (Mongo would reject it; we append verbatim)', () => {
    const arr = [{ a: 1 }, { b: 2 }];
    const result = normalizePushOperand(arr);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(arr);
  });

  it('does not misread an object that merely HAS an $each-shaped key holding a non-array', () => {
    const impostor = { $each: 'not-an-array' };
    const result = normalizePushOperand(impostor);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(impostor);
  });

  it('handles null operand as a single null element', () => {
    expect(normalizePushOperand(null)).toEqual([null]);
  });
});

describe('sanitizePlayer combat-power fields (FID-20260908-003)', () => {
  const row = {
    username: 'fame',
    password: '$2b$10$HASH',
    totalStrength: 1250,
    totalDefense: 840,
    factoryCount: 1,
  };

  it('projects totalStrength/totalDefense so the client power meters can read them', () => {
    const pub = sanitizePlayer(row)!;
    expect(pub.totalStrength).toBe(1250);
    expect(pub.totalDefense).toBe(840);
    expect(pub.factoryCount).toBe(1);
  });

  it('still drops sensitive fields (allowlist addition did not widen the leak surface)', () => {
    const pub = sanitizePlayer(row)!;
    expect(pub).not.toHaveProperty('password');
    expect(pub).not.toHaveProperty('email');
  });
});
