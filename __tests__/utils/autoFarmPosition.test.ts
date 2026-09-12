/**
 * @file __tests__/utils/autoFarmPosition.test.ts
 * @overview FID-20260912-063 — pins extractMovePosition against the real
 * /api/move envelope (measured live from the running server) and every
 * serialization-drift shape that previously produced the `{}` incident.
 */
import { describe, it, expect } from 'vitest';
import { extractMovePosition } from '@/utils/autoFarmEngine';

describe('FID-20260912-063: move position extraction', () => {
  it('reads the canonical envelope (measured live shape)', () => {
    const payload = {
      success: true,
      data: {
        player: {
          username: 'smoketest1',
          baseX: 43,
          baseY: 45,
          currentPosition: { x: 44, y: 45 },
          currentPositionX: 44,
          currentPositionY: 45,
          resources: { metal: 0, energy: 0 },
        },
        currentTile: { x: 44, y: 45, terrain: 'Metal' },
      },
    };
    expect(extractMovePosition(payload)).toEqual({ x: 44, y: 45 });
  });

  it('falls through truthy-but-empty currentPosition (the live {} incident)', () => {
    const payload = {
      success: true,
      data: { player: { currentPosition: {}, currentPositionX: 12, currentPositionY: 30 } },
    };
    expect(extractMovePosition(payload)).toEqual({ x: 12, y: 30 });
  });

  it('falls through NaN/garbage nested positions to valid fallbacks', () => {
    expect(
      extractMovePosition({
        data: { player: { currentPosition: { x: NaN, y: 3 } }, newPosition: { x: 7, y: 8 } },
      })
    ).toEqual({ x: 7, y: 8 });
  });

  it('supports legacy envelopes', () => {
    expect(extractMovePosition({ player: { currentPosition: { x: 1, y: 2 } } })).toEqual({ x: 1, y: 2 });
    expect(extractMovePosition({ data: { newPosition: { x: 3, y: 4 } } })).toEqual({ x: 3, y: 4 });
    expect(extractMovePosition({ newPosition: { x: 5, y: 6 } })).toEqual({ x: 5, y: 6 });
    expect(extractMovePosition({ data: { player: { currentPositionX: 7, currentPositionY: 9 } } })).toEqual({
      x: 7,
      y: 9,
    });
  });

  it('rejects garbage payloads with null', () => {
    expect(extractMovePosition(null)).toBeNull();
    expect(extractMovePosition(undefined)).toBeNull();
    expect(extractMovePosition('nope')).toBeNull();
    expect(extractMovePosition({})).toBeNull();
    expect(extractMovePosition({ data: { player: {} } })).toBeNull();
    expect(extractMovePosition({ data: { player: { currentPosition: { x: 'a', y: 1 } } } })).toBeNull();
    expect(
      extractMovePosition({ data: { player: { currentPositionX: Infinity, currentPositionY: 1 } } })
    ).toBeNull();
  });
});
