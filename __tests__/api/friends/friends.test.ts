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
import { FriendStatus, FriendRequestStatus } from '@/types/friend';
import { GET as getFriends, POST as sendRequest } from '@/app/api/friends/route';
import { PATCH as updateRequest, DELETE as removeFriend } from '@/app/api/friends/[id]/route';
import { GET as getRequests } from '@/app/api/friends/requests/route';
import { GET as searchUsers } from '@/app/api/friends/search/route';

// Mock dependencies
vi.mock('@/lib/authMiddleware', () => ({
  requireAuth: vi.fn(async (_req: Request) => ({
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
          _id: 'friendship-1',
          userId: 'test-user-123',
          friendId: 'friend-1',
          status: FriendStatus.ACCEPTED,
          initiatedBy: 'test-user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          username: 'friend1',
          level: 10,
          vip: false,
          clanTag: 'CLAN1'
        }
      ];

      const { getFriends: getFriendsMock } = await import('@/lib/friendService');
      vi.mocked(getFriendsMock).mockResolvedValue(mockFriends);

      const request = new NextRequest('http://localhost/api/friends');
      const response = await getFriends(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.friends).toHaveLength(1);
      expect(data.friends[0].username).toBe('friend1');
    });

    it('should return empty array when no friends', async () => {
      const { getFriends: getFriendsMock } = await import('@/lib/friendService');
      vi.mocked(getFriendsMock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/friends');
      const response = await getFriends(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.friends).toHaveLength(0);
    });

    it('should handle service errors gracefully', async () => {
      const { getFriends: getFriendsMock } = await import('@/lib/friendService');
      vi.mocked(getFriendsMock).mockRejectedValue(new Error('Database error'));

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
      vi.mocked(sendRequestMock).mockResolvedValue({
        _id: 'request-123',
        from: 'test-user-123',
        to: 'friend2',
        status: FriendRequestStatus.PENDING,
        createdAt: new Date()
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
      expect(data.request.to).toBe('friend2');
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
  vi.mocked(sendRequestMock).mockRejectedValue(new ValidationError('Cannot send request to yourself'));

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
      vi.mocked(acceptRequestMock).mockResolvedValue({
        _id: 'friendship-123',
        userId: 'sender-1',
        friendId: 'test-user-123',
        status: FriendStatus.ACCEPTED,
        initiatedBy: 'sender-1',
        createdAt: new Date(),
        updatedAt: new Date()
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
      vi.mocked(declineRequestMock).mockResolvedValue({
        _id: 'request-123',
        from: 'sender-1',
        to: 'test-user-123',
        status: FriendRequestStatus.DECLINED,
        createdAt: new Date(),
        respondedAt: new Date()
      });

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
  vi.mocked(acceptRequestMock).mockRejectedValue(new NotFoundError('Request not found'));

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
      vi.mocked(removeFriendMock).mockResolvedValue(true);

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
  vi.mocked(removeFriendMock).mockRejectedValue(new NotFoundError('Friendship not found'));

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
      
      vi.mocked(getPendingMock).mockResolvedValue([
        {
          _id: 'req-1',
          from: 'sender-1',
          to: 'test-user-123',
          status: FriendRequestStatus.PENDING,
          message: 'Hello!',
          createdAt: new Date(),
          fromUsername: 'sender1',
          fromLevel: 12
        }
      ]);

      vi.mocked(getSentMock).mockResolvedValue([
        {
          _id: 'req-2',
          from: 'test-user-123',
          to: 'recipient-1',
          status: FriendRequestStatus.PENDING,
          createdAt: new Date(),
          fromUsername: 'recipient1',
          fromLevel: 8
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
      
      vi.mocked(getPendingMock).mockResolvedValue([]);
      vi.mocked(getSentMock).mockResolvedValue([]);

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
      vi.mocked(searchUsersMock).mockResolvedValue([
        {
          _id: 'player-1',
          username: 'player1',
          level: 15,
          vip: true
        },
        {
          _id: 'player-2',
          username: 'player2',
          level: 8,
          vip: false,
          friendStatus: FriendStatus.ACCEPTED
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
      vi.mocked(searchUsersMock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/friends/search?q=test&limit=5');
      await searchUsers(request);

      expect(searchUsersMock).toHaveBeenCalledWith('test-user-123', 'test', 5);
    });

    it('should use default limit when not provided', async () => {
      const { searchUsers: searchUsersMock } = await import('@/lib/friendService');
      vi.mocked(searchUsersMock).mockResolvedValue([]);

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
    vi.mocked(sendFriendRequest).mockResolvedValue({
      _id: 'req-123',
      from: 'test-user-123',
      to: 'friend1',
      status: FriendRequestStatus.PENDING,
      createdAt: new Date()
    });

    const sendReq = new NextRequest('http://localhost/api/friends', {
      method: 'POST',
      body: JSON.stringify({ recipientUsername: 'friend1' })
    });
    const sendRes = await sendRequest(sendReq);
    expect(sendRes.status).toBe(201);

    // 2. Check pending requests
    vi.mocked(getPendingRequests).mockResolvedValue([{
      _id: 'req-123',
      from: 'test-user-123',
      to: 'friend-1',
      status: FriendRequestStatus.PENDING,
      createdAt: new Date(),
      fromUsername: 'testuser',
      fromLevel: 1
    }]);

    // 3. Accept request
    vi.mocked(acceptRequest).mockResolvedValue({
      _id: 'friendship-123',
      userId: 'test-user-123',
      friendId: 'friend-1',
      status: FriendStatus.ACCEPTED,
      initiatedBy: 'test-user-123',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const acceptReq = new NextRequest('http://localhost/api/friends/req-123', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'accept' })
    });
  const acceptRes = await updateRequest(acceptReq, { params: Promise.resolve({ id: 'req-123' }) });
    expect(acceptRes.status).toBe(200);

    // 4. Verify in friends list
    vi.mocked(getFriendsService).mockResolvedValue([{
      _id: 'friendship-123',
      userId: 'test-user-123',
      friendId: 'friend-1',
      status: FriendStatus.ACCEPTED,
      initiatedBy: 'test-user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      username: 'friend1',
      level: 10
    }]);

    const listReq = new NextRequest('http://localhost/api/friends');
    const listRes = await getFriends(listReq);
    const listData = await listRes.json();
    
    expect(listData.friends).toHaveLength(1);
    expect(listData.friends[0].username).toBe('friend1');
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
