/**
 * @file __tests__/api/messagingBroadcast.test.ts
 * @created 2026-09-19
 * @overview Pins for FID-20260919-004 (DM real-time): the payload mappers and
 *            the personal-room fan-out. The room convention is THE defect this
 *            FID fixes — the old socket path emitted to `user_${id}` while
 *            clients join `user:<id>` — so the addressing pins are the core.
 *            Pure module; the io mock is a recording stub.
 */
import { describe, it, expect } from 'vitest';
import {
  toMessagingMessagePayload,
  toMessagingConversationPayload,
  emitToParticipants,
} from '@/lib/messagingBroadcast';
import { WebSocketRooms } from '@/types/websocket';
import type { Message, Conversation } from '@/types/messaging.types';

const MSG: Message = {
  _id: 'msg1',
  conversationId: 'conv1',
  senderId: 'alice',
  recipientId: 'bob',
  content: 'hello bob',
  contentType: 'text',
  status: 'sent',
  createdAt: new Date('2026-09-19T12:00:00.000Z'),
};

const CONV: Conversation = {
  _id: 'conv1',
  participants: ['alice', 'bob'],
  unreadCount: { bob: 1 },
  createdAt: new Date('2026-09-19T11:00:00.000Z'),
  updatedAt: new Date('2026-09-19T12:00:00.000Z'),
  lastMessage: {
    content: 'hello bob',
    senderId: 'alice',
    createdAt: new Date('2026-09-19T12:00:00.000Z'),
    status: 'sent',
  },
} as unknown as Conversation;

/** Recording io stub: captures (room, event, payload) triples. */
function makeIo(failRoom?: string) {
  const calls: Array<{ room: string; event: string; payload: unknown }> = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        if (room === failRoom) throw new Error(`room ${room} unavailable`);
        calls.push({ room, event, payload });
      },
    }),
  };
  return { io: io as never, calls };
}

describe('WebSocketRooms.user convention (the regression)', () => {
  it('addresses personal rooms as user:<id> — NOT the dead user_<id> form', () => {
    expect(WebSocketRooms.user('alice')).toBe('user:alice');
  });
});

describe('toMessagingMessagePayload', () => {
  it('maps every field the thread and page consume', () => {
    expect(toMessagingMessagePayload(MSG)).toEqual({
      _id: 'msg1',
      conversationId: 'conv1',
      senderId: 'alice',
      recipientId: 'bob',
      content: 'hello bob',
      contentType: 'text',
      status: 'sent',
      createdAt: new Date('2026-09-19T12:00:00.000Z'),
      readAt: undefined,
    });
  });
});

describe('toMessagingConversationPayload', () => {
  it('maps the conversation snapshot including lastMessage', () => {
    const payload = toMessagingConversationPayload(CONV);
    expect(payload._id).toBe('conv1');
    expect(payload.participants).toEqual(['alice', 'bob']);
    expect(payload.unreadCount).toEqual({ bob: 1 });
    expect(payload.lastMessage?.content).toBe('hello bob');
  });

  it('copies unreadCount — later mutation of the payload cannot touch the source', () => {
    const payload = toMessagingConversationPayload(CONV);
    payload.unreadCount.bob = 99;
    expect(CONV.unreadCount.bob).toBe(1);
  });

  it('maps a conversation without lastMessage (freshly created)', () => {
    const bare = { ...CONV, lastMessage: undefined } as unknown as Conversation;
    expect(toMessagingConversationPayload(bare).lastMessage).toBeUndefined();
  });
});

describe('emitToParticipants', () => {
  it('emits to every participant personal room under the user:<id> convention', () => {
    const { io, calls } = makeIo();
    emitToParticipants(io, ['alice', 'bob'], 'message:receive', { _id: 'msg1' });
    expect(calls.map(c => c.room)).toEqual(['user:alice', 'user:bob']);
    expect(calls.every(c => c.event === 'message:receive')).toBe(true);
  });

  it('one participant emit failing does not suppress delivery to the others', () => {
    const { io, calls } = makeIo('user:alice'); // alice's emit throws
    emitToParticipants(io, ['alice', 'bob'], 'conversation:updated', { _id: 'conv1' });
    expect(calls.map(c => c.room)).toEqual(['user:bob']);
  });
});
