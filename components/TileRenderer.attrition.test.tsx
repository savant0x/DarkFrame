/**
 * @file components/TileRenderer.attrition.test.tsx
 * @overview FID-20261003-002 UI pins: the attack badge surfaces the raid's
 *            attrition truth from the server log — survivors per side (with
 *            the historical-row fallback), the per-round loss summary, and
 *            the saved-army floor note — and renders nothing extra when the
 *            response carries no battle log.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import TileRenderer from './TileRenderer';
import { useGameContext } from '@/context/GameContext';
import { TerrainType, BattleType, type Tile } from '@/types';
import type { AttackResult, BattleLog } from '@/types/game.types';

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

const makeEnemyBaseTile = (): Tile =>
  ({
    x: 50,
    y: 50,
    terrain: TerrainType.Wasteland,
    occupiedByBase: true,
    baseOwner: 'SomeRaider',
    baseLevel: 12,
  }) as Tile;

const u = (id: string) => ({
  id,
  type: 'T1_RIFLEMAN',
  strength: 20,
  defense: 5,
  producedAt: { x: 0, y: 0 },
  producedDate: new Date(),
  owner: 'Me',
});

/** The hand-traced 3-round attrition log (mirrors combatAttrition.integration). */
const makeBattle = (overrides: Partial<BattleLog> = {}): BattleLog =>
  ({
    battleId: 'BATTLE-1',
    battleType: BattleType.BaseRaid,
    timestamp: new Date('2026-10-03T12:00:00Z'),
    attacker: {
      username: 'Me',
      units: [u('a1'), u('a2'), u('a3'), u('a4')],
      totalSTR: 80, totalDEF: 20, initialHP: 100, finalHP: 90,
      unitsLost: 0, unitsCaptured: 0, survivorCount: 4,
      startingHP: 100, endingHP: 90, damageDealt: 171, xpEarned: 0,
    },
    defender: {
      username: 'SomeRaider',
      units: [u('d1'), u('d2'), u('d3'), u('d4'), u('d5')],
      totalSTR: 25, totalDEF: 75, initialHP: 100, finalHP: 0,
      unitsLost: 5, unitsCaptured: 0, survivorCount: 0,
      startingHP: 100, endingHP: 0, damageDealt: 10, xpEarned: 0,
    },
    outcome: 'ATTACKER_WIN',
    rounds: [
      { roundNumber: 1, attackerDamage: 42, defenderDamage: 5, attackerHP: 95, defenderHP: 58, attackerUnitsLost: 0, defenderUnitsLost: 2 },
      { roundNumber: 2, attackerDamage: 57, defenderDamage: 5, attackerHP: 90, defenderHP: 16, attackerUnitsLost: 0, defenderUnitsLost: 2 },
      { roundNumber: 3, attackerDamage: 72, defenderDamage: 0, attackerHP: 90, defenderHP: 0, attackerUnitsLost: 0, defenderUnitsLost: 1 },
    ],
    totalRounds: 3,
    attackerXP: 0,
    defenderXP: 0,
    ...overrides,
  }) as BattleLog;

describe('TileRenderer — attrition readout (FID-20261003-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders survivors, per-round losses and the floor note from the battle log', () => {
    vi.mocked(useGameContext).mockReturnValue(ctxWithPlayer('Me'));
    const battle = makeBattle({ notes: 'Saved-army floor: 2 battle casualties capped to 1 persisted (25% pool floor)' });

    const { container } = render(
      <TileRenderer tile={makeEnemyBaseTile()} onAttackClick={() => {}} isAttacking={false} attackResult={{ success: true, message: 'x', playerPower: 0, factoryDefense: 0, captured: true, battle } as AttackResult} />
    );

    expect(container.textContent).toContain('🙂 4/4');
    expect(container.textContent).toContain('🛡 0/5');
    expect(container.textContent).toContain('💀 A 0·0·0 / D 2·2·1');
    expect(container.textContent).toContain('Saved-army floor: 2 battle casualties capped to 1 persisted (25% pool floor)');
  });

  it('derives survivors from brought − lost when survivorCount is absent (historical rows)', () => {
    vi.mocked(useGameContext).mockReturnValue(ctxWithPlayer('Me'));
    const battle = makeBattle();
    delete (battle.attacker as { survivorCount?: number }).survivorCount;
    delete (battle.defender as { survivorCount?: number }).survivorCount;

    const { container } = render(
      <TileRenderer tile={makeEnemyBaseTile()} onAttackClick={() => {}} isAttacking={false} attackResult={{ success: true, message: 'x', playerPower: 0, factoryDefense: 0, captured: true, battle } as AttackResult} />
    );

    expect(container.textContent).toContain('🙂 4/4');
    expect(container.textContent).toContain('🛡 0/5');
  });

  it('renders no attrition strip when the response carries no battle log', () => {
    vi.mocked(useGameContext).mockReturnValue(ctxWithPlayer('Me'));

    const { container } = render(
      <TileRenderer tile={makeEnemyBaseTile()} onAttackClick={() => {}} isAttacking={false} attackResult={{ success: true, message: 'x', playerPower: 0, factoryDefense: 0, captured: true } as AttackResult} />
    );

    expect(container.textContent).not.toContain('🙂');
    expect(container.textContent).not.toContain('💀 A');
  });
});
