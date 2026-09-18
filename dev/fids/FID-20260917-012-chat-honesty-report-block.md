# FID-20260917-012 — Chat honesty: real report + GLOBAL block + orphan ChatMessage repaired

**Status:** `loop-complete (filed + implemented same session, work order item 3)`
**Session:** 2026-09-17 (055)
**Origin:** Work order FID-20260917-011 item 3 (approved). Operator decision:
**block = GLOBAL** (chat + DMs + social), recorded in the survey audit.

## 1. Goal + the Law-16 discovery that reshaped it

Survey P0 said ChatMessage's report/block/delete buttons "lie to the player."
Ground truth: **`components/chat/ChatMessage.tsx` is an orphan** — zero
importers (ChatPanel's own header says "ChatMessage component will be created
in Task 6"). No player ever sees those buttons. The real survey defect class
is worse in a different way:

- The **live** ChatPanel renders its own message rows; edit/delete work
  (real fetches, real `/api/chat/delete` contract). But there are NO
  report/block affordances anywhere in the live UI.
- The orphan carries aspirational UI (report/block/delete/profile/item
  actions) wired to stubs and false toasts — a trap for whoever mounts it.
- ModerationPanel (admin) fetches `/api/admin/moderation?type=mutes|bans|
  blacklist|history` — but the route's type union has NO `reports`: reports
  would be invisible to admins even with persistence.

So "honesty" = build the real backends, surface them in the LIVE panel, and
make the orphan's stubs real (so a future mount inherits working actions, not
lies). Delete needs no fix (live path already works; orphan stub now calls the
real service too).

## 2. Loop decisions

- **Where to surface report/block in the live UI:** ChatPanel's own message
  row action region, next to Edit/Delete — report for OTHERS' messages,
  block via a hover action on other senders. No new components; minimal
  inline additions to the existing row renderer.
- **Schema:** two new tables in `lib/db/schema/moderation.ts` (the house
  moderation home), exported through the barrel:
  - `chat_reports`: id (24-char), messageId, channelId, reporterId,
    reportedUserId, reason (enum-ish varchar), status ('open' default),
    createdAt, resolvedAt, resolvedBy.
  - `blocked_users`: id, blockerId, blockedId, createdAt +
    UNIQUE(blockerId, blockedId). Global by definition: enforcement is
    server-side reads.
- **Enforcement (global):** `getBlockedUsernames(blockerId)` in
  `lib/blockService.ts`; wired into (1) `getGlobalChatMessages` — messages
  FROM blocked users filtered out post-query (viewer-keyed, so the filter
  lives at the service seam where viewerId is available); (2)
  `messagingService.getConversations` — conversations where the OTHER
  participant is blocked are excluded for that viewer.
- **Routes:** `POST /api/chat/report` (auth, Zod-lite validation, insert,
  returns report id) and `POST /api/chat/block` / `DELETE` (toggle-safe,
  idempotent) + `GET /api/chat/block` (list my blocked users).
- **Admin visibility:** `/api/admin/moderation` GET gains
  `type: 'reports'` (open reports, newest first) + POST `action: 'resolve_report'`.
- **Orphan repair:** ChatMessage's handleReport/handleBlock call the real
  endpoints (honest even when the component is eventually mounted);
  handleDelete calls `/api/chat/delete` (the real contract) instead of
  toasting; stale item-link comment corrected (endpoint EXISTS, only the
  details modal is missing).
- **No WebSocket work**, no chat polish (non-goals).

## 3. Implementation

`lib/db/schema/moderation.ts` + barrel: chat_reports, blocked_users.
`lib/blockService.ts` (new): blockUser/unblockUser/getBlockedUsernames/
isBlocked. `app/api/chat/report/route.ts`, `app/api/chat/block/route.ts`.
`app/api/admin/moderation/route.ts`: + reports read + resolve action.
`lib/chatService.ts`: viewer-keyed blocked filter in getGlobalChatMessages.
`lib/messagingService.ts`: blocked-participant filter in getConversations.
`components/chat/ChatPanel.tsx`: report action on others' messages (calls
/api/chat/report), block action on senders (calls /api/chat/block, then
optimistic local filter), both with honest error toasts.
`components/chat/ChatMessage.tsx`: real handlers (report/block/delete),
stale comments fixed.

## 4. Pins

`__tests__/api/chatReportBlock.test.ts`:
1. report route: 401 unauth; 400 missing fields; insert lands (db mocked);
   success shape.
2. block route: idempotent insert; unblock removes; list returns blockers'
   view; self-block refused.
3. blockService: getBlockedUsernames shape.
4. chatService filter: a message FROM a blocked user is absent for the
   blocked-viewer query but present for others (db chained mock).
5. moderation route: type=reports returns open reports (db mocked).

## 5. Live probe

`scripts/e2eChatHonesty.ts`: real DB — (1) fame reports a seeded message
from a cloned player; row lands with status open; (2) fame blocks the clone;
getGlobalChatMessages(viewer=fame) omits the clone's messages while a
non-blocked viewer still sees them; (3) unblock restores visibility;
(4) cleanup: report + block rows + clone deleted, zero residual. No player
data mutated beyond the disposable clone.

## 6. Gates

tsc 0 - eslint 0 (touched files) - full suite - census exit 0.

## 7. Notes

- ChatMessage remains unmounted (mounting it is chat-polish scope); honesty
  achieved by making its stubs real and adding affordances to the LIVE panel.
- Survey P2 item-details-modal and profile-modal remain non-goals.
- Follow-up candidates recorded: WebSocket block events (instant hide),
  report-reason analytics.

### 3b. Execution notes (truth pass)

- Block-route auth refactored during gate fixing: `requireUser` returns a
  **tagged pair** (`{ ok: false, error } | { ok: true, user }`) instead of the
  `as const` union — under `exactOptionalPropertyTypes`, the merged-optional
  shape made tsc infer `| undefined` handler fall-throughs (probed via a
  throwaway type-print file, then deleted). Call sites guard `if (!auth.ok)`.
- Stale `.next/types` for the deleted tutorial route (FID-013) caused 2 phantom
  TS2307s during the same gate run; cleared, not a source defect.
- Block/report affordance placement (FID-20260917-012): standalone **Report**
  and **Block** buttons render on other players' message rows in the live
  ChatPanel (handlers `reportMessage`/`blockSender`); delete affordance live in
  ChatPanel; ChatMessage stubs now hit the real endpoints.

## 8. Closure

- **Gates:** — filled at closure.
- **Commit hash (G2):** — filled at closure.
- **Post-commit:** FID archived; SCOPE row 90 -> Closed; CHANGELOG; VERSION.
