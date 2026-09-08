/**
 * @file components/StatsPanel.test.tsx
 * @created 2025-10-23
 * @overview Unit tests for StatsPanel component
 * 
 * OVERVIEW:
 * Comprehensive tests for the StatsPanel component covering:
 * - Resource display (metal, energy, RP)
 * - Player information rendering
 * - Position tracking (current/base)
 * - Clan integration
 * - Shrine boost timers
 * - User interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatsPanel from './StatsPanel';
import { useGameContext } from '@/context/GameContext';
import { useRouter } from 'next/navigation';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { SanitizedPlayer } from '@/types';

// Mock dependencies
vi.mock('@/context/GameContext');
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/hooks', () => ({
  useCountUp: (value: number) => value,
  useIsMobile: () => false,
}));

vi.mock('./BalanceIndicator', () => ({
  default: () => <div>BalanceIndicator</div>,
}));

vi.mock('./XPProgressBar', () => ({
  default: ({ level, currentLevelXP, xpForNextLevel, _totalXP }: {
    level: number;
    currentLevelXP: number;
    xpForNextLevel: number;
    /** Renamed to satisfy the unused-var rule while keeping the prop contract
     *  visible; the mock stub renders only the three fields the tests assert. */
    _totalXP: number;
  }) => (
    <div data-testid="xp-progress-bar">
      Level {level}: {currentLevelXP}/{xpForNextLevel}
    </div>
  ),
}));

/** Full GameContextState as returned by useGameContext — ReturnType keeps the
 *  unexported interface honest without touching production code. */
type GameState = ReturnType<typeof useGameContext>;

/** Complete context value with typed no-op collaborators; each test overrides
 *  only the fields its component actually reads. */
const baseCtx: GameState = {
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
};

const makeCtx = (overrides: Partial<GameState>): GameState => ({ ...baseCtx, ...overrides });

const mockRouter: AppRouterInstance = {
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
};

describe('StatsPanel', () => {
  /** SanitizedPlayer fixture — the full client-facing shape the context
   *  carries (private fields excluded by the type itself). */
  const mockPlayer: SanitizedPlayer = {
    username: 'TestCommander',
    level: 5,
    rank: 12,
    xp: 1500,
    researchPoints: 250,
    factoryCount: 3,
    base: { x: 5, y: 15 },
    currentPosition: { x: 10, y: 20 },
    resources: {
      metal: 5000,
      energy: 3000,
    },
    bank: {
      metal: 10000,
      energy: 8000,
      lastDeposit: null,
    },
    inventory: { items: [], capacity: 50, metalDiggerCount: 0, energyDiggerCount: 0 },
    gatheringBonus: { metalBonus: 0, energyBonus: 0 },
    activeBoosts: { gatheringBoost: null, expiresAt: null },
    units: [],
    totalStrength: 150,
    totalDefense: 120,
    shrineBoosts: [],
    unlockedTiers: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue(mockRouter);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Loading State', () => {
    it('should show loading message when player is null', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: null }));

      render(<StatsPanel />);
      
      expect(screen.getByText('Loading player data...')).toBeInTheDocument();
    });
  });

  describe('Player Information', () => {
    beforeEach(() => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer }));
    });

    it('should display username correctly', () => {
      render(<StatsPanel />);
      
      expect(screen.getByText('TestCommander')).toBeInTheDocument();
    });

    it('should display level and rank', () => {
      render(<StatsPanel />);
      
      expect(screen.getByText('5')).toBeInTheDocument(); // Level
      expect(screen.getByText('12')).toBeInTheDocument(); // Rank
    });

    it('should display factory count', () => {
      render(<StatsPanel />);
      
      expect(screen.getByText('3')).toBeInTheDocument(); // Factory count
    });

    it('should display research points when available', () => {
      const playerWithXP = {
        ...mockPlayer,
        xpProgress: {
          currentLevelXP: 500,
          progressPercent: 50,
          xpForNextLevel: 1000,
        },
      };

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: playerWithXP }));

      render(<StatsPanel />);
      
      // Research points shown when xpProgress exists (rendered as "250 RP")
      expect(screen.getByText(/250/)).toBeInTheDocument();
    });
  });

  describe('Position Display', () => {
    beforeEach(() => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer }));
    });

    it('should display current position', () => {
      render(<StatsPanel />);
      
      expect(screen.getByText('(10, 20)')).toBeInTheDocument();
    });

    it('should display base position', () => {
      render(<StatsPanel />);
      
      expect(screen.getByText('(5, 15)')).toBeInTheDocument();
    });
  });

  describe('Resource Display', () => {
    beforeEach(() => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer }));
    });

    it('should display metal amount with proper formatting', () => {
      render(<StatsPanel />);
      
      expect(screen.getByText('5,000')).toBeInTheDocument();
    });

    it('should display energy amount with proper formatting', () => {
      render(<StatsPanel />);
      
      expect(screen.getByText('3,000')).toBeInTheDocument();
    });

    it('should display banked metal', () => {
      render(<StatsPanel />);
      
      expect(screen.getByText('10,000')).toBeInTheDocument();
    });

    it('should display banked energy', () => {
      render(<StatsPanel />);
      
      expect(screen.getByText('8,000')).toBeInTheDocument();
    });

    it('should handle zero resources', () => {
      const playerWithNoResources = {
        ...mockPlayer,
        resources: { metal: 0, energy: 0 },
        bank: { metal: 0, energy: 0, lastDeposit: null },
      };

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: playerWithNoResources }));

      render(<StatsPanel />);
      
      // Should display 0 for resources
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThan(0);
    });
  });

  describe('Clan Integration', () => {
    it('should show "Join / Create" button when player has no clan', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer }));

      render(<StatsPanel />);
      
      expect(screen.getByText('Join / Create')).toBeInTheDocument();
    });

    it('should navigate to clan page when "Join / Create" is clicked', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer }));

      render(<StatsPanel />);
      
      const joinButton = screen.getByText('Join / Create');
      fireEvent.click(joinButton);
      
      expect(mockRouter.push).toHaveBeenCalledWith('/clan');
    });

    it('should display clan name when player is in a clan', async () => {
      const playerWithClan = {
        ...mockPlayer,
        clanId: 'clan123',
        clanName: 'Elite Warriors',
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tag: 'EW' }),
      });

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: playerWithClan }));

      render(<StatsPanel />);
      
      // Use getAllByText since clan name appears multiple times
      const clanNames = screen.getAllByText('Elite Warriors');
      expect(clanNames.length).toBeGreaterThan(0);
      
      // Should fetch clan tag
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/clan?clanId=clan123');
      });
    });

    it('should display clan tag when fetched', async () => {
      const playerWithClan = {
        ...mockPlayer,
        clanId: 'clan123',
        clanName: 'Elite Warriors',
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tag: 'EW' }),
      });

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: playerWithClan }));

      render(<StatsPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('[EW]')).toBeInTheDocument();
      });
    });

    it('should call custom onClanClick when provided', () => {
      const onClanClick = vi.fn();

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer }));

      render(<StatsPanel onClanClick={onClanClick} />);
      
      const joinButton = screen.getByText('Join / Create');
      fireEvent.click(joinButton);
      
      expect(onClanClick).toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe('Shrine Boost Display', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should display active shrine boosts with timers', () => {
      const now = new Date('2025-10-23T12:00:00Z');
      vi.setSystemTime(now);

      const playerWithBoosts = {
        ...mockPlayer,
        shrineBoosts: [
          {
            tier: 'spade' as const,
            yieldBonus: 0.25, // ShrineBoost contract: fraction, +25%
            expiresAt: new Date('2025-10-23T15:30:00Z'), // 3h 30m from now
          },
        ],
      };

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: playerWithBoosts }));

      render(<StatsPanel />);
      
      // Timer should update
      vi.advanceTimersByTime(1000);
      
      expect(screen.getByText(/3h 30m/)).toBeInTheDocument();
    });

    it('should not display expired shrine boosts', () => {
      const now = new Date('2025-10-23T12:00:00Z');
      vi.setSystemTime(now);

      const playerWithExpiredBoost = {
        ...mockPlayer,
        shrineBoosts: [
          {
            tier: 'spade' as const,
            yieldBonus: 0.25,
            expiresAt: new Date('2025-10-23T11:00:00Z'), // Expired 1 hour ago
          },
        ],
      };

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: playerWithExpiredBoost }));

      render(<StatsPanel />);
      
      // Expired boost should not appear
      expect(screen.queryByText(/1h/)).not.toBeInTheDocument();
    });

    it('should update timers every second', () => {
      const now = new Date('2025-10-23T12:00:00Z');
      vi.setSystemTime(now);

      const playerWithBoosts = {
        ...mockPlayer,
        shrineBoosts: [
          {
            tier: 'heart' as const,
            yieldBonus: 0.5, // +50%
            expiresAt: new Date('2025-10-23T14:00:00Z'), // 2 hours from now
          },
        ],
      };

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: playerWithBoosts }));

      render(<StatsPanel />);
      
      // Should display timer (2h 0m)
      vi.advanceTimersByTime(1000); // Advance to trigger first timer update
      expect(screen.getByText(/2h 0m/)).toBeInTheDocument();
    });
  });

  describe('Military Stats', () => {
    beforeEach(() => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer }));
    });

    it('should display total strength', () => {
      render(<StatsPanel />);
      
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('should display total defense', () => {
      render(<StatsPanel />);
      
      expect(screen.getByText('120')).toBeInTheDocument();
    });

    it('should calculate effective power', () => {
      render(<StatsPanel />);
      
      // Effective power = strength + defense = 150 + 120 = 270
      expect(screen.getByText('270')).toBeInTheDocument();
    });
  });

  describe('XP Progress', () => {
    it('should display XP progress bar when xpProgress exists', () => {
      const playerWithXP = {
        ...mockPlayer,
        xpProgress: {
          currentLevelXP: 500,
          progressPercent: 50,
          xpForNextLevel: 1000,
        },
      };

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: playerWithXP }));

      render(<StatsPanel />);
      
      // FID-20260906-012 P2-R0: XP now renders as the sample §02 meter
      // ("XP · LEVEL 5" label + Orbitron "500 / 1,000" readout) in-panel.
      expect(screen.getByText(/XP · LEVEL 5/i)).toBeInTheDocument();
      expect(screen.getByText('500 / 1,000')).toBeInTheDocument();
    });

    it('should not display XP progress bar when xpProgress is missing', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer }));

      render(<StatsPanel />);
      
      expect(screen.queryByTestId('xp-progress-bar')).not.toBeInTheDocument();
    });
  });
});
