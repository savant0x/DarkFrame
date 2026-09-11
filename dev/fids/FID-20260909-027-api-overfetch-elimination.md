# FID-20260909-027: API over-fetching — polled endpoints ship full histories where deltas/ids/projections would do

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-027-api-overfetch-elimination.md`
**ID:** FID-20260909-027
**Severity:** HIGH (a 10-second-cadence poll ships the full 100-message history continuously; an admin endpoint ships up to 10,000 rows per open)
**Status:** converged
**Created:** 2026-09-09

---

## 1. Summary

Follow-up to the terrain-grid compaction (FID-20260909-026 §5): a full census of the 224 API
routes for over-fetching — full objects where ids or compact forms would do, repeated
coordinates, unbounded arrays, client-side filtering of server data. Three offenders
confirmed and remediated below; several endpoints audited clean.

---

## 2. Census results (full sweep)

### 2.1 Offenders (remediated this FID)

| # | Endpoint / consumer | Defect | Impact |
|---|---|---|---|
| 1 | `GET /api/clan/chat/messages` ← `components/clan/ClanChatPanel.tsx` | Panel polls **every 10 s** with `?limit=100` and replaces the whole list — while the service layer's purpose-built delta API (`getMessagesSince`, consumed by `GET /api/clan/chat?since=`) is **never called by the live panel**. Route has no `since` passthrough. | Active clan chat re-downloads 100 full messages 6×/min for typically zero new messages. |
| 2 | `GET /api/admin/battle-logs` ← `components/admin/BattleLogsModal.tsx` | `.limit(10000)` rows shipped in one JSON; modal client-side filters (player/outcome/date) and paginates **25 per page**. | Up to ~1.5–3 MB per modal open, 99% never displayed; full-table scan to JS on every open. |
| 3 | `GET /api/admin/flagged-players` | `db.select().from(playerFlags)` **unbounded**, then filters (flagType/severity/resolved) in JS. | Full-table transfer per admin view; filters unindexable. |

### 2.2 Audited clean (no action)

- `GET /api/player` (main poll): `sanitizePlayer` allowlist projection; client throttles to ≥2 s. OK.
- `GET /api/clan/activity` (TopNavBar 30 s poll): ships `limit=1`. OK.
- `GET /api/beer-bases/list`: unscanned rows projected to `{username, powerTier, distance, scanned}`. OK.
- Terrain: compacted in FID-026 §5 (~98% cut). OK.
- Legacy `components/ClanChatPanel.tsx` has **zero mounters** (dead code) — its 5 s delta poller is the pattern the live panel should adopt. Flagged for the dead-kit retirement list.

### 2.3 Noted, not remediated (residual, recorded)

- `admin/analytics/session-trends` pulls all sessions into JS for histogram bucketing. Wire payload is aggregate-only (fine); the over-fetch is DB→app. SQL-side duration bucketing is possible but date-arithmetic drift risk outweighs the win on an admin-only route.
- `getMessagesSince` (delta SQL) has no LIMIT; chat volume bounds it in practice. Belt-and-braces: the route re-syncs to a full fetch if a delta exceeds 200 rows.

---

## 3. Remediation contract

### 3.1 Chat delta poll (item 1)

- `/api/clan/chat/messages` gains `?since=<ISO>`: when present, resolves via `getMessagesSince`
  and applies the same `sender*` aliases as the full fetch. `since` + `limit` together → 400
  (ambiguous contract is worse than none).
- `ClanChatPanel`: initial load keeps `limit=100` and records the newest message timestamp;
  the 10 s interval calls a new `pollNewMessages` with `?since=`, **appending** new messages
  (id-deduped) and advancing the cursor. No behavior change visible to users.

### 3.2 Battle-logs server-side query (item 2)

- Route gains `player`, `outcome`, `dateFrom`, `dateTo`, `page`, `limit` (default 50, cap 200)
  and `export=all` (the CSV/JSON download case; caps at 10,000 as before). SQL:
  `or(ilike(attacker, %p%), ilike(defender, %p%))`, `eq(outcome)`, `gte/lte(timestamp)`;
  count via a parallel `count()` query. Response keeps `{ logs, total }` shape (total =
  filtered count; logs = one page) plus `page/limit` echo.
- Modal: filters + pagination move to the query string (300 ms debounce on text input);
  export refetches with `export=all` and the current filters.

### 3.3 Flagged-players SQL filters (item 3)

- `flagType`/`severity`/`resolved` filters move into the WHERE clause with the legacy-jsonb
  fallback preserved in SQL: `(flag_type = X OR details->>'flagType' = X)`, and for resolved:
  `(resolved = 1 OR details->>'resolved' = 'true')`. JS grouping retained over the filtered set.

---

## 4. Non-goals

- No wire-format compaction (charmaps) for these endpoints — JSON field reduction and
  delta/pagination are the correct levers here; terrain-style charmaps apply to grids only.
- No change to rate limits or auth surfaces.

---

## 5. Implementation log

Hand-edited, file by file. No scripts.

- `app/api/clan/chat/messages/route.ts` — `?since=<ISO>` delta mode via `getMessagesSince`; `since`+`limit` → 400; malformed `since` → 400; delta >200 rows re-syncs to the full 100-message window with `resync: true`; shared `toWire` mapper applies `sender*` aliases uniformly in both modes.
- `components/clan/ClanChatPanel.tsx` — new `pollNewMessages` (delta cursor = index 0 of the DESC list; prepends id-deduped reversed delta, preserving the newest-first render contract); `resync: true` replaces state outright; the 10 s interval now calls the delta poll (full window remains on mount + manual refresh button); interval effect deps updated.
- `app/api/admin/battle-logs/route.ts` — `player` (ilike on attacker OR defender), `outcome` (enum-validated → 400 on unknown), `dateFrom`/`dateTo` (validated ISO) pushed into SQL WHERE; filtered `count()` + `limit`/`offset` pagination (default 50, cap 200); `export=all` preserves the bulk path (10,000 cap) with shared mapper extracted to `mapBattleLogForAdmin`; response keeps `{ logs, total }` + `page`/`limit` echo; file header docs rewritten.
- `components/admin/BattleLogsModal.tsx` — client-side filter effect deleted; `fetchBattleLogs` builds the query string (300 ms debounce on the player search; non-text filters reset to page 1); `totalPages` derives from the server `total`; export refetches with `export=all` + current filters (busy state on the button); header shows the filtered total.
- `app/api/admin/flagged-players/route.ts` — flagType/severity/resolved filters moved into the WHERE clause with jsonb fallbacks in SQL (`details->>'flagType'` etc.); JS grouping retained over the filtered set.
- Tests: `__tests__/api/clan/chat-delta.test.ts` (6) + `__tests__/api/admin/battle-logs.test.ts` (5) — delta contract, mutual exclusion, resync belt, alias mapping, filtered-total contract, enum/date validation, admin gate, export path.

---

## 6. Gates

- `tsc --noEmit`: 0 errors
- `eslint .`: 0 errors (2 pre-existing warnings)
- `vitest run`: **398 passed / 1 skipped** (11 new regression tests)
- `next build`: exit 0, 238/238 pages, 0 prerender errors
- 0 suppressions added

---

## 7. Residuals & follow-ups

- Dead `components/ClanChatPanel.tsx` → dead-kit retirement list.
- Session-trends SQL bucketing (§2.3).
- `getMessagesSince` LIMIT belt (§2.3) — implemented in the route's re-sync guard.
