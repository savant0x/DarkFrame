/**
 * FID-20260919-005: the single broadcast seam for ask-veterans help requests.
 *
 * History: the socket handler (chatHandlers.handleAskVeterans) had an inline
 * fan-out that was never reachable (no client emits `chat:ask_veterans`), and
 * the HTTP route the client actually calls broadcast nothing at all —
 * sendVeteranNotification built an object and returned it. The success toast
 * then read `notifiedCount`, a field only the dead socket path ever produced.
 * This module is now the one truth for payload shape + veteran filter; both
 * entry points ride it.
 */
import { randomUUID } from 'crypto';
import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedUser } from '@/lib/websocket/auth';
import { isVeteran } from '@/lib/chatService';
import type { ChatVeteranNotificationPayload } from '@/types/websocket';

/** How long a veteran should treat the request as actionable (matches the 5-minute ask cooldown). */
export const VETERAN_NOTIFICATION_TTL_MS = 5 * 60 * 1000;

/** Minimal shape the two call sites have in hand after sendVeteranNotification. */
export interface VeteranNotificationLike {
  playerId: string;
  playerUsername: string;
  playerLevel: number;
  question: string;
  timestamp: Date | string;
}

/**
 * Map the service's notification onto the declared S2C payload
 * (types/websocket.ts ChatVeteranNotificationPayload) and emit it to every
 * connected socket whose authenticated user is a veteran (level >= 50).
 *
 * @returns the number of veteran sockets notified — the honest value the
 *          HTTP route must return to the asking player.
 */
export async function broadcastVeteranRequest(
  io: SocketIOServer,
  notification: VeteranNotificationLike
): Promise<number> {
  const timestampMs = new Date(notification.timestamp).getTime();
  const payload: ChatVeteranNotificationPayload = {
    notificationId: randomUUID(),
    requesterId: notification.playerId,
    requesterUsername: notification.playerUsername,
    requesterLevel: notification.playerLevel,
    question: notification.question,
    channelId: 'help',
    timestamp: timestampMs,
    expiresAt: timestampMs + VETERAN_NOTIFICATION_TTL_MS,
  };

  const sockets = await io.fetchSockets();
  let notifiedCount = 0;

  for (const targetSocket of sockets) {
    const targetUser = targetSocket.data.user as AuthenticatedUser | undefined;
    if (targetUser && isVeteran(targetUser.level || 1)) {
      targetSocket.emit('chat:veteran_notification', payload);
      notifiedCount++;
    }
  }

  return notifiedCount;
}
