/**
 * FID-20260919-015 W1: persistent chat channel read state.
 *
 * chat_read_status is the store behind ChatPanel's channel unread badges —
 * the session-only Map lost every unread count on refresh. One row per
 * (channelId, username): when the user last read that channel and the message
 * id they stopped at. Unread "since last visit" is computed by the client
 * against message timestamps, so this table stays small and never needs
 * per-message writes.
 */

import { db } from '@/lib/db';
import { chatMessages, chatReadStatus } from '@/lib/db/schema';
import { and, eq, gt, ne, sql } from 'drizzle-orm';
import { generateId } from '@/lib/utils';

export interface ChannelReadState {
  channelId: string;
  lastReadMessageId: string | null;
  lastReadAt: Date;
}

/**
 * Persist a channel's read position (upsert — migration 0036 made the pair
 * unique so this is atomic). Returns the written row's timestamp.
 */
export async function markChannelRead(
  username: string,
  channelId: string,
  lastReadMessageId: string
): Promise<{ lastReadAt: Date }> {
  const lastReadAt = new Date();

  await db
    .insert(chatReadStatus)
    .values({
      id: generateId(),
      channelId,
      userId: username,
      lastReadMessageId,
      lastReadAt,
    })
    .onConflictDoUpdate({
      target: [chatReadStatus.channelId, chatReadStatus.userId],
      set: { lastReadMessageId, lastReadAt },
    });

  return { lastReadAt };
}

/**
 * The caller's full read-state map, keyed by channelId. Absent channels have
 * never been marked read — the client treats them as fully unread.
 */
export async function getChannelReadState(
  username: string
): Promise<Record<string, ChannelReadState>> {
  const rows = await db
    .select({
      channelId: chatReadStatus.channelId,
      lastReadMessageId: chatReadStatus.lastReadMessageId,
      lastReadAt: chatReadStatus.lastReadAt,
    })
    .from(chatReadStatus)
    .where(eq(chatReadStatus.userId, username));

  const state: Record<string, ChannelReadState> = {};
  for (const row of rows) {
    state[row.channelId] = {
      channelId: row.channelId,
      lastReadMessageId: row.lastReadMessageId,
      lastReadAt: row.lastReadAt,
    };
  }
  return state;
}

/** Narrow a drizzle row to the wire shape (route helper, mirrors domain convention). */
export function toReadStateWire(state: Record<string, ChannelReadState>) {
  const wire: Record<string, { lastReadMessageId: string | null; lastReadAt: string }> = {};
  for (const [channelId, entry] of Object.entries(state)) {
    wire[channelId] = {
      lastReadMessageId: entry.lastReadMessageId,
      lastReadAt: entry.lastReadAt.toISOString(),
    };
  }
  return wire;
}

export interface ChannelReadSummary {
  lastReadAt: string;
  unread: number;
}

/**
 * Badge seeding for panel mount: for every channel the user has EVER marked
 * read, count messages newer than their read position (own messages excluded).
 * Channels with no read-state row return nothing — badges there accrue from
 * live socket traffic (a never-visited channel's full history would be badge
 * noise, and "you have never looked at trade" is not information).
 */
export async function getReadStateSummary(
  username: string,
  channelIds: string[]
): Promise<Record<string, ChannelReadSummary>> {
  const state = await getChannelReadState(username);
  const summary: Record<string, ChannelReadSummary> = {};

  for (const channelId of channelIds) {
    const entry = state[channelId];
    if (!entry) continue;

    const [countRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.channelId, channelId),
          gt(chatMessages.timestamp, entry.lastReadAt),
          ne(chatMessages.senderId, username)
        )
      );

    summary[channelId] = {
      lastReadAt: entry.lastReadAt.toISOString(),
      unread: countRow?.n ?? 0,
    };
  }
  return summary;
}
