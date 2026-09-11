/**
 * @file __tests__/api/security/session-identity.test.ts
 * @overview FID-20260909-023 §3.1 regression tests — session-derived identity
 * on endpoints that previously trusted query-string identity.
 *
 * Covers:
 * - GET /api/bot-scanner  (was: scan/status for ANY player via ?username=)
 * - GET /api/tutorial/tracking  (was: any player's progress via ?playerId=)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getBotScanner } from '@/app/api/bot-scanner/route';
import { GET as getTutorialTracking } from '@/app/api/tutorial/tracking/route';

const mockAuthUser = vi.fn();

vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockAuthUser(...args),
}));

vi.mock('@/lib/botScannerService', () => ({
  scanForBots: vi.fn(async (username: string) => ({
    success: true,
    scannedBy: username,
    bots: [],
  })),
  getScannerStatus: vi.fn(async (username: string) => ({
    unlocked: true,
    onCooldown: false,
    owner: username,
  })),
}));

vi.mock('@/lib/tutorialService', () => ({
  getActionTracking: vi.fn(async (_playerId: string, stepId: string) => {
    if (stepId === 'step-moves') {
      return {
        playerId: 'victim',
        stepId,
        currentCount: 13,
        targetCount: 15,
        targetX: 42,
        targetY: 17,
        lastUpdated: new Date(),
      };
    }
    return null;
  }),
}));

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FID-023 §3.1a — GET /api/bot-scanner session identity', () => {
  it('401s when unauthenticated, even with a username in the query', async () => {
    mockAuthUser.mockResolvedValue(null);

    const response = await getBotScanner(
      makeRequest('/api/bot-scanner?username=victim'),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(401);
  });

  it('executes the scan for the SESSION user, ignoring ?username=', async () => {
    mockAuthUser.mockResolvedValue({ username: 'attacker' });

    const response = await getBotScanner(
      makeRequest('/api/bot-scanner?username=victim'),
      { params: Promise.resolve({}) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.scannedBy).toBe('attacker');

    const { scanForBots } = await import('@/lib/botScannerService');
    expect(scanForBots).toHaveBeenCalledWith('attacker');
    expect(scanForBots).not.toHaveBeenCalledWith('victim');
  });

  it('resolves status for the SESSION user, ignoring ?username=', async () => {
    mockAuthUser.mockResolvedValue({ username: 'attacker' });

    const response = await getBotScanner(
      makeRequest('/api/bot-scanner?username=victim&action=status'),
      { params: Promise.resolve({}) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status.owner).toBe('attacker');

    const { getScannerStatus } = await import('@/lib/botScannerService');
    expect(getScannerStatus).toHaveBeenCalledWith('attacker');
  });
});

describe('FID-023 §3.1b — GET /api/tutorial/tracking session identity', () => {
  it('401s when unauthenticated, even with a playerId in the query', async () => {
    mockAuthUser.mockResolvedValue(null);

    const response = await getTutorialTracking(
      makeRequest('/api/tutorial/tracking?playerId=victim&stepId=step-moves')
    );

    expect(response.status).toBe(401);
  });

  it('scopes reads to the SESSION user, ignoring ?playerId=', async () => {
    mockAuthUser.mockResolvedValue({ username: 'me' });

    const response = await getTutorialTracking(
      makeRequest('/api/tutorial/tracking?playerId=victim&stepId=step-moves')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentCount).toBe(13);
    expect(data.moveCount).toBe(15);

    const { getActionTracking } = await import('@/lib/tutorialService');
    expect(getActionTracking).toHaveBeenCalledWith('me', 'step-moves');
    expect(getActionTracking).not.toHaveBeenCalledWith('victim', expect.anything());
  });

  it('returns an empty object when no tracking row exists (step has not started)', async () => {
    mockAuthUser.mockResolvedValue({ username: 'me' });

    const response = await getTutorialTracking(
      makeRequest('/api/tutorial/tracking?stepId=step-not-started')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });

  it('400s when stepId is missing', async () => {
    mockAuthUser.mockResolvedValue({ username: 'me' });

    const response = await getTutorialTracking(makeRequest('/api/tutorial/tracking'));

    expect(response.status).toBe(400);
  });
});
