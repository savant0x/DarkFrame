# FID-20260912-079 — WebSocket broadcasts: the lost-`this` crash

**Date:** 2026-09-12
**Request:** Fix the pre-existing `broadcastToLocation` crash ("Cannot read properties of undefined (reading 'adapter')") so player-online pings reach nearby players.

## 1. Root cause (reproduced in isolation)

`emitTyped` (lib/websocket/broadcast.ts) did:

```ts
const emit = io.to(room).emit as (...) => void;
emit(event, payload);          // ← detached call
```

Extracting `.emit` into a variable and invoking it **detached** loses `this`.
socket.io's `BroadcastOperator.emit` reads `this.adapter` →
`undefined.adapter` → TypeError. Reproduced against a real socket.io 4.8.3
Server in three lines.

Because every broadcast helper wraps itself in `try/catch` + `console.error`,
the failure was **completely silent**: the error was logged, execution
continued, and no event ever reached any client. The production log showed
**6 failures, 0 successes** — not just player-online: tile updates, clan
events, and global broadcasts were ALL dead. The entire WebSocket event fanout
was a no-op.

## 2. Fix

`emitTyped` now invokes the emit as a member call (`io.to(room).emit(...)`),
preserving `this`. socket.io's overloaded emit cannot resolve a generic event
key, so the operator is widened to `any` on that single audited line — the
payload contract is still enforced by `emitTyped`'s own signature, and every
call site stays fully typed (the helper exists precisely to centralize this).

## 3. Tests

`__tests__/lib/websocketBroadcast.test.ts` (node env pragma — jsdom breaks
socket.io-client) drives a **real** socket.io server + client:
- `broadcastToAll` delivers to a connected client (would timeout pre-fix)
- `broadcastToLocation` delivers to room members — the exact player-online
  path from `handlePlayerOnline`
- room joins registered before `listen()` (race-free fixture)

## 4. Live verification

Server restarted on the new build; browser reconnected:
```
[Game Handler] fame came online at (131,5)
[Broadcast] Event 'game:player_online' sent to location (131,5)
```
`Failed to broadcast` count since restart: **0**.

## 5. Gates

tsc 0 · eslint 0 · vitest **595** (2 new) · build exit 0.
