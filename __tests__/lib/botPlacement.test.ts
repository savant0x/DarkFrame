/**
 * @file __tests__/lib/botPlacement.test.ts
 * @overview FID-20260909-030 §3-F regression — the shared bot base placement
 * helper (claimBotBaseTile / releaseBotBaseTile).
 *
 * The placement contract from the docs (README_NEW.md §Terrain Distribution:
 * Wasteland = spawn terrain) and the human precedent
 * (findAndClaimSpawnTile): Wasteland ∧ unoccupied ∧ zone sector ∧ race-safe
 * conditional claim, loud exhaustion. These tests pin each clause.
 *
 * Harness note: the db mock serves candidates from a deterministic
 * `serveQueue` (one tile per select) and resolves the conditional claim
 * against the just-served candidate — the helper's documented claim target —
 * rather than regex-parsing drizzle's SQL chunk trees (those don't stringify
 * as `"x" = 30`).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { capture } = vi.hoisted(() => ({
  capture: {
    // One tile handed out per candidate select, in order.
    serveQueue: [] as Array<{ x: number; y: number; terrain: string }>,
    // The tile the most recent select served — the claim's target.
    lastServed: null as { x: number; y: number; terrain: string } | null,
    // "x,y" keys that lose the conditional-claim race (a concurrent
    // claimant wins) even though the select served them.
    raceLost: new Set<string>(),
    // Keys permanently claimed (successful claims by anyone).
    occupied: new Set<string>(),
    // Every claim/release update captured.
    updates: [] as Array<{ set: Record<string, unknown>; where: string }>,
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => {
              const tile = capture.serveQueue.shift() ?? null;
              capture.lastServed = tile;
              return tile ? [tile] : [];
            },
          }),
        }),
      }),
    }),
    update: () => ({
      set: (set: Record<string, unknown>) => ({
        where: (expr: unknown) => ({
          // Support both terminal shapes: awaited directly (release) and
          // .returning() (conditional claim).
          ...({
            then: (resolve: (v: unknown) => void) => {
              capture.updates.push({ set, where: describeWhere(expr) });
              resolve(undefined);
            },
          }),
          returning: async () => {
            capture.updates.push({ set, where: describeWhere(expr) });
            const served = capture.lastServed;
            if (!served) return [];
            const key = `${served.x},${served.y}`;
            // The claim only lands while the tile is still unclaimed —
            // and only when no concurrent claimant wins the race.
            if (capture.occupied.has(key) || capture.raceLost.has(key)) return [];
            capture.occupied.add(key);
            return [{ x: served.x }];
          },
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/schema')>()),
  tiles: {
    x: 'x',
    y: 'y',
    terrain: 'terrain',
    occupiedByBase: 'occupied_by_base',
    baseOwner: 'base_owner',
  },
}));

import { claimBotBaseTile, releaseBotBaseTile } from '@/lib/botService';

/** Extract the coordinate pair and owner from the drizzle expression objects
 *  the helper composes (eq(tiles.x, …), eq(tiles.y, …), eq(tiles.baseOwner, …)).
 *  The schema mock maps columns to plain strings, so the eq() results are
 *  opaque objects — probe them structurally. */
function describeWhere(expr: unknown): string {
  return JSON.stringify(expr, (_k, v) => (typeof v === 'object' && v !== null ? { ...v } : v));
}

describe('claimBotBaseTile (FID-030 placement contract)', () => {
  beforeEach(() => {
    capture.serveQueue.length = 0;
    capture.lastServed = null;
    capture.raceLost.clear();
    capture.occupied.clear();
    capture.updates.length = 0;
  });

  it('claims a Wasteland tile and attributes it to the owner', async () => {
    capture.serveQueue = [{ x: 42, y: 17, terrain: 'Wasteland' }];

    const claimed = await claimBotBaseTile({ zone: null, ownerUsername: 'Alpha_Raider' });

    expect(claimed).toEqual({ x: 42, y: 17, terrain: 'Wasteland' });
    expect(capture.updates).toHaveLength(1);
    expect(capture.updates[0].set).toMatchObject({ occupiedByBase: 1, baseOwner: 'Alpha_Raider' });
  });

  it('throws loudly when the pool is empty (no silent illegal placement)', async () => {
    capture.serveQueue = [];

    await expect(claimBotBaseTile({ zone: 4, ownerUsername: 'Alpha_Raider' }))
      .rejects.toThrow(/no unoccupied Wasteland tile in zone 4/);
  });

  it('retries on a lost claim race and claims the next candidate', async () => {
    capture.serveQueue = [
      { x: 10, y: 20, terrain: 'Wasteland' },
      { x: 30, y: 40, terrain: 'Wasteland' },
    ];
    // A concurrent claimant wins the first tile; the helper must re-select.
    capture.raceLost.add('10,20');

    const claimed = await claimBotBaseTile({ zone: null, ownerUsername: 'Bravo_Fortress' });

    expect(claimed.x).toBe(30);
    expect(claimed.y).toBe(40);
    expect(capture.updates).toHaveLength(2);
  });

  it('throws after exhausting retries when every race is lost', async () => {
    capture.serveQueue = Array.from({ length: 5 }, () => ({ x: 10, y: 20, terrain: 'Wasteland' }));
    capture.raceLost.add('10,20');

    await expect(claimBotBaseTile({ zone: null, ownerUsername: 'Charlie_Ghost' }))
      .rejects.toThrow(/after 5 attempts/);
  });

  it('releaseBotBaseTile clears occupancy scoped to the owner', async () => {
    capture.occupied.add('55,66');

    await releaseBotBaseTile(55, 66, 'Old_Bot');

    expect(capture.updates).toHaveLength(1);
    expect(capture.updates[0].set).toMatchObject({ occupiedByBase: null, baseOwner: null });
    expect(capture.updates[0].where).toContain('55');
    expect(capture.updates[0].where).toContain('66');
  });
});
