/**
 * @file lib/auctionNotification.ts
 * @created 2026-09-12
 * @overview FID-20260912-065 — auction inbox notifications.
 *
 * Mirrors the battle-report delivery (system conversation, unread bump,
 * metadataSystemType marker) so auction events land in the same inbox the
 * player already watches. Events: outbid, sale-complete (seller + winner),
 * expired-no-sale (seller), and refund-on-cancel (seller).
 * Non-fatal by contract — callers may await without try/catch.
 */

import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateId } from './utils';

export const AUCTION_SYSTEM_TYPE = 'auction_event';

const SYSTEM_SENDER = 'SYSTEM';

/** Inboxless accounts (same exclusions as battle reports). */
function isInboxless(username: string): boolean {
  return (
    /^Flag[-_]Bearer[-_]/.test(username) ||
    username.startsWith('🍺BeerBase-') ||
    /^b[WMSEUL]\d{12}$/.test(username) ||
    /^Silent_/.test(username) ||
    username === SYSTEM_SENDER
  );
}

async function findOrCreateSystemConversation(recipient: string): Promise<string | null> {
  const participants = [SYSTEM_SENDER, recipient].sort();
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
      participants: participants as unknown as string[],
      unreadCount: { [SYSTEM_SENDER]: 0, [recipient]: 0 },
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created?.id ?? null;
}

async function deliver(
  recipient: string,
  content: string,
  auctionId: string,
  icon: string
): Promise<void> {
  if (isInboxless(recipient)) return;
  const conversationId = await findOrCreateSystemConversation(recipient);
  if (!conversationId) return;
  const now = new Date();
  await db.insert(messages).values({
    id: generateId(),
    conversationId,
    senderId: SYSTEM_SENDER,
    recipientId: recipient,
    content: `${icon} ${content}`,
    contentType: 'system',
    status: 'sent',
    createdAt: now,
    metadataSystemType: AUCTION_SYSTEM_TYPE,
    metadataRelatedEntityId: auctionId.slice(0, 50),
  });
  await db
    .update(conversations)
    .set({
      lastMessageContent: `${icon} ${content}`.slice(0, 200),
      lastMessageSenderId: SYSTEM_SENDER,
      lastMessageCreatedAt: now,
      lastMessageStatus: 'sent',
      updatedAt: now,
      unreadCount: sql`jsonb_set(COALESCE(${conversations.unreadCount}, '{}'::jsonb), ARRAY[${recipient}]::text[], to_jsonb(COALESCE((${conversations.unreadCount}->>${recipient})::numeric, 0) + 1))`,
    })
    .where(eq(conversations.id, conversationId));
}

export type AuctionEventType =
  | 'outbid'
  | 'sold_seller'
  | 'sold_winner'
  | 'expired_seller'
  | 'refund_seller'
  | 'won_settlement';

/** Send an auction event to a recipient. Fire-and-forget safe. */
export async function notifyAuctionEvent(
  type: AuctionEventType,
  recipient: string,
  detail: { auctionId: string; itemName: string; amount?: number; counterparty?: string }
): Promise<void> {
  try {
    const amt = (n?: number) => (typeof n === 'number' ? `${n.toLocaleString()} metal` : '');
    let content: string;
    let icon: string;
    switch (type) {
      case 'outbid':
        icon = '⚠️';
        content = `You've been OUTBID on "${detail.itemName}". ${detail.counterparty ?? 'Another player'} leads at ${amt(detail.amount)}. Bid again to reclaim it!`;
        break;
      case 'sold_seller':
        icon = '💰';
        content = `Your auction "${detail.itemName}" SOLD to ${detail.counterparty} for ${amt(detail.amount)} (fee deducted, metal credited).`;
        break;
      case 'sold_winner':
      case 'won_settlement':
        icon = '🏆';
        content = `You WON "${detail.itemName}" at ${amt(detail.amount)}. ${detail.itemName.includes('×') ? 'Goods' : 'The item'} has been delivered to your account.`;
        break;
      case 'expired_seller':
        icon = '⌛';
        content = `Your auction "${detail.itemName}" expired with no bids. Your goods were returned to your stockpile.`;
        break;
      case 'refund_seller':
        icon = '↩️';
        content = `Auction "${detail.itemName}" cancelled — your escrowed goods were returned.`;
        break;
    }
    await deliver(recipient, content, detail.auctionId, icon);
  } catch (error) {
    console.error('⚠️ Auction notification failed (non-fatal):', error);
  }
}
