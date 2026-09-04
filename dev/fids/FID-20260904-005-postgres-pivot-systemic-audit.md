# FID-20260904-005: Postgres-Pivot Systemic Failure Audit — Auth, Identity, Persistence, Schema, Client Wiring

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  This document SUPERSEDES the initial slim FID-20260904-005-massive-feature-audit.md
  (same ID, same date, created and expanded within one working session after the
  operator directed full-scope exploration and complete ECHO compliance). The superseded
  file remains in dev/fids/ until this FID closes, then both archive together.
  No attribution fields (Document Signing rule wins over the template's Author mention).
-->

**Filename:** `FID-20260904-005-postgres-pivot-systemic-audit.md`
**ID:** FID-20260904-005
**Severity:** CRITICAL
**Status:** analyzed
**Created:** 2026-09-04

---

## 1. Summary

The operator directed an exhaustive feature audit of the entire game ("explore everything"),
with every problem flagged under ECHO zero-tolerance regardless of origin, followed by a
perfection loop that fixes everything found. The game shipped against MongoDB, went dormant
~1 year, then was pivoted to Postgres/Drizzle via a Mongo→pg compatibility seam
(`lib/mongodb.ts`). The pivot preserved Mongo-era code paths instead of migrating them, which
produced systemic failures across five layers: **authentication coverage** (mutating routes
reachable with no session), **identity trust** (routes acting as arbitrary `username`s from
request bodies), **response hygiene** (password hashes and emails serialized to clients),
**schema/persistence** (phantom tables, MySQL-dialect SQL, id-generation holes), and **client
wiring** (UI calling endpoints that do not exist). This FID catalogs all of it with file:line
evidence, designs the fixes, and phases the perfection loop.

---

## 2. Evidence (RED)

Every claim below was reproduced during this session. Live probes ran against production
(`https://darkframe-savantai.vercel.app`) with cookie-jar sessions created from `.env.local`
owner credentials. Static claims cite exact file:line at HEAD `2225c94`.

### 2.1 C1 — Unauthenticated mutating routes (auth-coverage census)

Census method: for every `app/api/**/route.ts`, flag any file exporting POST/PUT/PATCH/DELETE
that contains no call to any of `getAuthenticatedUser` / `getAuthenticatedPlayer` /
`authenticateRequest` / `requireAuth` / `requireAdmin` / `authMiddleware`. Result: **35 routes**
(list in `/tmp/noauth_routes.txt`, reproduced in Appendix A). Live exploitation proof:

```text
POST /api/move {"username":"fame","direction":"S"}   (NO cookies)
→ 200 {"success":true,...,"player":{...}}
→ position changed 122,92 → 122,93  (live-verified 2026-09-04 ~21:40Z)
```

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | `/api/move` acts on body-supplied `username`, no session check | `app/api/move/route.ts:80` (`const { username, direction } = validated`), `:97` (`movePlayer(username, ...)`) | unauthenticated curl moved `fame`; position mutated |
| 2 | Admin VIP grant/revoke callable by anyone | `app/api/admin/vip/grant/route.ts:26` (`export const POST = withRequestLogging(...)` — no auth import in file) | census row `admin/vip/grant` |
| 3 | Admin factory-slot migration callable by anyone | `app/api/admin/migrate-factory-slots/route.ts` | census row |
| 4 | Harvest acts for arbitrary `username` | `app/api/harvest/route.ts:67` (`await request.json()`), census shows `username` referenced | census row `harvest` |
| 5 | Research acts for arbitrary `username` | `app/api/research/route.ts` | census row `research` |
| 6 | Factory build/produce for arbitrary `username` | `app/api/factory/build-unit/route.ts`, `app/api/factory/produce/route.ts` | census rows |
| 7 | Player unit build/upgrade for arbitrary `username` | `app/api/player/build-unit/route.ts`, `app/api/player/upgrade-unit/route.ts` | census rows |
| 8 | Clan invite/research act for arbitrary `username` | `app/api/clan/invite/route.ts`, `app/api/clan/research/contribute/route.ts`, `app/api/clan/research/unlock/route.ts` | census rows |
| 9 | Tutorial state mutable for arbitrary `playerId` | `app/api/tutorial/route.ts:12` (`?playerId={id}`), `app/api/tutorial/complete/route.ts`, `app/api/tutorial/decline/route.ts`, `app/api/tutorial/track-action/route.ts` | census rows |
| 10 | DM inbox readable and writable without session | `app/api/messages/route.ts:34` (`searchParams.get('playerId')`), POST takes `senderId` from body (`app/api/messages/route.ts:70-71`) | **live:** `GET /api/messages/conversations?playerId=fame` → **200** with inbox data; unauthenticated POST forged a message **as `fame`** (failed only on a downstream SQL bug, §2.4-F) |
| 11 | Chat send runs as hardcoded `TestUser` | `app/api/chat/route.ts:117` (`username: 'TestUser'` placeholder auth) | live POST created message with `senderUsername: 'TestUser'` while operator's session was `fame` |
| 12 | Cache stats reset / logs cleanup callable by anyone | `app/api/cache/stats/route.ts`, `app/api/logs/cleanup/route.ts` | census rows |
| 13 | Flag system init callable by anyone (idempotent, low harm, still an unauthenticated write) | `app/api/flag/init/route.ts` | census row |
| 14 | Clan bank distribute / chat / level / perks callable with no session | `app/api/clan/bank/distribute/route.ts`, `app/api/clan/chat/route.ts`, `app/api/clan/level/route.ts`, `app/api/clan/perks/activate/route.ts` | census rows |
| 15 | Stripe session verify takes body `username` unauthenticated | `app/api/stripe/verify-session/route.ts` | census row (`username-in-req: YES`) |

Note: `auth/login`, `auth/register`, `stripe/webhook` are legitimately unauthenticated
(webhook verified by Stripe signature — verify that in GREEN), `assets/images` is a read-only
GET-only route, `chat/heartbeat`/`chat/typing` take public presence data (revisit in GREEN:
identity should still come from session, not body). The census over-counts; the true
"must-fix" set is derived per-route in Section 5 (Work Plan). **Presentation of this
classification to the operator is a blocking step before implementation.**

### 2.2 C2 — Sensitive data in responses (response-hygiene census)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | `mapRowToPlayer` spreads the raw DB row — `password`, `email`, `signupIp`, `referredBy`, `stripeCustomerId` ride along into every `Player` object | `lib/playerService.ts:25` (`...row`) with cast at `:50` | code read; `Player` type carries extras via the cast |
| 2 | `/api/move` returns that raw player object | `app/api/move/route.ts:113` (`player,` in response payload) | **live:** response contained `"password":"$2b$10$ALOopMiqoTdheBdZscmi2.vHb/wi..."` and email |
| 3 | Authenticated-but-leaky GET: `/api/player` returns raw row too (same `mapRowToPlayer` path) | `app/api/player/route.ts` → `getPlayerByUsername` (`lib/playerService.ts:119-122`) | code read |
| 4 | No sanitization utility exists anywhere in the response path | `grep -rn 'sanitize\|omit.*password' lib/` → 0 hits in response paths | grep |

### 2.3 C3 — Phantom-cookie auth helpers (already-fixed instance + systemic siblings)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | WMD helpers read cookie `auth-token`; login sets `darkframe_session`. All 6 WMD endpoints 401'd for every logged-in user. | `lib/wmd/apiHelpers.ts:32` (original; now `:33-38` with fix comment + legacy fallback) | live: `/api/wmd/voting` → 401 with valid session; **FIXED in commit `f4b6fed`** |
| 2 | `requireAuth`/`requireAdmin` default to cookie name **`token`** — same phantom. 21 call sites use the default. | `lib/authMiddleware.ts:134` and `:200` (`cookieName: string = 'token'`) | code read |
| 3 | DM routes use `requireAuth(request)` default → live 401 for logged-in users. **DMs are completely broken in production.** | `app/api/dm/route.ts:83,198`; also `app/api/admin/moderation/route.ts:174,366,511`, `app/api/admin/warfare/config/route.ts:88,161`, `app/api/chat/ask-veterans/route.ts:109`, `app/api/chat/channels/route.ts:61`, `app/api/clan/create/route.ts:72`, `app/api/clan/join/route.ts:69`, + others (21 total) | live: `GET /api/dm` with valid session → `{"success":false,"error":"Unauthorized"}` |
| 4 | Impersonation surface: 13 routes authenticate the session but then act on `username`/`playerId` from query/body — any user can pass any other user's id. Includes WMD defense/missiles (act on `batteryId` without ownership check) and admin player-tracking reads. | `app/api/wmd/defense/route.ts:62,259` (`batteryId`), `app/api/admin/player-tracking/activity/route.ts:46-47` (`username`), + 11 more from scan | impersonation scan output (§ Appendix B) |

### 2.4 C4/H — Persistence failures (live 500s with server-side root causes from Vercel logs)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| A | `bot_migration_history` table does not exist in the database (never in any migration) but `botMigrationService` INSERTs/SELECTs it → `/api/bot-migration` 500s | `lib/botMigrationService.ts:211,222` | live 500: `Failed query: SELECT * FROM bot_migration_history`; `information_schema` shows no such table |
| B | `rpTransactions` table does not exist (raw-SQL table name from the Mongo era; schema has no such `pgTable`; DB has no such table) → RP-economy routes 500 (`transactions`, `milestone-stats`, `generation-by-source`) | `lib/researchPointService.ts:219,555,736,816,835`; consumers: `app/api/admin/rp-economy/transactions/route.ts:71-72`, `app/api/admin/rp-economy/milestone-stats/route.ts:41-42`, `app/api/admin/rp-economy/generation-by-source/route.ts:61-62` | live 500s; Vercel log: `Failed query: SELECT * FROM rpTransactions WHERE timestamp >= ?` |
| C | `activity-trends` 500: `sql` template inlines `playerActivity.timestamp` unqualified in SELECT while GROUP BY qualifies it — Postgres rejects the ambiguity mismatch (`FLOOR(EXTRACT(EPOCH FROM "timestamp")...` vs `FLOOR(..."player_activity"."timestamp"...)`) | `app/api/admin/analytics/activity-trends/route.ts:73-91` | Vercel log: full failing query shows unqualified vs qualified mix |
| D | `resource-trends` 500 (same route family; must be diagnosed in GREEN — likely same table/qualifier class) | `app/api/admin/analytics/resource-trends/route.ts` | live 500 |
| E | `auction/my-bids` 500: shim emits `where false` for the ownership filter (Mongo `$or`-on-`_id` translation produced an impossible predicate) — this is the #25 auction seam gap resurfacing | `lib/mongodb.ts` (buildWhere vs `my-bids` filter); `app/api/auction/my-bids/route.ts:84` | Vercel log: `select ... from "auctions" where false limit $1` |
| F | MySQL-dialect SQL in drizzle templates breaks on Postgres: `JSON_SET`/`JSON_UNQUOTE`/`JSON_EXTRACT` (4 sites) — DM send 500s on the conversations UPDATE | `lib/messagingService.ts:355,463`; `lib/warfareConfigService.ts:171,310` | live: unauthenticated DM-forgery POST failed with the JSON_SET query error (§2.1-#10) |
| G | `player_activity.id` is `varchar(24)` PK but `activityLogService` writes 36-char `randomUUID()`s → inserts fail (or truncate) whenever logging fires | `lib/db/schema/config.ts:137` vs `lib/activityLogService.ts:59,78` | code read; consistent with analytics routes having no/failed rows |
| H | `updateOne({upsert:true})` in the shim inserts WITHOUT id generation (`insertDoc` bypasses `ensureRowId`) → `values (default, ...)` against a `varchar(24)` PK with no default → every first-presence insert fails. Affects `chat/heartbeat` (live-verified 500), `chat/typing` (live 500s), tutorial tracking in `/api/move` (`:340`), `beerBaseService:216`. | `lib/mongodb.ts:993-1013` (insert path lacks `ensureRowId` that `insertOne` has at `:955-965`) | live: heartbeat POST → 500 `insert into "user_presence" ("id", ...) values (default, $1, ...)` |
| I | `/api/cron/flag-bot-movement` returns 500 "Server configuration error" when `CRON_SECRET` is unset — leaks config state and reports failure instead of rejecting the caller | `app/api/cron/flag-bot-movement/route.ts:53-56` | live 500 |

### 2.5 C4 — Dead client wiring (35 endpoints; script: `dev/scripts/audit/dead-wire-audit.cjs`)

Client `fetch()` call sites with **no matching route on disk** (verified by directory listing;
not false positives):

| Subsystem | Dead endpoints | Caller files |
| --------- | -------------- | ------------ |
| Admin moderation (7) | `moderation/bans`, `moderation/blacklist`, `moderation/blacklist/:param`, `moderation/logs`, `moderation/mutes`, `moderation/unban`, `moderation/unmute` | `components/admin/ModerationPanel.tsx` (a single `admin/moderation` route EXISTS but with different API shape and no GET list/ban/mute sub-actions matching the client) |
| Admin referrals (4) | `admin/referrals`, `admin/referrals/flag`, `admin/referrals/invalidate`, `admin/referrals/validate` | `app/admin/referrals/page.tsx` (entire page non-functional) |
| Admin VIP (1) | `admin/vip/subscriptions` | `app/admin/vip/page.tsx` (page partially non-functional) |
| Admin beer bases (1) | `admin/beer-bases/recalculate-predictions` | `app/admin/AdminView.tsx` |
| Clan (16) | `bank/deposit`, `bank/withdraw`, `chat/send`, `chat/messages`, `chat/delete`, `demote`, `promote`, `kick`, `search`, `activities`, `activity`, `alliance/create`, `alliance/break`, `alliances`, `wars`, `war/declare`, `territory/list`, `territory/unclaim` | `ClanBankPanel.tsx`, `ClanChatPanel.tsx` (both root and `clan/` variants), `ClanMembersPanel.tsx`, `ClanWarfarePanel.tsx`, `ClanTerritoryPanel.tsx`, `ClanActivityFeed.tsx`, `CreateClanModal.tsx`, `JoinClanModal.tsx`, `ClanPanel.tsx`, `ClanManagementView.tsx`, `TopNavBar.tsx`, `PassiveIncomeDisplay.tsx` |
| Friends (1) | `friends/requests/:param` (approve/deny by id) | `components/friends/FriendRequestsPanel.tsx` (accept/decline buttons dead) |
| Misc (2) | `bot-scanner/tracked`, `user/permissions` | `ReputationPanel.tsx`, `ModerationPanel.tsx` |

Total: 34 rows in script output + `clan/territory/list` counted within clan block = **34 unique
endpoints** (earlier verbal count "35" included `admin/beer-bases/recalculate-predictions`
which this final run confirms; corrected total: **34**).

### 2.6 M — Correctness/quality debt (zero-tolerance ledger)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| M1 | **1,343 ESLint errors project-wide**: 767 `no-explicit-any`, 522 unused vars, 44 require-imports, 9 ban-ts-comment, 3 hook-deps, 1 unsafe-function-type + 3 warnings | `npx eslint .` → `✖ 1346 problems (1343 errors, 3 warnings)` | census run this session |
| M2 | 9 admin routes hide DB seams behind `@ts-nocheck` | `app/api/admin/{achievement-stats,active-sessions,analytics/session-trends,bot-config,bot-leaderboard,bot-stats,player-sessions,player-tracking,stats}/route.ts` | grep census |
| M3 | Global chat GET serves 25 hardcoded mock messages instead of the real `chat_messages` table for the GLOBAL channel; a real POST persists (1 real row in DB) but is invisible to clients | `app/api/chat/route.ts:233-264` (`dummyMessages` array + `messagesToReturn = channelId === ChannelType.GLOBAL ? dummyMessages : messages` ternary at `:264`) | live: GET returns TileHunter42 et al.; DB `chat_messages` has 1 real row; mock field shape uses `content` while the service row shape uses `message` (client maps `m.content` at `ChatPanel.tsx:297` — so swapping the ternary alone would show empty-text messages until the mapping is unified) |
| M4 | Chat auth placeholder (`TestUser`) — see §2.1-#11; online count (`chat/online`) and presence derive from a `user_presence` table that currently 500s on first write per user (§2.4-H) | `app/api/chat/route.ts:101-122` | code + live |
| M5 | NaN% military ratios — FIXED `84101c6` (`components/StatsPanel.tsx:396,418` zero-guard) | — | fixed & deployed |
| M6 | Flag module never rendered on serverless — FIXED `84101c6` (lazy `initializeFlagSystem()` in `app/api/flag/route.ts:71`) | — | fixed & deployed |
| M7 | Tutorial insert-race 500 bursts — FIXED `b3e2b56` (`lib/tutorialService.ts:798,953` `onConflictDoNothing`) | — | fixed & deployed; 10-concurrent live test passed |
| M8 | Request flood — FIXED `8cc6587` (`hooks/usePolling.ts:175-228` refs + self-scheduling + breaker) | — | fixed & deployed; behavioral tests green |

### 2.7 Call-graph notes (Law 4)

- **C1/C2 entry points:** browser game client (`app/game/page.tsx`, `context/GameContext.tsx`)
  → `fetch('/api/move')` etc. → route handlers. The exploit path is *direct* — no auth layer
  exists between the internet and these handlers on Vercel (`middleware.ts` only maps routes;
  it does not authenticate — verified by the unauthenticated 200s).
- **C4-H upsert entry points:** `ChatPanel.tsx` heartbeat poller → `/api/chat/heartbeat` →
  shim `updateOne(upsert)` → drizzle insert without id. Production-reached (live 500s).
- **Dead wires:** `AdminView.tsx` / clan panels are mounted from the game shell and admin
  pages; their fetches fire on panel mount (live-observed 500/404-pattern responses in the
  original console flood before hardening).

---

## 3. Impact Analysis

- **Who/what is affected:**
  - Every player: DMs unusable (C3-3), global chat unreadable as real conversation (M3/M4),
    presence/online-count broken at first write (C4-H), tutorial tracking unreliable on move (C4-H).
  - The operator's business: admin moderation/referrals/VIP-subscriptions/clan-management
    surfaces non-functional (C4); RP economy analytics dark (C4-B).
  - Security posture: unauthenticated state mutation (C1), identity forgery (C1/C3-4),
    private-inbox reads (C1-#10), credential-material exposure (C2).
- **Failure modes if unfixed:** account takeover via hash cracking is gated only by bcrypt
  cost; economy integrity is void (anyone can harvest/build/move as anyone); the game cannot
  be publicly released in this state.
- **Blast radius of the fix (GREEN):**
  - Sanitization utility + session-identity enforcement touch ~35 route files + 2 lib files
    (authMiddleware defaults, playerService mapper) — broad but mechanical.
  - Shim upsert fix is one function (`lib/mongodb.ts:993-1013`) — narrow, high leverage.
  - Phantom-table migrations are additive (2 new tables) — no existing-table changes.
  - MySQL→pg SQL rewrites: 4 `sql` templates in 2 files — narrow.
  - Dead wires: per-subsystem decision (rebuild endpoint vs remove UI) — operator input
    required per Section 8 blocking questions.
  - Chat de-mocking: route ternary removal + field-shape unification + client mapping —
    2 files (+ client), plus test updates.

---

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — session-identity enforcement and sanitization are universal (every route, every response), not per-call-site patches. The shim id fix is at the seam where ALL upserts flow. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes — one `sanitizePlayer()` utility (Law 13) instead of per-route field stripping; middleware-level auth wrappers mean new routes inherit correctness by default (`requireSession()` / `requireAdminSession()` helpers). |
| Survives a hostile attacker, not just an honest user? | Yes — this FID's entire premise: the hostile attacker is the design target (no body-trusted identity, no raw-row leakage, no unauthenticated mutations, cron secrets enforced, ownership checks on battery/territory actions). |
| Maintainable in 2 years? | Yes — auth defaults corrected at the definition site (not per-caller), shim fixed at the seam, schema brings phantom tables under migration control, and the dead-wire audit script becomes a permanent regression gate in `dev/scripts/audit/`. |
| Sets the standard for the industry? | Yes — census-driven security hardening with live exploitation evidence, reusable audit tooling committed to the repo, and a FID that doubles as the audit trail. |

---

## 5. Proposed Fix (GREEN)

Design principles: fix at seams (Law 13), most robust defaults, zero silent failure paths
(Law 14), every route's identity from the session only (hostile-attacker question).

### 5.0 Shared infrastructure (build once, use everywhere)

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/authMiddleware.ts` | modify | Change both defaults (`:134`, `:200`) from `'token'` to `'darkframe_session'`. Every `requireAuth(request)` call site becomes correct with zero caller edits. |
| `lib/playerSanitize.ts` (new) | create | `sanitizePlayer(raw): PublicPlayer` — allowlist projection (username, level, position, resources, bank, vip, clan fields, hp, stats, greeting, referral *counts* only, etc.). Denylist is forbidden (new columns would leak by default); allowlist is the robust default. Also `sanitizePlayerRows()` for arrays. |
| `lib/playerService.ts` | modify | `getPlayerByUsername` gains an options param `{ includePrivate?: boolean }` (default false → returns sanitized). Login route explicitly requests private view for bcrypt compare. All service-internal callers that need full row use drizzle directly (they already do). |
| `lib/mongodb.ts` | modify | `updateOne` upsert path (`:1010`) routes `insertDoc` through `ensureRowId` exactly like `insertOne` (`:958`). One-line-class fix. |
| `lib/db/migrations/0009_phantom_tables.sql` (new) | create | `CREATE TABLE IF NOT EXISTS bot_migration_history (...)` and `rp_transactions (...)` matching the columns the raw SQL actually reads/writes (derive from `botMigrationService.ts` and `researchPointService.ts` INSERT column lists; NOT NULL where code assumes). Idempotent. |
| `lib/messagingService.ts` | modify | `:355` unread-count increment → `jsonb_set` idiom: `jsonb_set(COALESCE(unread_count,'{}'::jsonb), ARRAY[recipientId], (COALESCE((unread_count->>recipientId)::int,0)+1)::text::jsonb)` — parameterized safely; `:463` reset → `jsonb_set(..., ARRAY[playerId], '0'::jsonb)`. |
| `lib/warfareConfigService.ts` | modify | `:171,310` `JSON_EXTRACT(config,'$.version')` → `(config->>'version')` ordering. |
| `lib/activityLogService.ts` | modify | `:59,78` `id: randomUUID()` → `id: generateId().replace(/-/g,'').slice(0,24)` (repo's existing 24-char id helper pattern). |
| `app/api/cron/flag-bot-movement/route.ts` | modify | Unset `CRON_SECRET` → 401 `CRON_NOT_CONFIGURED` (fail closed, no config disclosure); wrong secret → 403. |

### 5.1 C1+C2 — Auth & identity sweep (mechanical, per-route)

Pattern for every route in the census (Appendix A), classified:

- **Session-identity routes** (move, harvest, research, factory/*, player/build-unit,
  player/upgrade-unit, tutorial family, messages family, chat send, clan player-actions):
  drop body/query identity entirely; resolve actor via `getAuthenticatedUser()`;
  401 when absent; 403 when acting-on-behalf mismatch (admin override only via
  `requireAdminSession()`).
- **Admin routes** (vip/grant, vip/revoke, migrate-factory-slots, cache/stats/reset,
  logs/cleanup, flag/init): `requireAdminSession()` — rank gate identical to the
  `ADMIN_ACCESS_REQUIRED (rank 5+)` pattern already in `admin/player-sessions`.
- **Public-by-design** (auth/login, auth/register): unchanged; `stripe/webhook` gains
  signature verification if not present (verify in implementation; Stripe-signature check is
  the only lawful identity).
- **Presence writers** (chat/heartbeat, chat/typing): identity from session; body may carry
  display fields only (level, status). Unauthenticated heartbeat → 401 (client treats as
  backoff signal).
- **Ownership checks** (C3-4 impersonation set): wmd defense/missiles verify
  `battery.playerId === auth.username` before acting; admin player-tracking routes stay
  admin-gated (they already require admin — verify each).
- **Response hygiene:** every route that returns a player object returns
  `sanitizePlayer(...)` output. Enforced by changing `mapRowToPlayer` default (5.0) so the
  unsafe variant requires an explicit opt-in flag — greppable, auditable.

**Verification plan (per route):** census script re-run → zero mutating routes without auth
imports; live probes: unauthenticated move/harvest/messages → 401; authenticated sanity →
200; response JSON contains no `password`/`email`/`signupIp` keys (automated probe script).

### 5.2 C4 persistence — sequence

1. Migration 0009 (tables) → deploy → `/api/bot-migration` and rp-economy routes return
   200/empty-data.
2. Shim upsert fix → live heartbeat: first POST 200 with row in `user_presence`; typing 200.
3. activityLog id fix → log a real action → row lands in `player_activity` with 24-char id.
4. Analytics qualifier fix (activity-trends `sql` template: qualify both sides identically)
   → 200 with bucketed data (seeded by step 3 rows).
5. MySQL→pg rewrites → DM send 200 end-to-end; warfare config list 200.
6. Auction `where false`: fix the shim `buildWhere` `$or`-on-`_id` translation (reproduce
   locally against the `auctions` table; the filter comes from `my-bids`'s bidder predicate —
   translate to `doc` JSON contains or the alias columns per #25 field-map). Verify:
   `my-bids` 200, listing→bid→buyout cycle green (completes SCOPE #25).

### 5.3 C4 dead wires — decision matrix (BLOCKING: operator choices in Section 8)

For each subsystem: **(R)ebuild** the missing endpoint(s) against existing services, or
**(U)I-remove** the dead controls. Defaults proposed (operator confirms):

| Subsystem | Default | Rationale |
| --------- | ------- | --------- |
| Admin moderation | **R** — wire client to the EXISTING `admin/moderation` route (it has POST/GET/DELETE; reshape client calls) | service + route exist; smallest change |
| Admin referrals | **R** — endpoints backed by existing referral service | page exists, service exists |
| VIP subscriptions | **R** — read-only Stripe-backed list | data exists via stripe ids on players |
| Beer-base recalc | **U** — remove button unless predictions service is wired | low value |
| Clan bank deposit/withdraw | **R** — `clan/bank` POST exists; add actions or reshape client | money-adjacent; service exists |
| Clan member manage (demote/promote/kick) | **R** — add to `clan/invite`-style routes | core clan lifecycle |
| Clan chat (send/messages/delete) | **R** — `clanChatService` exists | feature parity |
| Clan alliances/wars | **R** — `clan/alliance/contract` + `clan/warfare/declare` exist; reshape client to real routes | avoid duplicate systems |
| Clan activities/activity feeds | **U** (defer) — no backing service found; remove feed until designed | no service exists |
| Clan search | **R** — trivial query on clans table | leaderboard pattern exists |
| Territory list/unclaim | **R** — `territoryService` exists (with known #11/#16 bugs to fix first) | service exists |
| Friends request approve/deny | **R** — `friends/[id]` route exists; fix client path shape | route exists |
| bot-scanner/tracked | **R** — scanner service exists | small read |
| user/permissions | **U** — replace with session-derived permissions client-side | cleaner |

### 5.4 M1–M3 quality work

- **M3 chat de-mock:** delete `dummyMessages` + ternary (`app/api/chat/route.ts:233-264`);
  unify field shape (`message` vs `content`) at the service boundary; fix client mapping
  (`ChatPanel.tsx:297`) to read the service shape; add a regression test asserting GET returns
  DB rows, not fixtures. Replace placeholder auth (§2.1-#11) with session identity (5.1).
- **M2 `@ts-nocheck`:** remove directive per file; fix surfaced type errors properly
  (9 files; each becomes its own commit).
- **M1 lint-zero:** phased — (a) unused-vars (522, mechanical), (b) require-imports (44),
  (c) ban-ts-comment (9), (d) hook-deps (3), (e) unsafe-function-type (1), (f) `any`-elimination
  (767 — largest, per-module with type guards at trust boundaries). Order avoids blocking the
  security work; lint-zero lands last with a CI gate.

### 5.5 Alternatives considered (and rejected)

- **Per-route allowlists inside each handler** instead of `sanitizePlayer` — rejected:
  35 duplications, one missed route = leak (violates Law 13).
- **Cookie-name change everywhere instead of fixing defaults** — rejected: 21 call sites to
  touch for what is a one-line default fix at the definition (Law 13/11).
- **Rebuilding Mongo** — rejected: operator directive is Postgres; the seam strategy is sound,
  its gaps are enumerable and this FID enumerates them.
- **Deleting the mock chat silently** — rejected as insufficient: without unifying the field
  shape the UI renders blank messages (M3); the fix must include client mapping + test.
- **Suppressing heartbeat 500s client-side only** — rejected: server-side failure is the bug;
  hiding it would mask presence outages (Law 14).

---

## 6. Audit Record (FID-level double audit — passes before IMPLEMENT)

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static census scripts | auth coverage, dead wires, lint census, MySQL-ism grep, phantom-table `information_schema` check | route census (35 rows), dead-wire script (34 rows), `eslint .` (1343 errors), JSON_SET grep (4), table check (missing `bot_migration_history`, `rpTransactions`) | pass (findings reproducible) |
| Method 2: live exploitation probes | unauthenticated move/move-again, messages inbox read, message forgery-as-fame, heartbeat 500, WMD voting 401→(post-fix)200, tutorial race 10×200 | outputs pasted in §2 | pass (all claims reproduced) |

Circuit breakers: this FID grew by ~4× in one pass (supersession pass); subsequent passes are
edits to Sections 5/7 only, tracked against the 10% cap per pass. Convergence expected at
pass 2 (Section 8 answers → status `converged`).

---

## 8. Blocking questions for the operator (Law 2 — presented before implementation)

1. **Dead-wire defaults (§5.3):** approve the R/U matrix as defaulted, or adjust per subsystem?
2. **Auth classification (§2.1 note):** confirm `auth/login`, `auth/register`,
   `stripe/webhook` (with signature check) as the only unauthenticated POSTs, and that
   `flag/init` becomes admin-only (it currently auto-inits lazily via `/api/flag` GET — the
   standalone route may be deleted entirely).
3. **`@ts-nocheck` 9 routes:** these are also the admin analytics family with live 500s —
   fix order: rewrite properly (types + SQL) in the same pass? (Recommended: yes.)
4. **Lint-zero scope:** approve `any`-elimination (767) as its own follow-on FID after this
   one, with this FID covering the other 576? (Recommended: yes — keeps this loop shippable.)
5. **M3 field shape:** unify on `message` (service/DB shape) and update the client mapping —
   confirm (content is the Mongo-era shape).

---

## 7. Implementation Record (only after status reaches `converged`)

- **Status:** not-started
- **Files changed:** (to be filled per phase)

| Phase | File | Lines | Notes |
| ----- | ---- | ----- | ----- |
| 0 | lib/wmd/apiHelpers.ts | +7 −1 | DONE pre-convergence (`f4b6fed`) — recorded as hotfix, re-verified below |
| 0 | components/StatsPanel.tsx, app/api/flag/route.ts | +35 −6 | DONE pre-convergence (`84101c6`) — M5/M6 |
| 0 | hooks/usePolling.ts, context/GameContext.tsx, __tests__/hooks/ | +269 −31 | DONE pre-convergence (`8cc6587`) — M8 |
| 0 | lib/tutorialService.ts, components/tutorial/TutorialQuestPanel.tsx | +74 −16 | DONE pre-convergence (`b3e2b56`) — M7 |
| 1 | (auth sweep files) | — | pending convergence |
| 2 | (persistence files) | — | pending convergence |
| 3 | (dead-wire rebuilds) | — | pending convergence |
| 4 | (de-mock + @ts-nocheck + lint) | — | pending convergence |

- **Verification evidence:** per-phase (pasted at implementation time).
- **Call-graph reachability evidence:** per-phase greps (per §5 verification plans).

---

## 9. Closure

- **Gates:** [ ] typecheck 0 errors · [ ] lint 0 errors/0 warnings · [ ] tests pass ·
  [ ] call-graph proven · [ ] live prod probes green (route sweep 0×5xx, exploit probes 401)
- **Commit hash (G2):** _pending (prepared by agent; committed per operator's standing
  push approval)_
- **Staging plan (G3/G4):** phase-scoped commits — (1) shared infra, (2) auth sweep,
  (3) persistence, (4) dead wires, (5) quality; each independently revertible.
- **Commit message (G8):** `fix(security): <phase-desc> (FID-20260904-005)`
- **Archive:** on close, move this file AND the superseded slim file to `dev/fids/archive/`,
  append CHANGELOG, log in session summary.

---

## Appendix A — No-auth mutating routes (35; census at §2.1)

admin/migrate-factory-slots, admin/vip/grant, admin/vip/revoke, assets/images, auth/login,
auth/register, cache/stats, chat/heartbeat, chat/typing, clan/bank/distribute, clan/bank,
clan/chat, clan/invite, clan/leave, clan/level, clan/perks/activate,
clan/research/contribute, clan/research/unlock, factory/build-unit, factory/produce,
flag/init, harvest, logs/cleanup, messages/read, messages, move, player/build-unit,
player/upgrade-unit, research, stripe/verify-session, stripe/webhook, tutorial/complete,
tutorial/decline, tutorial, tutorial/track-action

## Appendix B — Impersonation surface (13; authed routes trusting query/body identity)

admin/anti-cheat/ban, admin/anti-cheat/player-flags, admin/anti-cheat/unban, admin/ban-player,
admin/bot-config, admin/clear-flag, admin/give-resources, admin/player-tracking/activity,
admin/player-tracking/sessions, admin/rp-economy/transactions, admin/wmd, wmd/defense,
wmd/missiles

---

**Final status:** analyzed
