/**
 * @file __tests__/lib/beerBaseRespawn.test.ts
 * @overview FID-20260909-030 leak-class regression — weekly Beer Base respawn
 * must release every existing base's tile claim BEFORE the bulk player delete.
 *
 * The original bug: weeklyBeerBaseRespawn deleteMany'd all Beer Base players
 * without the tile release that removeBeerBase performs, leaving ghost
 * base_owner rows on the map and permanently draining Wasteland tiles from
 * the spawn pool — one tile per replaced base, every weekly cycle. Live
 * verification after the fix caught exactly this ghost (Silent_Tower's claim
 * at 68,123 surviving its own deletion).
 *
 * These tests pin the repair:
 *   1. Every existing base gets releaseBotBaseTile(x, y, username).
 *   2. Every release is awaited before the deleteMany fires (ordering).
 *   3. A failing tile release for one base must not abort the respawn
 *      (per-base error tolerance) — a flaky tile update can't brick the
 *      weekly cron.
 *   4. Bases with missing/zero coordinates skip the release (nothing to
 *      release) but are still deleted.
 *   5. A disabled config short-circuits: no reads, no releases, no deletes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { capture } = vi.hoisted(() => ({
  capture: {
    // Beer Base player rows the find() serves (username + base coords).
    existingBases: [] as Array<{
      username: string;
      isBot: boolean;
      isSpecialBase: boolean;
      base: { x: number; y: number };
    }>,
    // Regular bot count feeding getTargetBeerBaseCount (0 → target 0 →
    // spawnBeerBases is a no-op, so the test isolates the removal path).
    regularBots: 0,
    // Config rows the drizzle select serves for getBeerBaseConfig.
    configRows: [] as Array<{ config: Record<string, unknown> }>,
    // Every releaseBotBaseTile invocation, in order.
    releases: [] as Array<{ x: number; y: number; owner: string }>,
    // Usernames whose release should reject (error-tolerance scenario).
    failReleaseFor: new Set<string>(),
    // Global event timeline for the release-before-delete ordering pin.
    events: [] as string[],
    // The deleteMany filter, captured for assertion.
    deleteFilter: null as Record<string, unknown> | null,
  },
}));

vi.mock('@/lib/mongodb', () => ({
  connectToDatabase: async () => ({
    collection: (_name: string) => ({
      find: () => ({
        toArray: async () => {
          capture.events.push(`find:${capture.existingBases.length}`);
          return capture.existingBases;
        },
      }),
      countDocuments: async () => capture.regularBots,
      findOne: async () => null, // botConfig row → default totalBotCap
      deleteMany: async (filter: Record<string, unknown>) => {
        capture.events.push('delete');
        capture.deleteFilter = filter;
        return { deletedCount: capture.existingBases.length };
      },
    }),
  }),
}));

vi.mock('@/lib/botService', () => ({
  releaseBotBaseTile: async (x: number, y: number, ownerUsername: string) => {
    capture.events.push(`release:${ownerUsername}`);
    if (capture.failReleaseFor.has(ownerUsername)) {
      throw new Error(`tile update failed for ${ownerUsername}`);
    }
    capture.releases.push({ x, y, owner: ownerUsername });
  },
  // Unused by the removal path (target count is 0); stubbed for import safety.
  claimBotBaseTile: vi.fn(),
  createBotPlayer: vi.fn(),
  generateBeerBaseName: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    // getBeerBaseConfig: select().from(gameConfig).where(...).limit()
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => capture.configRows,
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  gameConfig: { type: 'type' },
}));

import { weeklyBeerBaseRespawn } from '@/lib/beerBaseService';

describe('weeklyBeerBaseRespawn tile-claim release (FID-030 leak class)', () => {
  beforeEach(() => {
    capture.existingBases = [];
    capture.regularBots = 0;
    capture.configRows = [];
    capture.releases = [];
    capture.failReleaseFor.clear();
    capture.events = [];
    capture.deleteFilter = null;
  });

  it('releases every existing base tile claim before the bulk delete', async () => {
    capture.existingBases = [
      { username: 'Silent_Tower', isBot: true, isSpecialBase: true, base: { x: 68, y: 123 } },
      { username: 'Silent_Citadel', isBot: true, isSpecialBase: true, base: { x: 45, y: 8 } },
    ];

    const result = await weeklyBeerBaseRespawn();

    // Every base's claim released with its exact coordinates and owner.
    expect(capture.releases).toEqual([
      { x: 68, y: 123, owner: 'Silent_Tower' },
      { x: 45, y: 8, owner: 'Silent_Citadel' },
    ]);

    // Ordering: every release is awaited before the deleteMany fires —
    // the delete must never race ahead of the tile releases.
    const deleteIdx = capture.events.indexOf('delete');
    expect(deleteIdx).toBeGreaterThan(-1);
    for (const base of capture.existingBases) {
      const releaseIdx = capture.events.indexOf(`release:${base.username}`);
      expect(releaseIdx).toBeGreaterThan(-1);
      expect(releaseIdx).toBeLessThan(deleteIdx);
    }

    // The delete still targets exactly the Beer Base population.
    expect(capture.deleteFilter).toEqual({ isBot: true, isSpecialBase: true });
    expect(result).toEqual({ removed: 2, spawned: 0, beerBases: [] });
  });

  it('completes the respawn when one base tile release fails (per-base tolerance)', async () => {
    capture.existingBases = [
      { username: 'Flaky_Base', isBot: true, isSpecialBase: true, base: { x: 12, y: 34 } },
      { username: 'Healthy_Base', isBot: true, isSpecialBase: true, base: { x: 56, y: 78 } },
    ];
    capture.failReleaseFor.add('Flaky_Base');

    await expect(weeklyBeerBaseRespawn()).resolves.toEqual({
      removed: 2,
      spawned: 0,
      beerBases: [],
    });

    // The healthy release still ran and the delete still happened —
    // a single flaky tile update must not brick the weekly cron.
    expect(capture.releases).toEqual([{ x: 56, y: 78, owner: 'Healthy_Base' }]);
    expect(capture.events).toContain('delete');
  });

  it('deletes bases with missing coordinates without attempting a release', async () => {
    capture.existingBases = [
      // Malformed placement: no usable coords → nothing to release.
      { username: 'Coordless_Base', isBot: true, isSpecialBase: true, base: { x: 0, y: 0 } },
    ];

    const result = await weeklyBeerBaseRespawn();

    expect(capture.releases).toEqual([]);
    expect(capture.events).toContain('delete');
    expect(result.removed).toBe(1);
  });

  it('short-circuits entirely when Beer Bases are disabled', async () => {
    capture.configRows = [{ config: { enabled: false } }];
    capture.existingBases = [
      { username: 'Dormant_Base', isBot: true, isSpecialBase: true, base: { x: 1, y: 2 } },
    ];

    const result = await weeklyBeerBaseRespawn();

    expect(result).toEqual({ removed: 0, spawned: 0, beerBases: [] });
    expect(capture.releases).toEqual([]);
    expect(capture.events).not.toContain('delete');
  });
});
