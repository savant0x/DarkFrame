# FID-20260919-002 — Chat real-time client wiring: message, typing, online count (+ deletion) against the live socket emissions

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-19
**Origin:** Operator directive from the product survey (P1): "chat is real-time on
the server, polled on the client — wire the client subscriptions."

## 1. Ground truth

**Server (live layer — `lib/websocket/chatHandlers.ts`, wired in `lib/websocket/server.ts` connection handler):**
- `chat:message` → ChatMessage wire object (id/channelId/senderId/senderUsername/
  senderLevel/isVIP/message/timestamp/edited/editedAt) — NOTE: this is the
  `/api/chat` wire shape, NOT the declared `ChatMessagePayload` (messageId/content/
  userId fields). The server emits through the untyped `Server`, so this drift is
  silent; the client subscription must map the REAL wire shape (same boundary the
  HTTP poll already documents).
- `chat:typing_start` / `chat:typing_stop` → `{ channelId, clanId?, username }`
  (typing excludes the sender server-side: `socket.to(room)`).
- `chat:online_count` → `{ channelId, clanId?, count }`, re-broadcast on join.
- `chat:message_deleted` → `{ messageId, channelId, deletedBy, reason }`.
- Rooms: clients are AUTO-JOINED to every accessible channel room on connect
  (`autoJoinChatChannels`); the client never needs `chat:join_channel`.
- Client→server declarations for typing exist and are wired server-side:
  `chat:start_typing`/`chat:stop_typing` (`{ channelId }`).

**Dead layer (do not wire):** `lib/websocket/handlers/chatHandler.ts` +
`broadcast.ts`'s `chat:typing`/`chat:member_online` emissions — never registered
in server.ts; their type-map declarations are what misled the type surface.

**Client today (`components/chat/ChatPanel.tsx`):**
- Messages: 2s HTTP poll with since-cursor, merged by id into a per-channel Map.
- Typing: 2s HTTP poll (`/api/chat/typing`) + POST on keystroke; the stop timer
  is an explicit NO-OP ("MongoDB TTL will auto-delete") — Mongo era residue.
- Online count: 30s poll (`/api/chat/online`, also feeds @mention list).
- Send: HTTP POST → server emits to the room INCLUDING the sender → any socket
  subscription will see the sender's own message; the id-dedupe merge already
  makes this idempotent.
- Zero `socket.on` subscriptions; `useWebSocketContext`/`hooks/useWebSocket`
  infra is live and provider-mounted at `app/layout.tsx:47`.

## 2. Spec

1. **Type map** (`types/websocket.ts`): add the three live emissions the map
   lacks — `chat:typing_start`, `chat:typing_stop`, `chat:online_count` — with
   the exact server payload shapes. Legacy declarations (`chat:typing`,
   `chat:member_online`) stay: they are true of the not-yet-deleted dead layer;
   pruning it is separate hygiene.
2. **Pure wiring module** (`lib/chatSocketWiring.ts`): the subscription state
   transitions as pure, pinnable functions over ChatPanel's Map-shaped state:
   `mergeSocketMessage`, `applyTypingStart`, `applyTypingStop`,
   `applyOnlineCount`, `applyMessageDeleted`. Message merge reuses the poll's
   id-dedupe semantics (socket messages are idempotent with polled ones);
   typing filters self and dedupes by username; deletion removes by id.
3. **ChatPanel subscriptions** (one `useEffect` keyed on socket identity):
   `chat:message` → merge into the payload's channel (unread++ when background);
   typing start/stop → per-channel typing map; `chat:online_count` → count map;
   `chat:message_deleted` → remove. Active channel read via a ref (subscribe
   once — no listener churn on channel switch).
4. **Typing emits**: `handleTyping` emits `chat:start_typing`; the stop timer
   now emits `chat:stop_typing` (replacing the TTL no-op comment). HTTP typing
   POST stays (powers the poll backstop + API truth).
5. **Poll cadence** (socket is primary, HTTP is the gap-filler): messages 2s →
   10s; typing 2s → 10s; online count stays 30s (it also feeds the mention list).

## 3. Perfection-loop self-check

- Double-append on send? No — server emits to the sender's room too, but merge
  is by id and the poll dedupes the same way; HTTP-send path unchanged. ✓
- Stale activeChannel closure? Handlers read `activeChannelRef` (subscribed
  once per socket identity). ✓
- Socket null / reconnect? Subscriptions keyed on socket identity — resubscribe
  when the provider hands over a new connected socket. ✓
- Self-typing echo? Server already excludes the sender (`socket.to(room)`); the
  wiring filters self again defensively. ✓
- Behavior change risk? Polls remain as backstops at reduced cadence — worst
  case (socket down) equals today's behavior, slower. ✓

## 4. Pins (`__tests__/lib/chatSocketWiring.test.ts`)

Pure-function pins: socket message merges + dedupes against polled messages and
lands in the right channel; background-channel receipt increments unread exactly
once; typing start dedupes and filters self; typing stop removes only that user;
online count sets the right channel; deletion removes the message. Plus a
component-level render pin: ChatPanel registers all four `socket.on` handlers
(mocked WebSocketContext) and re-registers on socket identity change.

## 5. Live probe (`scripts/e2eChatSocketLive.ts`)

Two socket.io-client sessions against the real custom server (`npm run
dev:server` on :3003): session A subscribes and counts `chat:message`,
`chat:typing_start/stop`, `chat:online_count`; session B sends a message via
HTTP POST (same as the game client) and a typing emit. Assertions: A receives
B's message over the socket within 2s (before the 10s poll could), typing
start/stop arrive, online count arrives. Deletes its own messages, residue zero.

## 8. Execution

**Implementation commit:** `d1b390b` (chat wiring batch) — see CHANGELOG 0.0.15.

**Pins:** `__tests__/lib/chatSocketWiring.test.ts` — 16/16 green (wire mapping incl.
isVIP/senderIsVIP alias, id-dedupe identity preservation, per-channel typing scoping,
self-filter, deletion sweep identity semantics). Full suite at close: 116 files /
1163 tests, tsc 0, eslint clean.

**Live probe (`scripts/e2eChatSocketLive.ts`, 12/12 green):** two authenticated socket
sessions + HTTP player C against the real custom server (tsx server.ts :3003 —
Next + socket.io, the production mount):
- P3 send ack + `chat:message` wire object received by B (exact id/channel/sender)
- P4 typing_start/stop received by B; **sender-exclusion verified** (A does not hear A)
- P5 `chat:online_count` for newbie on C's join (count reflects room size)
- P6 `DELETE /api/chat/delete` → B receives `chat:message_deleted` with the id
- P7 the real wire object round-trips `wireToChatMessage` + `mergeSocketMessage`
  idempotently (echo/poll dedupe)
- probe players deleted; residue zero

**Out-of-scope defects found and fixed under this FID (all live-verified):**
1. **Listener-registration window (server.ts):** the async connection handler awaited
   `autoJoinRooms` / `autoJoinChatChannels` / `handlePlayerOnline` BEFORE registering
   any event listeners — every client emit arriving in that DB-bound window was
   silently dropped (first probe run: send ack never fired). Listeners now register
   synchronously first; async setup runs after.
2. **Delete-notify dead path:** `notifyMessageDeleted` had zero callers; the delete
   route carried `// TODO: Emit WebSocket event`. Wired via `getIO()` into the
   route's success path.
3. **Module-graph split (webpack route bundles):** a route importing
   `lib/websocket/server.ts` gets its own module copy with `io === null`, so
   `getIO()` returned null inside `/api/chat/delete` even with the socket server
   running (probe P6b timeout). Instance now bridged via `globalThis` so both
   module graphs share the singleton. Verified live: P6b green after the bridge.
4. **Stale S2C type map:** declared `chat:typing` / `chat:member_online` events that
   no live code emits; real emissions (`chat:typing_start/stop`, `chat:online_count`)
   were untyped. Map corrected to server truth; the dead parallel layer
   (`handlers/chatHandler.ts` + `broadcastTypingIndicator`/`broadcastMemberOnlineStatus`,
   zero external consumers) deleted.
5. **Client-emit payload honesty:** ChatPanel's typing stop was a no-op and the
   modal sent `userId`/`username` (ignored — server derives identity from the
   authenticated socket). Emits now `chat:start_typing`/`chat:stop_typing` with
   `{ channelId }` only, with HTTP fallback pre-connection.

**FID-017 §8 residue note:** `getIO()`'s import of `lib/websocket/server.ts` inside a
route handler is the documented webpack-bundle workaround, not shim residue.
