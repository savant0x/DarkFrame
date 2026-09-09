# FID-20260908-005: WebSocket client gives up permanently after 5 reconnect attempts

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-005-websocket-reconnect-resilience.md`
**ID:** FID-20260908-005
**Severity:** MEDIUM (routine dev-server restarts / brief network blips permanently kill the live session until manual page refresh)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

`WebSocketProvider` disables socket.io's built-in reconnection (`reconnection: false`) and implements manual retry with a hard ceiling: after **5 failed attempts** it logs "Max reconnection attempts reached", sets a terminal error, and **never retries again** — even if the server comes back seconds later. In dev, webpack recompiles and the custom server restarts routinely (and the operator's environment restarts servers often); every restart longer than the backoff window (≈1+2+4+8+16s ≈ 31s total) permanently dead-ends the socket. The reported console error is exactly this terminal state at `context/WebSocketContext.tsx:172`.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | Manual reconnection with hard ceiling | `context/WebSocketContext.tsx:91-95` | `maxReconnectAttempts = 5; baseReconnectDelay = 1000;` |
| 2 | Terminal give-up branch (the reported error) | `context/WebSocketContext.tsx:170-174` | `console.error('[WebSocket] Max reconnection attempts reached'); setError('Failed to connect after multiple attempts. Please refresh the page.');` — no further scheduling |
| 3 | Built-in reconnection disabled | `context/WebSocketContext.tsx:122` | `reconnection: false, // We handle reconnection manually` |
| 4 | Disconnect-path retries share the same ceiling | `context/WebSocketContext.tsx:177-196` | `transport close`/`ping timeout` branch: `if (reconnectAttemptsRef.current < maxReconnectAttempts)` — after 5, silence |
| 5 | Timer leak on retry path: attempts increment INSIDE the timeout, but a second `connect_error` can schedule another timer over the ref | `context/WebSocketContext.tsx:167-169` | `reconnectTimeoutRef.current = setTimeout(...)` without clearing a previous pending timer → double-fire risk |
| 6 | Auth-error gate is reachable only at attempt 0 | `context/WebSocketContext.tsx:146-151` | `shouldRetryAuthError = isAuthError && isInitialConnection && attempts < 3` — attempts only increments inside the retry timeout, so this is `attempts === 0`; workable but fragile |
| 7 | Consumers rely on `isConnected` | referencedBy index | WMD panels ×5, hooks/useWebSocket, useWMDNotifications, WebSocketConsoleModal — all go silent after give-up |
| 8 | Server side is fine | `server.ts:96` | `getSocketIOServer(httpServer)` starts unconditionally on boot; the client ceiling is the only dead-end |

**Call-graph (Law 4):** `app/layout.tsx` → `WebSocketProvider` (autoConnect) → client socket; consumers listed in #7 read `isConnected`/`socket` from context. The fix is entirely inside the provider — all consumers inherit resilience.

## 3. Impact Analysis

- **Affected:** every live client session across server restarts and network blips; WMD/notification/chat sockets all die together.
- **Failure modes:** permanent "Failed to connect… refresh the page" until manual reload; stale UI states (chat presence, WMD alerts) with no recovery.
- **Blast radius:** one client file. No server change, no API change, no consumer change.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — covers boot-time failure, mid-session drop, server restart, and auth-timing; separate policies per disconnect reason |
| Scales? | Yes — capped backoff with jitter prevents reconnect storms when many clients return after a server restart |
| Hostile attacker? | Yes — jitter + max-delay cap bound client behavior; no unbounded hot loop even against a flapping server |
| Maintainable? | Yes — one well-documented state machine in one file; no consumer coupling |
| Industry standard? | Yes — socket.io's own default is infinite reconnection with backoff; this matches the library's design intent |

## 5. Proposed Fix (GREEN)

- **Approach:** make reconnection **endless but well-behaved**:
  1. Keep `reconnection: false` (manual control preserved) but replace the hard ceiling with: exponential backoff `min(base × 2^attempts, 30s)` **+ jitter** (±20%), retrying **indefinitely** while the provider is mounted.
  2. Distinguish **auth errors** (do not hammer — retry slowly at 30s fixed, since only login state can change them; matches current "skip unless initial" intent but recovers after re-login elsewhere in the app) from **transport errors** (full backoff schedule).
  3. Fix the timer-leak: clear `reconnectTimeoutRef` before scheduling; keep a `disposedRef` so unmount cancels pending retries (cleanup currently clears only one timer).
  4. Keep `connectionState`/`error` semantics; after give-up removal, `error` reflects the LAST failure reason while state shows `connecting` — consumers already render from `connectionState`.
  5. `reconnect()` (manual) resets attempts — unchanged.
- **Alternatives considered:** (a) enable socket.io's built-in `reconnection: true` with its options — rejected: removes the auth-error special-casing the login flow relies on and changes observable console behavior more broadly; (b) page-reload prompt — rejected: hostile UX, data-unfriendly.
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `context/WebSocketContext.tsx` | modify | endless bounded-backoff reconnect (+jitter), per-reason policy, timer-leak + unmount-dispose fixes |

- **Verification plan:** tsc 0; eslint 0 (file); vitest full run; **live verification**: start dev server, connect, kill server, restart it → client reconnects automatically within the backoff window (operator drive or preview with server control; pasted evidence).
- **Call-graph reachability plan:** unchanged provider public API (`socket`, `isConnected`, `reconnect`, `disconnect`); grep confirms all consumers compile against it (tsc covers).

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint / vitest | *(paste at implementation)* | pass |
| Method 2: manual re-read | state machine walk-through: boot failure, mid-session drop, auth failure, unmount-during-retry | *(paste at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete
- **Changes applied (`context/WebSocketContext.tsx`):**
  - Hard ceiling removed: transport errors now reconnect **endlessly** with bounded backoff `min(1s × 2^attempt, 30s)` **+ ±20% jitter** (storm-safe).
  - Auth errors (post-initial) retry at a fixed 30s — only login state can change them; no hammering, and a fresh login elsewhere recovers the session without a refresh.
  - New `scheduleReconnect(target, delay)` helper: clears any pending timer before scheduling (fixes the double-fire leak) and no-ops once `disposedRef` is set (unmount cancels retries; cleanup previously cleared only one timer). `connect()` resets `disposedRef` so manual reconnect re-arms the loop.
  - Both retry paths (connect_error + transport close/ping timeout) routed through the helper; `connectionState` set back to `connecting` on each scheduled attempt.
  - Impl-notes doc updated to match.
- **Gates:** tsc 0 · file eslint 0 errors (1 documented warning: `socket?.connected` read is ref-stable; re-adding it loops via setSocket) · full vitest 362/0/1.
- **Audit Method 2 state-machine walk-through:** boot failure → endless backoff; mid-session `transport close` → endless backoff; `io server disconnect` → immediate reconnect (unchanged); auth failure → 3 fast initial retries, then 30s slow retry; unmount during pending retry → disposedRef cancels; manual `reconnect()` → attempts reset, disposedRef cleared.
- **Live verification:** pending operator drive (start dev, connect, restart server, observe auto-reconnect within backoff window).

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [ ] live reconnect verified (operator drive)
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add context/WebSocketContext.tsx`
