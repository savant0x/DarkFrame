/**
 * @file lib/chatSocketWiring.ts
 * @created 2026-09-19 (FID-20260919-002)
 * @overview Pure state transitions for ChatPanel's socket subscriptions.
 *            The server's live chat emissions (lib/websocket/chatHandlers.ts)
 *            carry payloads the HTTP polls already consume; these functions
 *            apply a socket payload to the panel's Map-shaped state with the
 *            SAME semantics the polls use (id-dedupe for messages, per-channel
 *            maps, self-filtering) so socket and poll are interchangeable.
 */
import type { ChannelType } from '@/lib/channelService';

/** Wire shape of a chat message as pushed by `chat:message` — the same object
 *  the server stores and `/api/chat` serves (NOT the stale declared
 *  ChatMessagePayload; see FID §1). Dates ride as ISO strings over the wire. */
export interface ChatSocketMessageWire {
  id: string;
  channelId: string;
  senderId: string;
  senderUsername: string;
  senderLevel: number;
  isVIP?: boolean;
  senderIsVIP?: boolean;
  message: string;
  timestamp: string;
  edited?: boolean;
  editedAt?: string;
}

/** UI shape held in ChatPanel state (Date objects). */
export interface ChatMessageData {
  id: string;
  channelId: ChannelType;
  senderId: string;
  senderUsername: string;
  senderLevel: number;
  senderIsVIP: boolean;
  content: string;
  timestamp: Date;
  edited?: boolean;
  editedAt?: Date;
}

export interface TypingUser {
  username: string;
  timestamp: number;
}

/**
 * Map a `chat:message` wire object into the UI shape. Returns null when the
 * payload is not a usable message (defensive: the server emits untyped).
 */
export function wireToChatMessage(m: ChatSocketMessageWire): ChatMessageData | null {
  if (!m || typeof m.id !== 'string' || typeof m.message !== 'string') return null;
  return {
    id: m.id,
    channelId: m.channelId as ChannelType,
    senderId: m.senderId,
    senderUsername: m.senderUsername,
    senderLevel: m.senderLevel,
    senderIsVIP: m.isVIP ?? m.senderIsVIP ?? false,
    content: m.message,
    timestamp: new Date(m.timestamp),
    edited: !!m.edited,
    editedAt: m.editedAt ? new Date(m.editedAt) : undefined,
  };
}

/**
 * Merge a socket message into the per-channel message map. Dedupe by id —
 * the sender also receives their own message and the HTTP poll may deliver
 * the same message first (socket is idempotent with polled messages).
 * Returns the same map identity when nothing changed.
 */
export function mergeSocketMessage(
  messages: Map<ChannelType, ChatMessageData[]>,
  incoming: ChatMessageData
): Map<ChannelType, ChatMessageData[]> {
  const existing = messages.get(incoming.channelId) ?? [];
  if (existing.some((m) => m.id === incoming.id)) return messages;
  const merged = [...existing, incoming].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
  const updated = new Map(messages);
  updated.set(incoming.channelId, merged);
  return updated;
}

/**
 * Apply `chat:typing_start`: filter self, dedupe by username, store under the
 * payload's channel. Returns the input map when the payload changes nothing.
 */
export function applyTypingStart(
  typing: Map<ChannelType, TypingUser[]>,
  channelId: ChannelType,
  username: string,
  selfUsername: string,
  now = Date.now()
): Map<ChannelType, TypingUser[]> {
  if (!username || username === selfUsername) return typing;
  const users = typing.get(channelId) ?? [];
  if (users.some((u) => u.username === username)) return typing;
  const updated = new Map(typing);
  updated.set(channelId, [...users, { username, timestamp: now }]);
  return updated;
}

/**
 * Apply `chat:typing_stop`: remove ONLY that user from that channel.
 */
export function applyTypingStop(
  typing: Map<ChannelType, TypingUser[]>,
  channelId: ChannelType,
  username: string
): Map<ChannelType, TypingUser[]> {
  const users = typing.get(channelId) ?? [];
  if (!users.some((u) => u.username === username)) return typing;
  const updated = new Map(typing);
  updated.set(channelId, users.filter((u) => u.username !== username));
  return updated;
}

/**
 * Apply `chat:online_count` for the payload's channel.
 */
export function applyOnlineCount(
  counts: Map<ChannelType, number>,
  channelId: ChannelType,
  count: number
): Map<ChannelType, number> {
  if (typeof count !== 'number') return counts;
  const updated = new Map(counts);
  updated.set(channelId, count);
  return updated;
}

/**
 * Apply `chat:message_deleted`: remove the message from every channel that
 * holds it (the notification carries its channel; the defensive sweep keeps
 * the invariant "no deleted id rendered" cheap and total).
 */
export function applyMessageDeleted(
  messages: Map<ChannelType, ChatMessageData[]>,
  messageId: string
): Map<ChannelType, ChatMessageData[]> {
  let changed = false;
  const updated = new Map<ChannelType, ChatMessageData[]>();
  for (const [channel, msgs] of messages) {
    const next = msgs.filter((m) => m.id !== messageId);
    if (next.length !== msgs.length) changed = true;
    updated.set(channel, next);
  }
  return changed ? updated : messages;
}
