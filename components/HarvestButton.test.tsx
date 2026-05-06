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

// Mock dependencies
vi.mock('@/context/GameContext');

describe('HarvestButton', () => {
  const mockPlayer = {
    username: 'testplayer',
    resources: { metal: 1000, energy: 500 },
  };

  const mockMetalTile = {
    terrain: TerrainType.Metal,
    x: 10,
    y: 20,
  };

  const mockEnergyTile = {
    terrain: TerrainType.Energy,
    x: 15,
    y: 25,
  };

  const mockCaveTile = {
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
      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: false,
      });

      render(<HarvestButton />);
      
      expect(screen.getByText(/Harvest/i)).toBeInTheDocument();
    });

    it('should render harvest button for energy tile', () => {
      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockEnergyTile,
        isLoading: false,
      });

      render(<HarvestButton />);
      
      expect(screen.getByText(/Harvest/i)).toBeInTheDocument();
    });

    it('should render harvest button for cave tile', () => {
      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockCaveTile,
        isLoading: false,
      });

      render(<HarvestButton />);
      
      expect(screen.getByText(/Harvest/i)).toBeInTheDocument();
    });

    it('should not render when player is null', () => {
      (useGameContext as any).mockReturnValue({
        player: null,
        currentTile: mockMetalTile,
        isLoading: false,
      });

      const { container } = render(<HarvestButton />);
      
      expect(container).toBeEmptyDOMElement();
    });

    it('should not render when current tile is null', () => {
      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: null,
        isLoading: false,
      });

      const { container } = render(<HarvestButton />);
      
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Button Click Harvesting', () => {
    it('should call harvest API when button is clicked', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Harvested successfully',
          metalGained: 1000,
          energyGained: 0,
        }),
      });

      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: false,
      });

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

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => harvestData,
      });

      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: false,
      });

      render(<HarvestButton onHarvestResult={onHarvestResult} />);
      
      const harvestButton = screen.getByText(/Harvest/i);
      fireEvent.click(harvestButton);
      
      await waitFor(() => {
        expect(onHarvestResult).toHaveBeenCalledWith(harvestData);
      });
    });

    it('should call onHarvestResult callback on API failure', async () => {
      const onHarvestResult = vi.fn();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          message: 'Already harvested this tile',
        }),
      });

      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: false,
      });

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

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: false,
      });

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
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          metalGained: 1000,
          energyGained: 0,
        }),
      });

      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: false,
      });

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'g' });
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/harvest', expect.any(Object));
      });
    });

    it('should harvest energy tile on G key press', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          metalGained: 0,
          energyGained: 800,
        }),
      });

      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockEnergyTile,
        isLoading: false,
      });

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'G' }); // Uppercase also works
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/harvest', expect.any(Object));
      });
    });

    it('should harvest cave tile on F key press', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          itemFound: { name: 'Ancient Relic', rarity: 'rare' },
          metalGained: 0,
          energyGained: 0,
        }),
      });

      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockCaveTile,
        isLoading: false,
      });

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'f' });
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/harvest', expect.any(Object));
      });
    });

    it('should not harvest metal tile on F key press', () => {
      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: false,
      });

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'f' });
      
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not harvest cave tile on G key press', () => {
      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockCaveTile,
        isLoading: false,
      });

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'g' });
      
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('should show harvesting text when action is in progress', async () => {
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, metalGained: 1000, energyGained: 0 })
        }), 100))
      );

      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: false,
      });

      render(<HarvestButton />);
      
      const harvestButton = screen.getByRole('button');
      fireEvent.click(harvestButton);
      
      // Button should show "HARVESTING..." and be disabled
      await waitFor(() => {
        expect(screen.getByText('HARVESTING...')).toBeInTheDocument();
      });
    });

    it('should not harvest when button is clicked while loading', () => {
      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: true,
      });

      render(<HarvestButton />);
      
      const harvestButton = screen.getByText(/Harvest/i);
      fireEvent.click(harvestButton);
      
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not harvest on keyboard press while loading', () => {
      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: true,
      });

      render(<HarvestButton />);
      
      fireEvent.keyDown(window, { key: 'g' });
      
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should prevent multiple simultaneous harvests', async () => {
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, metalGained: 1000, energyGained: 0 })
        }), 100))
      );

      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: false,
      });

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

      (useGameContext as any).mockReturnValue({
        player: mockPlayer,
        currentTile: mockMetalTile,
        isLoading: false,
      });
      
      const { unmount } = render(<HarvestButton />);
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
});
