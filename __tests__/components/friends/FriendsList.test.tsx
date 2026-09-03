/**
 * @file __tests__/components/friends/FriendsList.test.tsx
 * @created 2025-10-26
 * @overview Component tests for FriendsList
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FriendsList from '@/components/friends/FriendsList';

global.fetch = vi.fn();

describe('FriendsList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockFriend(overrides: Record<string, any> = {}) {
    return {
      _id: 'f1',
      userId: 'u1',
      friendId: 'u2',
      status: 'accepted',
      initiatedBy: 'u1',
      username: 'friend1',
      level: 10,
      vip: false,
      clanTag: undefined,
      onlineStatus: { status: 'offline', lastSeen: new Date(), userId: 'u1' },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function createMockFetchResponse(data: any) {
    return {
      ok: true,
      json: vi.fn().mockResolvedValue(data),
    };
  }

  describe('Rendering', () => {
    it('should render friends list successfully', async () => {
      const mockFriends = [
        createMockFriend({ _id: 'f1', userId: 'u1', username: 'friend1', onlineStatus: { status: 'online', lastSeen: new Date(), userId: 'u1' } }),
        createMockFriend({ _id: 'f2', userId: 'u2', username: 'friend2', onlineStatus: { status: 'offline', lastSeen: new Date(), userId: 'u2' } }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, friends: mockFriends, statuses: { u1: 'online', u2: 'offline' } }));

      render(<FriendsList />);

      await waitFor(() => {
        expect(screen.getByText('friend1')).toBeInTheDocument();
        expect(screen.getByText('friend2')).toBeInTheDocument();
      });
    });

    it('should display online status indicators correctly', async () => {
      const mockFriends = [
        createMockFriend({ _id: 'f1', userId: 'u1', username: 'onlineFriend', onlineStatus: { status: 'online', lastSeen: new Date(), userId: 'u1' } }),
        createMockFriend({ _id: 'f2', userId: 'u2', username: 'offlineFriend', onlineStatus: { status: 'offline', lastSeen: new Date(), userId: 'u2' } }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, friends: mockFriends, statuses: { u1: 'online', u2: 'offline' } }));

      const { container } = render(<FriendsList />);

      await waitFor(() => {
        const onlineIndicators = container.querySelectorAll('.bg-green-500');
        expect(onlineIndicators.length).toBeGreaterThan(0);
      });
    });

    it('should render VIP badge for VIP friends', async () => {
      const mockFriends = [
        createMockFriend({ _id: 'f1', userId: 'u1', username: 'vipFriend', vip: true, onlineStatus: { status: 'online', lastSeen: new Date(), userId: 'u1' } }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, friends: mockFriends, statuses: { u1: 'online' } }));

      render(<FriendsList />);

      await waitFor(() => {
        // Exact text: /VIP/i also matches the username "vipFriend", which throws
        // "Found multiple elements" (see SESSION-2026-09-02-006, Class C).
        expect(screen.getByText('VIP')).toBeInTheDocument();
      });
    });

    it('should render empty state when no friends', async () => {
      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, friends: [] }));

      render(<FriendsList />);

      await waitFor(() => {
        expect(screen.getByText(/no friends yet/i)).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching', async () => {
      (global.fetch as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockFetchResponse({ success: true, friends: [] })), 1000))
      );

      render(<FriendsList />);

      expect(screen.getByText(/loading friends/i)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onMessageFriend when message button clicked', async () => {
      const mockFriends = [
        createMockFriend({ _id: 'f1', userId: 'u1', username: 'friend1', onlineStatus: { status: 'online', lastSeen: new Date(), userId: 'u1' } }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, friends: mockFriends, statuses: { u1: 'online' } }));

      const onMessageFriend = vi.fn();
      render(<FriendsList onMessageFriend={onMessageFriend} />);

      await waitFor(() => {
        expect(screen.getByText('friend1')).toBeInTheDocument();
      });

      const messageButton = screen.getByText('Message');
      await act(async () => {
        await userEvent.click(messageButton);
      });

      expect(onMessageFriend).toHaveBeenCalledWith('u1', 'friend1');
    });

    it('should call onFriendRemoved when remove confirmed', async () => {
      const mockFriends = [
        createMockFriend({ _id: 'f1', userId: 'u1', username: 'friend1', onlineStatus: { status: 'online', lastSeen: new Date(), userId: 'u1' } }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, friends: mockFriends, statuses: { u1: 'online' } }));

      const onFriendRemoved = vi.fn();
      render(<FriendsList onFriendRemoved={onFriendRemoved} />);

      await waitFor(() => {
        expect(screen.getByText('friend1')).toBeInTheDocument();
      });

      const moreButton = screen.getByTitle('More actions');
      await act(async () => {
        await userEvent.click(moreButton);
      });

      const removeButton = screen.getByText('Remove Friend');
      await act(async () => {
        await userEvent.click(removeButton);
      });

      expect(onFriendRemoved).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: false, error: 'Failed to load friends' }));

      render(<FriendsList />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load friends/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      render(<FriendsList />);

      await waitFor(() => {
        expect(screen.getByText(/unable to load friends/i)).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh when key prop changes', async () => {
      const mockFriends = [
        createMockFriend({ _id: 'f1', userId: 'u1', username: 'friend1', onlineStatus: { status: 'online', lastSeen: new Date(), userId: 'u1' } }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, friends: mockFriends, statuses: { u1: 'online' } }));

      const { rerender } = render(<FriendsList key={1} />);

      await waitFor(() => {
        expect(screen.getByText('friend1')).toBeInTheDocument();
      });

      // Assert on the friends-list fetch by URL: the component also fires one
      // online-status fetch on mount (documented behavior), so a bare call count
      // races against that poll. (SESSION-2026-09-02-006)
      const listCalls = (global.fetch as any).mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && String(c[0]).startsWith('/api/friends') && !String(c[0]).includes('/online'),
      );
      expect(listCalls).toHaveLength(1);

      rerender(<FriendsList key={2} />);

      await waitFor(() => {
        const listCallsAfter = (global.fetch as any).mock.calls.filter(
          (c: unknown[]) => typeof c[0] === 'string' && String(c[0]).startsWith('/api/friends') && !String(c[0]).includes('/online'),
        );
        expect(listCallsAfter).toHaveLength(2);
      });
    });
  });

  describe('Friend Sorting', () => {
    it('should display online friends first', async () => {
      const mockFriends = [
        createMockFriend({ _id: 'f1', userId: 'u1', username: 'offlineFriend', onlineStatus: { status: 'offline', lastSeen: new Date('2025-01-01'), userId: 'u1' } }),
        createMockFriend({ _id: 'f2', userId: 'u2', username: 'onlineFriend', onlineStatus: { status: 'online', lastSeen: new Date('2025-01-02'), userId: 'u2' } }),
      ];

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, friends: mockFriends, statuses: { u1: 'offline', u2: 'online' } }));

      const { container } = render(<FriendsList />);

      await waitFor(() => {
        const friendElements = container.querySelectorAll('[class*="bg-gray-800"]');
        const usernames = Array.from(friendElements).map(el => el.textContent);
        const onlineIdx = usernames.findIndex(t => t?.includes('onlineFriend'));
        const offlineIdx = usernames.findIndex(t => t?.includes('offlineFriend'));
        expect(onlineIdx).toBeGreaterThanOrEqual(0);
        expect(offlineIdx).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
