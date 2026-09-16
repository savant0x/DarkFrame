# FID-20260911-044 — Battle Report Cards in the Inbox

**Date:** 2026-09-11 · **Follows:** FID-20260911-043 (full line-item battle reports via messages)

## Problem

FID-043 delivered full line-item battle reports to both participants' inboxes, but the
MessageThread rendered them as a raw 1–3.8 KB text wall — indistinguishable in quality
from chat. Two latent defects also blocked any future styling:

1. **Marker stripped server-side.** `mapMessageToType`'s type guard validated
   `metadata_system_type` against `['achievement','battle','trade','notification']` —
   `'battle_result'` (the value `battleNotification.ts` writes) failed the guard, so the
   marker **never reached the client**. Any client-side detection was impossible.
2. **No renderer.** MessageThread had a single `<p>{message.content}</p>` path.

## Fix

| File | Change |
|---|---|
| `types/messaging.types.ts` | `systemType` union extended with `'battle_result'`. |
| `lib/messagingService.ts` | `SYSTEM_MESSAGE_TYPES` guard extended — marker now flows to the client (verified live over HTTP). |
| `lib/battleReportParser.ts` *(new)* | Pure parser: deterministic report text → typed sections (headline/outcome/location/meta, per-side forces with unit line items, round-by-round, casualty/result lines). Defensive — arbitrary text parses with `parsed: false` and round-trips. |
| `components/messaging/BattleReportCard.tsx` *(new)* | NEON NOIR card: outcome-tinted border/head (green VICTORY, magenta DEFEAT, amber DRAW), two-column forces grid, scrollable unit line items, round rows, gain/loss-tinted result lines, collapse toggle. Non-parsing bodies fall back to the exact pre-FID raw-text render. |
| `components/messaging/MessageThread.tsx` | `systemType === 'battle_result'` branch renders the card; all other messages unchanged. |
| `app/neon-noir.css` | `.nn-battle-report*` block appended (tokens only, no new palette values). |
| `__tests__/lib/battleReportParser.test.ts` *(new)* | 6 tests pinning the parser against the verbatim live report text (from the FID-043 raid smoke row) + truncation/garbage defenses. |

### Implementation note (root-caused, not guessed)

First parser revision failed its own contract tests: `[📋🎲💀]` as a **character class
cannot match astral-plane emoji** (surrogate pairs — the class matches one code unit,
then `\s` fails on the low surrogate). Section detection now uses literal alternation
(`(?:📋|🎲💀)` pattern family), which sequences the pairs correctly. Test-verified.

## Verification

- **Parser:** 6/6 new tests; suite total **499 passed / 1 skipped**.
- **Live end-to-end:** production build on :3001; `/api/messages` for fame's battle
  conversation now returns `metadata.systemType: "battle_result"` (HTTP 200) with the
  1,120-char report — proving the type-guard fix unblocked client detection.
- **Gates:** tsc 0 · eslint 0 · build exit 0.
- Fallback guarantee: any `battle_result` row that fails to parse renders exactly as
  before (raw text), never an empty card.

## Deliberately unchanged

- Chat messages, achievement/notification system messages, MessageInbox list previews.
- Legacy `'battle'` systemType rows (none exist in the live DB; value kept for
  backward compatibility of the union).
