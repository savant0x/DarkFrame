/**
 * @file lib/auctionNotification.ts
 * @created 2026-09-12
 * @rewritten 2026-09-19 (FID-20260919-013 — delivery moved to the shared seam)
 * @overview FID-20260912-065 — auction inbox notifications.
 *
 * Builds auction event content and hands it to lib/playerNotification, the
 * single delivery seam: persist to the System inbox + push FID-004's
 * message:receive / conversation:updated (and notification:push) to the
 * player's socket room. Before the seam this module wrote inbox rows directly,
 * so live players got no badge movement or toast until their next page load.
 * Events: outbid, sale-complete (seller + winner), expired-no-sale (seller),
 * and refund-on-cancel (seller). Non-fatal by contract.
 */
import { notifyPlayer } from '@/lib/playerNotification';

export const AUCTION_SYSTEM_TYPE = 'auction_event';

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
    let title: string;
    let icon: string;
    let content: string;
    switch (type) {
      case 'outbid':
        title = 'Outbid';
        icon = '⚠️';
        content = `You've been OUTBID on "${detail.itemName}". ${detail.counterparty ?? 'Another player'} leads at ${amt(detail.amount)}. Bid again to reclaim it!`;
        break;
      case 'sold_seller':
        title = 'Auction Sold';
        icon = '💰';
        content = `Your auction "${detail.itemName}" SOLD to ${detail.counterparty} for ${amt(detail.amount)} (fee deducted, metal credited).`;
        break;
      case 'sold_winner':
      case 'won_settlement':
        title = 'You Won';
        icon = '🏆';
        content = `You WON "${detail.itemName}" at ${amt(detail.amount)}. ${detail.itemName.includes('×') ? 'Goods' : 'The item'} has been delivered to your account.`;
        break;
      case 'expired_seller':
        title = 'Auction Expired';
        icon = '⌛';
        content = `Your auction "${detail.itemName}" expired with no bids. Your goods were returned to your stockpile.`;
        break;
      case 'refund_seller':
        title = 'Auction Cancelled';
        icon = '↩️';
        content = `Auction "${detail.itemName}" cancelled — your escrowed goods were returned.`;
        break;
    }
    await notifyPlayer({
      systemType: AUCTION_SYSTEM_TYPE,
      recipient,
      title,
      body: content,
      icon,
      relatedEntityId: detail.auctionId,
      dedupeKey: `auction:${detail.auctionId}:${type}:${recipient}`,
    });
  } catch (error) {
    console.error('⚠️ Auction notification failed (non-fatal):', error);
  }
}
