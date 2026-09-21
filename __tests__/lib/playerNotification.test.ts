/**
 * @file __tests__/lib/playerNotification.test.ts
 * @created 2026-09-19 (FID-20260919-013)
 * @overview Pins for the player-notification delivery seam: persistence to the
 *            System DM conversation, FID-004 wire-contract pushes
 *            (message:receive / conversation:updated / notification:push) to
 *            the recipient's personal room, the 60s dedupe window, inboxless
 *            guards, conversation lazy-creation, and DB-only degradation when
 *            no socket server exists. Mock rides the real drizzle call surface
 *            (table-aware insert/update) so the seam's actual writes are
 *            asserted, not an imagined API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { state } = vi.hoisted(() => ({
  state: {
    conversationRows: [] as Array<Record<string, unknown>>,
    inserts: [] as Array<{ table: string; vals: Record<string, unknown> }>,
    updates: [] as Array<{ table: string; vals: Record<string, unknown> }>,
    emits: [] as Array<{ room: string; event: string; payload: unknown }>,
    io: null as
      | null
      | { to: (room: string) => { emit: (event: string, payload: unknown) => void } },
    messageInsertResult: null as Record<string, unknown> | null,
    conversationInsertResult: null as Record<string, unknown> | null,
    conversationUpdateResult: null as Record<string, unknown> | null,
    failNextInsert: false,
  },
}));

vi.mock('@/lib/db', async () => {
  const { conversations, messages } = await import('@/lib/db/schema');
  const tableName = (t: unknown) => (t === conversations ? 'conversations' : t === messages ? 'messages' : '?');
  return {
    db: {
      select: () => ({
        from: () => Promise.resolve(state.conversationRows),
      }),
      insert: (table: unknown) => ({
        values: (vals: Record<string, unknown>) => ({
          returning: async () => {
            if (state.failNextInsert) throw new Error('insert failed');
            state.inserts.push({ table: tableName(table), vals });
            if (table === conversations) return [state.conversationInsertResult];
            return [state.messageInsertResult];
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (vals: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              state.updates.push({ table: tableName(table), vals });
              return [state.conversationUpdateResult];
            },
          }),
        }),
      }),
    },
  };
});

vi.mock('@/lib/websocket/server', () => ({
  getIO: () => state.io,
}));

const NOW = new Date('2026-09-19T12:00:00Z');

function messageRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'msg_row_1',
    conversationId: 'conv_row_1',
    senderId: 'SYSTEM',
    recipientId: 'alice',
    content: '⚠️ Test body',
    contentType: 'system',
    status: 'sent',
    createdAt: NOW,
    readAt: null,
    editedAt: null,
    deletedAt: null,
    metadataSystemType: 'auction_event',
    metadataRelatedEntityId: 'auc_1',
    ...overrides,
  };
}

function conversationRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'conv_row_1',
    participants: ['SYSTEM', 'alice'],
    unreadCount: { alice: 3, SYSTEM: 0 },
    isArchived: null,
    isPinned: null,
    participantDetails: null,
    lastMessageContent: '⚠️ Test body',
    lastMessageSenderId: 'SYSTEM',
    lastMessageCreatedAt: NOW,
    lastMessageStatus: 'sent',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

import { notifyPlayer, PLAYER_NOTIFICATION_TYPE } from '@/lib/playerNotification';

describe('notifyPlayer delivery seam (FID-20260919-013)', () => {
  beforeEach(() => {
    state.conversationRows = [conversationRow()];
    state.inserts = [];
    state.updates = [];
    state.emits = [];
    state.io = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => {
          state.emits.push({ room, event, payload });
        },
      }),
    };
    state.messageInsertResult = messageRow();
    state.conversationInsertResult = conversationRow({ id: 'conv_new_1' });
    state.conversationUpdateResult = conversationRow();
    state.failNextInsert = false;
  });

  it('persists the System DM with producer metadata and bumps the unread count', async () => {
    const ok = await notifyPlayer({
      systemType: 'auction_event',
      recipient: 'alice',
      title: 'Outbid',
      body: 'Test body',
      icon: '⚠️',
      relatedEntityId: 'auc_1',
    });
    expect(ok).toBe(true);

    expect(state.inserts).toHaveLength(1);
    const { table, vals } = state.inserts[0];
    expect(table).toBe('messages');
    expect(vals.senderId).toBe('SYSTEM');
    expect(vals.recipientId).toBe('alice');
    expect(vals.content).toBe('⚠️ Test body');
    expect(vals.contentType).toBe('system');
    expect(vals.metadataSystemType).toBe('auction_event');
    expect(vals.metadataRelatedEntityId).toBe('auc_1');

    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].table).toBe('conversations');
    expect(state.updates[0].vals.lastMessageSenderId).toBe('SYSTEM');
  });

  it('pushes FID-004 wire contracts + notification:push to the personal room', async () => {
    await notifyPlayer({
      systemType: PLAYER_NOTIFICATION_TYPE,
      recipient: 'alice',
      title: 'Impact',
      body: 'Test body',
    });
    const events = state.emits.map((e) => e.event);
    expect(events).toEqual(['message:receive', 'conversation:updated', 'notification:push']);
    expect(state.emits.every((e) => e.room === 'user:alice')).toBe(true);

    const [, convPush, notifPush] = state.emits.map((e) => e.payload) as [
      { _id: string; contentType: string; createdAt: Date },
      { _id: string; unreadCount: Record<string, number> },
      { systemType: string; title: string; createdAt: string },
    ];
    expect(convPush._id).toBe('conv_row_1');
    expect(convPush.unreadCount.alice).toBe(3);
    expect(notifPush.systemType).toBe(PLAYER_NOTIFICATION_TYPE);
    expect(notifPush.title).toBe('Impact');
    expect(typeof notifPush.createdAt).toBe('string');
  });

  it('degrades to DB-only delivery when no socket server exists (scheduled jobs)', async () => {
    state.io = null;
    const ok = await notifyPlayer({
      systemType: 'wmd_missile_impact',
      recipient: 'alice',
      title: 'Impact',
      body: 'Test body',
    });
    expect(ok).toBe(true);
    expect(state.inserts).toHaveLength(1);
    expect(state.emits).toHaveLength(0);
  });

  it('dedupes identical dedupeKeys within the window', async () => {
    const base = {
      systemType: 'wmd_missile_impact',
      recipient: 'alice',
      title: 'Impact',
      body: 'Test body',
      dedupeKey: 'missile:m1:impact',
    };
    expect(await notifyPlayer(base)).toBe(true);
    expect(await notifyPlayer(base)).toBe(false);
    expect(state.inserts).toHaveLength(1);
  });

  it('never delivers to inboxless identities', async () => {
    const ok = await notifyPlayer({
      systemType: 'auction_event',
      recipient: 'Silent_abc',
      title: 'T',
      body: 'B',
    });
    expect(ok).toBe(false);
    expect(state.inserts).toHaveLength(0);
    expect(state.emits).toHaveLength(0);
  });

  it('lazily creates the System conversation when none exists, then delivers', async () => {
    state.conversationRows = [];
    const ok = await notifyPlayer({
      systemType: 'auction_event',
      recipient: 'alice',
      title: 'T',
      body: 'B',
    });
    expect(ok).toBe(true);
    expect(state.inserts.map((i) => i.table)).toEqual(['conversations', 'messages']);
    const convVals = state.inserts[0].vals;
    expect(convVals.participants).toEqual(['SYSTEM', 'alice']);
    expect(convVals.unreadCount).toEqual({ SYSTEM: 0, alice: 0 });
  });

  it('returns false (non-fatal) when persistence fails', async () => {
    state.failNextInsert = true;
    const ok = await notifyPlayer({
      systemType: 'auction_event',
      recipient: 'alice',
      title: 'T',
      body: 'B',
    });
    expect(ok).toBe(false);
    expect(state.emits).toHaveLength(0);
  });
});
