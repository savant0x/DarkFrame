/**
 * @file __tests__/api/slice2TheaterAndDeletions.test.ts
 * @created 2026-09-18
 * @overview Pins for FID-20260917-017 slice 2 — theater conversion (harvest/move
 *            read via getPlayerSlim) and deletions (root /api/inventory,
 *            /api/debug/tile, orphaned /game/inventory page). Static pins on
 *            the import/usage surface; reachability pins on the survivors.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('harvest route — theater conversion', () => {
  const src = read('app/api/harvest/route.ts');

  it('no shim import or getCollection usage remains', () => {
    expect(src).not.toContain("from '@/lib/mongodb'");
    expect(src).not.toContain('getCollection(');
    expect(src).not.toContain('findOne(');
  });

  it('reads via getPlayerSlim', () => {
    expect(src).toContain("import { getPlayerSlim } from '@/lib/playerService'");
    expect(src).toContain('getPlayerSlim(username)');
  });

  it('error mapping and downstream call shape preserved', () => {
    expect(src).toContain('ErrorCode.AUTH_UNAUTHORIZED');
    expect(src).toContain('harvestResourceTile(username, tile)');
    expect(src).toContain('harvestCaveTile(username, tile)');
    expect(src).toContain('harvestForestTile(username, tile)');
  });
});

describe('move route — theater conversion', () => {
  const src = read('app/api/move/route.ts');

  it('no shim import or findOne usage remains', () => {
    expect(src).not.toContain("from '@/lib/mongodb'");
    expect(src).not.toContain('getCollection(');
    expect(src).not.toContain('.findOne(');
  });

  it('reads via getPlayerSlim and uses the domain currentPosition', () => {
    expect(src).toContain("import { getPlayerSlim } from '@/lib/playerService'");
    expect(src).toContain('playerBefore?.currentPosition ?? null');
  });

  it('movement pipeline untouched (movePlayer per step, speed detector wired)', () => {
    expect(src).toContain('await movePlayer(username, direction)');
    expect(src).toContain('detectSpeedHack(');
  });
});

describe('deletions — dead route files are gone', () => {
  it('root /api/inventory deleted (real inventory UI rides /api/player/inventory)', () => {
    expect(existsSync(join(root, 'app/api/inventory/route.ts'))).toBe(false);
  });

  it('/api/debug/tile deleted', () => {
    expect(existsSync(join(root, 'app/api/debug/tile/route.ts'))).toBe(false);
  });

  it('orphaned /game/inventory page deleted (nothing linked to it; InventoryPanel is the live UI)', () => {
    expect(existsSync(join(root, 'app/game/inventory/page.tsx'))).toBe(false);
  });
});

describe('reachability of the survivors', () => {
  it('harvest route has a live client caller', () => {
    expect(read('components/HarvestButton.tsx')).toContain('/api/harvest');
  });

  it('move route has live client callers (MovementControls / autoFarm)', () => {
    const callers = ['components/MovementControls.tsx', 'utils/autoFarmEngine.ts'];
    const hits = callers.filter((f) => existsSync(join(root, f)) && read(f).includes('/api/move'));
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('the real inventory endpoint (player/inventory) is untouched', () => {
    expect(existsSync(join(root, 'app/api/player/inventory/route.ts'))).toBe(true);
    expect(read('components/InventoryPanel.tsx')).toContain('/api/player/inventory');
  });
});
