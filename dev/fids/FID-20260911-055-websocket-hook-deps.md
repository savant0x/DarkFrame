# FID-20260911-055 — WebSocket Hook Deps: Stale-Closure & Ref-Cleanup Fixes

**Date:** 2026-09-12 · **Follows:** FID-054 · **Trigger:** the last two
`react-hooks/exhaustive-deps` warnings in the repo, both in reconnect-critical
code.

## Why these mattered (not lint noise)

### 1. `context/WebSocketContext.tsx` — stale `socket` in `connect()`

`connect` read `socket?.connected` but its dependency array excluded
`socket` (with a comment admitting re-subscription loops). Consequence: the
closure captured the **first-render** socket forever. After any reconnect
produced a *new* socket object, `connect()` would still evaluate the guard
against the old identity — on a manual `reconnect()` chain it could see
"not connected" and create a **duplicate connection**. Fixed with a
`socketRef` mirror, synced at the single `setSocket(newSocket)` site;
`connect` now reads `socketRef.current?.connected`. The dep-array exclusion
stays (it is correct — the ref removes the *need* for the dep), and the
misleading old comment was replaced.

### 2. `hooks/useWebSocket.ts` — `listenersRef.current` read in cleanup

The unmount cleanup dereferenced `listenersRef.current` at cleanup time.
React may re-run effects with a *new* ref object, so the cleanup could
iterate an empty/new map and leak every handler registered on the live
socket (silent ghost listeners after HMR or any effect re-run). Fixed with
the lint's own prescription: snapshot `const listeners = listenersRef.current`
in the effect body and close over that exact map.

## Verification

- `npx eslint .` — **repo-wide silence: 0 errors, 0 warnings** (first time
  since the warnings appeared)
- tsc 0 · vitest 509 passed / 1 skipped · build exit 0
- No behavior change on the happy path; the two fixes close the
  duplicate-connection and leaked-listener failure modes precisely.
