/**
 * @file lib/battleNotification.ts
 * @created 2026-09-06
 * @updated 2026-09-11 (FID-20260911-044) — full line-item battle reports.
 *
 * Every battle delivers a complete, line-item battle report to BOTH
 * participants' inboxes (conversations + messages tables) — attacker AND
 * defender. Uses the `metadataSystemType='battle_result'` +
 * `metadataRelatedEntityId=battleId` seam modeled by lib/db/schema/messages.ts.
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

/** Force summary for one side of a battle. */
function formatForce(label: string, p: BattleLog['attacker']): string[] {
  const lines: string[] = [`${label}: ${p.username}`];
  if (p.units.length > 0) {
    // Group by unit type (a fight may field many stacks).
    const byType = new Map<string, { qty: number; str: number; def: number }>();
    for (const u of p.units) {
      const key = String(u.type) || u.id;
      const cur = byType.get(key) ?? { qty: 0, str: 0, def: 0 };
      cur.qty += 1;
      cur.str += u.strength ?? 0;
      cur.def += u.defense ?? 0;
      byType.set(key, cur);
    }
    for (const [name, agg] of byType) {
      lines.push(`  • ${name} ×${agg.qty.toLocaleString()} — STR ${agg.str.toLocaleString()} / DEF ${agg.def.toLocaleString()}`);
    }
  }
  lines.push(`  • Total STR ${p.totalSTR.toLocaleString()} · DEF ${p.totalDEF.toLocaleString()} · HP ${p.initialHP.toLocaleString()} → ${p.finalHP.toLocaleString()}`);
  return lines;
}

/** Full line-item battle report — the same text both participants receive. */
export function formatBattleResultMessage(battleLog: BattleLog, viewerIsAttacker: boolean): string {
  const a = battleLog.attacker;
  const d = battleLog.defender;
  const attackerWon = battleLog.outcome === 'ATTACKER_WIN';
  const draw = battleLog.outcome !== 'ATTACKER_WIN' && battleLog.outcome !== 'DEFENDER_WIN';

  const lines: string[] = [];

  // Headline — from the viewer's perspective.
  const youWon = viewerIsAttacker ? attackerWon : !attackerWinForDefender(draw, attackerWon);
  if (draw) {
    lines.push(`⚔️ BATTLE REPORT — ${battleLog.battleType} at ${formatLocation(battleLog)} — DRAW`);
  } else if (youWon) {
    lines.push(`⚔️ BATTLE REPORT — ${battleLog.battleType} at ${formatLocation(battleLog)} — VICTORY`);
  } else {
    lines.push(`⚔️ BATTLE REPORT — ${battleLog.battleType} at ${formatLocation(battleLog)} — DEFEAT`);
  }
  lines.push(`🗓 ${new Date(battleLog.timestamp).toLocaleString()} · Battle ID ${battleLog.battleId.slice(0, 12)} · ${battleLog.totalRounds} round${battleLog.totalRounds === 1 ? '' : 's'}`);
  lines.push('');

  // Forces committed (full line items).
  lines.push('📋 FORCES COMMITTED');
  lines.push(...formatForce('🎯 Attacker', a));
  lines.push(...formatForce('🛡 Defender', d));
  lines.push('');

  // Round-by-round combat log.
  lines.push('🎲 ROUND-BY-ROUND');
  for (const r of battleLog.rounds) {
    lines.push(
      `  R${r.roundNumber}: A dealt ${r.attackerDamage.toLocaleString()} / D dealt ${r.defenderDamage.toLocaleString()}`
      + ` — HP ${r.attackerHP.toLocaleString()} vs ${r.defenderHP.toLocaleString()}`
      + ` — losses A ${r.attackerUnitsLost} / D ${r.defenderUnitsLost}`
    );
  }
  if (battleLog.rounds.length === 0) lines.push('  (no rounds recorded)');
  lines.push('');

  // Casualties + outcome accounting.
  lines.push('💀 CASUALTIES & RESULTS');
  lines.push(`  • Attacker lost ${a.unitsLost.toLocaleString()} unit${a.unitsLost === 1 ? '' : 's'} · dealt ${a.damageDealt.toLocaleString()} total damage`);
  lines.push(`  • Defender lost ${d.unitsLost.toLocaleString()} unit${d.unitsLost === 1 ? '' : 's'} · dealt ${d.damageDealt.toLocaleString()} total damage`);
  if (battleLog.unitsCaptured && (battleLog.unitsCaptured.attackerCaptured.length > 0 || battleLog.unitsCaptured.defenderCaptured.length > 0)) {
    lines.push(`  • Units captured — attacker took ${battleLog.unitsCaptured.attackerCaptured.length}, defender took ${battleLog.unitsCaptured.defenderCaptured.length}`);
  }
  if (battleLog.resourcesStolen && battleLog.resourcesStolen.amount > 0) {
    const stoleLine = `${battleLog.resourcesStolen.amount.toLocaleString()} ${battleLog.resourcesStolen.resourceType}`;
    lines.push(viewerIsAttacker ? `  • 💰 You plundered ${stoleLine}` : `  • 📉 You lost ${stoleLine} to the raider`);
  }
  if (battleLog.attackerXP > 0 || battleLog.defenderXP > 0) {
    lines.push(`  • XP — attacker +${battleLog.attackerXP.toLocaleString()} · defender +${battleLog.defenderXP.toLocaleString()}`);
  }
  if (battleLog.message) lines.push(`  ℹ️ ${battleLog.message}`);

  return lines.join('\n').slice(0, 3800);
}

/** Outcome from the DEFENDER's seat (draw = not a win). */
function attackerWinForDefender(draw: boolean, attackerWon: boolean): boolean {
  void draw;
  return attackerWon;
}

function formatLocation(battleLog: BattleLog): string {
  return battleLog.location ? `(${battleLog.location.x}, ${battleLog.location.y})` : 'the field';
}

/** Bots and special bases have no inbox — never route them a message. */
function isInboxless(username: string): boolean {
  return /^Flag[-_]Bearer[-_]/.test(username)
    || username.startsWith('🍺BeerBase-')
    || /^b[WMSEUL]\d{12}$/.test(username)
    || /^Silent_/.test(username)
    || username === SYSTEM_SENDER;
}

/**
 * Find-or-create the 1:1 SYSTEM ↔ recipient conversation (same lookup
 * semantics as messagingService.getOrCreateConversation).
 */
async function findOrCreateSystemConversation(recipient: string) {
  const participants = [SYSTEM_SENDER, recipient].sort();
  const all = await db.select().from(conversations);
  let conversation = all.find(c => {
    const p = c.participants as string[];
    return p.length === 2 && p.includes(SYSTEM_SENDER) && p.includes(recipient);
  });
  if (!conversation) {
    const now = new Date();
    const [created] = await db.insert(conversations).values({
      id: shortId(),
      participants: participants as unknown as string[],
      unreadCount: { [SYSTEM_SENDER]: 0, [recipient]: 0 },
      createdAt: now,
      updatedAt: now,
    }).returning();
    conversation = created;
  }
  return conversation;
}

/** Insert the report message and bump the recipient's unread counter. */
async function deliverReport(
  conversationId: string,
  recipient: string,
  content: string,
  battleId: string,
  systemType: string = 'battle_result'
): Promise<void> {
  const now = new Date();
  await db.insert(messages).values({
    id: shortId(),
    conversationId,
    senderId: SYSTEM_SENDER,
    recipientId: recipient,
    content,
    contentType: 'system',
    status: 'sent',
    createdAt: now,
    metadataSystemType: systemType,
    metadataRelatedEntityId: battleId.slice(0, 50),
  });

  await db.update(conversations)
    .set({
      lastMessageContent: content.slice(0, 200),
      lastMessageSenderId: SYSTEM_SENDER,
      lastMessageCreatedAt: now,
      lastMessageStatus: 'sent',
      updatedAt: now,
      unreadCount: sql`jsonb_set(COALESCE(${conversations.unreadCount}, '{}'::jsonb), ARRAY[${recipient}]::text[], to_jsonb(COALESCE((${conversations.unreadCount}->>${recipient})::numeric, 0) + 1))`,
    })
    .where(eq(conversations.id, conversationId));
}

/**
 * Deliver a full line-item battle report to BOTH participants' inboxes.
 * Non-fatal by contract — callers may await without try/catch.
 */
export async function notifyBattleResult(battleLog: BattleLog): Promise<void> {
  try {
    const attacker = battleLog.attacker.username;
    const defender = battleLog.defender.username;

    const recipients = [attacker, defender].filter(
      (u) => u && u !== SYSTEM_SENDER && !isInboxless(u),
    );
    // A 1:1 battle between two inboxless parties (rare) has no one to notify.
    if (recipients.length === 0) return;

    for (const recipient of recipients) {
      const conversation = await findOrCreateSystemConversation(recipient);
      if (!conversation) continue;
      const viewerIsAttacker = recipient === attacker;
      const content = formatBattleResultMessage(battleLog, viewerIsAttacker);
      await deliverReport(conversation.id, recipient, content, battleLog.battleId);
    }
  } catch (error) {
    console.error('⚠️ Battle notification failed (non-fatal):', error);
  }
}

/**
 * FID-20260912-076: generic SYSTEM DM for non-battle events (war declared/
 * settled, captures, truces). Same find-or-create + unread-bump machinery as
 * battle reports; renders as a styled card via the `war_result` system type.
 * Non-fatal by contract. Inboxless usernames are filtered internally.
 */
export async function notifySystem(
  recipient: string,
  content: string,
  systemType: string,
  relatedEntityId?: string
): Promise<void> {
  try {
    if (!recipient || recipient === SYSTEM_SENDER || isInboxless(recipient)) return;
    const conversation = await findOrCreateSystemConversation(recipient);
    if (!conversation) return;
    await deliverReport(conversation.id, recipient, content, relatedEntityId ?? 'war', systemType);
  } catch (error) {
    console.error(`⚠️ System notification (${systemType}) failed (non-fatal):`, error);
  }
}
