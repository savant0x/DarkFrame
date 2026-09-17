/**
 * @file components/TileRenderer.protection.test.tsx
 * @created 2026-09-16
 * @overview FID-20260916-002 UI pins: raid CTAs grey out with an honest
 *            countdown while a tile's base owner is inside their new-player
 *            protection window; CTAs render normally otherwise. Scoped to the
 *            protection behavior — the rest of TileRenderer is covered by its
 *            own suites.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TileRenderer from './TileRenderer';
import { useGameContext } from '@/context/GameContext';
import { TerrainType, type Tile } from '@/types';

vi.mock('@/context/GameContext');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn(), forward: vi.fn() }),
}));
vi.mock('@/lib/imageService', () => ({
  getTerrainImage: () => null,
  getBankImage: () => null,
  // FID-20260917-003: level-driven signature (returns the tier path)
  getBaseImage: async () => '/assets/tiles/bases/1.jpg',
  levelToBaseTier: (level: number) => Math.min(10, Math.max(1, Math.ceil(level / 10))),
}));
vi.mock('./SafeHtmlRenderer', () => ({
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
    currentPosition: { x: 1, y: 1 },
    resources: { metal: 0, energy: 0 },
  } as GameState['player'],
});

/** Enemy-owned base tile on a plain wasteland (keeps other CTAs out of the DOM). */
const makeEnemyBaseTile = (overrides: Partial<Tile> = {}): Tile =>
  ({
    x: 50,
    y: 50,
    terrain: TerrainType.Wasteland,
    occupiedByBase: true,
    baseOwner: 'SomeRaider',
    baseLevel: 12,
    ...overrides,
  }) as Tile;

describe('TileRenderer — new-player protection UI (FID-20260916-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces raid CTAs with the shielded countdown when the owner is protected', () => {
    vi.mocked(useGameContext).mockReturnValue(ctxWithPlayer('Me'));

    const soon = new Date(Date.now() + 36 * 3_600_000);
    render(
      <TileRenderer
        tile={makeEnemyBaseTile({ baseProtected: true, baseProtectionUntil: soon })}
        onAttackClick={() => {}}
        isAttacking={false}
      />
    );

    expect(screen.queryByText('ATTACK · METAL')).not.toBeInTheDocument();
    expect(screen.queryByText('ATTACK · ENERGY')).not.toBeInTheDocument();
    expect(screen.getByText(/Shielded · /)).toBeInTheDocument();
    // Honest countdown: 36h remaining → hours + minutes form ("1d 12h" would
    // only appear above the 48h threshold)
    expect(screen.getByText(/Shielded · (1d 1[0-9]h|3[0-9]h \d{1,2}m)/)).toBeInTheDocument();
  });

  it('renders the raid CTAs normally when the owner is NOT protected', () => {
    vi.mocked(useGameContext).mockReturnValue(ctxWithPlayer('Me'));

    render(
      <TileRenderer
        tile={makeEnemyBaseTile()}
        onAttackClick={() => {}}
        isAttacking={false}
      />
    );

    expect(screen.getByText('ATTACK · METAL')).toBeInTheDocument();
    expect(screen.getByText('ATTACK · ENERGY')).toBeInTheDocument();
    expect(screen.queryByText(/Shielded · /)).not.toBeInTheDocument();
  });

  it('renders the raid CTAs normally when the owner window has expired', () => {
    vi.mocked(useGameContext).mockReturnValue(ctxWithPlayer('Me'));

    render(
      <TileRenderer
        tile={makeEnemyBaseTile({ baseProtected: false, baseProtectionUntil: new Date(Date.now() - 1000) })}
        onAttackClick={() => {}}
        isAttacking={false}
      />
    );

    expect(screen.getByText('ATTACK · METAL')).toBeInTheDocument();
    expect(screen.queryByText(/Shielded · /)).not.toBeInTheDocument();
  });
});
