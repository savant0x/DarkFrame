# FID-20260919-004 — DM real-time: broadcast seams + room-address fixes + thread wiring

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-19 (follows FID-20260919-002)
**Origin:** Operator directive: "Extend real-time wiring to DMs: private messaging
emissions exist server-side but the messages page still rides HTTP polling."

## 1. Premise (refined by grounding — the directive was half right)

The messages **page** (`app/messages/page.tsx:316-330`) ALREADY subscribes to
`message:receive`, `conversation:updated`, `message:read`, `typing:start/stop`
with full list-state handlers. The gap is that **no live path emits any of
those events**:

1. **Send**: the UI's only send path is `POST /api/messages` →
   `messagingService.sendDirectMessage` — zero emit code. The socket path
   (`message:send` → `handleSendMessage`) IS registered in `server.ts:192`,
   but no client emits it, and even that path emits to `user_${id}` rooms
   while clients join `WebSocketRooms.user(id)` = `user:${id}` (colon) —
   **dead addressing**. Same bug in `handleTypingStart/Stop`.
2. **Typing**: `MessageThread.tsx:271-276` has the emit calls commented out
   ("Will be wired to socket in a future update").
3. **Read receipts**: `POST /api/messages/read` → `markMessagesAsRead`
   persists but never broadcasts; `handleReadReceipt` on the page listens to
   silence.
4. **Thread**: `MessageThread` fetches history once over HTTP and never
   appends incoming socket messages.

Also verified: JWTs carry no `userId` claim, so `AuthenticatedUser.userId`
resolves to the **username** (`lib/websocket/auth.ts:93`) — the personal room
`user:<username>` is addressable by username, exactly how DMs are keyed.

## 2. Scope

- `lib/messagingService.ts`: broadcast seams after the two mutations —
  `sendDirectMessage` emits `message:receive` + `conversation:updated` to
  both participants' personal rooms; `markMessagesAsRead` emits `message:read`
  to both rooms. Guards: no-op when `getIO()` returns null (bare `next dev`
  has no socket server).
- `lib/websocket/messagingHandlers.ts`: replace `user_${id}` /
  `conversation_${id}` literals with `WebSocketRooms.user(id)` and the shared
  `conversation_${id}` convention so the socket path and service seams target
  the same rooms.
- `components/messaging/MessageThread.tsx`: real typing emits (debounced,
  auto-stop ~3s) via the registered `typing:start_private/stop_private`
  events; subscriptions for `message:receive` (append to open thread, skip
  own echo), `typing:start/stop` (indicator), `message:read` (flip own sent
  messages to read). Needs the socket — `useWebSocket()` cannot be nested
  inside `useWebSocketProvider`, so consume `useWebSocketContext()` directly
  (precedent: WMD panels).
- Server identity fix in the socket path stays consistent: emissions ride
  username-addressed rooms (matching `joinUserRoom(socket, user.userId)`).

## 3. Not scope

- Replacing the page's list-level handlers (already correct).
- Moving the send path onto the socket (`message:send`) — HTTP send is the
  audited, auth-hardened path; socket stays an alternative.
- Conversation-room join/leave lifecycle (personal rooms fully cover DMs).

## 4. Pins (`__tests__/api/dmRealtimeBroadcast.test.ts`)

Service-level broadcast seams on the established drizzle-simulation idiom:
`vi.mock('@/lib/websocket/server')` so `getIO()` returns a recording stub —
assert `sendDirectMessage` success emits exactly two `message:receive` +
two `conversation:updated` to `user:<sender>` / `user:<recipient>`; read path
emits `message:read` to both; **no emission on failure paths**; no-throw when
`getIO()` is null (socket-less boot).

## 5. Live probe (`scripts/e2eDmRealtimeLive.ts`)

Real server (`tsx server.ts`), two registered players, two authenticated
sockets (FID-002 driver patterns): A sends via HTTP POST → B receives
`message:receive` + `conversation:updated` with exact payloads; A emits
`typing:start_private` → B receives `typing:start`; B marks read via HTTP →
A receives `message:read`. Probe players + rows cleaned; residue zero.

## 6. Risks

- Double-append on the sender's own thread — handled by skipping own echoes.
- `getIO()` null in route-bundle module graphs — already bridged via
  globalThis in FID-20260919-002.
- Payload date shapes: `MessagingMessagePayload.createdAt` is `Date` typed but
  serializes as string over the wire — thread append constructs `Date`.

## 7. Rollback

Revert the batch; service seams are additive and isolated.

## 8. Execution

**Implementation commit:** `4362e82` — 7 files changed (+630/−9).

**Delivered (per §2, one refinement):** the broadcast logic was extracted into
`lib/messagingBroadcast.ts` (single source of truth for the room convention +
payload mappers + fault-isolated fan-out) rather than living inline in the
service — the room-addressing defect class demanded one addressable home.

**Pins:** `__tests__/api/messagingBroadcast.test.ts` 7/7 — the `user:<id>`
convention regression pin, full payload mapping, unreadCount copy semantics,
per-participant fault isolation. Full suite at close: 117 files / 1170 tests,
tsc 0, eslint clean.

**Live probe (`scripts/e2eDmRealtimeLive.ts`, 11/11 green):** two probe players,
two authenticated sockets, real HTTP send/read:
- P3 HTTP `POST /api/messages` → B receives `message:receive` (exact payload)
  AND `conversation:updated` — both previously silent paths
- P4 `typing:start_private` → B receives `typing:start`; sender-exclusion
  verified (A does not hear A)
- P5 B marks read via HTTP → A receives `message:read` with `playerId = B`
- P6 wire payload maps through `toMessagingMessagePayload` (thread contract)
- probe conversation + messages + players deleted; residue zero

**Verification note:** the first probe run failed P4a (typing timeout) because
the running `tsx server.ts` predated the messagingHandlers fix — the native
server graph does not hot-reload (Next routes do, which is why P3/P5 passed).
After restart, 11/11. Recorded so future probes don't misread stale-server
failures as code failures.

**Out-of-scope note:** `messagingHandlers.handleMessageSend` (the socket send
path) now emits to correctly-addressed rooms but still has no client emitter —
HTTP remains the only live send path, per §3.
