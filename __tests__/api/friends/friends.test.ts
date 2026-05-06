/**
 * @file __tests__/api/friends/friends.test.ts
 * @created 2025-10-26
 * @overview Automated tests for Friend System API routes
 * 
 * Tests cover:
 * - GET /api/friends (list friends)
 * - POST /api/friends (send friend request)
 * - PATCH /api/friends/[id] (accept/decline request)
 * - DELETE /api/friends/[id] (remove friend)
 * - GET /api/friends/requests (pending requests)
 * - GET /api/friends/search (search users)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getFriends, POST as sendRequest } from '@/app/api/friends/route';
import { PATCH as updateRequest, DELETE as removeFriend } from '@/app/api/friends/[id]/route';
import { GET as getRequests } from '@/app/api/friends/requests/route';
import { GET as searchUsers } from '@/app/api/friends/search/route';

// Mock dependencies
vi.mock('@/lib/authMiddleware', () => ({
  requireAuth: vi.fn(async (req: Request) => ({
    userId: 'test-user-123',
    username: 'testuser'
  }))
}));

vi.mock('@/lib/friendService', () => ({
  getFriends: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptRequest: vi.fn(),
  declineRequest: vi.fn(),
  removeFriend: vi.fn(),
  getPendingRequests: vi.fn(),
  getSentRequests: vi.fn(),
  searchUsers: vi.fn(),
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
  PermissionError: class PermissionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PermissionError';
    }
  }
}));

describe('Friend API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // GET /api/friends - List Friends
  // ============================================================
  describe('GET /api/friends', () => {
    it('should return list of friends successfully', async () => {
      const mockFriends = [
        {
          friendshipId: 'friendship-1',
          player: {
            username: 'friend1',
            level: 10,
            vip: false,
            clanTag: 'CLAN1'
          },
          status: 'accepted',
          createdAt: new Date(),
          onlineStatus: 'online'
        }
      ];

      const { getFriends: getFriendsMock } = await import('@/lib/friendService');
      (getFriendsMock as any).mockResolvedValue(mockFriends);

      const request = new NextRequest('http://localhost/api/friends');
      const response = await getFriends(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.friends).toHaveLength(1);
      expect(data.friends[0].player.username).toBe('friend1');
    });

    it('should return empty array when no friends', async () => {
      const { getFriends: getFriendsMock } = await import('@/lib/friendService');
      (getFriendsMock as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/friends');
      const response = await getFriends(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.friends).toHaveLength(0);
    });

    it('should handle service errors gracefully', async () => {
      const { getFriends: getFriendsMock } = await import('@/lib/friendService');
      (getFriendsMock as any).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/friends');
      const response = await getFriends(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  // ============================================================
  // POST /api/friends - Send Friend Request
  // ============================================================
  describe('POST /api/friends', () => {
    it('should send friend request successfully', async () => {
      const { sendFriendRequest: sendRequestMock } = await import('@/lib/friendService');
      (sendRequestMock as any).mockResolvedValue({
        requestId: 'request-123',
        recipientUsername: 'friend2',
        status: 'pending'
      });

      const request = new NextRequest('http://localhost/api/friends', {
        method: 'POST',
        body: JSON.stringify({
          recipientUsername: 'friend2',
          message: 'Let\'s be friends!'
        })
      });

      const response = await sendRequest(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.request.recipientUsername).toBe('friend2');
    });

    it('should reject request with missing recipient', async () => {
      const request = new NextRequest('http://localhost/api/friends', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await sendRequest(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should reject request with message > 200 chars', async () => {
      const longMessage = 'a'.repeat(201);

      const request = new NextRequest('http://localhost/api/friends', {
        method: 'POST',
        body: JSON.stringify({
          recipientUsername: 'friend2',
          message: longMessage
        })
      });

      const response = await sendRequest(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should handle ValidationError from service', async () => {
  const { sendFriendRequest: sendRequestMock } = await import('@/lib/friendService');
  const { ValidationError } = await import('@/lib/common/errors');
  (sendRequestMock as any).mockRejectedValue(new ValidationError('Cannot send request to yourself'));

      const request = new NextRequest('http://localhost/api/friends', {
        method: 'POST',
        body: JSON.stringify({
          recipientUsername: 'testuser'
        })
      });

      const response = await sendRequest(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  // ============================================================
  // PATCH /api/friends/[id] - Accept/Decline Request
  // ============================================================
  describe('PATCH /api/friends/[id]', () => {
    it('should accept friend request successfully', async () => {
      const { acceptRequest: acceptRequestMock } = await import('@/lib/friendService');
      (acceptRequestMock as any).mockResolvedValue({
        friendshipId: 'friendship-123',
        status: 'accepted'
      });

      const request = new NextRequest('http://localhost/api/friends/request-123', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'accept' })
      });

  const response = await updateRequest(request, { params: Promise.resolve({ id: 'request-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.friendship.status).toBe('accepted');
    });

    it('should decline friend request successfully', async () => {
      const { declineRequest: declineRequestMock } = await import('@/lib/friendService');
      (declineRequestMock as any).mockResolvedValue({ success: true });

      const request = new NextRequest('http://localhost/api/friends/request-123', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'decline' })
      });

  const response = await updateRequest(request, { params: Promise.resolve({ id: 'request-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid action', async () => {
      const request = new NextRequest('http://localhost/api/friends/request-123', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'invalid' })
      });

  const response = await updateRequest(request, { params: Promise.resolve({ id: 'request-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should handle NotFoundError', async () => {
  const { acceptRequest: acceptRequestMock } = await import('@/lib/friendService');
  const { NotFoundError } = await import('@/lib/common/errors');
  (acceptRequestMock as any).mockRejectedValue(new NotFoundError('Request not found'));

      const request = new NextRequest('http://localhost/api/friends/request-123', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'accept' })
      });

  const response = await updateRequest(request, { params: Promise.resolve({ id: 'request-123' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  // ============================================================
  // DELETE /api/friends/[id] - Remove Friend
  // ============================================================
  describe('DELETE /api/friends/[id]', () => {
    it('should remove friend successfully', async () => {
      const { removeFriend: removeFriendMock } = await import('@/lib/friendService');
      (removeFriendMock as any).mockResolvedValue({ success: true });

      const request = new NextRequest('http://localhost/api/friends/friendship-123', {
        method: 'DELETE'
      });

  const response = await removeFriend(request, { params: Promise.resolve({ id: 'friendship-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle NotFoundError when removing non-existent friend', async () => {
  const { removeFriend: removeFriendMock } = await import('@/lib/friendService');
  const { NotFoundError } = await import('@/lib/common/errors');
  (removeFriendMock as any).mockRejectedValue(new NotFoundError('Friendship not found'));

      const request = new NextRequest('http://localhost/api/friends/friendship-123', {
        method: 'DELETE'
      });

  const response = await removeFriend(request, { params: Promise.resolve({ id: 'friendship-123' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  // ============================================================
  // GET /api/friends/requests - Pending Requests
  // ============================================================
  describe('GET /api/friends/requests', () => {
    it('should return received and sent requests', async () => {
      const { getPendingRequests: getPendingMock, getSentRequests: getSentMock } = await import('@/lib/friendService');
      
      (getPendingMock as any).mockResolvedValue([
        {
          requestId: 'req-1',
          senderUsername: 'sender1',
          message: 'Hello!',
          createdAt: new Date()
        }
      ]);

      (getSentMock as any).mockResolvedValue([
        {
          requestId: 'req-2',
          recipientUsername: 'recipient1',
          createdAt: new Date()
        }
      ]);

      const request = new NextRequest('http://localhost/api/friends/requests');
      const response = await getRequests(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.received).toHaveLength(1);
      expect(data.sent).toHaveLength(1);
    });

    it('should return empty arrays when no requests', async () => {
      const { getPendingRequests: getPendingMock, getSentRequests: getSentMock } = await import('@/lib/friendService');
      
      (getPendingMock as any).mockResolvedValue([]);
      (getSentMock as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/friends/requests');
      const response = await getRequests(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toHaveLength(0);
      expect(data.sent).toHaveLength(0);
    });
  });

  // ============================================================
  // GET /api/friends/search - Search Users
  // ============================================================
  describe('GET /api/friends/search', () => {
    it('should search users successfully', async () => {
      const { searchUsers: searchUsersMock } = await import('@/lib/friendService');
      (searchUsersMock as any).mockResolvedValue([
        {
          username: 'player1',
          level: 15,
          vip: true,
          friendStatus: 'none'
        },
        {
          username: 'player2',
          level: 8,
          vip: false,
          friendStatus: 'friends'
        }
      ]);

      const request = new NextRequest('http://localhost/api/friends/search?q=player');
      const response = await searchUsers(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(2);
    });

    it('should reject query < 1 character', async () => {
      const request = new NextRequest('http://localhost/api/friends/search?q=');
      const response = await searchUsers(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should reject query > 50 characters', async () => {
      const longQuery = 'a'.repeat(51);
      const request = new NextRequest(`http://localhost/api/friends/search?q=${longQuery}`);
      const response = await searchUsers(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should respect limit parameter', async () => {
      const { searchUsers: searchUsersMock } = await import('@/lib/friendService');
      (searchUsersMock as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/friends/search?q=test&limit=5');
      await searchUsers(request);

      expect(searchUsersMock).toHaveBeenCalledWith('test-user-123', 'test', 5);
    });

    it('should use default limit when not provided', async () => {
      const { searchUsers: searchUsersMock } = await import('@/lib/friendService');
      (searchUsersMock as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/friends/search?q=test');
      await searchUsers(request);

      expect(searchUsersMock).toHaveBeenCalledWith('test-user-123', 'test', 20);
    });
  });
});

// ============================================================
// INTEGRATION TESTS
// ============================================================
describe('Friend API Integration', () => {
  it('should complete full friend request flow', async () => {
    const { 
      sendFriendRequest, 
      getPendingRequests, 
      acceptRequest, 
      getFriends: getFriendsService 
    } = await import('@/lib/friendService');

    // 1. Send request
    (sendFriendRequest as any).mockResolvedValue({
      requestId: 'req-123',
      recipientUsername: 'friend1',
      status: 'pending'
    });

    const sendReq = new NextRequest('http://localhost/api/friends', {
      method: 'POST',
      body: JSON.stringify({ recipientUsername: 'friend1' })
    });
    const sendRes = await sendRequest(sendReq);
    expect(sendRes.status).toBe(201);

    // 2. Check pending requests
    (getPendingRequests as any).mockResolvedValue([{
      requestId: 'req-123',
      senderUsername: 'testuser'
    }]);

    // 3. Accept request
    (acceptRequest as any).mockResolvedValue({
      friendshipId: 'friendship-123',
      status: 'accepted'
    });

    const acceptReq = new NextRequest('http://localhost/api/friends/req-123', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'accept' })
    });
  const acceptRes = await updateRequest(acceptReq, { params: Promise.resolve({ id: 'req-123' }) });
    expect(acceptRes.status).toBe(200);

    // 4. Verify in friends list
    (getFriendsService as any).mockResolvedValue([{
      friendshipId: 'friendship-123',
      player: { username: 'friend1' },
      status: 'accepted'
    }]);

    const listReq = new NextRequest('http://localhost/api/friends');
    const listRes = await getFriends(listReq);
    const listData = await listRes.json();
    
    expect(listData.friends).toHaveLength(1);
    expect(listData.friends[0].player.username).toBe('friend1');
  });
});

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * TEST COVERAGE:
 * - GET /api/friends: 3 tests (success, empty, error)
 * - POST /api/friends: 4 tests (success, validation errors, service errors)
 * - PATCH /api/friends/[id]: 4 tests (accept, decline, invalid action, not found)
 * - DELETE /api/friends/[id]: 2 tests (success, not found)
 * - GET /api/friends/requests: 2 tests (with requests, empty)
 * - GET /api/friends/search: 5 tests (success, validation, limit handling)
 * - Integration: 1 test (full friend request flow)
 * 
 * Total: 21 automated tests
 * 
 * TO RUN:
 * npm run test -- friends.test.ts
 * 
 * MOCK STRATEGY:
 * - authMiddleware: Always returns test-user-123
 * - friendService: All functions mocked with vi.fn()
 * - Error classes: Custom error types properly mocked
 * 
 * COVERAGE GOALS:
 * - Statements: > 80%
 * - Branches: > 75%
 * - Functions: > 80%
 * - Lines: > 80%
 */
