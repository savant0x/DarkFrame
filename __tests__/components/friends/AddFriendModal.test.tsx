/**
 * @file __tests__/components/friends/AddFriendModal.test.tsx
 * @created 2025-10-26
 * @overview Component tests for AddFriendModal
 * 
 * Tests cover:
 * - Modal rendering
 * - User search functionality
 * - Send friend request
 * - Optional message
 * - Search result filtering
 * - Error handling
 * - Close functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddFriendModal from '@/components/friends/AddFriendModal';

// Mock fetch
global.fetch = vi.fn();

describe('AddFriendModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================
  describe('Rendering', () => {
    it('should render modal when isOpen is true', () => {
      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      expect(screen.getByText(/add friend/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter username/i)).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      render(<AddFriendModal isOpen={false} onClose={() => {}} />);

      expect(screen.queryByText(/add friend/i)).not.toBeInTheDocument();
    });

    it('should display search input and button', () => {
      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      expect(screen.getByPlaceholderText(/enter username/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    });
  });

  // ============================================================
  // SEARCH TESTS
  // ============================================================
  describe('Search Functionality', () => {
    it('should search for players successfully', async () => {
      const mockResults = [
        { username: 'player1', level: 10, vip: false, friendStatus: 'none' },
        { username: 'player2', level: 15, vip: true, friendStatus: 'none' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, results: mockResults })
      });

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'player');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText('player1')).toBeInTheDocument();
        expect(screen.getByText('player2')).toBeInTheDocument();
      });
    });

    it('should display VIP badge for VIP players', async () => {
      const mockResults = [
        { username: 'vipPlayer', level: 20, vip: true, friendStatus: 'none' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, results: mockResults })
      });

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'vip');
      await waitFor(() => {
        expect(screen.getByText(/VIP/i)).toBeInTheDocument();
      });
    });

    it('should display friend status in search results', async () => {
      const mockResults = [
        { username: 'friend1', level: 10, vip: false, friendStatus: 'friends' },
        { username: 'pending1', level: 12, vip: false, friendStatus: 'pending' },
        { username: 'blocked1', level: 8, vip: false, friendStatus: 'blocked' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, results: mockResults })
      });

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'test');
      await waitFor(() => {
        expect(screen.getByText(/already friends/i)).toBeInTheDocument();
        expect(screen.getByText(/pending/i)).toBeInTheDocument();
        expect(screen.getByText(/blocked/i)).toBeInTheDocument();
      });
    });

    it('should show empty state when no results found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, results: [] })
      });

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'nonexistent');
      await waitFor(() => {
        expect(screen.getByText(/no players found/i)).toBeInTheDocument();
      });
    });

    it('should require minimum search length', async () => {
      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'a'); // Only 1 character

      const searchButton = screen.getByRole('button', { name: /search/i });
      await userEvent.click(searchButton);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
    });
  });

  // ============================================================
  // SEND REQUEST TESTS
  // ============================================================
  describe('Send Friend Request', () => {
    it('should send friend request successfully', async () => {
      const mockResults = [
        { username: 'player1', level: 10, vip: false, friendStatus: 'none' }
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, results: mockResults })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, request: { requestId: 'req-123' } })
        });

      const onRequestSent = vi.fn();
      render(<AddFriendModal isOpen={true} onClose={() => {}} onRequestSent={onRequestSent} />);

      // Search for player
      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'player');
      await waitFor(() => {
        expect(screen.getByText('player1')).toBeInTheDocument();
      });

      // Send request
      const addButton = screen.getByRole('button', { name: /add friend/i });
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(onRequestSent).toHaveBeenCalled();
      });
    });

    it('should include optional message with request', async () => {
      const mockResults = [
        { username: 'player1', level: 10, vip: false, friendStatus: 'none' }
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, results: mockResults })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, request: { requestId: 'req-123' } })
        });

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      // Search for player
      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'player');
      await waitFor(() => {
        expect(screen.getByText('player1')).toBeInTheDocument();
      });

      // Click add friend to show message input
      const addButton = screen.getByRole('button', { name: /add friend/i });
      await userEvent.click(addButton);

      // Type message
      const messageInput = screen.getByPlaceholderText(/optional message/i);
      await userEvent.type(messageInput, 'Hey, want to be friends?');

      // Send request
      const sendButton = screen.getByRole('button', { name: /send request/i });
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('Hey, want to be friends?')
          })
        );
      });
    });

    it('should enforce message length limit', async () => {
      const mockResults = [
        { username: 'player1', level: 10, vip: false, friendStatus: 'none' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, results: mockResults })
      });

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      // Search and select player
      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'player');
      await waitFor(() => {
        expect(screen.getByText('player1')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add friend/i });
      await userEvent.click(addButton);

      // Try to type message > 200 characters
      const messageInput = screen.getByPlaceholderText(/optional message/i);
      const longMessage = 'a'.repeat(201);
      await userEvent.type(messageInput, longMessage);

      expect(messageInput).toHaveValue(expect.stringMatching(/^.{0,200}$/));
    });

    it('should disable add button for already friends', async () => {
      const mockResults = [
        { username: 'friend1', level: 10, vip: false, friendStatus: 'friends' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, results: mockResults })
      });

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'friend');
      await waitFor(() => {
        expect(screen.getByText(/already friends/i)).toBeInTheDocument();
      });

      const addButton = screen.queryByRole('button', { name: /add friend/i });
      expect(addButton).not.toBeInTheDocument();
    });
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================
  describe('Error Handling', () => {
    it('should display error when search fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, message: 'Search failed' })
      });

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'player');
      await waitFor(() => {
        expect(screen.getByText(/search failed/i)).toBeInTheDocument();
      });
    });

    it('should display error when send request fails', async () => {
      const mockResults = [
        { username: 'player1', level: 10, vip: false, friendStatus: 'none' }
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, results: mockResults })
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ success: false, message: 'Request already exists' })
        });

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'player');
      await waitFor(() => {
        expect(screen.getByText('player1')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add friend/i });
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/request already exists/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // CLOSE TESTS
  // ============================================================
  describe('Close Functionality', () => {
    it('should call onClose when close button clicked', async () => {
      const onClose = vi.fn();
      render(<AddFriendModal isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should clear search results when closing', async () => {
      const mockResults = [
        { username: 'player1', level: 10, vip: false, friendStatus: 'none' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, results: mockResults })
      });

      const { rerender } = render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await userEvent.type(searchInput, 'player');
      await waitFor(() => {
        expect(screen.getByText('player1')).toBeInTheDocument();
      });

      // Close and reopen
      rerender(<AddFriendModal isOpen={false} onClose={() => {}} />);
      rerender(<AddFriendModal isOpen={true} onClose={() => {}} />);

      expect(screen.queryByText('player1')).not.toBeInTheDocument();
    });
  });
});

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * TEST COVERAGE:
 * - Rendering: 3 tests (open/closed states, elements)
 * - Search: 5 tests (success, VIP badge, status, empty, min length)
 * - Send Request: 4 tests (success, message, length limit, disabled)
 * - Error Handling: 2 tests (search failure, send failure)
 * - Close: 2 tests (close button, clear results)
 * 
 * Total: 16 component tests
 * 
 * TO RUN:
 * npm run test -- AddFriendModal.test.tsx
 * 
 * DEPENDENCIES:
 * - @testing-library/react
 * - @testing-library/user-event
 * - vitest
 * 
 * COVERAGE GOALS:
 * - Statements: > 80%
 * - Branches: > 75%
 * - Functions: > 80%
 * - Lines: > 80%
 */



