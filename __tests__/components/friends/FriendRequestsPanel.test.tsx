/**
 * @file __tests__/components/friends/FriendRequestsPanel.test.tsx
 * @created 2025-10-26
 * @overview Component tests for FriendRequestsPanel
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FriendRequestsPanel from '@/components/friends/FriendRequestsPanel';

global.fetch = vi.fn();
window.alert = vi.fn();

describe('FriendRequestsPanel Component', () => {
  // The component polls /api/friends/requests on a 5s setInterval, so tests run under
  // fake timers with a bounded advance (runAllTimersAsync would spin forever on the
  // interval). user-event is bridged to the fake clock (SESSION-2026-09-02-006, Class B).
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createMockReceivedRequest(overrides: Record<string, any> = {}) {
    return {
      _id: 'req-1',
      from: 'sender-id',
      to: 'my-id',
      status: 'pending',
      fromUsername: 'sender1',
      fromLevel: 10,
      fromVip: false,
      fromClanTag: undefined,
      message: undefined,
      createdAt: new Date(),
      ...overrides,
    };
  }

  function createMockSentRequest(overrides: Record<string, any> = {}) {
    return {
      _id: 'req-2',
      from: 'my-id',
      to: 'recipient-id',
      status: 'pending',
      fromUsername: 'me',
      fromLevel: 15,
      fromVip: false,
      fromClanTag: undefined,
      message: undefined,
      createdAt: new Date(),
      ...overrides,
    };
  }

  function createMockFetchResponse(data: any) {
    return {
      ok: true,
      json: vi.fn().mockResolvedValue(data),
    };
  }

  async function renderAndWait(ui: React.ReactElement) {
    const result = render(ui);
    await act(async () => {
      // Bounded: flush pending microtasks/timers without advancing the 5s poll interval.
      await vi.advanceTimersByTimeAsync(0);
    });
    return result;
  }

  describe('Rendering', () => {
    it('should render received requests tab by default', async () => {
      const mockRequests = {
        received: [
          createMockReceivedRequest({
            fromUsername: 'sender1',
            message: "Let's be friends!",
          }),
        ],
        sent: [],
      };

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, received: mockRequests.received, sent: mockRequests.sent }));

      await renderAndWait(<FriendRequestsPanel />);

      expect(screen.getByText('sender1')).toBeInTheDocument();
      expect(screen.getByText(/let's be friends/i)).toBeInTheDocument();
    });

    it('should switch to sent requests tab', async () => {
      const mockRequests = {
        received: [],
        sent: [
          createMockSentRequest({
            fromUsername: 'me',
          }),
        ],
      };

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, received: mockRequests.received, sent: mockRequests.sent }));

      await renderAndWait(<FriendRequestsPanel />);

      const sentTab = screen.getByText(/sent/i);
      await act(async () => {
        await user.click(sentTab);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('me')).toBeInTheDocument();
    });

    it('should display badge counts for received requests', async () => {
      const mockRequests = {
        received: [
          createMockReceivedRequest({ _id: 'req-1', fromUsername: 'sender1' }),
          createMockReceivedRequest({ _id: 'req-2', fromUsername: 'sender2' }),
        ],
        sent: [],
      };

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, received: mockRequests.received, sent: mockRequests.sent }));

      await renderAndWait(<FriendRequestsPanel />);

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should render empty state for no received requests', async () => {
      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, received: [], sent: [] }));

      await renderAndWait(<FriendRequestsPanel />);

      expect(screen.getByText(/no pending requests/i)).toBeInTheDocument();
    });

    it('should render empty state for no sent requests', async () => {
      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, received: [], sent: [] }));

      await renderAndWait(<FriendRequestsPanel />);

      const sentTab = screen.getByText(/sent/i);
      await act(async () => {
        await user.click(sentTab);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getAllByText(/no pending requests/i).length).toBeGreaterThan(0);
    });
  });

  describe('Received Request Actions', () => {
    it('should accept friend request successfully', async () => {
      const mockRequests = {
        received: [
          createMockReceivedRequest({
            fromUsername: 'sender1',
            message: 'Hi!',
          }),
        ],
        sent: [],
      };

      (global.fetch as any)
        .mockResolvedValueOnce(createMockFetchResponse({ success: true, received: mockRequests.received, sent: mockRequests.sent }))
        .mockResolvedValueOnce(createMockFetchResponse({ success: true, friendship: { status: 'accepted' } }))
        .mockResolvedValue(createMockFetchResponse({ success: true, received: [], sent: [] }));

      const onRequestAccepted = vi.fn();
      await renderAndWait(<FriendRequestsPanel onRequestAccepted={onRequestAccepted} />);

      const acceptButton = screen.getByText(/accept/i);
      await act(async () => {
        await user.click(acceptButton);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(onRequestAccepted).toHaveBeenCalled();
    });

    it('should decline friend request successfully', async () => {
      const mockRequests = {
        received: [
          createMockReceivedRequest({ fromUsername: 'sender1' }),
        ],
        sent: [],
      };

      (global.fetch as any)
        .mockResolvedValueOnce(createMockFetchResponse({ success: true, received: mockRequests.received, sent: mockRequests.sent }))
        .mockResolvedValueOnce(createMockFetchResponse({ success: true }))
        .mockResolvedValue(createMockFetchResponse({ success: true, received: [], sent: [] }));

      await renderAndWait(<FriendRequestsPanel />);

      const declineButton = screen.getByText(/decline/i);
      await act(async () => {
        await user.click(declineButton);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.queryByText('sender1')).not.toBeInTheDocument();
    });

    it('should display request message if provided', async () => {
      const mockRequests = {
        received: [
          createMockReceivedRequest({
            fromUsername: 'sender1',
            message: 'Saw you in global chat!',
          }),
        ],
        sent: [],
      };

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, received: mockRequests.received, sent: mockRequests.sent }));

      await renderAndWait(<FriendRequestsPanel />);

      expect(screen.getByText(/saw you in global chat/i)).toBeInTheDocument();
    });
  });

  describe('Sent Request Actions', () => {
    it('should cancel sent request successfully', async () => {
      const mockRequests = {
        received: [],
        sent: [
          createMockSentRequest({ fromUsername: 'me' }),
        ],
      };

      (global.fetch as any)
        .mockResolvedValueOnce(createMockFetchResponse({ success: true, received: mockRequests.received, sent: mockRequests.sent }))
        .mockResolvedValueOnce(createMockFetchResponse({ success: true }))
        .mockResolvedValue(createMockFetchResponse({ success: true, received: [], sent: [] }));

      await renderAndWait(<FriendRequestsPanel />);

      const sentTab = screen.getByText(/sent/i);
      await act(async () => {
        await user.click(sentTab);
        await vi.advanceTimersByTimeAsync(0);
      });

      const cancelButton = screen.getByText(/cancel/i);
      await act(async () => {
        await user.click(cancelButton);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.queryByText('me')).not.toBeInTheDocument();
    });

    it('should display pending status for sent requests', async () => {
      const mockRequests = {
        received: [],
        sent: [
          createMockSentRequest({ fromUsername: 'me' }),
        ],
      };

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, received: mockRequests.received, sent: mockRequests.sent }));

      await renderAndWait(<FriendRequestsPanel />);

      const sentTab = screen.getByText(/sent/i);
      await act(async () => {
        await user.click(sentTab);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error when fetch fails', async () => {
      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: false, error: 'Failed to load requests' }));

      await renderAndWait(<FriendRequestsPanel />);

      expect(screen.getByText(/failed to load requests/i)).toBeInTheDocument();
    });

    it('should display error when accept fails', async () => {
      const mockRequests = {
        received: [
          createMockReceivedRequest({ fromUsername: 'sender1' }),
        ],
        sent: [],
      };

      (global.fetch as any)
        .mockResolvedValueOnce(createMockFetchResponse({ success: true, received: mockRequests.received, sent: mockRequests.sent }))
        .mockResolvedValue(createMockFetchResponse({ success: false, error: 'Request not found' }));

      await renderAndWait(<FriendRequestsPanel />);

      const acceptButton = screen.getByText(/accept/i);
      await act(async () => {
        await user.click(acceptButton);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(window.alert).toHaveBeenCalledWith('Request not found');
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh when key prop changes', async () => {
      const mockRequests = {
        received: [
          createMockReceivedRequest({ fromUsername: 'sender1' }),
        ],
        sent: [],
      };

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, received: mockRequests.received, sent: mockRequests.sent }));

      const { rerender } = await renderAndWait(<FriendRequestsPanel key={1} />);

      expect(global.fetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        rerender(<FriendRequestsPanel key={2} />);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Request Timestamps', () => {
    it('should display time since request sent', async () => {
      const mockRequests = {
        received: [
          createMockReceivedRequest({
            fromUsername: 'sender1',
            createdAt: new Date(Date.now() - 60000),
          }),
        ],
        sent: [],
      };

      (global.fetch as any).mockResolvedValue(createMockFetchResponse({ success: true, received: mockRequests.received, sent: mockRequests.sent }));

      await renderAndWait(<FriendRequestsPanel />);

      expect(screen.getByText(/1m ago/i)).toBeInTheDocument();
    });
  });
});
