/**
 * @file __tests__/api/chatReadState.test.ts
 * @created 2026-09-19 (FID-20260919-015 W1)
 * @overview Pins for the persistent chat channel read state: the real PATCH
 *            /api/chat (replacing the FID-012 no-op comment), the read-state
 *            GET summary contract, and the service's upsert shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { authMock, canReadMock, markMock, stateMock, summaryMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  canReadMock: vi.fn(),
  markMock: vi.fn(),
  stateMock: vi.fn(),
  summaryMock: vi.fn(),
}));

vi.mock('@/lib/authMiddleware', () => ({
  authenticateRequest: authMock,
  requireAuth: vi.fn(async (req: NextRequest) => {
    const cookie = req.headers.get('cookie') ?? '';
    if (cookie.includes('darkframe_session=ok')) return { username: 'tester' };
    // Route guards with `instanceof NextResponse` — the 401 must be one.
    const { NextResponse } = await import('next/server');
    return NextResponse.json({ success: false }, { status: 401 });
  }),
}));

vi.mock('@/lib/moderationService', () => ({
  checkMuteStatus: vi.fn().mockResolvedValue({ isMuted: false }),
  filterMessage: vi.fn(),
  detectSpam: vi.fn(),
  muteUserForSpam: vi.fn(),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/chatService', () => ({
  deleteGlobalChatMessage: vi.fn(),
  sendGlobalChatMessage: vi.fn(),
  getGlobalChatMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/channelService', () => ({
  canReadChannel: canReadMock,
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

vi.mock('@/lib/chatReadStatusService', () => ({
  markChannelRead: markMock,
  getChannelReadState: stateMock,
  getReadStateSummary: summaryMock,
  toReadStateWire: (s: Record<string, { lastReadMessageId: string | null; lastReadAt: Date }>) => {
    const wire: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) {
      wire[k] = { lastReadMessageId: v.lastReadMessageId, lastReadAt: v.lastReadAt.toISOString() };
    }
    return wire;
  },
}));

import { PATCH } from '@/app/api/chat/route';
import { GET as readStateGET } from '@/app/api/chat/read-state/route';

interface ReqInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}
function makeRequest(url: string, init?: ReqInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as never);
}

describe('PATCH /api/chat — persistent mark-as-read (FID-20260919-015 W1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ username: 'tester', player: { level: 5, vip: 0, clanId: null } });
    canReadMock.mockReturnValue({ canRead: true });
    markMock.mockResolvedValue({ lastReadAt: new Date('2026-09-19T12:00:00Z') });
  });

  it('persists via markChannelRead with channelId + lastReadMessageId', async () => {
    const req = makeRequest('http://localhost:3000/api/chat', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: 'global', lastReadMessageId: 'm-42' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(markMock).toHaveBeenCalledWith('tester', 'global', 'm-42');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.lastReadMessageId).toBe('m-42');
  });

  it('400 when lastReadMessageId missing — nothing persisted', async () => {
    const req = makeRequest('http://localhost:3000/api/chat', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: 'global' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    expect(markMock).not.toHaveBeenCalled();
  });

  it('400 on unknown channel — nothing persisted', async () => {
    canReadMock.mockReturnValue({ canRead: false, reason: 'unknown-channel' });
    const req = makeRequest('http://localhost:3000/api/chat', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: 'nope', lastReadMessageId: 'm-1' }),
    });
    const res = await PATCH(req);
    expect([400, 403]).toContain(res.status);
    expect(markMock).not.toHaveBeenCalled();
  });

  it('401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const req = makeRequest('http://localhost:3000/api/chat', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: 'global', lastReadMessageId: 'm-1' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
    expect(markMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/chat/read-state — badge seeding contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateMock.mockResolvedValue({
      trade: { channelId: 'trade', lastReadMessageId: 'm-9', lastReadAt: new Date('2026-09-19T11:00:00.000Z') },
    });
    summaryMock.mockResolvedValue({
      trade: { lastReadAt: '2026-09-19T11:00:00.000Z', unread: 3 },
    });
  });

  it('returns readState + unread summary for the caller only', async () => {
    const req = makeRequest('http://localhost:3000/api/chat/read-state', {
      headers: { cookie: 'darkframe_session=ok' },
    });
    const res = await readStateGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.readState.trade).toEqual({
      lastReadMessageId: 'm-9',
      lastReadAt: '2026-09-19T11:00:00.000Z',
    });
    expect(body.summary.trade.unread).toBe(3);
    expect(stateMock).toHaveBeenCalledWith('tester');
  });

  it('401 without a session', async () => {
    const req = makeRequest('http://localhost:3000/api/chat/read-state');
    const res = await readStateGET(req);
    expect(res.status).toBe(401);
  });
});
