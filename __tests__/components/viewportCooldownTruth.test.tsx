/**
 * @file __tests__/components/viewportCooldownTruth.test.ts
 * @created 2026-09-27
 * @overview FID-20260927-007 — the two live harvest-cooldown indicators read
 *            the server's answer instead of computing their own.
 *
 * Both chips used to decide readiness themselves, from two different private
 * rules, neither of which is the server's:
 *
 *   - `TileRenderer` matched `lastHarvestedBy` on `playerId` ALONE, dropping the
 *     `resetPeriod` term the server requires — so a record from a *previous*
 *     period kept the chip counting down forever, against a tile the player can
 *     harvest right now. Its countdown came from host-local `setHours(12/24)`.
 *   - `TileHarvestStatus` declared a flat 5-minute cooldown that exists nowhere
 *     in the server, so it invited players into a guaranteed rejection.
 *
 * The rule these pins enforce: **the client renders the server's verdict; it
 * never re-derives one.** Group 5 is the drift census that keeps a third copy
 * from being written later — the same shape as `__tests__/terrainTruth.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import TileRenderer from '@/components/TileRenderer';
import TileHarvestStatus from '@/components/TileHarvestStatus';
import { useGameContext } from '@/context/GameContext';
import { TerrainType, type Tile, type HarvestStatus } from '@/types';

vi.mock('@/context/GameContext');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn(), forward: vi.fn() }),
}));
vi.mock('@/lib/imageService', () => ({
  getTerrainImage: () => null,
  getBankImage: () => null,
  getBaseImage: async () => '/assets/tiles/bases/1.jpg',
  levelToBaseTier: (level: number) => Math.min(10, Math.max(1, Math.ceil(level / 10))),
}));
vi.mock('@/components/SafeHtmlRenderer', () => ({
  SafeHtmlRenderer: ({ fallback }: { fallback: string }) => <div>{fallback}</div>,
}));

type GameState = ReturnType<typeof useGameContext>;

const baseCtx = {
  player: null,
  currentTile: null,
  isLoading: false,
  error: null,
  setPlayer: vi.fn(),
  setCurrentTile: vi.fn(),
  updateTileOnly: vi.fn(),
  movePlayer: vi.fn(),
  refreshGameState: vi.fn(),
  refreshPlayer: vi.fn(),
  logout: vi.fn(),
} as unknown as GameState;

const ctxWithPlayer = (username: string): GameState => ({
  ...baseCtx,
  player: {
    username,
    level: 10,
    rank: 1,
    base: { x: 1, y: 1 },
    currentPosition: { x: 10, y: 10 },
    resources: { metal: 0, energy: 0 },
  } as GameState['player'],
});

const HOUR = 60 * 60 * 1000;

/** A farmable tile carrying an explicit server verdict. */
const farmableTile = (harvestStatus: HarvestStatus | undefined, overrides: Partial<Tile> = {}): Tile =>
  ({
    x: 50,
    y: 50,
    terrain: TerrainType.Metal,
    harvestStatus,
    ...overrides,
  }) as Tile;

const status = (canHarvest: boolean, timeUntilReset: number): HarvestStatus => ({
  canHarvest,
  timeUntilReset,
  resetPeriod: '2026-09-27-AM',
});

describe('FID-20260927-007 — the cooldown chips read the server\'s verdict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGameContext).mockReturnValue(ctxWithPlayer('Me'));
  });

  // --- Group 1: the verdict, not arithmetic ---------------------------------
  // THE core defect. The record below is from a PREVIOUS reset period, so the
  // server says this tile is harvestable. The pre-fix chip matched on playerId
  // alone and showed a countdown anyway — forever, because the record is
  // superseded rather than deleted.
  it('shows ready when the server says harvestable, even with a stale-period record on the tile', () => {
    render(
      <TileRenderer
        tile={farmableTile(status(true, 3 * HOUR), {
          lastHarvestedBy: [
            { playerId: 'Me', timestamp: new Date('2026-09-26T04:00:00Z'), resetPeriod: '2026-09-26-PM' },
          ],
        })}
      />
    );

    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.queryByText(/until reset/)).not.toBeInTheDocument();
  });

  // --- Group 2: negative control --------------------------------------------
  // Proves the chip follows the server rather than echoing the record list: the
  // tile has NO record at all, yet the server refuses, so the chip must too.
  it('shows a countdown when the server refuses, even on a tile with no harvest record', () => {
    render(<TileRenderer tile={farmableTile(status(false, 90 * 60 * 1000))} />);

    expect(screen.getByText('1h 30m until reset')).toBeInTheDocument();
    expect(screen.queryByText('ready')).not.toBeInTheDocument();
  });

  // --- Group 3: the reset period still governs -------------------------------
  // A record in the CURRENT period plus the server's refusal must read as a
  // cooldown, not as permission.
  it('shows a countdown for a current-period record the server refuses', () => {
    render(
      <TileRenderer
        tile={farmableTile(status(false, 45 * 60 * 1000), {
          lastHarvestedBy: [
            { playerId: 'Me', timestamp: new Date(), resetPeriod: '2026-09-27-AM' },
          ],
        })}
      />
    );

    expect(screen.getByText('45m until reset')).toBeInTheDocument();
  });

  // --- Group 4: unknown is not permission ------------------------------------
  // An absent verdict (non-farmable tile, or an enrichment that failed) must
  // never render as "ready" — a guess in the permissive direction is the one
  // error this whole class has been making.
  it('never renders ready when the server sent no verdict', () => {
    render(<TileRenderer tile={farmableTile(undefined)} />);

    expect(screen.queryByText('ready')).not.toBeInTheDocument();
    expect(screen.queryByText(/until reset/)).not.toBeInTheDocument();
  });

  // --- The stats chip: its 5-minute rule had no server counterpart -----------
  it('stats chip follows the server verdict, not a local 5-minute timer', () => {
    const tile = farmableTile(status(false, 2 * HOUR), {
      // Harvested 10 minutes ago. The old flat rule (5 min) declared this
      // READY; the server will refuse for another two hours.
      lastHarvestedBy: [
        { playerId: 'Me', timestamp: new Date(Date.now() - 10 * 60 * 1000), resetPeriod: '2026-09-27-AM' },
      ],
    });

    render(<TileHarvestStatus currentTile={tile} playerUsername="Me" />);

    expect(screen.queryByText('Ready to Harvest')).not.toBeInTheDocument();
    expect(screen.getByText('Harvest Cooldown')).toBeInTheDocument();
  });

  it('stats chip reports ready when the server says harvestable', () => {
    render(
      <TileHarvestStatus
        currentTile={farmableTile(status(true, 0), {
          lastHarvestedBy: [
            { playerId: 'Me', timestamp: new Date(Date.now() - 10 * 60 * 1000), resetPeriod: '2026-09-27-PM' },
          ],
        })}
        playerUsername="Me"
      />
    );

    expect(screen.getByText('Ready to Harvest')).toBeInTheDocument();
  });
});

/**
 * Group 5 — the drift census. A behavioural pin cannot see a rule that has not
 * been written yet; this one can. Modeled on `__tests__/terrainTruth.test.ts`,
 * which pins the farmable-terrain set against the terrain inventory.
 */
describe('FID-20260927-007 — no client may re-derive the cooldown rule', () => {
  const ROOT = join(__dirname, '..', '..');
  const chipFiles = ['components/TileRenderer.tsx', 'components/TileHarvestStatus.tsx'];

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) {
        if (['node_modules', '.next', 'archives'].includes(e)) continue;
        walk(p, out);
      } else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) {
        out.push(p);
      }
    }
    return out;
  };

  it('no chip declares its own cooldown constant or cooldown predicate', () => {
    for (const rel of chipFiles) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      expect(src, `${rel} must not declare a local harvest-cooldown constant`).not.toMatch(
        /HARVEST_COOLDOWN_MS/,
      );
      expect(src, `${rel} must not re-derive readiness from the harvest record list`).not.toMatch(
        /lastHarvestedBy\s*\.\s*some/,
      );
      expect(src, `${rel} must not compute a reset boundary in host-local time`).not.toMatch(
        /setHours\s*\(\s*(12|24)\b/,
      );
    }
  });

  it('no client file infers harvest eligibility from lastHarvestedBy', () => {
    const offenders: string[] = [];
    for (const abs of walk(join(ROOT, 'components'))) {
      const rel = abs.slice(ROOT.length + 1).replace(/\\/g, '/');
      const src = readFileSync(abs, 'utf8');
      src.split('\n').forEach((raw, i) => {
        // A client that decides "can I harvest" from the record list is
        // re-deriving the server's rule. Reading the list for DISPLAY is fine.
        if (/lastHarvestedBy/.test(raw) && /\bplayerId\s*===/.test(raw)) {
          offenders.push(`${rel}:${i + 1}`);
        }
      });
    }
    expect(
      offenders,
      `client code must not decide harvest eligibility from lastHarvestedBy:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('the unauthenticated harvest-status route stays uncalled by live client code', () => {
    // `/api/harvest/status` takes identity from a `?username=` query parameter
    // and has no session auth — a username-enumeration oracle. Nothing may
    // revive it; the server's answer now rides on the tile payload instead.
    const offenders: string[] = [];
    for (const dir of ['components', 'context', 'app/game', 'utils', 'hooks']) {
      const abs = join(ROOT, dir);
      if (!readdirSync(ROOT).includes(dir)) continue;
      walk(abs, []).forEach((f) => {
        if (readFileSync(f, 'utf8').includes('/api/harvest/status')) {
          offenders.push(f.slice(ROOT.length + 1).replace(/\\/g, '/'));
        }
      });
    }
    expect(
      offenders,
      `live client code must not call the unauthenticated /api/harvest/status:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
