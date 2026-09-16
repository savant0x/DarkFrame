/**
 * @file __tests__/api/sabotageTargets.test.ts
 * @created 2026-09-16
 * @overview Pins for the FID-20260916-011 sabotage UI seams: the
 *            sabotage-targets enumeration GET, the spies-GET operator scoping,
 *            the fire-path route contract (argument order + validation), and
 *            the shared sabotageMath formulas. Route handlers are invoked
 *            directly over mocked auth/service layers (pattern of
 *            p0MissingEndpoints.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { requireAuthMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
}));

vi.mock('@/lib/authMiddleware', () => ({
  requireAuth: requireAuthMock,
}));

vi.mock('@/lib', () => ({
  withRequestLogging: (h: unknown) => h,
  createRateLimiter: (_cfg: unknown) => (h: unknown) => h,
  ENDPOINT_RATE_LIMITS: { STANDARD: 'standard' },
  createRouteLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    time: () => vi.fn(),
  }),
  createErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ success: false, error: message, code }), {
      status: code === 'AUTH_UNAUTHORIZED' ? 401 : 400,
    }),
  createErrorFromException: (_e: unknown, _code: string) =>
    new Response(JSON.stringify({ success: false, error: 'internal' }), { status: 500 }),
  ErrorCode: {
    AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
    VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
}));

vi.mock('@/lib/wmd/apiHelpers', () => ({
  getAuthenticatedPlayer: vi.fn(),
}));

vi.mock('@/lib/wmd/sabotageTargets', () => ({
  getSabotageTargets: vi.fn(),
}));

vi.mock('@/lib/wmd/spyService', () => ({
  getPlayerSpies: vi.fn(),
  getPlayerMissions: vi.fn(),
  executeSabotage: vi.fn(),
  recruitSpy: vi.fn(),
  trainSpy: vi.fn(),
  startMission: vi.fn(),
  completeMission: vi.fn(),
  counterIntelligenceSweep: vi.fn(),
}));

import { GET as intelligenceGET, POST as intelligencePOST } from '@/app/api/wmd/intelligence/route';
import { getAuthenticatedPlayer } from '@/lib/wmd/apiHelpers';
import { getSabotageTargets } from '@/lib/wmd/sabotageTargets';
import { getPlayerSpies, executeSabotage } from '@/lib/wmd/spyService';
import {
  sabotageSuccessChance,
  sabotageDetectionRisk,
} from '@/lib/wmd/sabotageMath';

// The intelligence route exports bare (req) handlers — the wrapper's RouteHandler
// context param is runtime-ignored (same as p0MissingEndpoints.test.ts).
const intelligencePOST1 = intelligencePOST as unknown as (req: NextRequest) => Promise<Response>;

function req(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new Request(url, init));
}

const ROUTE_CONTEXT = {} as { params: Promise<Record<string, string>> };

const AUTH = { playerId: 'op_user_1', player: { username: 'op_user_1' } };

function authOk() {
  vi.mocked(getAuthenticatedPlayer).mockResolvedValueOnce(AUTH as never);
}

const TARGET = {
  targetType: 'MISSILE' as const,
  targetId: 'msl_1',
  label: 'nuke warhead (ready)',
  victimKind: 'PLAYER' as const,
  victimId: 'victim_u',
  victimUsername: 'victim_u',
  protected: false,
  difficulty: 0.2,
  detectionRisk: 0.4,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/wmd/intelligence?type=sabotage-targets', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getAuthenticatedPlayer).mockResolvedValueOnce(null as never);
    const res = await intelligenceGET(req('http://localhost/api/wmd/intelligence?type=sabotage-targets&spyId=spy_1'), ROUTE_CONTEXT);
    expect(res.status).toBe(401);
  });

  it('400 when spyId parameter is missing', async () => {
    authOk();
    const res = await intelligenceGET(req('http://localhost/api/wmd/intelligence?type=sabotage-targets'), ROUTE_CONTEXT);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('spyId');
  });

  it('400 with the service message on refusal (unknown spy / skill floor)', async () => {
    authOk();
    vi.mocked(getSabotageTargets).mockResolvedValueOnce({
      success: false,
      message: 'Spy lacks sufficient sabotage skills (minimum 30)',
    });
    const res = await intelligenceGET(req('http://localhost/api/wmd/intelligence?type=sabotage-targets&spyId=spy_x'), ROUTE_CONTEXT);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Spy lacks sufficient sabotage skills (minimum 30)');
  });

  it('passes the three target lists through as the panel payload', async () => {
    authOk();
    vi.mocked(getSabotageTargets).mockResolvedValueOnce({
      success: true,
      missiles: [TARGET],
      batteries: [],
      research: [],
    });
    const res = await intelligenceGET(req('http://localhost/api/wmd/intelligence?type=sabotage-targets&spyId=spy_1'), ROUTE_CONTEXT);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.missiles).toEqual([TARGET]);
    expect(data.batteries).toEqual([]);
    expect(data.research).toEqual([]);
    expect(getSabotageTargets).toHaveBeenCalledWith('spy_1');
  });
});

describe('GET spies operator scoping (FID-20260916-011)', () => {
  it('scopes the spies list to the session identity', async () => {
    authOk();
    vi.mocked(getPlayerSpies).mockResolvedValueOnce([]);
    await intelligenceGET(req('http://localhost/api/wmd/intelligence?type=spies'), ROUTE_CONTEXT);
    expect(getPlayerSpies).toHaveBeenCalledWith('op_user_1', undefined, ['op_user_1']);
  });
});

describe('POST sabotage fire-path contract', () => {
  it('400 when required fields are missing', async () => {
    authOk();
    const res = await intelligencePOST1(
      req('http://localhost/api/wmd/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sabotage', spyId: 'spy_1' }),
      })
    );
    expect(res.status).toBe(400);
  });

  it('rejects malformed targetType values before the service switch', async () => {
    authOk();
    const res = await intelligencePOST1(
      req('http://localhost/api/wmd/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sabotage', spyId: 's', targetId: 't', targetType: 'NUKE' }),
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid targetType');
    expect(executeSabotage).not.toHaveBeenCalled();
  });

  it('calls executeSabotage in signature order with the session caller as operator', async () => {
    authOk();
    vi.mocked(executeSabotage).mockResolvedValueOnce({ success: true, message: 'done' });
    const res = await intelligencePOST1(
      req('http://localhost/api/wmd/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sabotage', spyId: 'spy_1', targetId: 'msl_1', targetType: 'MISSILE' }),
      })
    );
    expect(res.status).toBe(200);
    expect(executeSabotage).toHaveBeenCalledWith('spy_1', 'MISSILE', 'msl_1', 'op_user_1');
  });

  it('surfaces refusals verbatim as 400 { error }', async () => {
    authOk();
    vi.mocked(executeSabotage).mockResolvedValueOnce({
      success: false,
      message: 'Target is under new-player protection',
    });
    const res = await intelligencePOST1(
      req('http://localhost/api/wmd/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sabotage', spyId: 'spy_1', targetId: 'msl_1', targetType: 'MISSILE' }),
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Target is under new-player protection');
  });
});

describe('sabotageMath formula pins (shared source of truth)', () => {
  it('success chance matches the fire path: max(0.05, skill/100 - difficulty)', () => {
    expect(sabotageSuccessChance(100, 'MISSILE')).toBe(0.8);
    expect(sabotageSuccessChance(60, 'RESEARCH')).toBeCloseTo(0.2, 10); // unclamped
    expect(sabotageSuccessChance(30, 'RESEARCH')).toBe(0.05); // floor clamps up
    expect(sabotageSuccessChance(20, 'MISSILE')).toBe(0.05); // floor clamps up
  });

  it('detection risk matches the fire path clamp window [0.1, 0.9]', () => {
    expect(sabotageDetectionRisk(0, 'MISSILE')).toBe(0.4); // base
    expect(sabotageDetectionRisk(200, 'MISSILE')).toBe(0.1); // clamped low
    expect(sabotageDetectionRisk(0, 'RESEARCH')).toBe(0.6);
  });
});
