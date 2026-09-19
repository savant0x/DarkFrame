// @vitest-environment node
/**
 * @file __tests__/lib/beerBaseRespawn.test.ts
 * @overview FID-20260909-030 leak-class regression — weekly Beer Base respawn
 * must release every existing base's tile claim BEFORE the bulk player delete.
 *
 * The original bug: weeklyBeerBaseRespawn deleted all Beer Base players
 * without the tile release that removeBeerBase performs, leaving ghost
 * base_owner rows on the map and permanently draining Wasteland tiles from
 * the spawn pool — one tile per replaced base, every weekly cycle. Live
 * verification after the fix caught exactly this ghost (Silent_Tower's claim
 * at 68,123 surviving its own deletion).
 *
 * These tests pin the repair (rebased onto the pg drizzle seams by
 * FID-20260917-017; the shim mock is gone):
 *   1. Every existing base gets releaseBotBaseTile(x, y, username).
 *   2. Every release is awaited before the bulk delete fires (ordering).
 *   3. A failing tile release for one base must not abort the respawn
 *      (per-base error tolerance) — a flaky tile update can't brick the
 *      weekly cron.
 *   4. Bases with missing/zero coordinates skip the release (nothing to
 *      release) but are still deleted.
 *   5. A disabled config short-circuits: no reads, no releases, no deletes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { capture, botConfigTable } = vi.hoisted(() => ({
  capture: {
    // Beer Base rows the bases select serves (username + flat base coords).
    existingBases: [] as Array<{ username: string; baseX: number; baseY: number }>,
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
    // Whether the bulk delete received a where-guard (isBot+isSpecialBase
    // are now opaque drizzle conditions; identity is tsc-pinned).
    deleteWasGuarded: false,
    // Number of rows the delete's returning() reports.
    deletedUsernames: [] as string[],
  },
  // Identity handles so the connection mock can discriminate tables.
  botConfigTable: { __table: 'bot_config' },
}));

// beerBaseAnalytics (recordSpawnEvent import chain) still rides the shim;
// mocked out wholesale so the real mongodb module never loads here.
vi.mock('@/lib/db/connection', () => ({
  db: {
    select: (projection?: Record<string, unknown>) => ({
      from: (table: unknown) => {
        if (table === botConfigTable) {
          // getTargetBeerBaseCount: bot cap row (null row → service fallback).
          return {
            limit: async () => (capture.regularBots > 0 ? [{} as Record<string, unknown>] : []),
          };
        }
        if (projection && 'count' in projection) {
          // Population count select.
          return { where: async () => [{ count: capture.regularBots }] };
        }
        // Existing Beer Bases read (username + base coords).
        return { where: async () => capture.existingBases };
      },
    }),
    delete: (_table: unknown) => ({
      where: (..._args: unknown[]) => ({
        returning: async () => {
          capture.events.push('delete');
          capture.deleteWasGuarded = _args.length > 0;
          capture.deletedUsernames = capture.existingBases.map((b) => b.username);
          return capture.deletedUsernames.map((username) => ({ username }));
        },
      }),
    }),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    // getBeerBaseConfig: drizzleDb.select().from(gameConfig).where(...).limit()
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => capture.configRows,
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', async (importOriginal) => ({
  // Proxy: any column access returns a tagged stub (identity for projections);
  // other schema exports pass through so unrelated imports stay safe.
  ...(await importOriginal<Record<string, unknown>>()),
  gameConfig: { type: { name: 'type' } },
  players: new Proxy({}, { get: (_t, prop) => ({ name: String(prop) }) }),
}));

vi.mock('@/lib/db/schema/config', () => ({
  botConfig: botConfigTable,
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

import { weeklyBeerBaseRespawn } from '@/lib/beerBaseService';

describe('weeklyBeerBaseRespawn tile-claim release (FID-030 leak class)', () => {
  beforeEach(() => {
    capture.existingBases = [];
    capture.regularBots = 0;
    capture.configRows = [];
    capture.releases = [];
    capture.failReleaseFor.clear();
    capture.events = [];
    capture.deleteWasGuarded = false;
    capture.deletedUsernames = [];
  });

  it('releases every existing base tile claim before the bulk delete', async () => {
    capture.existingBases = [
      { username: 'Silent_Tower', baseX: 68, baseY: 123 },
      { username: 'Silent_Citadel', baseX: 45, baseY: 8 },
    ];

    const result = await weeklyBeerBaseRespawn();

    // Every base's claim released with its exact coordinates and owner.
    expect(capture.releases).toEqual([
      { x: 68, y: 123, owner: 'Silent_Tower' },
      { x: 45, y: 8, owner: 'Silent_Citadel' },
    ]);

    // Ordering: every release is awaited before the delete fires —
    // the delete must never race ahead of the tile releases.
    const deleteIdx = capture.events.indexOf('delete');
    expect(deleteIdx).toBeGreaterThan(-1);
    for (const base of capture.existingBases) {
      const releaseIdx = capture.events.indexOf(`release:${base.username}`);
      expect(releaseIdx).toBeGreaterThan(-1);
      expect(releaseIdx).toBeLessThan(deleteIdx);
    }

    // The delete is guarded (Beer-Base population filter) and removed
    // exactly the Beer Base rows.
    expect(capture.deleteWasGuarded).toBe(true);
    expect(capture.deletedUsernames).toEqual(['Silent_Tower', 'Silent_Citadel']);
    expect(result).toEqual({ removed: 2, spawned: 0, beerBases: [] });
  });

  it('completes the respawn when one base tile release fails (per-base tolerance)', async () => {
    capture.existingBases = [
      { username: 'Flaky_Base', baseX: 12, baseY: 34 },
      { username: 'Healthy_Base', baseX: 56, baseY: 78 },
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
      { username: 'Coordless_Base', baseX: 0, baseY: 0 },
    ];

    const result = await weeklyBeerBaseRespawn();

    expect(capture.releases).toEqual([]);
    expect(capture.events).toContain('delete');
    expect(result.removed).toBe(1);
  });

  it('short-circuits entirely when Beer Bases are disabled', async () => {
    capture.configRows = [{ config: { enabled: false } }];
    capture.existingBases = [
      { username: 'Dormant_Base', baseX: 1, baseY: 2 },
    ];

    const result = await weeklyBeerBaseRespawn();

    expect(result).toEqual({ removed: 0, spawned: 0, beerBases: [] });
    expect(capture.releases).toEqual([]);
    expect(capture.events).not.toContain('delete');
  });
});
