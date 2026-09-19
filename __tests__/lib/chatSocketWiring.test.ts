/**
 * @file __tests__/lib/chatSocketWiring.test.ts
 * @created 2026-09-19
 * @overview Pins for FID-20260919-002 (chat realtime client wiring). The pure
 *            transition module carries ALL socket-application semantics —
 *            message id-dedupe (socket echo + poll overlap), typing self-
 *            filtering and per-channel scoping, online counts, and the
 *            deletion sweep — so these pins are the contract ChatPanel rides.
 *            Pure functions; no mocks, no DB, no socket.
 */
import { describe, it, expect } from 'vitest';
import {
  wireToChatMessage,
  mergeSocketMessage,
  applyTypingStart,
  applyTypingStop,
  applyOnlineCount,
  applyMessageDeleted,
  type ChatSocketMessageWire,
  type ChatMessageData,
} from '@/lib/chatSocketWiring';
import { ChannelType } from '@/lib/channelService';

const WIRE_MSG: ChatSocketMessageWire = {
  id: 'm1',
  channelId: ChannelType.GLOBAL,
  senderId: 'u2',
  senderUsername: 'rival',
  senderLevel: 12,
  isVIP: true,
  message: 'hello world',
  timestamp: '2026-09-19T12:00:00.000Z',
};

function uiMsg(overrides: Partial<ChatMessageData> = {}): ChatMessageData {
  return {
    id: 'm1',
    channelId: ChannelType.GLOBAL,
    senderId: 'u2',
    senderUsername: 'rival',
    senderLevel: 12,
    senderIsVIP: true,
    content: 'hello world',
    timestamp: new Date('2026-09-19T12:00:00.000Z'),
    edited: false,
    ...overrides,
  };
}

describe('wireToChatMessage', () => {
  it('maps the server wire object to the UI shape (isVIP alias, Date coercion)', () => {
    const m = wireToChatMessage(WIRE_MSG);
    expect(m).toEqual({
      id: 'm1',
      channelId: ChannelType.GLOBAL,
      senderId: 'u2',
      senderUsername: 'rival',
      senderLevel: 12,
      senderIsVIP: true,
      content: 'hello world',
      timestamp: new Date('2026-09-19T12:00:00.000Z'),
      edited: false,
      editedAt: undefined,
    });
    expect(m?.timestamp instanceof Date).toBe(true);
  });

  it('falls back to senderIsVIP when isVIP is absent, and isVIP wins when present', () => {
    // both alias spellings appear across the emission sites (server emits untyped)
    expect(
      wireToChatMessage({ ...WIRE_MSG, isVIP: undefined, senderIsVIP: true })?.senderIsVIP
    ).toBe(true);
    expect(
      wireToChatMessage({ ...WIRE_MSG, isVIP: false, senderIsVIP: true })?.senderIsVIP
    ).toBe(false);
  });

  it('returns null for unusable payloads (server emits untyped)', () => {
    expect(wireToChatMessage(null as unknown as ChatSocketMessageWire)).toBeNull();
    expect(wireToChatMessage({} as unknown as ChatSocketMessageWire)).toBeNull();
    expect(
      wireToChatMessage({ ...WIRE_MSG, message: 42 } as unknown as ChatSocketMessageWire)
    ).toBeNull();
  });
});

describe('mergeSocketMessage', () => {
  it('appends and keeps per-channel ordering by timestamp', () => {
    const base = new Map([[ChannelType.GLOBAL, [uiMsg({ id: 'm1', timestamp: new Date(1000) })]]]);
    const next = mergeSocketMessage(base, uiMsg({ id: 'm2', timestamp: new Date(2000) }));
    expect(next.get(ChannelType.GLOBAL)?.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(next).not.toBe(base); // new map identity → React re-render
  });

  it('is idempotent by id (sender echo and poll copy do not duplicate)', () => {
    const base = new Map([[ChannelType.GLOBAL, [uiMsg()]]]);
    const next = mergeSocketMessage(base, uiMsg());
    expect(next).toBe(base);
    expect(next.get(ChannelType.GLOBAL)).toHaveLength(1);
  });

  it('creates the channel bucket on first message for that channel', () => {
    const next = mergeSocketMessage(new Map(), uiMsg({ channelId: ChannelType.TRADE }));
    expect(next.get(ChannelType.TRADE)?.map((m) => m.id)).toEqual(['m1']);
  });
});

describe('applyTypingStart / applyTypingStop', () => {
  it('adds a typist under the payload channel with the given timestamp', () => {
    const next = applyTypingStart(new Map(), ChannelType.GLOBAL, 'rival', 'me', 1234);
    expect(next.get(ChannelType.GLOBAL)).toEqual([{ username: 'rival', timestamp: 1234 }]);
  });

  it('filters SELF (server also excludes the sender; double defense)', () => {
    const base = new Map([[ChannelType.GLOBAL, [{ username: 'rival', timestamp: 1 }]]]);
    const next = applyTypingStart(base, ChannelType.GLOBAL, 'me', 'me');
    expect(next).toBe(base);
  });

  it('dedupes repeat start events for the same typist', () => {
    const base = new Map([[ChannelType.GLOBAL, [{ username: 'rival', timestamp: 1 }]]]);
    const next = applyTypingStart(base, ChannelType.GLOBAL, 'rival', 'me', 2);
    expect(next).toBe(base);
    expect(next.get(ChannelType.GLOBAL)).toHaveLength(1);
  });

  it('scopes typing per channel — start in GLOBAL is invisible to TRADE', () => {
    const next = applyTypingStart(new Map(), ChannelType.GLOBAL, 'rival', 'me');
    expect(next.get(ChannelType.TRADE)).toBeUndefined();
  });

  it('stop removes only that user from that channel', () => {
    const base = new Map([
      [
        ChannelType.GLOBAL,
        [
          { username: 'rival', timestamp: 1 },
          { username: 'other', timestamp: 2 },
        ],
      ],
      [ChannelType.TRADE, [{ username: 'rival', timestamp: 3 }]],
    ]);
    const next = applyTypingStop(base, ChannelType.GLOBAL, 'rival');
    expect(next.get(ChannelType.GLOBAL)?.map((u) => u.username)).toEqual(['other']);
    expect(next.get(ChannelType.TRADE)?.map((u) => u.username)).toEqual(['rival']); // other channel untouched
  });

  it('stop is a no-op (same identity) for an unknown typist', () => {
    const base = new Map([[ChannelType.GLOBAL, [{ username: 'other', timestamp: 2 }]]]);
    expect(applyTypingStop(base, ChannelType.GLOBAL, 'ghost')).toBe(base);
  });
});

describe('applyOnlineCount', () => {
  it('sets the count for the payload channel only', () => {
    const base = new Map([[ChannelType.GLOBAL, 3]]);
    const next = applyOnlineCount(base, ChannelType.TRADE, 7);
    expect(next.get(ChannelType.TRADE)).toBe(7);
    expect(next.get(ChannelType.GLOBAL)).toBe(3);
  });

  it('rejects non-numeric counts defensively', () => {
    const base = new Map([[ChannelType.GLOBAL, 3]]);
    expect(applyOnlineCount(base, ChannelType.GLOBAL, undefined as unknown as number)).toBe(base);
  });
});

describe('applyMessageDeleted', () => {
  it('sweeps the deleted id from every channel and preserves the rest', () => {
    const base = new Map([
      [ChannelType.GLOBAL, [uiMsg({ id: 'm1' }), uiMsg({ id: 'm2' })]],
      [ChannelType.TRADE, [uiMsg({ id: 'm1', channelId: ChannelType.TRADE })]],
    ]);
    const next = applyMessageDeleted(base, 'm1');
    expect(next.get(ChannelType.GLOBAL)?.map((m) => m.id)).toEqual(['m2']);
    expect(next.get(ChannelType.TRADE)).toEqual([]);
  });

  it('returns the same map identity when the id is unknown (no re-render)', () => {
    const base = new Map([[ChannelType.GLOBAL, [uiMsg({ id: 'm1' })]]]);
    expect(applyMessageDeleted(base, 'nope')).toBe(base);
  });
});
