/**
 * @file components/MovementControls.test.tsx
 * @created 2025-10-23
 * @overview Unit tests for MovementControls component
 * 
 * OVERVIEW:
 * Comprehensive tests for the MovementControls component covering:
 * - 9-direction movement compass rendering
 * - Keyboard input handling (WASD, arrow keys, numpad)
 * - Button click interactions
 * - Loading state management
 * - Movement direction validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MovementControls from './MovementControls';
import { useGameContext } from '@/context/GameContext';
import { MovementDirection } from '@/types';

// Mock dependencies
vi.mock('@/context/GameContext');

describe('MovementControls', () => {
  const mockMovePlayer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useGameContext as any).mockReturnValue({
      movePlayer: mockMovePlayer,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render movement controls title', () => {
      render(<MovementControls />);
      
      expect(screen.getByText('🎮 MOVEMENT CONTROLS')).toBeInTheDocument();
    });

    it('should render all 9 directional buttons', () => {
      render(<MovementControls />);
      
      // Find buttons by their keyboard hints
      expect(screen.getByText('Q')).toBeInTheDocument(); // NW
      expect(screen.getByText('W')).toBeInTheDocument(); // N
      expect(screen.getByText('E')).toBeInTheDocument(); // NE
      expect(screen.getByText('A')).toBeInTheDocument(); // W
      expect(screen.getByText('S')).toBeInTheDocument(); // S
      expect(screen.getByText('D')).toBeInTheDocument(); // E
      expect(screen.getByText('Z')).toBeInTheDocument(); // SW
      expect(screen.getByText('X')).toBeInTheDocument(); // S (duplicate key)
      expect(screen.getByText('C')).toBeInTheDocument(); // SE
    });

    it('should render refresh button', () => {
      render(<MovementControls />);
      
      const refreshButton = screen.getByTitle(/Refresh/i);
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe('Button Click Movement', () => {
    it('should move north when north button is clicked', () => {
      render(<MovementControls />);
      
      const northButton = screen.getByTitle(/North \(W/i);
      fireEvent.click(northButton);
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.North);
    });

    it('should move south when south button is clicked', () => {
      render(<MovementControls />);
      
      const southButton = screen.getByTitle(/South \(X/i);
      fireEvent.click(southButton);
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.South);
    });

    it('should move east when east button is clicked', () => {
      render(<MovementControls />);
      
      const eastButton = screen.getByTitle(/East \(D/i);
      fireEvent.click(eastButton);
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.East);
    });

    it('should move west when west button is clicked', () => {
      render(<MovementControls />);
      
      const westButton = screen.getByTitle(/West \(A/i);
      fireEvent.click(westButton);
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.West);
    });

    it('should move northwest when northwest button is clicked', () => {
      render(<MovementControls />);
      
      const nwButton = screen.getByTitle(/Northwest \(Q/i);
      fireEvent.click(nwButton);
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.Northwest);
    });

    it('should move northeast when northeast button is clicked', () => {
      render(<MovementControls />);
      
      const neButton = screen.getByTitle(/Northeast \(E/i);
      fireEvent.click(neButton);
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.Northeast);
    });

    it('should move southwest when southwest button is clicked', () => {
      render(<MovementControls />);
      
      const swButton = screen.getByTitle(/Southwest \(Z/i);
      fireEvent.click(swButton);
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.Southwest);
    });

    it('should move southeast when southeast button is clicked', () => {
      render(<MovementControls />);
      
      const seButton = screen.getByTitle(/Southeast \(C/i);
      fireEvent.click(seButton);
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.Southeast);
    });
  });

  describe('Keyboard Input Handling', () => {
    it('should move north on W key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'w' });
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.North);
    });

    it('should move south on S key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'x' }); // X is south, S is refresh
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.South);
    });

    it('should move east on D key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'd' });
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.East);
    });

    it('should move west on A key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'a' });
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.West);
    });

    it('should move north on arrow up key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'ArrowUp' });
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.North);
    });

    it('should move south on arrow down key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.South);
    });

    it('should move east on arrow right key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.East);
    });

    it('should move west on arrow left key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.West);
    });

    it('should move northwest on Q key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'q' });
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.Northwest);
    });

    it('should move northeast on E key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'e' });
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.Northeast);
    });

    it('should move southwest on Z key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'z' });
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.Southwest);
    });

    it('should move southeast on C key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'c' });
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.Southeast);
    });

    it('should not move on invalid key press', () => {
      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'g' }); // Random invalid key
      
      expect(mockMovePlayer).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should disable all buttons when loading', () => {
      (useGameContext as any).mockReturnValue({
        movePlayer: mockMovePlayer,
        isLoading: true,
      });

      render(<MovementControls />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('should not move on button click when loading', () => {
      (useGameContext as any).mockReturnValue({
        movePlayer: mockMovePlayer,
        isLoading: true,
      });

      render(<MovementControls />);
      
      const northButton = screen.getByTitle(/North \(W/i);
      fireEvent.click(northButton);
      
      expect(mockMovePlayer).not.toHaveBeenCalled();
    });

    it('should not move on keyboard press when loading', () => {
      (useGameContext as any).mockReturnValue({
        movePlayer: mockMovePlayer,
        isLoading: true,
      });

      render(<MovementControls />);
      
      fireEvent.keyDown(window, { key: 'w' });
      
      expect(mockMovePlayer).not.toHaveBeenCalled();
    });

    it('should enable buttons when not loading', () => {
      render(<MovementControls />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('Event Cleanup', () => {
    it('should remove keyboard event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      const { unmount } = render(<MovementControls />);
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Refresh Button', () => {
    it('should call movePlayer with Refresh direction when refresh is clicked', () => {
      render(<MovementControls />);
      
      const refreshButton = screen.getByTitle(/Refresh/i);
      fireEvent.click(refreshButton);
      
      expect(mockMovePlayer).toHaveBeenCalledWith(MovementDirection.Refresh);
    });

    it('should not refresh when loading', () => {
      (useGameContext as any).mockReturnValue({
        movePlayer: mockMovePlayer,
        isLoading: true,
      });

      render(<MovementControls />);
      
      const refreshButton = screen.getByTitle(/Refresh/i);
      fireEvent.click(refreshButton);
      
      expect(mockMovePlayer).not.toHaveBeenCalled();
    });
  });
});
