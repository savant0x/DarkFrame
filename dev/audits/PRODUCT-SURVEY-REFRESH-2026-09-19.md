# PRODUCT SURVEY REFRESH — 2026-09-19: the board after the real-time + hygiene arcs

**Method:** every open claim from `PRODUCT-SURVEY-2026-09-19.md` re-probed per Law 16,
plus two fresh sweeps: a socket-emission × client-subscription cross-census over the
chat family, and a nav census (every `router.push`/`href` target must resolve to a
real app route — the inverted-route census covered fetches only, never navigation).
Population census via direct pg query for the veteran-help finding.

## Closed since the last survey (this arc, all live-verified)

- **P0 auction unit-stat honesty** — FID-20260919-001 (`123d5e2`): escrow-owned
  truth + real unit picker; also un-500ed every listing insert (doc-bridge booleans).
- **P1 chat real-time** — FID-20260919-002 (`d1b390b`): all five emissions wired
  client-side; probe exposed and fixed four server-side defects.
- **P1 balance UI** — premise disproved: already surfaced in StatsPanel (Balance
  row, Dealt/Taken multipliers, recommendation caution, meters) and the leaderboard.
  Disposition: `BALANCE-UI-DISPOSITION-2026-09-19.md`.
- **P2 dead-UI generation** — FID-20260919-003 (`9a46891`): 13 components + orphaned
  test archived with census-pinned README/manifest.
- **DM real-time** — FID-20260919-004 (`4362e82`): HTTP-path broadcast seams, room
  addressing fixes, live thread (typing, receipts, append).

## NEW P1 — Ask-Veterans is a false-success feature (newbie help never delivered)

The full chain is dead at every hop, and the UI reports success anyway:

1. **Client never uses the socket path.** ChatPanel:925 POSTs `/api/chat/ask-veterans`
   (the `chat:ask_veterans` socket event and its working broadcast handler in
   `chatHandlers.ts:472` are never called by anything).
2. **The HTTP route broadcasts nothing.** Its own body says so:
   `// TODO: Actual WebSocket broadcasting happens in Task 3`. It calls
   `sendVeteranNotification(...)` and returns.
3. **`sendVeteranNotification` persists nothing** (`chatService.ts:641-659`): it
   builds a `VeteranNotification` object and returns it — no DB write, no emit, no
   queue. The notification evaporates.
4. **No client would hear it anyway.** `chat:veteran_notification` has zero
   subscribers (not in the FID-002 wiring, not in any component).
5. **The success toast reads a field the HTTP response doesn't carry.** The route
   returns `{ success, message, notification, cooldownSeconds }` — no
   `notifiedCount` (that's the socket handler's contract). Live toast:
   **"Notified undefined veteran players (Level 50+)"**.

**Population census (live DB):** 78 players — **54 are level ≤10** (the target
cohort for this feature), **1 is level ≥50** (max 65). The feature exists
precisely for the majority of the player base and delivers to nobody.

**Fix shape:** one broadcast seam in the HTTP route (reuse the socket handler's
fan-out logic or emit via `getIO()` over connected sockets with the veteran
filter), `notifiedCount` in the response, and a `chat:veteran_notification`
subscription in the FID-002 wiring module rendering a toast/panel for veterans.
Pins + one live probe (two sockets, different levels). Small FID, high player-value.

## Stale premises corrected (no longer product work)

- **ModerationPanel "polling → socket events":** panel is admin-side HTTP CRUD
  (`/api/admin/moderation`), not `usePolling` — and the server has almost no
  moderation emissions to subscribe to (only `chat:banned_from_channel` exists).
  Converting to sockets would require building the emission surface first, for an
  admin-only panel where polling is acceptable. **Dropped as not-worth-it**; the
  only real-time moderation gap that matters to players (mute/ban feedback in
  chat) can ride the ask-veterans FID's wiring work if ever wanted.
- **P3 specialization "unreached system":** fully wired — `/game/specialization`
  page + `SpecializationPanel` fetches all three status GETs and POSTs
  choose/switch. Never was a gap at the current head.
- **Item-details modal:** smaller than surveyed — the validation route, the client
  fetch, and the cache all exist; only `handleItemClick` (ChatMessage:304) is a
  toast stub instead of opening a modal/navigating.
- **Profile modal:** `/profile/[username]` page already exists;
  `ChatMessage.handleProfileClick` correctly calls the `onProfileClick` prop, but
  ChatPanel never passes one, so it falls through to a toast. The gap is one
  `router.push(\`/profile/${username}\`)` prop at the ChatPanel call site.

## Nav census (fresh sweep — inverted-route census for navigation)

Every `router.push` target in live code resolves to a real `app/` route, with one
exception that isn't live: `/game/factory-management` (TileRenderer:1042) is inside
a **commented-out** "Manage Factory" button (TODO since the original build). No
player-visible nav is broken. Recorded product call it implies: **factory owners
have no map-tile jump into factory management** — the button exists, commented,
waiting for a page that never shipped. Note `app/game/unit-factory` exists and may
already be that destination; a rewire, not a build, if pursued.

## Remaining board (ranked)

| # | Item | Size | Evidence |
|---|------|------|----------|
| 1 | **Ask-Veterans false-success fix** (P1) | Small FID: broadcast seam + response field + veteran subscription; pins + 2-socket probe | This survey, NEW P1 section |
| 2 | Chat polish: profile click → `/profile/[username]`; item click → details/auction nav | Tiny — one prop + one handler | ChatMessage:267/:304; page exists |
| 3 | Factory "Manage" tile button: rewire to `/game/unit-factory` or build page — operator call | Small if rewire | TileRenderer:1040-1048 |
| 4 | PlayerDetailModal reset-progress (admin convenience) | Small; needs a scoped, logged admin endpoint | PlayerDetailModal:671 |
| 5 | ChatPanel virtualization (react-window) | Only when scroll pain is real | ChatPanel:2298 |

## Not product work (standing context)

Stripe VIP grant path fixed (0.0.9); Mongo era deleted outright (0.0.13); every
technical-debt track closed; chat + DM real-time live (0.0.15/0.0.17); auction
economy honest (0.0.14); dead UI archived (0.0.16); balance UI confirmed present.

## SUPERSEDED 2026-09-19 (later session): refresh 2

The items this board ranked were shipped (ask-veterans 0.0.18, chat profile nav
0.0.19, factory Manage 0.0.20, item links + auction name search 0.0.21, deep-link
open repair). The live board now lives in `PRODUCT-SURVEY-REFRESH-2-2026-09-19.md`
(RP checkout, items-table design, doc-rot hygiene, notifications disposition).
