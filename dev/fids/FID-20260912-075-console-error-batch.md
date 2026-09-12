# FID-20260912-075 — Console Error Batch (AutoFarm, Battle Logs, Unit Factory, Messages)

**Date:** 2026-09-12 · **Trigger:** user console dump + live-surface reports.
**Corrections:** factory tile art was NOT broken (loads from
`/assets/factories/level{n}/`); the manifest warning was a background-layer
fallback reading the empty `tiles/factory/` dir.

## 1. AutoFarm position-divergence loop (the invisible walk)

Console showed the engine holding (143,3) while the server had fame at
(32,2): every "move E" succeeded server-side, the FID-063 verification
rejected it (server ≠ target), returned false — and **never adopted the
server position**. Net effect: engine stalled forever, character silently
walked east one tile per retry, ~1.5 KB pretty-printed JSON logged per tile.

Fix (`utils/autoFarmEngine.ts`):
- On mismatch, adopt the server-authoritative position (`/api/player` sync,
  falling back to the move response's own position), emit a divergence
  warning once, and let `processNextTile` recalculate from truth.
- `start()`/`resume()` now sync position from the server first — a stale
  persisted engine position can never fight the server again.
- One-line move logging replaces the full JSON dump (egress + noise).

## 2. Battle Logs page: the route never existed

`/game/battle-logs/[type]` fetched `/api/battle-logs` (2025-10-17) but only
`/api/admin/battle-logs` existed — 404 on every visit. Meanwhile the data WAS
being written: `battle_logs` holds 17 rows (fame's factory raids, INFANTRY
sparring). New route `app/api/battle-logs/route.ts` implements the page's
contract: type=perspective filter (attack→attacker, defense→defender),
viewer-relative result (a defense where the defender won renders "victory"),
UPPERCASE BattleType match for infantry, paginated, count over same
predicate. Verified live: fame vs Titan_Gamma rows returned.

## 3. Unit Factory "Uplink failed" hid the real rejection

fame is Flag Bearer → `GET /api/player/build-unit` correctly 403s with
"bearer restriction" — the page swallowed the body and rendered a dead-end
generic note. Now the page parses the response, shows
`Reason: <server message>` and, for bearer restriction, explains the rule
(drop the flag or wait for capture). Other failures (401, 5xx) surface their
real reason too.

## 4. Messages: clicking a conversation did nothing

`MessageInbox` fetched and rendered conversations but never lifted them to
the page; the page's `state.conversations` was permanently empty, so
`handleConversationSelect` logged "Selected conversation not found" on every
click and the thread never opened. The deep-link handler compounded it: a
stale `?conv=` re-fired on every inbox state update. Fixes:
- New `onConversationsLoaded` prop — inbox hands its unfiltered list up; the
  page resolves selections from real data.
- Deep links consume their params on BOTH success and not-found (one retry,
  then `router.replace('/messages')`).

## 5. Image-manifest warning dedup

`⚠️ No images found for terrain: factory` fired per tile from the
terrain-background fallback. Now once per terrain type. Artless terrain
renders the designed gradient; factory tile art itself is unaffected.

## Non-bugs in the dump
- `runtime.lastError: message channel closed` — browser extension artifact.
- Chart width(-1) warning — recharts measuring before layout; pre-existing.

## Verification
- tsc 0 · eslint 0 · vitest **574 passed** · build exit 0.
- Live: `/api/battle-logs?username=fame&type=attack` 200 with real rows;
  single server process on :3000 (custom server owns the port — `next start`
  duplicate removed).
