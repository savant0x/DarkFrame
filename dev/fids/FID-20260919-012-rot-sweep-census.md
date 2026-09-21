# FID-20260919-012 — TODO/placeholder census: doc-truth batch + two real defects

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-19 (census directive)
**Origin:** Operator directive after FID-011: "Run a fresh TODO/placeholder census across live
code to confirm no false-advertising surface remains after the doc-truth sweep."

## 1. Goal

Answer the census question with probes, not grep counts: **does any live surface still
lie?** Every TODO/FIXME/XXX/HACK hit triaged to rot (rewrite), real gap (record), or dead
code (remove). The census found the doc-truth arc is *mostly* done — but two real defects
were hiding under rot-shaped TODOs.

## 2. Census method and totals

- Pattern: `TODO|FIXME|XXX|HACK` across `app/ components/ lib/ hooks/ context/ types/`
  (archives excluded). 91 hits; 18 false positives (antiCheatDetector's `SPEED_HACK` /
  `RESOURCE_HACK` flag names). ~73 genuine marks triaged.
- Every "placeholder authentication" claim probed against actual route code (the claims
  were all false — real `authenticateRequest`/`requireAuth` everywhere probed).
- Every "Coming Soon" string probed for reachability (callers, nav links, view setters).
- DB probes: clan aux tables enumerated; drizzle schema cross-checked.

## 3. Findings — real defects (fixed in this FID)

### 3.1 Clan disband crashes on a phantom table (crash)
`clanService.disbandClan` runs `DELETE FROM clan_chat` (raw SQL). The live DB has
`clan_chat_messages` — **no `clan_chat` table exists** (verified via
`information_schema`; full census: `clan_activities, clan_alliances, clan_chat_messages,
clan_invitations, clan_relations, clan_wars, clans`). The remaining two DELETEs target
tables that *do* exist but have no drizzle definitions (hence raw SQL). Consequence:
every leader disband throws 500 after members are already cleared — partial-state crash.

### 3.2 `DELETE /api/chat` is a false-success stub (moderation lie)
The moderator delete handler returns `success: true, "Message deleted"` **without
deleting** — the body is commented out with "TODO: Implement deleteMessage()". The
implementation already exists and is unused: `chatService.deleteGlobalChatMessage`
(soft-delete via `chatMessages.deleted/deletedBy/deletionReason`, verified in schema).
Also ungated: the moderator check is commented out ("allow all authenticated users").
Fix: wire the real function, gate on `isAdmin`, return honest errors. (Moderator-undelete
and `message:deleted` socket fan-out remain out of scope — recorded in §5.)

### 3.3 Dead false-advertising UI removed
- **Game-page "Coming Soon" views** (`Battle Log View` :1316, `Inventory View` :1331):
  `BATTLE_LOG`/`INVENTORY` have **zero** `setCurrentView` callers (full census of the
  game page's state wiring), and live equivalents exist (InventoryPanel, BattleLogLinks).
  Both blocks + their CenterView members removed.
- **`app/admin/vip/page.tsx`** (465 lines): unmounted — zero `router.push`/`Link` reach
  `/admin/vip`; AdminView consumes the same admin VIP APIs directly. Its three TODO
  stubs (including a fake-success cancel toast) die with the page.
- **`game:request_tile_info` socket handler** (server.ts:143): empty TODO stub, no
  client emits it (grep across lib/ components/ app/). Removed.

## 4. Findings — doc rot (rewritten to truth)

| Location | Lie | Truth written |
|---|---|---|
| `app/api/chat/route.ts` header (SECURITY block) + `IMPLEMENTATION NOTES` | "Authentication not implemented yet", "placeholder getAuthenticatedUser()" | Real `authenticateRequest`; mute check live (`checkMuteStatus` at POST :305); ban check = channel-ban wiring (§5 candidate) |
| `app/api/chat/route.ts` PATCH | "TODO: Implement markMessagesAsRead()" + fake success comment | No-op documented honestly: no client calls bare `/api/chat` PATCH (ChatPanel uses `/api/chat/dm/read`); mark-as-read for channels is a real gap (§5) |
| `app/api/chat/delete/route.ts` docblock | "Ownership validation… sender can delete" | Actual behavior: admin-only moderator soft-delete (matches the wired handler) |
| `app/api/chat/edit/route.ts` | Stale placeholder-auth docblock sitting **above** the truthful one (double docblock) | Stale block removed; truthful one remains |
| `components/chat/ChatPanel.tsx` :985 | "TODO Task 10: Implement WebSocket chat:ask_veterans" | FID-20260919-005 shipped the HTTP seam + `chat:veteran_notification` subscription; comment rewritten |
| `components/messaging/MessageThread.tsx` ~:599-652 | Commented real-time sketch under live FID-20260919-004 wiring | Sketch removed; comment notes the shipped wiring |
| `app/help/page.tsx` :415 | "PvP combat is coming soon!" | PvP is live (protection arc): infantry + WMD seams, factory capture, espionage all enforced; text corrected |

## 5. Findings — real gaps recorded as FID candidates (NOT fixed here)

1. **Auction `clanOnly` is a silent API-only lie**: `CreateListingModal` hardcodes
   `clanOnly: false` ("Phase 5 feature"); the schema accepts it, `buyoutAuction`'s clan
   check is commented at both sites (:461, :620), but the sale-fee differential (:219)
   and the list filter (:1029) are live. No UI can set it; API callers get discounts for
   a restriction nobody enforces. Needs a product decision (enforce vs. strip), not a
   silent edit.
2. **`PATCH /api/chat` no-op**: kept for wire compat, but if any future client calls it,
   read-state silently doesn't persist. Channel mark-as-read needs a real FID.
3. **Ban check in chat POST**: `checkChannelBan` exists (channel-scoped, moderatorId =
   channelId by design); wiring it into the chat write path is a moderation work-order.
4. **Moderator undelete + `message:deleted` socket fan-out**: recorded in the delete
   route's corrected docblock as future work.
5. **`BattleLog` type duplication** (`types/activityLog.types.ts:204` +
   `types/game.types.ts:2144`): harmless today, flagged for the next types-consolidation
   pass.

## 6. Scope discipline

- No behavior change beyond §3. Rot rewrites touch comments/docblocks only.
- FID candidates in §5 are recorded, not executed — each needs its own loop or an
  explicit operator call (especially clanOnly, which is a product decision).

## 7. Verification plan

- Pins for the DELETE route (admin-gated, honest errors, soft-delete effect) and disband
  (no `clan_chat` reference; correct table hit).
- Full gates: vitest suite, `tsc --noEmit`, eslint on touched files.
- tsc must confirm the game page compiles after CenterView member removal (proves no
  hidden caller existed).

## 8. Closure

Implemented same session on operator standing directive. Implementation commit: `699aa38`.
Closed on `699aa38`. Gates: suite 1230/1230 (21 new pins), tsc 0, eslint clean.
Live probe: clan-table fix verified against dev DB (`clan_chat_messages` exists, `clan_chat` does not).
