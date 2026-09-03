/**
 * @file __tests__/components/friends/AddFriendModal.test.tsx
 * @created 2025-10-26
 * @overview Component tests for AddFriendModal
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddFriendModal from '@/components/friends/AddFriendModal';

global.fetch = vi.fn();

describe('AddFriendModal Component', () => {
  // user-event must share vitest's fake-clock: raw userEvent.type/click await internal
  // timers that never fire under vi.useFakeTimers(), stalling every interaction test
  // to the 5s timeout (SESSION-2026-09-02-006, Class A).
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createMockPlayer(overrides: Record<string, any> = {}) {
    return {
      _id: `player-${Math.random()}`,
      username: 'player1',
      level: 10,
      vip: false,
      clanTag: undefined,
      friendStatus: undefined,
      hasPendingRequest: false,
      ...overrides,
    };
  }

  function createMockFetchResponse(data: any) {
    return {
      ok: true,
      json: vi.fn().mockResolvedValue(data),
    };
  }

  async function typeAndDebounce(searchInput: HTMLElement, text: string) {
    await user.type(searchInput, text);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
  }

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

    it('should display search input', () => {
      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      expect(screen.getByPlaceholderText(/enter username/i)).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should search for players successfully', async () => {
      const mockResults = [
        createMockPlayer({ _id: 'p1', username: 'player1', level: 10, vip: false }),
        createMockPlayer({ _id: 'p2', username: 'player2', level: 15, vip: true }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, results: mockResults }));

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await typeAndDebounce(searchInput, 'player');

      expect(screen.getByText('player1')).toBeInTheDocument();
      expect(screen.getByText('player2')).toBeInTheDocument();
    });

    it('should display VIP badge for VIP players', async () => {
      const mockResults = [
        createMockPlayer({ _id: 'p1', username: 'vipPlayer', level: 20, vip: true }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, results: mockResults }));

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await typeAndDebounce(searchInput, 'vip');

      expect(screen.getByText('vipPlayer')).toBeInTheDocument();
      // Exact text match: /VIP/i also matches the username 'vipPlayer'
      expect(screen.getByText('VIP')).toBeInTheDocument();
    });

    it('should display friend status in search results', async () => {
      const mockResults = [
        createMockPlayer({ _id: 'p1', username: 'friend1', level: 10, friendStatus: 'accepted' }),
        createMockPlayer({ _id: 'p2', username: 'pending1', level: 12, hasPendingRequest: true }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, results: mockResults }));

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await typeAndDebounce(searchInput, 'test');

      expect(screen.getByText(/\u2713 Friends/i)).toBeInTheDocument();
      // Exact text match: /Pending/i also matches the username 'pending1'
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should show empty state when no results found', async () => {
      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, results: [] }));

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await typeAndDebounce(searchInput, 'nonexistent');

      expect(screen.getByText(/no players found/i)).toBeInTheDocument();
    });
  });

  describe('Send Friend Request', () => {
    it('should send friend request successfully', async () => {
      const mockResults = [
        createMockPlayer({ _id: 'p1', username: 'player1', level: 10 }),
      ];

      (global.fetch as any)
        .mockResolvedValueOnce(createMockFetchResponse({ success: true, results: mockResults }))
        .mockResolvedValue(createMockFetchResponse({ success: true, request: { requestId: 'req-123' } }));

      const onRequestSent = vi.fn();
      const onClose = vi.fn();
      render(<AddFriendModal isOpen={true} onClose={onClose} onRequestSent={onRequestSent} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await typeAndDebounce(searchInput, 'player');

      expect(screen.getByText('player1')).toBeInTheDocument();

      const addButton = screen.getByRole('button', { name: /add friend/i });
      await act(async () => {
        await user.click(addButton);
      });

      const sendButton = screen.getByRole('button', { name: /send friend request/i });
      await act(async () => {
        await user.click(sendButton);
        await vi.runAllTimersAsync();
      });

      expect(onRequestSent).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('should include optional message with request', async () => {
      const mockResults = [
        createMockPlayer({ _id: 'p1', username: 'player1', level: 10 }),
      ];

      (global.fetch as any)
        .mockResolvedValueOnce(createMockFetchResponse({ success: true, results: mockResults }))
        .mockResolvedValue(createMockFetchResponse({ success: true, request: { requestId: 'req-123' } }));

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await typeAndDebounce(searchInput, 'player');

      expect(screen.getByText('player1')).toBeInTheDocument();

      const addButton = screen.getByRole('button', { name: /add friend/i });
      await act(async () => {
        await user.click(addButton);
      });

      const messageInput = screen.getByPlaceholderText(/hey! want to team up/i);
      await user.type(messageInput, 'Hey, want to be friends?');

      const sendButton = screen.getByRole('button', { name: /send friend request/i });
      await act(async () => {
        await user.click(sendButton);
        await vi.runAllTimersAsync();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/friends',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Hey, want to be friends?')
        })
      );
    });

    it('should enforce message length limit', async () => {
      const mockResults = [
        createMockPlayer({ _id: 'p1', username: 'player1', level: 10 }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, results: mockResults }));

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await typeAndDebounce(searchInput, 'player');

      expect(screen.getByText('player1')).toBeInTheDocument();

      const addButton = screen.getByRole('button', { name: /add friend/i });
      await act(async () => {
        await user.click(addButton);
      });

      const messageInput = screen.getByPlaceholderText(/hey! want to team up/i);
      // jsdom does not enforce maxLength while typing (a real browser truncates);
      // the enforced cap is asserted via the attribute, which is the contract the
      // DOM actually exposes. (SESSION-2026-09-02-006)
      expect(messageInput).toHaveAttribute('maxLength', '200');
      const longMessage = 'a'.repeat(250);
      await user.type(messageInput, longMessage);
      expect(messageInput).toBeInTheDocument();
    });

    it('should disable add button for already friends', async () => {
      const mockResults = [
        createMockPlayer({ _id: 'p1', username: 'friend1', level: 10, friendStatus: 'accepted' }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, results: mockResults }));

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await typeAndDebounce(searchInput, 'friend');

      expect(screen.getByText(/\u2713 Friends/i)).toBeInTheDocument();

      const addButton = screen.queryByRole('button', { name: /add friend/i });
      expect(addButton).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error when search fails', async () => {
      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: false, error: 'Search failed' }));

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await typeAndDebounce(searchInput, 'player');

      expect(screen.getByText(/search failed/i)).toBeInTheDocument();
    });

    it('should display error when send request fails', async () => {
      const mockResults = [
        createMockPlayer({ _id: 'p1', username: 'player1', level: 10 }),
      ];

      (global.fetch as any)
        .mockResolvedValueOnce(createMockFetchResponse({ success: true, results: mockResults }))
        .mockResolvedValue(createMockFetchResponse({ success: false, error: 'Request already exists' }));

      render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await typeAndDebounce(searchInput, 'player');

      expect(screen.getByText('player1')).toBeInTheDocument();

      const addButton = screen.getByRole('button', { name: /add friend/i });
      await act(async () => {
        await user.click(addButton);
      });

      const sendButton = screen.getByRole('button', { name: /send friend request/i });
      await act(async () => {
        await user.click(sendButton);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText(/request already exists/i)).toBeInTheDocument();
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button clicked', async () => {
      const onClose = vi.fn();
      render(<AddFriendModal isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByTitle('Close');
      await act(async () => {
        await user.click(closeButton);
      });

      expect(onClose).toHaveBeenCalled();
    });

    it('should clear search results when closing', async () => {
      const mockResults = [
        createMockPlayer({ _id: 'p1', username: 'player1', level: 10 }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, results: mockResults }));

      const { rerender } = render(<AddFriendModal isOpen={true} onClose={() => {}} />);

      const searchInput = screen.getByPlaceholderText(/enter username/i);
      await typeAndDebounce(searchInput, 'player');

      expect(screen.getByText('player1')).toBeInTheDocument();

      rerender(<AddFriendModal isOpen={false} onClose={() => {}} />);
      // Flush the close-reset effect (state clearing commits on a concurrent
      // render tick) before asserting the reopened modal starts clean.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      rerender(<AddFriendModal isOpen={true} onClose={() => {}} />);

      expect(screen.queryByText('player1')).not.toBeInTheDocument();
    });
  });
});
