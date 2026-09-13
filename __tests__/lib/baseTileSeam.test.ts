/**
 * FID-20260912-090 — base-tile seam contract tests.
 *
 * Presence for base attacks/scan must resolve against the base's TILE
 * (tiles.base_owner — what the player sees and walks to), never the drifting
 * bot-agent position columns. These tests pin the resolver math and the heal's
 * classification logic against an in-memory fixture mirroring the live drift.
 */
import { describe, it, expect } from 'vitest';
import { chebyshevDistance } from '@/lib/presenceCheck';

/**
 * The heal's classification, extracted verbatim from basePositionResync.ts —
 * a row needs healing iff it owns a tile and any position column diverges.
 */
function needsResync(
  row: { username: string; currentPositionX: number; currentPositionY: number; baseX: number; baseY: number },
  tileByOwner: Map<string, { x: number; y: number }>
): boolean {
  const tile = tileByOwner.get(row.username);
  if (!tile) return false;
  return (
    Number(row.currentPositionX) !== tile.x ||
    Number(row.currentPositionY) !== tile.y ||
    Number(row.baseX) !== tile.x ||
    Number(row.baseY) !== tile.y
  );
}

describe('the live drift that 403ed on-tile attacks', () => {
  // Values straight from the production DB at FID-090 time.
  const tileByOwner = new Map<string, { x: number; y: number }>([
    ['Blackened_Garrison', { x: 114, y: 105 }],
    ['Gilded_Spire', { x: 85, y: 5 }],
    ['Shattered_Den', { x: 41, y: 72 }],
  ]);

  it('flags a base whose currentPosition drifted from its tile', () => {
    const row = {
      username: 'Blackened_Garrison',
      currentPositionX: 109, currentPositionY: 105, // drifted (bot agent moved)
      baseX: 114, baseY: 105,
    };
    expect(needsResync(row, tileByOwner)).toBe(true);
  });

  it('flags a base whose baseX/baseY drifted from its tile', () => {
    const row = {
      username: 'Shattered_Den',
      currentPositionX: 41, currentPositionY: 64, // drifted
      baseX: 41, baseY: 72, // drifts WITH currentPosition
    };
    expect(needsResync(row, tileByOwner)).toBe(true);
  });

  it('leaves a healthy base alone (free re-run)', () => {
    const row = {
      username: 'Gilded_Spire',
      currentPositionX: 85, currentPositionY: 5,
      baseX: 85, baseY: 5,
    };
    expect(needsResync(row, tileByOwner)).toBe(false);
  });

  it('ignores bots that own no tile (regular roaming bots)', () => {
    const row = {
      username: 'Rune_King',
      currentPositionX: 103, currentPositionY: 70,
      baseX: 103, baseY: 70,
    };
    expect(needsResync(row, tileByOwner)).toBe(false);
  });
});

describe('presence against the resolved tile (the seam contract)', () => {
  it('standing on the owned tile passes when position resolves from the tile', () => {
    const player = { x: 114, y: 105 };
    const tile = { x: 114, y: 105 };
    expect(chebyshevDistance(player, tile)).toBe(0);
  });

  it('the old behavior: same player position vs the drifted column 403s', () => {
    const player = { x: 114, y: 105 };
    const drifted = { x: 109, y: 105 };
    expect(chebyshevDistance(player, drifted)).toBeGreaterThan(0);
  });
});
