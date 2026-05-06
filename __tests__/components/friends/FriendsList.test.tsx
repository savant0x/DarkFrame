/**
 * @file __tests__/components/friends/FriendsList.test.tsx
 * @created 2025-10-26
 * @overview Component tests for FriendsList
 * 
 * Tests cover:
 * - Rendering friends list
 * - Online status indicators
 * - Friend actions menu
 * - Empty state
 * - Loading state
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FriendsList from '@/components/friends/FriendsList';

// Mock child components
vi.mock('@/components/friends/FriendActionsMenu', () => ({
  default: ({ friend, onMessage, onRemove, onBlock }: any) => (
    <div data-testid={`actions-menu-${friend.player.username}`}>
      <button onClick={() => onMessage(friend.player.username)}>Message</button>
      <button onClick={() => onRemove(friend.friendshipId)}>Remove</button>
      <button onClick={() => onBlock(friend.player.username)}>Block</button>
    </div>
  )
}));

// Mock fetch
global.fetch = vi.fn();

describe('FriendsList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================
  describe('Rendering', () => {
    it('should render friends list successfully', async () => {
      const mockFriends = [
        {
          friendshipId: 'friendship-1',
          player: { username: 'friend1', level: 10, vip: false },
          status: 'accepted',
          onlineStatus: 'online',
          createdAt: new Date()
        },
        {
          friendshipId: 'friendship-2',
          player: { username: 'friend2', level: 15, vip: true },
          status: 'accepted',
          onlineStatus: 'offline',
          createdAt: new Date()
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, friends: mockFriends })
      });

      render(<FriendsList />);

      await waitFor(() => {
        expect(screen.getByText('friend1')).toBeInTheDocument();
        expect(screen.getByText('friend2')).toBeInTheDocument();
      });
    });

    it('should display online status indicators correctly', async () => {
      const mockFriends = [
        {
          friendshipId: 'friendship-1',
          player: { username: 'onlineFriend', level: 10, vip: false },
          status: 'accepted',
          onlineStatus: 'online',
          createdAt: new Date()
        },
        {
          friendshipId: 'friendship-2',
          player: { username: 'offlineFriend', level: 10, vip: false },
          status: 'accepted',
          onlineStatus: 'offline',
          createdAt: new Date()
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, friends: mockFriends })
      });

      const { container } = render(<FriendsList />);

      await waitFor(() => {
        // Online friend should have green dot
        const onlineIndicators = container.querySelectorAll('.bg-green-500');
        expect(onlineIndicators.length).toBeGreaterThan(0);
      });
    });

    it('should render VIP badge for VIP friends', async () => {
      const mockFriends = [
        {
          friendshipId: 'friendship-1',
          player: { username: 'vipFriend', level: 20, vip: true },
          status: 'accepted',
          onlineStatus: 'online',
          createdAt: new Date()
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, friends: mockFriends })
      });

      render(<FriendsList />);

      await waitFor(() => {
        expect(screen.getByText(/VIP/i)).toBeInTheDocument();
      });
    });

    it('should render empty state when no friends', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, friends: [] })
      });

      render(<FriendsList />);

      await waitFor(() => {
        expect(screen.getByText(/no friends/i)).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching', () => {
      (global.fetch as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<FriendsList />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  // ============================================================
  // INTERACTION TESTS
  // ============================================================
  describe('User Interactions', () => {
    it('should call onMessageFriend when message button clicked', async () => {
      const mockFriends = [
        {
          friendshipId: 'friendship-1',
          player: { username: 'friend1', level: 10, vip: false },
          status: 'accepted',
          onlineStatus: 'online',
          createdAt: new Date()
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, friends: mockFriends })
      });

      const onMessageFriend = vi.fn();
      render(<FriendsList onMessageFriend={onMessageFriend} />);

      await waitFor(() => {
        expect(screen.getByText('friend1')).toBeInTheDocument();
      });

      const messageButton = screen.getByText('Message');
      await userEvent.click(messageButton);

      expect(onMessageFriend).toHaveBeenCalledWith('friend1');
    });

    it('should call onFriendRemoved when remove confirmed', async () => {
      const mockFriends = [
        {
          friendshipId: 'friendship-1',
          player: { username: 'friend1', level: 10, vip: false },
          status: 'accepted',
          onlineStatus: 'online',
          createdAt: new Date()
        }
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, friends: mockFriends })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      const onFriendRemoved = vi.fn();
      render(<FriendsList onFriendRemoved={onFriendRemoved} />);

      await waitFor(() => {
        expect(screen.getByText('friend1')).toBeInTheDocument();
      });

      const removeButton = screen.getByText('Remove');
      await userEvent.click(removeButton);

      await waitFor(() => {
        expect(onFriendRemoved).toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================
  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, message: 'Failed to load friends' })
      });

      render(<FriendsList />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<FriendsList />);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // REFRESH TESTS
  // ============================================================
  describe('Refresh Functionality', () => {
    it('should refresh when key prop changes', async () => {
      const mockFriends = [
        {
          friendshipId: 'friendship-1',
          player: { username: 'friend1', level: 10, vip: false },
          status: 'accepted',
          onlineStatus: 'online',
          createdAt: new Date()
        }
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, friends: mockFriends })
      });

      const { rerender } = render(<FriendsList key={1} />);

      await waitFor(() => {
        expect(screen.getByText('friend1')).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Change key to trigger refresh
      rerender(<FriendsList key={2} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ============================================================
  // SORTING TESTS
  // ============================================================
  describe('Friend Sorting', () => {
    it('should display online friends first', async () => {
      const mockFriends = [
        {
          friendshipId: 'friendship-1',
          player: { username: 'offlineFriend', level: 10, vip: false },
          status: 'accepted',
          onlineStatus: 'offline',
          createdAt: new Date('2025-01-01')
        },
        {
          friendshipId: 'friendship-2',
          player: { username: 'onlineFriend', level: 10, vip: false },
          status: 'accepted',
          onlineStatus: 'online',
          createdAt: new Date('2025-01-02')
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, friends: mockFriends })
      });

      const { container } = render(<FriendsList />);

      await waitFor(() => {
        const friendElements = container.querySelectorAll('[data-testid^="friend-"]');
        // First friend should be the online one
        expect(friendElements[0]).toHaveTextContent('onlineFriend');
      });
    });
  });
});

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * TEST COVERAGE:
 * - Rendering: 5 tests (list, status, VIP badge, empty state, loading)
 * - Interactions: 2 tests (message, remove)
 * - Error Handling: 2 tests (fetch failure, network error)
 * - Refresh: 1 test (key prop change)
 * - Sorting: 1 test (online friends first)
 * 
 * Total: 11 component tests
 * 
 * TO RUN:
 * npm run test -- FriendsList.test.tsx
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
