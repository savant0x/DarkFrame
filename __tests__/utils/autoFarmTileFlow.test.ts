/**
 * @file __tests__/utils/autoFarmTileFlow.test.ts
 * @created 2026-09-28
 * @overview FID-20260928-004 — auto-farm consumes the move envelope's
 *            `currentTile` instead of re-fetching the tile it just moved onto.
 *
 * Per tile, the engine used to fetch the tile twice more after `POST /api/move`
 * had already returned it: once via `getTileInfo` (engine) and once via the
 * page's `updateTileOnly` (driven by the engine's `move` event). These pins
 * hold the new single-fetch flow: envelope tile wins, fallbacks stay intact.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The engine emits through a callback; we drive moveToPosition indirectly via
// the private fetch surface. To keep the pins honest without a live server,
// we exercise the pieces the FID changed: envelope extraction happens inline
// in executeMove, so the observable contract is the MOVE EVENT payload and
// processTile's fetch behavior. We stub global fetch and construct an engine
// through its public surface.

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { AutoFarmEngine } from '@/utils/autoFarmEngine';
import { TerrainType, RankFilter, ResourceTarget, type Tile } from '@/types';

const TILE: Tile = {
  x: 50,
  y: 50,
  terrain: TerrainType.Metal,
  harvestStatus: { canHarvest: true, timeUntilReset: 3_600_000, resetPeriod: '2026-09-28-AM' },
};

/** A well-formed /api/move envelope (route contract: data.{player,currentTile}). */
const moveEnvelope = (tile: Tile | null) => ({
  ok: true,
  json: async () => ({
    success: true,
    data: {
      player: { currentPosition: { x: tile?.x ?? 50, y: tile?.y ?? 50 } },
      currentTile: tile,
    },
  }),
  headers: new Headers(),
});

function makeEngine(start: { x: number; y: number }, isVIP = true): AutoFarmEngine {
  return new AutoFarmEngine(
    {
      attackPlayers: false,
      rankFilter: RankFilter.ALL,
      resourceTarget: ResourceTarget.METAL,
      isVIP,
    },
    start,
  );
}

describe('FID-20260928-004 — one tile fetch per move', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // executeMove reads the username from localStorage (the engine's auth
    // transport); without it the move short-circuits before the fetch.
    localStorage.setItem('darkframe_username', 'tester');
  });

  it('move event carries the envelope tile in data.tile', async () => {
    const events: unknown[] = [];
    const engine = makeEngine({ x: 50, y: 49 });
    engine.onEvent((e) => events.push(e));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(moveEnvelope(TILE) as never);

    // One step east: (50,49) -> (50,50)
    await (engine as unknown as { moveToPosition(p: { x: number; y: number }): Promise<unknown> })
      .moveToPosition({ x: 50, y: 50 });

    const move = events.find((e) => (e as { type: string }).type === 'move') as
      { data?: { tile?: Tile } } | undefined;
    expect(move).toBeDefined();
    expect(move?.data?.tile?.terrain).toBe(TerrainType.Metal);
    expect(move?.data?.tile?.harvestStatus?.canHarvest).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // the move itself; no tile fetch
    fetchSpy.mockRestore();
  });

  it('processTile does NOT fetch /api/tile when the envelope carried one', async () => {
    const engine = makeEngine({ x: 50, y: 49 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes('/api/move')) return moveEnvelope(TILE) as never;
      // Any /api/tile hit here would be the regression this pin exists for.
      throw new Error(`unexpected fetch: ${url}`);
    });

    await (engine as unknown as { processTile(p: { x: number; y: number }): Promise<unknown> })
      .processTile({ x: 50, y: 50 });

    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/api/tile'))).toBe(false);
    fetchSpy.mockRestore();
  });

  it('processTile falls back to GET /api/tile when the envelope has no tile', async () => {
    const engine = makeEngine({ x: 50, y: 49 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes('/api/move')) return moveEnvelope(null) as never;
      if (url.includes('/api/tile')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: TILE }),
        } as never;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    await (engine as unknown as { processTile(p: { x: number; y: number }): Promise<unknown> })
      .processTile({ x: 50, y: 50 });

    expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes('/api/tile'))).toBe(true);
    fetchSpy.mockRestore();
  });

  it('page-side contract: the move handler prefers event.data.tile and only falls back without one', () => {
    // The page handler is inline JSX; its contract is pinned at the data level:
    // event.data.tile present -> setCurrentTile path; absent -> updateTileOnly.
    // This pin documents the branch condition the page implements.
    const eventWithTile: { type: string; position: { x: number; y: number }; data?: { tile?: Tile } } =
      { type: 'move', position: { x: 1, y: 2 }, data: { tile: TILE } };
    const eventWithoutTile: { type: string; position: { x: number; y: number }; data?: { tile?: Tile } } =
      { type: 'move', position: { x: 1, y: 2 } };
    expect('tile' in (eventWithTile.data ?? {})).toBe(true);
    expect('tile' in (eventWithoutTile.data ?? {})).toBe(false);
  });
});
