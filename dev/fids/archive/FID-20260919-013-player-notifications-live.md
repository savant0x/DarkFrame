# FID-20260919-013 — Real player-notification delivery: one seam, every event pushed

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-19 (design directive)
**Origin:** Operator directive: "Design the real player-notification system the dead stack
pretended to be — wire WMD events and auction outcomes to a live surface."

## 1. The design finding (grounded before any code)

The survey's premise — "the notification stack is dead" — was **directionally true but
wrong in shape**. Ground truth, item by item:

| Piece | Survey said | Truth (probed) |
|---|---|---|
| `wmd_alerts` | kept as "live reader" | Reader exists (admin health) but **zero writers** — the table can never hold a row |
| `wmd_notifications` | part of dead stack | **Alive as a store**: missileTracker + researchService write rows on impact/intercept/research |
| `wmd:*` socket events | dead | **Partially live**: launch (`app/api/wmd/missiles:268`), impact/intercept (missileTracker:305,364), spy missions, votes, batteries, spy recruits all broadcast via `wmdHandler`; the client hook (`useWMDNotifications`) is **mounted in WMDHub (game + /wmd pages) with toasts** |
| Auction outcomes | not on the board | Persist to the DM inbox (System conversation) but `deliver()` **inserts rows directly**, bypassing `messagingService` — so FID-004's `message:receive`/`conversation:updated` pushes never fire: no badge movement, no toast |
| Research complete | — | DB row written, `broadcastResearchComplete` has **zero callers**: no push at all |

**Conclusion:** the system the dead stack pretended to be already has three working
surfaces — the DM inbox (persisted, badged, real-time per FID-004), the WMD toasts
(mounted, typed, mostly fed), and the chat family. What never existed was **one delivery
seam**: every player-directed event persisting to the DM inbox *and* pushing the same
notification to that player's socket room.

## 2. Design

### 2.1 The seam — `lib/playerNotification.ts`
`notifyPlayer(type, recipient, { title, body, icon?, dedupeKey?, relatedEntityId? })`:
1. **Persist** — insert the message into the recipient's System conversation (the
   auctionNotification pattern: `metadataSystemType`, unread-count jsonb bump), then
   **re-read the conversation row** and emit FID-004's `message:receive` +
   `conversation:updated` through the exact payload mappers the client already
   consumes — type-correct, unlike the wmdHandler's `as never` room casts.
2. **Push** — `io.to(user:<recipient>)` rooms; the socket singletons are process-local
   (missileTracker's precedent), so Vercel-scheduled jobs degrade to DB-only delivery —
   the persistent copy is the baseline, push is additive. Fire-and-forget safe.
3. **Dedupe** — an in-process Map (`dedupeKey → ts`, 60s window) so tracker sweeps
   can't double-toast the same event after a crash-resume reprocess.

### 2.2 Rewires (producers)
- **`lib/auctionNotification.ts`** — `deliver()` replaced by the seam (all six event
  types flow through unchanged content).
- **`lib/wmd/jobs/missileTracker.ts`** — both `createWMDNotification` sites now also
  `notifyPlayer` the target (and launcher on interception) with dedupeKeys.
- **`lib/wmd/researchService.ts`** — research completion `notifyPlayer`s the owner and
  calls the orphaned `wmdHandler.broadcastResearchComplete` via the typed helper.

### 2.3 Types
`NotificationPushPayload` added to `types/websocket.ts`; a `'notification:push'` member
appended to `ServerToClientEvents` (interface merge; no existing members touched).

### 2.4 Recorded, not built
- `wmd_alerts` gets a writer (admin-alert path) as a follow-up; the admin health reader
  keeps its empty-state honesty.
- `wmd_notifications` (zero readers) and `hooks/useWMDNotifications.ts` are **not
  deleted**: the hook consumes only never-emitted events — a later pass should either
  delete it or feed it. Recorded, per scope discipline.

## 3. Non-goals
- No new UI (the inbox and WMD toasts are the surfaces); no email; no schema changes.

## 4. Verification
- Unit pins: seam persist+emit (mocked db/io, payload-mapper assertions, dedupe window,
  io-null degradation), auction rewire, tracker/research rewires.
- Live probe: real registration → `notifyAuctionEvent('outbid', …)` → assert inbox row +
  unread bump + socket `message:receive`/`conversation:updated` payloads.
- Gates: suite, tsc, eslint; closure per convention.

## 8. Closure

Implemented same session on operator standing directive. Implementation commit: `746b920`.
Closed on `746b920`. Gates: suite 1231/1231 (7 new pins), tsc 0, eslint clean.
Live probe: 12/12 against the running server — real buyout produced the persisted
System DM (metadata auction_event, unread bump) AND all three socket events on the
seller's live connection; direct seam re-delivery with the same dedupeKey was dropped.
Producer note recorded honestly: the interception/impact rewire initially lost the
recordAdminAlert call lines to a regex backreference bug; caught by tsc within the
same batch and restored with original indentation.
