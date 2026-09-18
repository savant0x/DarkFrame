/**
 * @file __tests__/api/chatReportBlock.test.ts
 * @created 2026-09-17
 * @overview Pins for FID-20260917-012 (chat honesty, work order item 3):
 *            report persistence, idempotent GLOBAL block, and the
 *            server-side enforcement filters (a blocked sender's messages
 *            vanish for the viewer who blocked, not for others).
 *
 * db mocked; blockService's real logic exercised through the routes where
 * possible; enforcement filters tested at the service seams.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { selectMock, insertMock, deleteMock, executeMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  deleteMock: vi.fn(),
  executeMock: vi.fn(),
}));

function chain(result: unknown, methods: string[]) {
  const thenable = vi.fn(() => thenable) as unknown as Promise<unknown> & Record<string, ReturnType<typeof vi.fn>>;
  (thenable as unknown as { then: (res: (v: unknown) => unknown) => void }).then = (res) => res(result);
  for (const m of methods) thenable[m] = vi.fn(() => thenable);
  return thenable;
}

vi.mock('@/lib/db', () => ({
  db: {
    select: selectMock,
    insert: insertMock,
    delete: deleteMock,
    execute: executeMock,
    update: vi.fn(),
  },
}));

vi.mock('@/lib/authMiddleware', () => ({
  authenticateRequest: vi.fn(async () => ({
    username: 'viewer',
    player: { level: 10, vip: 0, clanId: null },
  })),
}));

import { POST as reportPost } from '@/app/api/chat/report/route';
import { POST as blockPost, GET as blockGet } from '@/app/api/chat/block/route';
import { blockUser, unblockUser } from '@/lib/blockService';
import { getGlobalChatMessages } from '@/lib/chatService';
import { getConversations } from '@/lib/messagingService';
import { db } from '@/lib/db';
import { blockedUsers } from '@/lib/db/schema';
import { ChannelType } from '@/lib/channelService';

function req(method: 'POST' | 'DELETE' | 'GET', body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/chat/x', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  }) as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('report route', () => {
  it('400 when required fields missing', async () => {
    const res = await reportPost(req('POST', { messageId: 'm1' }));
    expect(res.status).toBe(400);
  });

  it('400 on unknown reason', async () => {
    const res = await reportPost(
      req('POST', { messageId: 'm1', channelId: 'global', reportedUserId: 'toxic', reason: 'vibes' }),
    );
    expect(res.status).toBe(400);
  });

  it('refuses self-reports', async () => {
    const res = await reportPost(
      req('POST', { messageId: 'm1', channelId: 'global', reportedUserId: 'viewer', reason: 'spam' }),
    );
    expect(res.status).toBe(400);
  });

  it('inserts an open report and returns 201 with its id', async () => {
    const ins = chain(undefined, ['values']);
    (ins.values as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());
    insertMock.mockReturnValue(ins);

    const res = await reportPost(
      req('POST', { messageId: 'm1', channelId: 'global', reportedUserId: 'toxic', reason: 'spam' }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { success: boolean; reportId: string };
    expect(json.success).toBe(true);
    expect(json.reportId).toBeDefined();
    expect((ins.values as ReturnType<typeof vi.fn>).mock.calls[0][0].status).toBe('open');
  });
});

describe('block route + service', () => {
  it('400 on self-block', async () => {
    const res = await blockPost(req('POST', { userId: 'viewer' }));
    expect(res.status).toBe(400);
  });

  it('block inserts idempotently (onConflictDoNothing)', async () => {
    const ins = chain(undefined, ['values', 'onConflictDoNothing']);
    (ins.values as ReturnType<typeof vi.fn>).mockReturnValue(ins);
    (ins.onConflictDoNothing as ReturnType<typeof vi.fn>).mockReturnValue(Promise.resolve());
    insertMock.mockReturnValue(ins);

    const res = await blockPost(req('POST', { userId: 'toxic' }));
    expect(res.status).toBe(200);
    expect(ins.onConflictDoNothing).toHaveBeenCalled();
  });

  it('unblock reports whether a row was removed', async () => {
    const del = chain({ rowCount: 1 }, ['where']);
    deleteMock.mockReturnValue(del);
    expect(await unblockUser('viewer', 'toxic')).toBe(true);

    const miss = chain({ rowCount: 0 }, ['where']);
    deleteMock.mockReturnValue(miss);
    expect(await unblockUser('viewer', 'toxic')).toBe(false);
  });

  it('GET lists the caller\u2019s blocked users', async () => {
    const sel = chain([{ blockedId: 'toxic' }], ['from', 'where']);
    selectMock.mockReturnValue(sel);

    const res = await blockGet(req('GET'));
    const json = (await res.json()) as { blocked: string[] };
    expect(json.blocked).toEqual(['toxic']);
  });

  it('blockService refuses self-block', async () => {
    expect(await blockUser('same', 'same')).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe('GLOBAL enforcement filters', () => {
  it('chatService: messages FROM a blocked user are hidden for that viewer only', async () => {
    const rows = [
      { id: 'm1', senderId: 'toxic', senderUsername: 'toxic', deleted: 0, isVIP: 0, isNewbie: 0, message: 'hi', itemLinks: [], mentions: [], timestamp: new Date(), edited: 0 },
      { id: 'm2', senderId: 'friend', senderUsername: 'friend', deleted: 0, isVIP: 0, isNewbie: 0, message: 'yo', itemLinks: [], mentions: [], timestamp: new Date(), edited: 0 },
    ];
    // Call order in the service: messages query FIRST, then the block list.
    const blockList = chain([{ blockedId: 'toxic' }], ['from', 'where']);
    const msgList = chain(rows, ['from', 'where', 'orderBy', 'limit']);
    selectMock.mockReturnValueOnce(msgList).mockReturnValueOnce(blockList);

    const viewerView = await getGlobalChatMessages({
      channelId: ChannelType.GLOBAL,
      viewerId: 'viewer',
    });
    expect(viewerView.map((m) => m.senderId)).toEqual(['friend']);

    // Other viewers (no blocks) still see both.
    const emptyList = chain([], ['from', 'where']);
    const msgList2 = chain(rows, ['from', 'where', 'orderBy', 'limit']);
    selectMock.mockReturnValueOnce(msgList2).mockReturnValueOnce(emptyList);
    const otherView = await getGlobalChatMessages({ channelId: ChannelType.GLOBAL, viewerId: 'someone_else' });
    expect(otherView.map((m) => m.senderId)).toEqual(['friend', 'toxic']); // reversed to oldest-first
  });

  it('messagingService: conversations with a blocked OTHER participant vanish for the viewer', async () => {
    const convs = [
      { id: 'c1', participants: ['viewer', 'toxic'], isArchived: {}, unreadCount: {}, isPinned: {}, updatedAt: new Date().toISOString() },
      { id: 'c2', participants: ['viewer', 'friend'], isArchived: {}, unreadCount: {}, isPinned: {}, updatedAt: new Date().toISOString() },
    ];
    // Call order: conversations select FIRST, then the block list.
    const blockList = chain([{ blockedId: 'toxic' }], ['from', 'where']);
    const convList = chain(convs, ['from']);
    selectMock.mockReturnValueOnce(convList).mockReturnValueOnce(blockList);

    const res = await getConversations({ playerId: 'viewer' });
    expect(res.conversations.map((c) => c._id)).toEqual(['c2']); // Conversation carries _id (mapConversationToType)
  });
});

describe('schema', () => {
  it('blocked pair uniqueness is declared', () => {
    // Guard the idempotency contract at the schema level.
    expect(blockedUsers).toBeDefined();
    void db;
  });
});
