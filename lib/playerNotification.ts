/**
 * @file lib/playerNotification.ts
 * @created 2026-09-19 (FID-20260919-013)
 * @overview The single delivery seam for player-directed notifications —
 *            what the removed dead stack (FID-20260919-011) pretended to be.
 *
 * Design: one call persists the event to the recipient's System DM conversation
 * (the surface that already exists: badged, real-time per FID-20260919-004,
 * zero-delete history) and pushes the same notification to that player's
 * socket room using FID-004's exact wire payloads, so an online player gets a
 * live badge/toast and an offline player finds the message on next load.
 *
 * History: the 2025-10 stack wrote player_notifications rows nobody read and
 * queued emails nobody sent, while the pieces that DID work (DM inbox, WMD
 * toasts) stayed unconnected to most producers. This module is the connection.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { generateId } from '@/lib/utils';
import { getIO } from '@/lib/websocket/server';
import { WebSocketRooms } from '@/types/websocket';
import type { NotificationPushPayload } from '@/types/websocket';
import {
  toMessagingMessagePayload,
  toMessagingConversationPayload,
} from '@/lib/messagingBroadcast';
import { mapMessageToType, mapConversationToType } from '@/lib/messagingService';
import type { Message, Conversation } from '@/types/messaging.types';

/** messages.metadata_system_type value for seam-delivered notifications. */
export const PLAYER_NOTIFICATION_TYPE = 'player_notification';

const SYSTEM_SENDER = 'SYSTEM';

/** Inboxless identities never receive notifications (auctionNotification law). */
function isInboxless(username: string): boolean {
  return (
    /^Flag[-_]Bearer[-_]/.test(username) ||
    username.startsWith('🍺BeerBase-') ||
    /^b[WMSEUL]\d{12}$/.test(username) ||
    /^Silent_/.test(username) ||
    username === SYSTEM_SENDER
  );
}

/** Find (or lazily create) the player's System DM conversation. */
async function findOrCreateSystemConversation(recipient: string): Promise<string | null> {
  const all = await db.select().from(conversations);
  const conversation = all.find((c) => {
    const p = c.participants as string[];
    return p.length === 2 && p.includes(SYSTEM_SENDER) && p.includes(recipient);
  });
  if (conversation) return conversation.id;

  const now = new Date();
  const [created] = await db
    .insert(conversations)
    .values({
      id: generateId(),
      participants: [SYSTEM_SENDER, recipient].sort() as unknown as string[],
      unreadCount: { [SYSTEM_SENDER]: 0, [recipient]: 0 },
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created?.id ?? null;
}

/**
 * In-process dedupe window: producers running on sweep timers (missileTracker
 * crash-resume, vote cleaners) can reprocess the same event; a 60s window
 * keeps the player's inbox/toasts clean without any cross-process machinery.
 */
const recentKeys = new Map<string, number>();
const DEDUPE_WINDOW_MS = 60_000;
let lastSweep = 0;
function isDuplicate(key: string, now: number): boolean {
  const prev = recentKeys.get(key);
  if (prev !== undefined && now - prev < DEDUPE_WINDOW_MS) return true;
  recentKeys.set(key, now);
  if (now - lastSweep > DEDUPE_WINDOW_MS) {
    lastSweep = now;
    for (const [k, ts] of recentKeys) if (now - ts >= DEDUPE_WINDOW_MS) recentKeys.delete(k);
  }
  return false;
}

export interface PlayerNotification {
  /** Provenance tag persisted as metadata_system_type (e.g. 'auction_event'). */
  systemType: string;
  recipient: string;
  title: string;
  body: string;
  icon?: string;
  relatedEntityId?: string;
  /** Optional idempotency tag; same key within the window is dropped. */
  dedupeKey?: string;
}

/**
 * Deliver a notification: persist to the System inbox, then push live.
 * Fire-and-forget safe — producers must never fail because notification
 * delivery failed. Returns false when nothing was delivered (inboxless
 * identity, dedupe hit, or persistence failure).
 */
export async function notifyPlayer(notification: PlayerNotification): Promise<boolean> {
  try {
    const { recipient, dedupeKey } = notification;
    if (isInboxless(recipient)) return false;
    if (dedupeKey && isDuplicate(dedupeKey, Date.now())) return false;

    const content = notification.icon
      ? `${notification.icon} ${notification.body}`
      : notification.body;
    const now = new Date();

    const conversationId = await findOrCreateSystemConversation(recipient);
    if (!conversationId) return false;

    const [inserted] = await db
      .insert(messages)
      .values({
        id: generateId(),
        conversationId,
        senderId: SYSTEM_SENDER,
        recipientId: recipient,
        content,
        contentType: 'system',
        status: 'sent',
        createdAt: now,
        metadataSystemType: notification.systemType.slice(0, 20),
        metadataRelatedEntityId: notification.relatedEntityId?.slice(0, 50),
      })
      .returning();
    if (!inserted) return false;

    const [updatedConversation] = await db
      .update(conversations)
      .set({
        lastMessageContent: content.slice(0, 200),
        lastMessageSenderId: SYSTEM_SENDER,
        lastMessageCreatedAt: now,
        lastMessageStatus: 'sent',
        updatedAt: now,
        unreadCount: sql`jsonb_set(COALESCE(${conversations.unreadCount}, '{}'::jsonb), ARRAY[${recipient}]::text[], to_jsonb(COALESCE((${conversations.unreadCount}->>${recipient})::numeric, 0) + 1))`,
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    // ---- Push: FID-004's exact wire contracts, to the player's room ----
    const io = getIO();
    if (io) {
      const message: Message = mapMessageToType(inserted);
      const payload = toMessagingMessagePayload(message);
      const push: NotificationPushPayload = {
        systemType: notification.systemType,
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        relatedEntityId: notification.relatedEntityId,
        createdAt: now.toISOString(),
      };
      try {
        io.to(WebSocketRooms.user(recipient)).emit('message:receive', payload);
        if (updatedConversation) {
          const conversation: Conversation = mapConversationToType(updatedConversation);
          io.to(WebSocketRooms.user(recipient)).emit(
            'conversation:updated',
            toMessagingConversationPayload(conversation)
          );
        }
        io.to(WebSocketRooms.user(recipient)).emit('notification:push', push);
      } catch (error) {
        // Persisted copy is already safe; push failures must not throw.
        console.error('[PlayerNotification] push failed:', error);
      }
    }

    return true;
  } catch (error) {
    console.error('[PlayerNotification] delivery failed (non-fatal):', error);
    return false;
  }
}
