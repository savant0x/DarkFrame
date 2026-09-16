/**
 * @file __tests__/api/clanResearchState.test.ts
 * @created 2026-09-16
 * @overview Pins for the FID-20260916-012 research state GET: membership gate
 *            pass-through, exact tree payload, error mapping.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { requireClanMembershipMock } = vi.hoisted(() => ({
  requireClanMembershipMock: vi.fn(),
}));

vi.mock('@/lib', () => ({
  requireClanMembership: requireClanMembershipMock,
}));

vi.mock('@/lib/clanResearchService', () => ({
  getResearchTree: vi.fn(),
}));

import { GET as stateGET } from '@/app/api/clan/research/state/route';
import { getResearchTree } from '@/lib/clanResearchService';

function req(): NextRequest {
  return new NextRequest(new Request('http://localhost/api/clan/research/state'));
}

const TREE = {
  INDUSTRIAL: [],
  MILITARY: [
    {
      id: 'mil_combat_1',
      name: 'Combat Training',
      description: 'Basic combat drills improve attack effectiveness',
      branch: 'MILITARY',
      tier: 1,
      cost: 5000,
      requiredLevel: 5,
      prerequisites: [],
      bonuses: [{ type: 'attack', value: 5 }],
      unlocked: false,
      available: true,
    },
    {
      id: 'mil_tactics_1',
      name: 'Advanced Tactics',
      description: 'Coordinated unit maneuvers',
      branch: 'MILITARY',
      tier: 2,
      cost: 12000,
      requiredLevel: 8,
      prerequisites: ['mil_combat_1'],
      bonuses: [{ type: 'defense', value: 4 }],
      unlocked: true,
      available: false,
    },
  ],
  ECONOMIC: [],
  SOCIAL: [],
  clanLevel: 6,
  researchPoints: 7500,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/clan/research/state', () => {
  it('passes the membership NextResponse through unchanged (401 gate)', async () => {
    const gate = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    requireClanMembershipMock.mockResolvedValueOnce(gate);
    const res = await stateGET(req());
    expect(res.status).toBe(401);
    expect(getResearchTree).not.toHaveBeenCalled();
  });

  it('returns the tree verbatim: nodes, clan level, fund balance', async () => {
    requireClanMembershipMock.mockResolvedValueOnce({ auth: {}, clan: {}, clanId: 'clan_1' });
    vi.mocked(getResearchTree).mockResolvedValueOnce(TREE as never);
    const res = await stateGET(req());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.tree).toEqual(TREE);
    expect(data.tree.MILITARY).toHaveLength(2);
    expect(data.tree.researchPoints).toBe(7500);
    expect(data.tree.clanLevel).toBe(6);
    expect(getResearchTree).toHaveBeenCalledWith('clan_1');
  });

  it('maps a service throw to a 500 with a generic message (no internals leaked)', async () => {
    requireClanMembershipMock.mockResolvedValueOnce({ auth: {}, clan: {}, clanId: 'clan_1' });
    vi.mocked(getResearchTree).mockRejectedValueOnce(new Error('Clan not found'));
    const res = await stateGET(req());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to fetch clan research state');
  });
});
