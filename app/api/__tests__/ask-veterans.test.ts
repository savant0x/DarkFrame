/**
 * API Route Tests - Ask Veterans
 * Created: 2025-10-25
 * Feature: FID-20251025-104 (Production Readiness - Testing)
 * 
 * OVERVIEW:
 * Integration tests for app/api/chat/ask-veterans/route.ts
 * Tests authentication, level restrictions, rate limiting, and validation.
 * 
 * TEST COVERAGE:
 * - Authentication (401 if not authenticated)
 * - Level restriction (403 if level > 10)
 * - Rate limiting (429 if cooldown active)
 * - Question validation (400 for invalid questions)
 * - Successful veteran help requests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/chat/ask-veterans/route';

// Mock dependencies
vi.mock('@/lib/mongodb', () => ({
  connectToDatabase: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/authMiddleware', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  createRateLimiter: vi.fn(() => ({
    check: vi.fn().mockResolvedValue(true),
    getRemainingTime: vi.fn().mockResolvedValue(0),
    record: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/lib/chatService', () => ({
  sendVeteranNotification: vi.fn().mockResolvedValue({
    id: 'notif_123',
    message: 'Help request sent',
  }),
  isVeteran: vi.fn(),
}));

describe('POST /api/chat/ask-veterans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { requireAuth } = await import('@/lib/authMiddleware');
    const { NextResponse } = await import('next/server');

    vi.mocked(requireAuth).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );

    const request = new NextRequest('http://localhost:3000/api/chat/ask-veterans', {
      method: 'POST',
      body: JSON.stringify({ question: 'Help me please' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 403 if player level > 10', async () => {
    const { requireAuth } = await import('@/lib/authMiddleware');

    vi.mocked(requireAuth).mockResolvedValueOnce({
      username: 'highLevelPlayer',
      playerId: 'player_high',
      isAdmin: false,
      player: {
        level: 25,
      },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/chat/ask-veterans', {
      method: 'POST',
      body: JSON.stringify({ question: 'Help me please' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('level 10 and below');
  });

  it('should return 429 if rate limited', async () => {
    const { requireAuth } = await import('@/lib/authMiddleware');
    const { createRateLimiter } = await import('@/lib/redis');

    vi.mocked(requireAuth).mockResolvedValueOnce({
      username: 'newbiePlayer',
      playerId: 'player_newbie',
      isAdmin: false,
      player: {
        level: 5,
      },
    } as any);

    // Mock rate limiter to return false (rate limited)
    vi.mocked(createRateLimiter).mockReturnValueOnce({
      check: vi.fn().mockResolvedValue(false),
      getRemainingTime: vi.fn().mockResolvedValue(180), // 3 minutes remaining
      record: vi.fn(),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/chat/ask-veterans', {
      method: 'POST',
      body: JSON.stringify({ question: 'Help me please' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('wait');
    expect(data.cooldownSeconds).toBe(180);
  });

  it('should return 400 if question is too short', async () => {
    const { requireAuth } = await import('@/lib/authMiddleware');

    vi.mocked(requireAuth).mockResolvedValueOnce({
      username: 'newbiePlayer',
      playerId: 'player_newbie',
      isAdmin: false,
      player: {
        level: 3,
      },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/chat/ask-veterans', {
      method: 'POST',
      body: JSON.stringify({ question: 'Help' }), // Too short
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('at least 10 characters');
  });

  it('should return 400 if question is too long', async () => {
    const { requireAuth } = await import('@/lib/authMiddleware');

    vi.mocked(requireAuth).mockResolvedValueOnce({
      username: 'newbiePlayer',
      playerId: 'player_newbie',
      isAdmin: false,
      player: {
        level: 3,
      },
    } as any);

    const longQuestion = 'a'.repeat(201); // 201 characters

    const request = new NextRequest('http://localhost:3000/api/chat/ask-veterans', {
      method: 'POST',
      body: JSON.stringify({ question: longQuestion }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('cannot exceed 200 characters');
  });

  it('should successfully send veteran help request', async () => {
    const { requireAuth } = await import('@/lib/authMiddleware');
    const { createRateLimiter } = await import('@/lib/redis');

    vi.mocked(requireAuth).mockResolvedValueOnce({
      username: 'newbiePlayer',
      playerId: 'player_newbie',
      isAdmin: false,
      player: {
        level: 5,
      },
    } as any);

    // Mock rate limiter to allow request
    vi.mocked(createRateLimiter).mockReturnValueOnce({
      check: vi.fn().mockResolvedValue(true),
      getRemainingTime: vi.fn().mockResolvedValue(0),
      record: vi.fn(),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/chat/ask-veterans', {
      method: 'POST',
      body: JSON.stringify({
        question: 'How do I get better equipment at level 5?',
        category: 'progression',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('sent to veteran players');
    expect(data.cooldownSeconds).toBe(300); // 5 minutes
  });

  it('should return 400 for invalid category', async () => {
    const { requireAuth } = await import('@/lib/authMiddleware');

    vi.mocked(requireAuth).mockResolvedValueOnce({
      username: 'newbiePlayer',
      playerId: 'player_newbie',
      isAdmin: false,
      player: {
        level: 5,
      },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/chat/ask-veterans', {
      method: 'POST',
      body: JSON.stringify({
        question: 'How do I get better equipment?',
        category: 'invalid_category',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid category');
  });
});

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Test Coverage:
 *    - Authentication (401)
 *    - Level restriction (403 for level > 10)
 *    - Rate limiting (429 with cooldown time)
 *    - Question validation (length, required field)
 *    - Category validation
 *    - Successful help request
 * 
 * 2. Mocking Strategy:
 *    - MongoDB mocked (no real database)
 *    - requireAuth() mocked for different user scenarios
 *    - createRateLimiter() mocked to control rate limit behavior
 *    - sendVeteranNotification() mocked (actual WebSocket broadcast tested separately)
 * 
 * 3. Rate Limiting Tests:
 *    - Allow request when not rate limited
 *    - Block request when rate limited
 *    - Return correct remaining cooldown time
 * 
 * 4. Running Tests:
 *    ```bash
 *    npm test app/api/__tests__/ask-veterans.test.ts
 *    npm test -- --coverage
 *    ```
 * 
 * 5. Future Enhancements:
 *    - Test actual Redis integration (requires Redis server)
 *    - Test concurrent requests from same user
 *    - Test veteran notification broadcasting
 *    - Add load tests (many newbies asking for help)
 */
