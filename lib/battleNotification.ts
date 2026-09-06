/**
 * @file lib/battleNotification.ts
 * @created 2026-09-06
 * @overview Defender battle-result notifications (FID-20260906-004 D2).
 *
 * When a battle is persisted, the defender receives a system message in their
 * existing messages inbox (conversations + messages tables). Uses the
 * `metadataSystemType='battle_result'` + `metadataRelatedEntityId=battleId`
 * seam already modeled by lib/db/schema/messages.ts and surfaced by
 * lib/messagingService's metadata mapping — previously written by no one.
 *
 * The SYSTEM sender is not a players row; system conversations are found by
 * the standard participants lookup and are read-only for the recipient.
 * All writes are non-fatal: notification failure must never fail the battle.
 */

import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { BattleLog } from '@/types/game.types';

/** Sender id for system-generated messages (never a real players row). */
export const SYSTEM_SENDER = 'SYSTEM';

/** 24-char id budget (columns are varchar(24); UUID-hex truncated). */
function shortId(): string {
  // Note: crypto.randomUUID is 36 chars — 32 hex — so slice to 24. The
  // `randomUUID in crypto` guard also exists in Node 19+ globals.
  const hex = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`.replace(/[^0-9a-f]/g, '0');
  return hex.slice(0, 24);
}

/** Compact human-readable battle result line for the inbox. */
export function formatBattleResultMessage(battleLog: BattleLog): string {
  const outcome = battleLog.outcome === 'ATTACKER_WIN'
    ? `Your defenses were BROKEN`
    : battleLog.outcome === 'DEFENDER_WIN'
      ? `You successfully DEFENDED`
      : `The battle ended in a DRAW`;
  const lost = battleLog.defender.unitsLost;
  const dealt = battleLog.defender.damageDealt;
  return [
    `⚔️ You were attacked by ${battleLog.attacker.username}!`,
    `${outcome} — ${lost} unit${lost === 1 ? '' : 's'} lost, ${dealt.toLocaleString()} damage dealt to the attacker.`,
    `Battle ID: ${battleLog.battleId}`,
  ].join(' ');
}

/**
 * Deliver a battle-result system message to the defender's inbox.
 * Non-fatal by contract — callers may await without try/catch.
 */
export async function notifyBattleResult(battleLog: BattleLog): Promise<void> {
  try {
    const defender = battleLog.defender.username;
    if (!defender || defender === SYSTEM_SENDER) return;

    // Bots and special bases have no inbox (no players row to read it).
    const isBotOrBase = /^Flag-Bearer-/.test(defender)
      || defender.startsWith('🍺BeerBase-')
      || /^b[WMSEUL]\d{12}$/.test(defender);
    if (isBotOrBase) return;

    // Find-or-create the 1:1 SYSTEM ↔ defender conversation (same lookup
    // semantics as messagingService.getOrCreateConversation).
    const participants = [SYSTEM_SENDER, defender].sort();
    const all = await db.select().from(conversations);
    let conversation = all.find(c => {
      const p = c.participants as string[];
      return p.length === 2 && p.includes(SYSTEM_SENDER) && p.includes(defender);
    });
    if (!conversation) {
      const now = new Date();
      const [created] = await db.insert(conversations).values({
        id: shortId(),
        participants: participants as unknown as string[],
        unreadCount: { [SYSTEM_SENDER]: 0, [defender]: 0 },
        createdAt: now,
        updatedAt: now,
      }).returning();
      conversation = created;
    }
    if (!conversation) return;

    const now = new Date();
    const content = formatBattleResultMessage(battleLog).slice(0, 1000);
    await db.insert(messages).values({
      id: shortId(),
      conversationId: conversation.id,
      senderId: SYSTEM_SENDER,
      recipientId: defender,
      content,
      contentType: 'system',
      status: 'sent',
      createdAt: now,
      metadataSystemType: 'battle_result',
      metadataRelatedEntityId: battleLog.battleId.slice(0, 50),
    });

    // Bump the defender's unread counter (same jsonb_set pattern as sendDirectMessage).
    await db.update(conversations)
      .set({
        lastMessageContent: content,
        lastMessageSenderId: SYSTEM_SENDER,
        lastMessageCreatedAt: now,
        lastMessageStatus: 'sent',
        updatedAt: now,
        unreadCount: sql`jsonb_set(COALESCE(${conversations.unreadCount}, '{}'::jsonb), ARRAY[${defender}]::text[], to_jsonb(COALESCE((${conversations.unreadCount}->>${defender})::numeric, 0) + 1))`,
      })
      .where(eq(conversations.id, conversation.id));
  } catch (error) {
    console.error('⚠️ Battle notification failed (non-fatal):', error);
  }
}
