/**
 * @file __tests__/api/veteranBroadcast.test.ts
 * @created 2026-09-19
 * @overview Pins for FID-20260919-005: the single ask-veterans broadcast seam.
 *            Payload shape (declared ChatVeteranNotificationPayload), veteran
 *            filtering (isVeteran delegated — mocked here to keep the unit pure),
 *            unauthenticated-socket safety, and the honest returned count.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const isVeteranMock = vi.fn((level: number) => level >= 50);

vi.mock('@/lib/chatService', () => ({
  isVeteran: (level: number) => isVeteranMock(level),
}));

import {
  broadcastVeteranRequest,
  VETERAN_NOTIFICATION_TTL_MS,
} from '@/lib/veteranBroadcast';
import type { Server as SocketIOServer } from 'socket.io';

interface FakeUser {
  username: string;
  level?: number;
}

interface FakeSocket {
  data: { user?: FakeUser };
  emit: ReturnType<typeof vi.fn>;
}

function makeIO(sockets: FakeSocket[]) {
  return {
    fetchSockets: vi.fn(async () => sockets),
  } as unknown as SocketIOServer;
}

const NOTIFICATION = {
  playerId: 'newbie1',
  playerUsername: 'newbie1',
  playerLevel: 3,
  question: 'How do I harvest?',
  timestamp: new Date('2026-09-19T12:00:00Z'),
};

beforeEach(() => {
  isVeteranMock.mockClear();
  isVeteranMock.mockImplementation((level: number) => level >= 50);
});

describe('broadcastVeteranRequest', () => {
  it('emits only to veteran sockets and skips unauthenticated ones', async () => {
    const veteran = { data: { user: { username: 'vet', level: 65 } }, emit: vi.fn() };
    const underLevel = { data: { user: { username: 'mid', level: 49 } }, emit: vi.fn() };
    const anonymous = { data: {}, emit: vi.fn() };

    const count = await broadcastVeteranRequest(makeIO([veteran, underLevel, anonymous]), NOTIFICATION);

    expect(count).toBe(1);
    expect(veteran.emit).toHaveBeenCalledTimes(1);
    expect(underLevel.emit).not.toHaveBeenCalled();
    expect(anonymous.emit).not.toHaveBeenCalled();
  });

  it('maps the service notification onto the declared payload shape', async () => {
    const veteran = { data: { user: { username: 'vet', level: 50 } }, emit: vi.fn() };

    await broadcastVeteranRequest(makeIO([veteran]), NOTIFICATION);

    const [, payload] = veteran.emit.mock.calls[0];
    expect(payload).toMatchObject({
      requesterId: 'newbie1',
      requesterUsername: 'newbie1',
      requesterLevel: 3,
      question: 'How do I harvest?',
      channelId: 'help',
      timestamp: Date.parse('2026-09-19T12:00:00Z'),
    });
    expect(typeof payload.notificationId).toBe('string');
    expect(payload.notificationId.length).toBeGreaterThan(0);
    expect(payload.expiresAt - payload.timestamp).toBe(VETERAN_NOTIFICATION_TTL_MS);
  });

  it('treats level 50 exactly as a veteran (boundary)', async () => {
    const boundary = { data: { user: { username: 'newvet', level: 50 } }, emit: vi.fn() };
    const count = await broadcastVeteranRequest(makeIO([boundary]), NOTIFICATION);
    expect(count).toBe(1);
    expect(boundary.emit).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when no veteran is connected — the honest count', async () => {
    const regular = { data: { user: { username: 'lv10', level: 10 } }, emit: vi.fn() };
    const count = await broadcastVeteranRequest(makeIO([regular]), NOTIFICATION);
    expect(count).toBe(0);
    expect(regular.emit).not.toHaveBeenCalled();
  });

  it('delivers the same payload object to every veteran (single source of truth)', async () => {
    const a = { data: { user: { username: 'vetA', level: 51 } }, emit: vi.fn() };
    const b = { data: { user: { username: 'vetB', level: 60 } }, emit: vi.fn() };
    await broadcastVeteranRequest(makeIO([a, b]), NOTIFICATION);
    expect(a.emit.mock.calls[0][1]).toEqual(b.emit.mock.calls[0][1]);
  });

  it('accepts ISO-string timestamps as well as Dates', async () => {
    const veteran = { data: { user: { username: 'vet', level: 50 } }, emit: vi.fn() };
    await broadcastVeteranRequest(makeIO([veteran]), {
      ...NOTIFICATION,
      timestamp: '2026-09-19T12:00:00.000Z',
    });
    const [, payload] = veteran.emit.mock.calls[0];
    expect(payload.timestamp).toBe(Date.parse('2026-09-19T12:00:00Z'));
  });

  it('TTL matches the 5-minute ask cooldown', () => {
    expect(VETERAN_NOTIFICATION_TTL_MS).toBe(5 * 60 * 1000);
  });
});
