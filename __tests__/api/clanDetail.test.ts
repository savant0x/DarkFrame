/**
 * @file __tests__/api/clanDetail.test.ts
 * @created 2026-09-17
 * @overview Pins for FID-20260917-006, GET /api/clan/[id]: auth pass-through,
 *            exact success contract ({ success, clan }), CLAN_NOT_FOUND 404,
 *            service-throw 500 envelope. Error envelopes are the REAL helpers
 *            (only requireAuth + getClanById are mocked).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { requireAuthMock, getClanByIdMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  getClanByIdMock: vi.fn(),
}));

vi.mock('@/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib')>();
  return {
    ...actual,
    requireAuth: requireAuthMock,
  };
});

vi.mock('@/lib/clanService', () => ({
  getClanById: getClanByIdMock,
}));

import { GET } from '@/app/api/clan/[id]/route';

const CLAN_FIXTURE = {
  _id: 'c' + '1'.repeat(23),
  name: 'Savant',
  tag: 'SAV',
  description: 'probe clan',
  leaderId: 'fame',
  members: [
    {
      playerId: 'fame',
      username: 'fame',
      role: 'LEADER',
      joinedAt: new Date('2026-09-17T00:00:00Z'),
      lastActive: new Date('2026-09-17T00:00:00Z'),
    },
  ],
  maxMembers: 20,
  level: { currentLevel: 1, totalXP: 0, currentLevelXP: 0, xpToNextLevel: 0, featuresUnlocked: [], milestonesCompleted: [], lastLevelUp: new Date() },
  createdAt: new Date('2026-09-17T00:00:00Z'),
  settings: {
    messageOfTheDay: '',
    isRecruiting: true,
    minLevelToJoin: 0,
    requiresApproval: false,
    allowTerritoryControl: true,
    allowWarDeclarations: true,
  },
  stats: { totalPower: 0, totalTerritories: 0, totalMonuments: 0, warsWon: 0, warsLost: 0 },
} as const;

function makeRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/clan/${id}`);
}

describe('GET /api/clan/[id] (FID-20260917-006)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ username: 'fame', playerId: 'fame', isAdmin: false });
  });

  it('serves the full clan contract the panels consume', async () => {
    getClanByIdMock.mockResolvedValue(CLAN_FIXTURE);

    const res = await GET(makeRequest('c1111'), { params: Promise.resolve({ id: 'c1111' }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.clan).toMatchObject({
      _id: CLAN_FIXTURE._id,
      name: 'Savant',
      tag: 'SAV',
      leaderId: 'fame',
    });
    // member gate data: ClanManagementView.tsx:720 members.find(m => m.username === ...)
    expect(body.clan.members).toHaveLength(1);
    expect(body.clan.members[0]).toMatchObject({ username: 'fame', role: 'LEADER' });
    // level header data: line 742 reads level.currentLevel
    expect(body.clan.level.currentLevel).toBe(1);
    expect(getClanByIdMock).toHaveBeenCalledWith('c1111');
  });

  it('404s with the CLAN_NOT_FOUND envelope for an unknown id', async () => {
    getClanByIdMock.mockResolvedValue(null);

    const res = await GET(makeRequest('nope'), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CLAN_NOT_FOUND');
  });

  it('passes the requireAuth 401 response through untouched', async () => {
    requireAuthMock.mockResolvedValue(
      NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    );

    const res = await GET(makeRequest('c1111'), { params: Promise.resolve({ id: 'c1111' }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(getClanByIdMock).not.toHaveBeenCalled();
  });

  it('maps a service throw to the 500 error envelope', async () => {
    getClanByIdMock.mockRejectedValue(new Error('db boom'));

    const res = await GET(makeRequest('c1111'), { params: Promise.resolve({ id: 'c1111' }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
