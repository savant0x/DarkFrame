/**
 * @file __tests__/api/chatModeratorDelete.test.ts
 * @created 2026-09-19 (FID-20260919-012)
 * @overview Pins for the bare DELETE /api/chat moderator endpoint — the
 *            false-success regression class: the handler previously returned
 *            `success: true, "Message deleted"` WITHOUT deleting (body was a
 *            commented-out TODO). These pins assert the wired behavior:
 *            admin-gated, real soft-delete via chatService, honest errors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { authMock, isAdminMock, deleteMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  isAdminMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('@/lib/authMiddleware', () => ({
  authenticateRequest: authMock,
}));

vi.mock('@/lib/moderationService', () => ({
  checkMuteStatus: vi.fn().mockResolvedValue({ isMuted: false }),
  filterMessage: vi.fn(),
  detectSpam: vi.fn(),
  muteUserForSpam: vi.fn(),
  isAdmin: isAdminMock,
}));

vi.mock('@/lib/chatService', () => ({
  deleteGlobalChatMessage: deleteMock,
  sendGlobalChatMessage: vi.fn(),
  getGlobalChatMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/channelService', () => ({
  canReadChannel: vi.fn().mockReturnValue({ canRead: true }),
  canWriteChannel: vi.fn().mockReturnValue({ canWrite: true }),
  ChannelType: {
    GLOBAL: 'global',
    NEWBIE: 'newbie',
    CLAN: 'clan',
    TRADE: 'trade',
    HELP: 'help',
    VIP: 'vip',
  },
}));

import { DELETE } from '@/app/api/chat/route';

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

const AUTH = {
  username: 'adminuser',
  player: { level: 30, vip: 1, clanId: null },
};

describe('DELETE /api/chat (moderator soft-delete, FID-20260919-012)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(AUTH);
    isAdminMock.mockResolvedValue(true);
    deleteMock.mockResolvedValue(true);
  });

  it('401 when unauthenticated — no delete attempted', async () => {
    authMock.mockResolvedValue(null);
    const res = await DELETE(makeRequest('http://localhost:3000/api/chat?messageId=m1'));
    expect(res.status).toBe(401);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('400 when messageId missing — no delete attempted', async () => {
    const res = await DELETE(makeRequest('http://localhost:3000/api/chat'));
    expect(res.status).toBe(400);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('403 for non-admin callers — gate precedes any delete', async () => {
    isAdminMock.mockResolvedValue(false);
    const res = await DELETE(makeRequest('http://localhost:3000/api/chat?messageId=m1'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Moderator access required');
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('deletes via chatService with moderator attribution and honest success body', async () => {
    const res = await DELETE(makeRequest('http://localhost:3000/api/chat?messageId=msg_9'));
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith('msg_9', 'adminuser', 'Deleted by moderator');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.messageId).toBe('msg_9');
  });

  it('404 when the message is missing or already deleted — never a false success', async () => {
    deleteMock.mockResolvedValue(false);
    const res = await DELETE(makeRequest('http://localhost:3000/api/chat?messageId=msg_x'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Message not found or already deleted');
  });

  it('500 bubbles unexpected service errors with success:false', async () => {
    deleteMock.mockRejectedValue(new Error('db down'));
    const res = await DELETE(makeRequest('http://localhost:3000/api/chat?messageId=m1'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
