/**
 * @file lib/messagingBroadcast.ts
 * @created 2026-09-19 (FID-20260919-004)
 * @overview DM wire-broadcast seam: pure payload mappers plus the personal-room
 *            fan-out. Room addressing is THE defect class this FID fixes — the
 *            old socket path emitted to `user_${id}` while clients join
 *            `WebSocketRooms.user(id)` = `user:<id>`. All emissions go through
 *            here so the room convention has one source of truth.
 */
import { WebSocketRooms } from '@/types/websocket';
import type {
  MessagingMessagePayload,
  MessagingConversationPayload,
} from '@/types/websocket';
import type { Message, Conversation } from '@/types/messaging.types';

type IoServer = NonNullable<ReturnType<typeof import('@/lib/websocket/server').getIO>>;
export type ServerEventKey = Parameters<IoServer['emit']>[0];

/** Domain Message → the `message:receive` wire payload. */
export function toMessagingMessagePayload(message: Message): MessagingMessagePayload {
  return {
    _id: message._id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    recipientId: message.recipientId,
    content: message.content,
    contentType: message.contentType,
    status: message.status,
    createdAt: message.createdAt,
    readAt: message.readAt,
  };
}

/** Domain Conversation → the `conversation:updated` wire payload. */
export function toMessagingConversationPayload(
  conversation: Conversation
): MessagingConversationPayload {
  return {
    _id: conversation._id,
    participants: [...conversation.participants],
    lastMessage: conversation.lastMessage
      ? {
          content: conversation.lastMessage.content,
          senderId: conversation.lastMessage.senderId,
          createdAt: conversation.lastMessage.createdAt,
          status: conversation.lastMessage.status,
        }
      : undefined,
    unreadCount: { ...conversation.unreadCount },
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

/**
 * Fan an event out to every participant's personal room. One participant's
 * emit failure must never suppress the others' delivery. Payload typing rides
 * the `as never` boundary cast — the heterogeneous emitter, per FID-002.
 */
export function emitToParticipants(
  io: IoServer,
  participants: string[],
  event: ServerEventKey,
  payload: unknown
): void {
  for (const participant of participants) {
    try {
      io.to(WebSocketRooms.user(participant)).emit(event, payload as never);
    } catch (error) {
      console.error(`[MessagingBroadcast] ${event} to ${participant} failed:`, error);
    }
  }
}
