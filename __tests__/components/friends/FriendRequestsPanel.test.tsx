/**
 * @file __tests__/components/friends/FriendRequestsPanel.test.tsx
 * @created 2025-10-26
 * @overview Component tests for FriendRequestsPanel
 * 
 * Tests cover:
 * - Dual-tab rendering (received/sent)
 * - Accept/decline requests
 * - Cancel sent requests
 * - Request messages
 * - Badge counts
 * - Empty states
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FriendRequestsPanel from '@/components/friends/FriendRequestsPanel';

// Mock fetch
global.fetch = vi.fn();

describe('FriendRequestsPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================
  describe('Rendering', () => {
    it('should render received requests tab by default', async () => {
      const mockRequests = {
        received: [
          {
            requestId: 'req-1',
            senderUsername: 'sender1',
            senderLevel: 10,
            senderVIP: false,
            message: 'Let\'s be friends!',
            createdAt: new Date()
          }
        ],
        sent: []
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, ...mockRequests })
      });

      render(<FriendRequestsPanel />);

      await waitFor(() => {
        expect(screen.getByText('sender1')).toBeInTheDocument();
        expect(screen.getByText('Let\'s be friends!')).toBeInTheDocument();
      });
    });

    it('should switch to sent requests tab', async () => {
      const mockRequests = {
        received: [],
        sent: [
          {
            requestId: 'req-2',
            recipientUsername: 'recipient1',
            recipientLevel: 15,
            recipientVIP: true,
            createdAt: new Date()
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, ...mockRequests })
      });

      render(<FriendRequestsPanel />);

      const sentTab = screen.getByText(/sent/i);
      await userEvent.click(sentTab);

      await waitFor(() => {
        expect(screen.getByText('recipient1')).toBeInTheDocument();
      });
    });

    it('should display badge count for received requests', async () => {
      const mockRequests = {
        received: [
          {
            requestId: 'req-1',
            senderUsername: 'sender1',
            senderLevel: 10,
            senderVIP: false,
            createdAt: new Date()
          },
          {
            requestId: 'req-2',
            senderUsername: 'sender2',
            senderLevel: 12,
            senderVIP: false,
            createdAt: new Date()
          }
        ],
        sent: []
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, ...mockRequests })
      });

      render(<FriendRequestsPanel />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Badge showing count
      });
    });

    it('should render empty state for no received requests', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, received: [], sent: [] })
      });

      render(<FriendRequestsPanel />);

      await waitFor(() => {
        expect(screen.getByText(/no pending/i)).toBeInTheDocument();
      });
    });

    it('should render empty state for no sent requests', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, received: [], sent: [] })
      });

      render(<FriendRequestsPanel />);

      const sentTab = screen.getByText(/sent/i);
      await userEvent.click(sentTab);

      await waitFor(() => {
        expect(screen.getByText(/no outgoing/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // INTERACTION TESTS - RECEIVED REQUESTS
  // ============================================================
  describe('Received Request Actions', () => {
    it('should accept friend request successfully', async () => {
      const mockRequests = {
        received: [
          {
            requestId: 'req-1',
            senderUsername: 'sender1',
            senderLevel: 10,
            senderVIP: false,
            message: 'Hi!',
            createdAt: new Date()
          }
        ],
        sent: []
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, ...mockRequests })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, friendship: { status: 'accepted' } })
        });

      const onRequestAccepted = vi.fn();
      render(<FriendRequestsPanel onRequestAccepted={onRequestAccepted} />);

      await waitFor(() => {
        expect(screen.getByText('sender1')).toBeInTheDocument();
      });

      const acceptButton = screen.getByText(/accept/i);
      await userEvent.click(acceptButton);

      await waitFor(() => {
        expect(onRequestAccepted).toHaveBeenCalled();
      });
    });

    it('should decline friend request successfully', async () => {
      const mockRequests = {
        received: [
          {
            requestId: 'req-1',
            senderUsername: 'sender1',
            senderLevel: 10,
            senderVIP: false,
            createdAt: new Date()
          }
        ],
        sent: []
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, ...mockRequests })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      render(<FriendRequestsPanel />);

      await waitFor(() => {
        expect(screen.getByText('sender1')).toBeInTheDocument();
      });

      const declineButton = screen.getByText(/decline/i);
      await userEvent.click(declineButton);

      await waitFor(() => {
        expect(screen.queryByText('sender1')).not.toBeInTheDocument();
      });
    });

    it('should display request message if provided', async () => {
      const mockRequests = {
        received: [
          {
            requestId: 'req-1',
            senderUsername: 'sender1',
            senderLevel: 10,
            senderVIP: false,
            message: 'Saw you in global chat!',
            createdAt: new Date()
          }
        ],
        sent: []
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, ...mockRequests })
      });

      render(<FriendRequestsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Saw you in global chat!')).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // INTERACTION TESTS - SENT REQUESTS
  // ============================================================
  describe('Sent Request Actions', () => {
    it('should cancel sent request successfully', async () => {
      const mockRequests = {
        received: [],
        sent: [
          {
            requestId: 'req-2',
            recipientUsername: 'recipient1',
            recipientLevel: 15,
            recipientVIP: false,
            createdAt: new Date()
          }
        ]
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, ...mockRequests })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      render(<FriendRequestsPanel />);

      const sentTab = screen.getByText(/sent/i);
      await userEvent.click(sentTab);

      await waitFor(() => {
        expect(screen.getByText('recipient1')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText(/cancel/i);
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('recipient1')).not.toBeInTheDocument();
      });
    });

    it('should display pending status for sent requests', async () => {
      const mockRequests = {
        received: [],
        sent: [
          {
            requestId: 'req-2',
            recipientUsername: 'recipient1',
            recipientLevel: 15,
            recipientVIP: false,
            createdAt: new Date()
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, ...mockRequests })
      });

      render(<FriendRequestsPanel />);

      const sentTab = screen.getByText(/sent/i);
      await userEvent.click(sentTab);

      await waitFor(() => {
        expect(screen.getByText(/pending/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================
  describe('Error Handling', () => {
    it('should display error when fetch fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, message: 'Failed to load requests' })
      });

      render(<FriendRequestsPanel />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    it('should display error when accept fails', async () => {
      const mockRequests = {
        received: [
          {
            requestId: 'req-1',
            senderUsername: 'sender1',
            senderLevel: 10,
            senderVIP: false,
            createdAt: new Date()
          }
        ],
        sent: []
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, ...mockRequests })
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ success: false, message: 'Request not found' })
        });

      render(<FriendRequestsPanel />);

      await waitFor(() => {
        expect(screen.getByText('sender1')).toBeInTheDocument();
      });

      const acceptButton = screen.getByText(/accept/i);
      await userEvent.click(acceptButton);

      await waitFor(() => {
        expect(screen.getByText(/request not found/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // REFRESH TESTS
  // ============================================================
  describe('Refresh Functionality', () => {
    it('should refresh when key prop changes', async () => {
      const mockRequests = {
        received: [
          {
            requestId: 'req-1',
            senderUsername: 'sender1',
            senderLevel: 10,
            senderVIP: false,
            createdAt: new Date()
          }
        ],
        sent: []
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, ...mockRequests })
      });

      const { rerender } = render(<FriendRequestsPanel key={1} />);

      await waitFor(() => {
        expect(screen.getByText('sender1')).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Change key to trigger refresh
      rerender(<FriendRequestsPanel key={2} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ============================================================
  // TIMESTAMP TESTS
  // ============================================================
  describe('Request Timestamps', () => {
    it('should display time since request sent', async () => {
      const mockRequests = {
        received: [
          {
            requestId: 'req-1',
            senderUsername: 'sender1',
            senderLevel: 10,
            senderVIP: false,
            createdAt: new Date(Date.now() - 60000) // 1 minute ago
          }
        ],
        sent: []
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, ...mockRequests })
      });

      render(<FriendRequestsPanel />);

      await waitFor(() => {
        expect(screen.getByText(/1.*min/i)).toBeInTheDocument();
      });
    });
  });
});

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * TEST COVERAGE:
 * - Rendering: 5 tests (tabs, badge, empty states)
 * - Received Actions: 3 tests (accept, decline, message display)
 * - Sent Actions: 2 tests (cancel, pending status)
 * - Error Handling: 2 tests (fetch failure, action failure)
 * - Refresh: 1 test (key prop change)
 * - Timestamps: 1 test (time display)
 * 
 * Total: 14 component tests
 * 
 * TO RUN:
 * npm run test -- FriendRequestsPanel.test.tsx
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
