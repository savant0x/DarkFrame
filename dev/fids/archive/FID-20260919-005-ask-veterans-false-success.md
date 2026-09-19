# FID-20260919-005 — Ask-Veterans false-success fix: real broadcast, honest count, veteran delivery

**Status:** closed (2026-09-19, commit `cdfaee7`)
**Session:** 2026-09-19 (059)
**Origin:** Product survey refresh (2026-09-19): the ask-veterans feature reports
success while delivering nothing — found during the P1 re-probe sweep.

## 1. Problem (evidence chain, all probed this session)

The newbie-help chain is dead at every hop, and the UI reports success anyway:

1. **Client never uses the socket path.** ChatPanel:925 POSTs
   `/api/chat/ask-veterans`. The socket event `chat:ask_veterans` →
   `handleAskVeterans` (chatHandlers.ts:472 — which *does* broadcast) is never
   emitted by any client.
2. **The HTTP route broadcasts nothing.** Its own body:
   `// TODO: Actual WebSocket broadcasting happens in Task 3`. It calls
   `sendVeteranNotification(...)` and returns 200.
3. **`sendVeteranNotification` (chatService.ts:641) persists nothing** — builds a
   `VeteranNotification` object and returns it. No DB write, no emit, no queue.
4. **No client would hear it anyway.** `chat:veteran_notification` has a declared
   S2C type (types/websocket.ts:760) and **zero subscribers**.
5. **The success toast reads a field the response doesn't carry.** The route
   returns `{ success, message, notification, cooldownSeconds }` — no
   `notifiedCount` (that is the *socket handler's* callback contract). Live
   toast: "Notified undefined veteran players (Level 50+)".
6. Bonus honesty wrinkle, same path: the panel's `.then` never checks
   `res.ok`/`data.success` — a 429 rate-limit response would still toast success.

**Population stakes (live DB census):** 78 players — 54 at level ≤10 (the exact
cohort this feature serves), 1 at level ≥50 (max 65). The feature exists for the
majority of the player base and reaches nobody.

## 2. Scope

- **Shared broadcast seam** `lib/veteranBroadcast.ts`:
  `broadcastVeteranRequest(io, notification)` — maps the `VeteranNotification`
  from `sendVeteranNotification` onto the declared
  `ChatVeteranNotificationPayload` shape (notificationId = uuid, expiresAt =
  timestamp + 5 min, matching the ask cooldown; channelId = `help`), fans out
  over `io.fetchSockets()` filtering `isVeteran(level)` (≥50), emits, returns the
  count. Sockets without an authenticated user are skipped safely.
- **HTTP route**: call the seam via `getIO()` (globalThis bridge, the FID-002
  pattern — webpack route bundles share the native server's io), include
  `notifiedCount` in the response, remove the stale Task-3 TODO.
- **Socket handler** `handleAskVeterans`: replace its inline fan-out with the
  same seam (single truth for payload shape + veteran filter).
- **Client (ChatPanel)**:
  - `submitVeteranQuestion`: check `res.ok`/`data.success`, toast the real
    `notifiedCount` (or the server's error message on 403/429).
  - Subscription effect: `chat:veteran_notification` → long-duration toast:
    "🆘 <username> (Lv N) asks: <question>".
- Pins for the seam; two-socket live probe; full gates.

## 3. Out of scope

- Persisting help requests for offline veterans (feature is transient by design —
  delivery to connected veterans only; recorded as a future enhancement, not
  silently dropped).
- Veteran response/claim workflow, HELP-channel badge counts, ModerationPanel
  socket conversion (dropped in the survey refresh).

## 4. Acceptance

- HTTP ask from a newbie with a connected veteran: response `notifiedCount ≥ 1`,
  veteran socket receives the payload with requester truth.
- No veteran connected: `notifiedCount: 0`, success still true (request accepted;
  the count is the truth).
- 429/403 paths toast errors, never success.
- Probe residue zero.


## 8. Closure (2026-09-19)

- **Shipped:** `lib/veteranBroadcast` (shared seam: declared payload shape, isVeteran filter, honest count, TTL = 5-minute ask cooldown); HTTP route broadcasts via the getIO() globalThis bridge and returns `notifiedCount`; the socket handler's inline fan-out replaced by the same seam (one truth); ChatPanel toasts the real count, gates on res.ok/data.success (403/429 surface the server's error, never a false success), and subscribes to `chat:veteran_notification` (30s toast).
- **Pins:** 7 (`__tests__/api/veteranBroadcast.test.ts`) — veteran-only fan-out incl. unauthenticated-socket safety, payload-truth mapping (UUID id, channelId help, expiresAt−timestamp = TTL), boundary level 50, honest zero count, identical payload across targets, string-timestamp tolerance, TTL constant.
- **Live probe:** 8/8 (`scripts/e2eVeteranBroadcastLive.ts` vs tsx server.ts:3003) — response carries notifiedCount=1; veteran socket receives the exact payload (TTL 300000ms asserted); newbie self-exclusion live; second ask inside cooldown → real 429 success:false. Probe lesson recorded in §8/method: the route broadcasts BEFORE its HTTP response resolves — a listener attached after the response misses the delivery (probe design race, not a code defect).
- **Gates at close:** suite 118 files / 1177 tests green (+7), tsc 0, eslint clean, probe residue zero.
