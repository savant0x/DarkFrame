/**
 * @file __tests__/api/clan/chat-delta.test.ts
 * @overview FID-20260909-027 §3.1 regression tests — clan chat delta polling.
 *
 * The live panel polled the FULL 100-message window every 10 s. The route now
 * supports `?since=<ISO>` (delta), rejects `since` + `limit` together, and
 * re-syncs to a full window when a delta exceeds 200 rows (stale cursor belt).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getMessages } from '@/app/api/clan/chat/messages/route';

const mockGate = vi.fn();
const mockGetClanChatMessages = vi.fn();
const mockGetMessagesSince = vi.fn();

vi.mock('@/lib/authMiddleware', () => ({
  requireClanMembership: (...args: unknown[]) => mockGate(...args),
}));

vi.mock('@/lib/clanChatService', () => ({
  getClanChatMessages: (...args: unknown[]) => mockGetClanChatMessages(...args),
  getMessagesSince: (...args: unknown[]) => mockGetMessagesSince(...args),
}));

function wireMessage(id: string, minutesAgo: number) {
  return {
    id,
    clanId: 'c1',
    type: 'chat' as const,
    playerId: `p-${id}`,
    username: `user-${id}`,
    role: 'MEMBER',
    message: `hello ${id}`,
    timestamp: new Date(Date.now() - minutesAgo * 60_000),
  };
}

function makeRequest(query: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000/api/clan/chat/messages${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGate.mockResolvedValue({ clanId: 'c1' });
});

describe('FID-027 §3.1 — /api/clan/chat/messages delta mode', () => {
  it('since mode resolves through getMessagesSince and applies sender* wire aliases', async () => {
    const delta = [wireMessage('m2', 1), wireMessage('m3', 0)];
    mockGetMessagesSince.mockResolvedValue(delta);

    const response = await getMessages(makeRequest('?clanId=c1&since=2026-09-09T10:00:00Z'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.resync).toBe(false);
    expect(body.messages).toHaveLength(2);
    // sender* aliases the panel reads must be present on delta responses too
    expect(body.messages[0].senderUsername).toBe('user-m2');
    expect(body.messages[0].senderRole).toBe('MEMBER');
    expect(mockGetMessagesSince).toHaveBeenCalledWith('c1', expect.any(Date));
    expect(mockGetClanChatMessages).not.toHaveBeenCalled();
  });

  it('rejects since + limit together with 400 and never hits the service', async () => {
    const response = await getMessages(makeRequest('?clanId=c1&since=2026-09-09T10:00:00Z&limit=50'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(mockGetMessagesSince).not.toHaveBeenCalled();
    expect(mockGetClanChatMessages).not.toHaveBeenCalled();
    expect(body.success).toBe(false);
  });

  it('rejects a malformed since timestamp with 400', async () => {
    const response = await getMessages(makeRequest('?clanId=c1&since=not-a-date'));
    expect(response.status).toBe(400);
  });

  it('re-syncs to a full window when the delta exceeds the 200-row belt', async () => {
    const flood = Array.from({ length: 201 }, (_, i) => wireMessage(`flood-${i}`, i));
    mockGetMessagesSince.mockResolvedValue(flood);
    mockGetClanChatMessages.mockResolvedValue([wireMessage('m9', 0)]);

    const response = await getMessages(makeRequest('?clanId=c1&since=2020-01-01T00:00:00Z'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resync).toBe(true);
    expect(body.messages).toHaveLength(1);
    // Re-sync = full recent window fetch, not the unbounded delta
    expect(mockGetClanChatMessages).toHaveBeenCalledWith('c1', 100);
  });

  it('full mode caps limit at 100 and maps sender* aliases as before', async () => {
    const rows = [wireMessage('m1', 2)];
    mockGetClanChatMessages.mockResolvedValue(rows);

    const response = await getMessages(makeRequest('?clanId=c1&limit=500'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetClanChatMessages).toHaveBeenCalledWith('c1', 100);
    expect(body.messages[0].senderId).toBe('p-m1');
    expect(body.messages[0].senderUsername).toBe('user-m1');
  });

  it('rejects a clanId param that disagrees with the session clan', async () => {
    const response = await getMessages(makeRequest('?clanId=OTHER&limit=50'));
    expect(response.status).toBe(403);
    expect(mockGetClanChatMessages).not.toHaveBeenCalled();
  });
});
