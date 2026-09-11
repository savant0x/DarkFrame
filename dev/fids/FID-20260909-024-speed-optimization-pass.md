# FID-20260909-024: Speed optimization pass — client re-render, cache tiering, hot-path I/O

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-024-speed-optimization-pass.md`
**ID:** FID-20260909-024
**Severity:** MEDIUM (performance debt compounding across client render, cache, and hot-path I/O; two latent production-reliability bugs found by the audit)
**Status:** converged (implemented + gated)
**Created:** 2026-09-09

---

## 1. Summary

Operator request: "optimize the game for speed if possible, find anything we can finetune." A read-only
audit across DB layer, API hot paths, client rendering, server runtime, and build config, followed by
implementation of the safe, high-value wins. All hand-edited. Two latent reliability bugs surfaced during
the audit (import-time DB access exhausting the build pool; a cache layer that silently no-oped without
Redis) and were fixed at the root.

---

## 2. Audit findings (what was measured, what was wrong)

### §2.1 Client: provider value identity (the big one)
`GameContext.Provider` built its `value` object literal fresh on **every provider render**. With ~30
consuming components (every panel, page, and modal), each provider state change (`setIsLoading` on every
move/harvest, tile updates from auto-farm, error toasts) re-rendered the entire tree of consumers. Same
pattern (lower blast radius) in `WebSocketContext`.

### §2.2 Cache: Redis-only tier = no cache in practice
`lib/cacheService.ts` returned null/false from **every** operation when Redis was unavailable. Consequences:
- Dev and any Redis-less deployment: leaderboard 300s cache, player-profile caches, etc. **never cached** —
  every request hit the DB directly.
- Even with Redis up: every read paid a Redis round-trip (no local tier).
- `getCacheOrFetch` had no single-flight dedupe: a cold cache plus a request burst = N concurrent heavy
  queries for the same key (cache stampede).

### §2.3 Hot path: `/api/move` per-move I/O and log tax
- The route logged the **entire success response** (full player object + tile) at INFO level on every move,
  plus ~10 INFO-level tutorial diagnostics per move. INFO is production-visible — this is per-move log I/O
  and serialization cost on the hottest endpoint in the game.
- `movePlayer` (service) also `console.log`'d every move.
- Redundant pre-read: the route fetched `playerBefore` (one `findOne`) only to know the old position —
  while `movePlayer` immediately re-fetched the same player row internally. (Left in place this pass —
  removing it would change `movePlayer`'s contract; recorded for the next touch.)

### §2.4 Latent bug: import-time DB access (found by the build)
`lib/chatService.ts` called `loadCustomBlacklist()` **at module import**. During `next build`, every
prerender worker imported the module → concurrent DB queries → Supavisor session-pool exhaustion
(`EMAXCONNSESSION, pool_size 15`) → repeated `Failed to load custom blacklist` failures during prerender.
Same failure mode would occur on any cold serverless burst.

### §2.5 Build config
No `compress`/`poweredByHeader`/source-map posture pinned.

### §2.6 Verified healthy (no action)
- pg pool deliberately sized for Supavisor session mode (documented in `lib/db/connection.ts`).
- 163 indexes across migrations; tutorial hot-path queries are index-backed (unique `(player_id, step_id)`).
- Redis wiring exists for leaderboard/cache-stats/ask-veterans.
- Tutorial progress short-circuit: one indexed query for graduated players (acceptable).
- Static prerendering already enabled for most routes.

---

## 3. Root Cause

§2.1: React Context identity semantics — inline object literals defeat shallow consumer bail-out.
§2.2: fail-closed cache design treated "Redis unavailable" as "no cache possible" instead of degrading to
the next tier.
§2.4: module side-effects performing I/O; safe under `next dev`, catastrophic under parallel prerender.

## 4. Impact

- §2.1: per-move full-tree consumer re-render (30+ subtrees) — the dominant client-frame cost during play.
- §2.2: every "cached" endpoint = uncached; stampede amplification under bursts.
- §2.3: per-move log serialization + I/O on the hottest route; log noise in production.
- §2.4: build-time pool exhaustion (observed in build output); latent cold-start 500 risk.

## 5. Implemented fixes

### §5.1 Client stable-identity (§2.1)
- `context/GameContext.tsx`: all handlers (`loadTileData`, `loadPlayerData`, `movePlayer`,
  `refreshGameState`, `refreshPlayer`, `updateTileOnly`, `logout`) converted to `useCallback` consts with
  real dependency chains; `playerRef` lets move/refresh handlers read live player without identity churn;
  provider `value` wrapped in `useMemo` keyed on actual data. The session-check effect moved below the
  loader declarations (TDZ fix). Consumers re-render only on genuine state transitions.
- `context/WebSocketContext.tsx`: `value` memoized (`socket`, `connectionState`, `error` keyed;
  reconnect/disconnect already stable).
- Net lint effect: the 3 warning baseline **dropped to 2** (the refactor's dependency chain satisfied the
  hook rules honestly — no new suppressions).

### §5.2 Two-tier cache + single-flight (§2.2)
`lib/cacheService.ts`:
- L1 process-local memory tier (pre-serialized strings, TTL-aware, 500-entry cap with lazy sweep and
  insertion-order eviction) in front of Redis L2. Written through on every set; checked first on every get;
  invalidated on delete/pattern-delete/flush. Redis hits backfill L1 with their remaining TTL.
- Coherence note recorded: the game runs as a single server process (server.ts owns socket.io), so a
  process-local L1 is coherent with these write-through paths.
- `getCacheOrFetch` gained single-flight dedupe (in-flight promise map, cleaned in `finally`).
- `getCacheMultiple` reworked: L1 pass, Redis `mget` only for misses, TTL-aware backfill.
- Stats counters unchanged; `flushAllCache` also clears L1 (dev-only).

### §5.3 Move-route log diet (§2.3)
`app/api/move/route.ts`: full-payload outgoing-response log and all per-move tutorial diagnostics
(INFO) → `log.debug` (dev-visible, production-silent). Lifecycle events kept at INFO: move tracked/
completed, target generated, auto-complete, movement completed, speed-hack warnings, errors.
`lib/movementService.ts` per-move `console.log` → `logger.debug` (dev-gated; no-console guard holds).

### §5.4 Lazy blacklist load (§2.4)
`lib/chatService.ts`: removed the module-import DB call; the blacklist now loads lazily (cached; no-op
after first load) from the two filter entry points, and `reloadChatBlacklist()` is unchanged for admin
flows. Build output: `EMAXCONNSESSION` failures eliminated.

### §5.5 Build config (§2.5)
`next.config.js`: `compress: true`, `poweredByHeader: false`, `productionBrowserSourceMaps: false`.

## 6. Verification

- `tsc --noEmit`: **0 errors**
- `eslint .`: **0 errors / 2 warnings** (both pre-existing `exhaustive-deps`, untouched; was 3)
- `vitest run`: **369 passed / 1 skipped**
- `next build --webpack`: compiles successfully; **zero** `EMAXCONNSESSION` / blacklist-load failures
  (previously spammed every prerender)
- `no-console` guard: still green; suppressions added: **0**

## 7. Known Limitations & Side Effects

- L1 cache is per-process: in a future multi-instance deployment, delete/pattern invalidation clears only
  the local process's L1 (Redis L2 remains the shared source of truth; worst case is an L1 entry living
  until its TTL expires). Acceptable for the current single-process topology, documented in-code.
- The move-route redundant `playerBefore` read (§2.3) is intentionally retained — removing it changes
  `movePlayer`'s return contract; deferred to the next substantive touch of that route.
- Log-diet changes are observable: per-move tutorial chatter now requires `LOG_LEVEL=DEBUG`.

## 8. Follow-ups / Prevention (deferred, recorded)

- Dedupe the move-route pre-read by extending `movePlayer` to return the prior position.
- Consider HTTP caching headers for the tile/terrain map endpoints (immutable terrain data).
- Rework `next.config` images/asset caching policy review when static assets move to a CDN.
- Polling consolidation (WS-event-driven refresh) remains open from FID-023 §3.8 beyond the visibility gates.

## 9. Closure

Closed — implemented and gated same session. Commit plan: single commit with FID-023 work, or separate
`perf(game): FID-20260909-024 …` commit; operator preference at staging time.
