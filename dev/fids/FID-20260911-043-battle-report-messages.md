# FID-20260911-043 — Full Line-Item Battle Reports via In-Game Messages

**Date:** 2026-09-11 · **Trigger:** "When a player has a battle, they should be sent a full
line item battle log via messages."

## Contract

Every battle (`persistBattleLog` → `notifyBattleResult`) delivers a complete, formatted
battle report to **both participants' inboxes** (attacker AND defender — bots are
inboxless by design and skipped). The report includes, as line items:

- Headline from the viewer's seat (VICTORY / DEFEAT / DRAW) + timestamp + battle ID + rounds
- **FORCES COMMITTED** — per unit type on both sides: quantity, STR, DEF, HP start→end
- **ROUND-BY-ROUND** — damage dealt per side, HP after each round, units lost per round
- **CASUALTIES & RESULTS** — total losses, total damage, units captured, resources
  plundered/lost (viewer-perspective), XP awarded

Delivered through the standard messaging seam: SYSTEM-sender 1:1 conversation,
`metadataSystemType='battle_result'`, `metadataRelatedEntityId=battleId`,
unread counter bumped. Non-fatal by contract: delivery failure never fails the battle.

## The blocker this FID closes

The first live raid test (Fame vs Silent_Citadel) proved the wiring but the insert died:

```
⚠️ Battle notification failed (non-fatal): value too long for type character varying(1000)
```

`messages.content` was `varchar(1000)` — a chat-message legacy cap. The report runs
1–3.8 KB, so **every** battle report was silently dropped (non-fatal = swallowed).
Fix: **migration 0023** widens `messages.content` to `text` (applied live), schema
updated. Player-typed chat is unchanged — `messagingService` zod still caps typed
messages at 1000 chars. `conversations.last_message_content` stays varchar(1000)
(preview only; `deliverReport` slices to 200).

## Files

- `lib/db/migrations/0023_messages_content_text.sql` — the ALTER
- `lib/db/schema/messages.ts` — `content: text()`
- `lib/battleNotification.ts` — report formatting + delivery (both seats)
- `lib/battleService.ts` — `notifyBattleResult(battleLog)` call site

## Verification

- `tsc` 0 · `eslint` 0 (migration-file parse noise is pre-existing: 0022 identical) ·
  vitest **42 files passed** · `next build` exit 0
- **Live raid smoke (prod server :3001, Fame → Silent_Citadel):**
  raid 200; fame's inbox received the full 1,120-char report — forces committed
  (all 10 defender unit types with STR/DEF line items), round-by-round, casualties,
  captured units. Insert no longer truncates or fails.
- Smoke side effects reverted: fame's army restored to exactly 10,725 Infantry @
  STR 100 (total_strength 1,072,500) and position (23,110).
