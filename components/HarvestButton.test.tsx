/**
 * @file components/HarvestButton.tsx.test.tsx
 * @created 2025-10-23
 * @overview Unit tests for HarvestButton component
 * 
 * OVERVIEW:
 * Comprehensive tests for the HarvestButton component covering:
 * - Button rendering and states
 * - Harvest action triggering
 * - Keyboard shortcuts (G for metal/energy, F for cave/forest)
 * - Success/failure handling
 * - Loading states
 * - Callback execution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HarvestButton from './HarvestButton';
import { useGameContext } from '@/context/GameContext';
import { TerrainType } from '@/types';
import type { SanitizedPlayer, Tile } from '@/types';

// Mock dependencies
vi.mock('@/context/GameContext');

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

describe('HarvestButton', () => {
  /** SanitizedPlayer fixture — the full client-facing shape the context
   *  carries (private fields excluded by the type itself). */
  const mockPlayer: SanitizedPlayer = {
    username: 'testplayer',
    base: { x: 5, y: 10 },
    currentPosition: { x: 10, y: 20 },
    resources: { metal: 1000, energy: 500 },
    bank: { metal: 0, energy: 0, lastDeposit: null },
    inventory: { items: [], capacity: 50, metalDiggerCount: 0, energyDiggerCount: 0 },
    gatheringBonus: { metalBonus: 0, energyBonus: 0 },
    activeBoosts: { gatheringBoost: null, expiresAt: null },
    shrineBoosts: [],
    units: [],
    totalStrength: 0,
    totalDefense: 0,
    xp: 0,
    level: 1,
    researchPoints: 0,
    unlockedTiers: [],
  };

  const mockMetalTile: Tile = {
    terrain: TerrainType.Metal,
    x: 10,
    y: 20,
  };

  const mockEnergyTile: Tile = {
    terrain: TerrainType.Energy,
    x: 15,
    y: 25,
  };

  const mockCaveTile: Tile = {
    terrain: TerrainType.Cave,
    x: 5,
    y: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render harvest button for metal tile', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockMetalTile }));

      render(<HarvestButton />);
      
      expect(screen.getByText(/Harvest/i)).toBeInTheDocument();
    });

    it('should render harvest button for energy tile', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockEnergyTile }));

      render(<HarvestButton />);
      
      expect(screen.getByText(/Harvest/i)).toBeInTheDocument();
    });

    it('should render harvest button for cave tile', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockCaveTile }));

      render(<HarvestButton />);
      
      expect(screen.getByText(/Harvest/i)).toBeInTheDocument();
    });

    it('should not render when player is null', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: null, currentTile: mockMetalTile }));

      const { container } = render(<HarvestButton />);
      
      expect(container).toBeEmptyDOMElement();
    });

    it('should not render when current tile is null', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: null }));

      const { container } = render(<HarvestButton />);
      
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Button Click Harvesting', () => {
    it('should call harvest API when button is clicked', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Harvested successfully',
          metalGained: 1000,
          energyGained: 0,
        }),
      });

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockMetalTile }));

      render(<HarvestButton />);
      
      const harvestButton = screen.getByText(/Harvest/i);
      fireEvent.click(harvestButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/harvest',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'testplayer' }),
          })
        );
      });
    });

    it('should call onHarvestResult callback on success', async () => {
      const onHarvestResult = vi.fn();
      const harvestData = {
        success: true,
        message: 'Harvested successfully',
        metalGained: 1000,
        energyGained: 0,
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => harvestData,
      });

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockMetalTile }));

      render(<HarvestButton onHarvestResult={onHarvestResult} />);
      
      const harvestButton = screen.getByText(/Harvest/i);
      fireEvent.click(harvestButton);
      
      await waitFor(() => {
        expect(onHarvestResult).toHaveBeenCalledWith(harvestData);
      });
    });

    it('should call onHarvestResult callback on API failure', async () => {
      const onHarvestResult = vi.fn();

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          message: 'Already harvested this tile',
        }),
      });

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockMetalTile }));

      render(<HarvestButton onHarvestResult={onHarvestResult} />);
      
      const harvestButton = screen.getByText(/Harvest/i);
      fireEvent.click(harvestButton);
      
      await waitFor(() => {
        expect(onHarvestResult).toHaveBeenCalledWith({
          success: false,
          message: 'Already harvested this tile',
          metalGained: 0,
          energyGained: 0,
        });
      });
    });

    it('should call onHarvestResult callback on network error', async () => {
      const onHarvestResult = vi.fn();

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockMetalTile }));

      render(<HarvestButton onHarvestResult={onHarvestResult} />);
      
      const harvestButton = screen.getByText(/Harvest/i);
      fireEvent.click(harvestButton);
      
      await waitFor(() => {
        expect(onHarvestResult).toHaveBeenCalledWith({
          success: false,
          message: 'Network error - please try again',
          metalGained: 0,
          energyGained: 0,
        });
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should harvest metal tile on G key press', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          metalGained: 1000,
          energyGained: 0,
        }),
      });

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockMetalTile }));

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'g' });
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/harvest', expect.any(Object));
      });
    });

    it('should harvest energy tile on G key press', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          metalGained: 0,
          energyGained: 800,
        }),
      });

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockEnergyTile }));

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'G' }); // Uppercase also works
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/harvest', expect.any(Object));
      });
    });

    it('should harvest cave tile on F key press', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          itemFound: { name: 'Ancient Relic', rarity: 'rare' },
          metalGained: 0,
          energyGained: 0,
        }),
      });

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockCaveTile }));

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'f' });
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/harvest', expect.any(Object));
      });
    });

    it('should not harvest metal tile on F key press', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockMetalTile }));

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'f' });
      
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not harvest cave tile on G key press', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockCaveTile }));

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'g' });
      
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('should show harvesting text when action is in progress', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, metalGained: 1000, energyGained: 0 })
        }), 100))
      );

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockMetalTile }));

      render(<HarvestButton />);
      
      const harvestButton = screen.getByRole('button');
      fireEvent.click(harvestButton);
      
      // Button should show "HARVESTING..." and be disabled
      await waitFor(() => {
        expect(screen.getByText('HARVESTING...')).toBeInTheDocument();
      });
    });

    it('should not harvest when button is clicked while loading', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockMetalTile, isLoading: true }));

      render(<HarvestButton />);
      
      const harvestButton = screen.getByText(/Harvest/i);
      fireEvent.click(harvestButton);
      
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not harvest on keyboard press while loading', () => {
      vi.mocked(useGameContext).mockReturnValue(makeCtx({ currentTile: mockMetalTile, isLoading: true }));

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'g' });
      
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should prevent multiple simultaneous harvests', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, metalGained: 1000, energyGained: 0 })
        }), 100))
      );

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockMetalTile }));

      render(<HarvestButton />);
      
      const harvestButton = screen.getByText(/Harvest/i);
      
      // Click twice rapidly
      fireEvent.click(harvestButton);
      fireEvent.click(harvestButton);
      
      // Should only be called once
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Event Cleanup', () => {
    it('should remove keyboard event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      vi.mocked(useGameContext).mockReturnValue(makeCtx({ player: mockPlayer, currentTile: mockMetalTile }));
      
      const { unmount } = render(<HarvestButton />);
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
});
