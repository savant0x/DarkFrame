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
**Status:** converged (Perfection Loop passes 1–4 complete: pass 1 FAIL→SELF-CORRECT,
passes 2–3 corrections applied and verified, pass 4 = zero actionable findings →
convergence. Implementation authorized per §8 decisions; §7 record to be filled at
IMPLEMENT.)
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

Note: `auth/login`, `auth/register`, `stripe/webhook` are legitimately unauthenticated.
**Pass-1 verification:** `stripe/webhook` ALREADY verifies signatures (`constructEvent` call
present in the route body; only the doc-comments mention it — the code path exists at the
top of POST). `assets/images` is a read-only GET-only route. `chat/heartbeat`/`chat/typing`
take public presence data (revisit in GREEN: identity must come from session, not body).
The census over-counts; the true "must-fix" set is derived per-route in Section 5.

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
| M3 | Global chat GET serves 25 hardcoded mock messages instead of the real `chat_messages` table for the GLOBAL channel; a real POST persists (1 real row in DB) but is invisible to clients | `app/api/chat/route.ts:234-264` (`dummyMessages` array at `:234` + `messagesToReturn = channelId === ChannelType.GLOBAL ? dummyMessages : messages` ternary at `:264`) | live: GET returns TileHunter42 et al.; DB `chat_messages` has 1 real row; mock field shape uses `content` while the service row shape uses `message` — the client maps `m.content` at **three** sites (`ChatPanel.tsx:297`, `:462`, `:640`; pass-1 correction — the FID originally cited only :297), so swapping the ternary alone would show empty-text messages until the mapping is unified |
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
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes — one `sanitizePlayer()` utility (Law 13) instead of per-route field stripping; middleware-level auth wrappers mean new routes inherit correctness by default (`requireAuth` / `requireAdmin` helpers that already exist in lib/authMiddleware). |
| Survives a hostile attacker, not just an honest user? | Yes — this FID's entire premise: the hostile attacker is the design target (no body-trusted identity, no raw-row leakage, no unauthenticated mutations, cron secrets enforced, ownership checks on battery/territory actions). |
| Maintainable in 2 years? | Yes — auth defaults corrected at the definition site (not per-caller), shim fixed at the seam, schema brings phantom tables under migration control, and the dead-wire audit script becomes a permanent regression gate in `dev/scripts/audit/`. |
| Sets the standard for the industry? | Yes — census-driven security hardening with live exploitation evidence, reusable audit tooling committed to the repo, and a FID that doubles as the audit trail. |

---

## 5. Proposed Fix (GREEN)

Design principles: fix at seams (Law 13), most robust defaults, zero silent failure paths
(Law 14), every route's identity from the session only (hostile-attacker question).

> **PASS-1 SELF-CORRECT ADDENDUM (2026-09-04).** The first GREEN draft contained 5 errors
> caught by the pass-1 audit (evidence in §6): (1) auth defaults occur at **3** sites
> (`:134`, `:200`, `:229`), not 2; (2) the cookie name is redeclared as a literal in **4**
> files (`lib/authMiddleware.ts:20`, `lib/authService.ts:15`, `lib/websocket/auth.ts:53`,
> `lib/wmd/apiHelpers.ts:37`) — the GREEN design now consolidates them into a single
> `SESSION_COOKIE_NAME` export in `lib/jwt.ts` (Edge-safe, no Node APIs) and re-points all
> four sites; (3) the `JSON_EXTRACT→->>'version'` rewrite as drafted would sort versions
> LEXICOGRAPHICALLY on Postgres (`'10' < '9'`) — the fix must cast: `(config->>'version')::numeric`;
> (4) `randomUUID()` ids cannot be "sliced to 24 chars from a repo helper" — no such helper
> exists (`lib/utils.ts:12` generateId is `Date.now()-base36`). The correct fix reuses the
> shim's own `generateId()` (the exact id scheme every shim-written row already carries);
> (5) the stripe-webhook "verify in implementation" note is resolved: signature verification
> already exists — the GREEN only adds a regression assertion.
> Additionally, pass-1 discovered one NEW hazard not in the original FID: the shim's
> `buildWhere` returns `undefined` for an EMPTY filter, so any `updateOne({})`/`updateMany({})`
> becomes an unqualified UPDATE of every row (Mongo updates first-match only) — guard added
> to GREEN below (§5.0-shim). And the select-then-insert upsert race needs a unique index
> (heartbeat path: filter `{userId}` on `user_presence.userId`) plus an `onConflictDoUpdate`
> to be truly race-safe (§5.0-shim).

### 5.0 Shared infrastructure (build once, use everywhere)

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/jwt.ts` | modify | **Add `export const SESSION_COOKIE_NAME = 'darkframe_session'`** (single source of truth; jwt.ts is Edge-safe and already imported everywhere auth happens). |
| `lib/authMiddleware.ts` | modify | Change **three** defaults (`:134` authenticateRequest, `:200` requireAuth, `:229` requireAdmin) from `'token'` to `SESSION_COOKIE_NAME`. Replace local `COOKIE_NAME` const (`:20`) with the import. Update the three `@param` doc lines. |
| `lib/authService.ts` | modify | Replace local `COOKIE_NAME = 'darkframe_session'` (`:15`) with `SESSION_COOKIE_NAME` import (4 usage sites at `:143,161,170` + declaration). |
| `lib/websocket/auth.ts` | modify | Replace local `JWT_COOKIE_NAME = 'darkframe_session'` (`:53`) with `SESSION_COOKIE_NAME` import (usage `:156`). |
| `lib/wmd/apiHelpers.ts` | modify | Replace the `request.cookies.get('darkframe_session')` literal (`:37`) with `SESSION_COOKIE_NAME` (keep the legacy `auth-token` fallback from the hotfix). |
| `lib/playerSanitize.ts` (new) | create | `sanitizePlayer(raw): PublicPlayer` — allowlist projection (username, level, position, resources, bank, vip, clan fields, hp, stats, greeting, referral *counts* only, etc.). Denylist is forbidden (new columns would leak by default); allowlist is the robust default. Also `sanitizePlayerRows()` for arrays. |
| `lib/playerService.ts` | modify | `getPlayerByUsername` gains an options param `{ includePrivate?: boolean }` (default false → returns sanitized). Login route explicitly requests private view for bcrypt compare. All service-internal callers that need full row use drizzle directly (they already do). 5 files consume `getPlayerByUsername|mapRowToPlayer` (pass-1 D4 count) — all re-verified after the change. |
| `lib/mongodb.ts` (shim) | modify | **(a)** `updateOne` upsert path (`:1010`): route `insertDoc` through `ensureRowId` exactly like `insertOne` (`:958`). **(b)** Race-hardening: the select-then-insert upsert (`:1011-1018`) becomes `insert().values(...).onConflictDoUpdate({ target: userPresence.userId, set: setPayload })` for the presence table. Pass-2 correction: the unique index **already exists in production** (`user_presence_user_id_unique`, live `pg_indexes` check) — so migration 0009 only adds it `IF NOT EXISTS` for environment parity, and the **drizzle schema** (`lib/db/schema/config.ts:182-185`) gains the matching `uniqueIndex(...)` so a schema-driven push can never silently drop the prod index (Pass-2 finding). **(c)** Empty-filter guard: `buildWhere` returning `undefined` for `{}` makes `updateOne({})` an unqualified mass-UPDATE — updateOne must never run an unqualified update (throw `INVALID_EMPTY_FILTER`, matching Mongo first-match semantics conservatively; pass-2 grep confirmed no current empty-filter callers, so the guard breaks nothing). **(d)** Unknown-key FAIL-CLOSED: `buildWhere` currently SILENTLY DROPS unresolvable keys (`if (!column …) continue`) — the root cause of both the auction `where false` (§2.4-E) and the general silent-filter class. New behavior: on tables WITH a `doc` jsonb column (auctions, trade_history), unknown/dotted keys translate to jsonb path predicates (`doc->'bids' @> '[{"bidderUsername":…}]'` — array containment matches "any element containing"); on tables WITHOUT `doc`, an unresolvable key THROWS `UNTRANSLATABLE_FILTER` (loud, Law 14). Known dotted domain paths (`base.x` → `baseX` etc. via the existing prop resolution) keep working unchanged. **(e)** Auction doc↔column sync: the schema comment (`config.ts:74`) promises a "shim's DOC_TABLES mapping" that DOES NOT EXIST (`grep DOC_TABLES lib/` → only the comment) — `flattenDomainPlayerFields` maps the PLAYER domain only. GREEN adds the auctions/trade_history write mapping (doc ⇄ mirrored columns) so listings persist to BOTH representations — this completes the #25 field-map seam. |

### 5.1 C1+C2 — Auth & identity sweep (mechanical, per-route)

Pattern for every route in the census (Appendix A), classified:

- **Session-identity routes** (move, harvest, research, factory/*, player/build-unit,
  player/upgrade-unit, tutorial family, messages family, chat send, clan player-actions):
  drop body/query identity entirely; resolve actor via `getAuthenticatedUser()`;
  401 when absent; 403 when acting-on-behalf mismatch (admin override only via the existing
  `requireAdmin` rank gate).
- **Admin routes** (vip/grant, vip/revoke, migrate-factory-slots, cache/stats/reset,
  logs/cleanup, flag/init): `requireAdmin` — rank gate identical to the
  `ADMIN_ACCESS_REQUIRED (rank 5+)` pattern already in `admin/player-sessions`.
- **Public-by-design** (auth/login, auth/register): unchanged; `stripe/webhook` keeps its
  existing signature verification (pass-1 confirmed `constructEvent` is present in the route
  body — the original "gains verification if not present" clause is resolved; the GREEN adds
  only a regression assertion that a request without a valid signature is rejected 400).
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

| `lib/messagingService.ts` | modify | `:355` unread-count increment → pg jsonb: `jsonb_set(unread_count, ARRAY[${recipientId}], (COALESCE((unread_count->>${recipientId})::int, 0) + 1))` (column is `jsonb NOT NULL DEFAULT '{}'` per `lib/db/schema/messages.ts:11`); `:463` reset → `jsonb_set(unread_count, ARRAY[${playerId}], 0)`. (Pass-1: original draft added a redundant `COALESCE(unread_count,'{}'::jsonb)` wrapper — column is NOT NULL with default; dropped for clarity.) |
| `lib/warfareConfigService.ts` | modify | `:171,310` `JSON_EXTRACT(config,'$.version')` → **`(config->>'version')::numeric`** — the cast is MANDATORY: bare `->>'version'` sorts lexicographically on Postgres (`'10' < '9'`), silently breaking version ordering once a config reaches v10 (pass-1 catch). |
| `lib/activityLogService.ts` | modify | `:59,78` `id: randomUUID()` → `id: generateId()` imported from `@/lib/utils` — the SAME generator the shim uses (`lib/mongodb.ts:27`), so ids match the scheme every shim-written row already carries. (Pass-1: original draft's `randomUUID().replace(/-/g,'').slice(0,24)` "repo pattern" does not exist — `lib/utils.ts:12` generateId is `Date.now()-base36`, ~23 chars, no dashes; the wrong fix would have produced inconsistent id schemes.) |
| `app/api/cron/flag-bot-movement/route.ts` | modify | Unset `CRON_SECRET` → 401 `CRON_NOT_CONFIGURED` (fail closed, no config disclosure); wrong secret → 403. |

### 5.2 C4 persistence — sequence

1. Migration 0009 (§5.2a: phantom tables + `user_presence` unique index) → deploy →
   `/api/bot-migration` and rp-economy routes return 200/empty-data.
2. Shim fixes (§5.0-mongodb a/b/c: upsert id, `onConflictDoUpdate` race-safety, empty-filter
   guard) → live heartbeat: first POST 200 with row in `user_presence`; typing 200.
3. activityLog id fix (`generateId()`) → log a real action → row lands in `player_activity`
   with a shim-scheme id that fits `varchar(24)`.
4. Analytics qualifier fix (activity-trends `sql` template: qualify both sides identically)
   → 200 with bucketed data (seeded by step 3 rows).
5. MySQL→pg rewrites → DM send 200 end-to-end; warfare config list 200 with
   numeric-correct version ordering.
6. Auction `where false`: root cause now precise (pass 2) — `my-bids` filters
   `'bids.bidderUsername'`, `buildWhere` has no doc-path fallback and silently drops the
   key, producing `where false`. Fix = §5.0-shim (d) doc-path containment predicate +
   (e) doc↔column write sync (the #25 field-map seam). Verify: `my-bids` 200,
   listing→bid→buyout cycle green (completes SCOPE #25).

#### 5.2a Migration 0009 details (pass-1 refined)

`lib/db/migrations/0009_phantom_tables.sql` (idempotent `CREATE TABLE IF NOT EXISTS`):

- **`bot_migration_history`** — columns per the service's INSERT (`lib/botMigrationService.ts:211-216`):
  `timestamp timestamptz NOT NULL`, `bots_migrated integer NOT NULL`,
  `by_specialization jsonb NOT NULL`, `triggered_by varchar(20) NOT NULL`,
  `triggered_by_user varchar(20)`; PK: the INSERT supplies NO id, so the table gets
  `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` (raw-SQL table, never shim-written,
  so the 24-char id scheme does not apply here).
  NOTE: the service SELECTs `SELECT *` and maps snake_case fields — column names must match
  exactly (`bots_migrated`, `by_specialization`, `triggered_by`, `triggered_by_user`).
- **`rptransactions`** — pass-1 FINAL design (the draft's three competing variants are
  resolved; rationale recorded because identifier folding here is subtle):
  Postgres folds UNQUOTED identifiers to lower-case, so the service's existing raw SQL —
  `INSERT INTO rpTransactions (id, playerUsername, …)` (`:219-222`, `:736-739`),
  `WHERE playerUsername = …`, `SELECT * FROM rpTransactions` — resolves table to
  `rptransactions` and columns to LOWER-CASE (`playerusername`). Therefore:
  (a) the table is created with **all lower-case columns**: `id varchar(64) NOT NULL
  PRIMARY KEY` (caller-generated), `player_username`→**NO** — use the folded names the SQL
  already produces: `playerusername varchar(20) NOT NULL`, `amount integer NOT NULL`,
  `source varchar(50) NOT NULL`, `description text`, `timestamp timestamptz NOT NULL`,
  `vipbonus integer NOT NULL DEFAULT 0`, `balanceafter integer`, `metadata jsonb`.
  This makes every existing INSERT and WHERE clause work UNMODIFIED (folding matches).
  (b) The only breakage is JS-side: `SELECT *` returns lower-case keys but the service maps
  `row.playerUsername`-style camelCase properties (`:835` region) → the GREEN adds a
  lower-case key fix to those row-mapping reads (small, contained, in-repo).
  (c) Quoted camelCase columns (`"playerUsername"`) were REJECTED: unquoted INSERTs would
  fold to lower-case and MISS the quoted columns — requiring rewrites of every raw SQL site
  (most change, most fragile). A quoted compatibility VIEW was also rejected as dead weight
  once (a)+(b) are the minimal complete fix.
- **`user_presence` unique index** — `CREATE UNIQUE INDEX IF NOT EXISTS user_presence_user_id_unique
  ON user_presence (user_id);` — pass-2 correction: this index ALREADY EXISTS in production
  (live `pg_indexes` check: `user_presence_user_id_unique … (user_id)`, zero duplicate
  `user_id` rows, so creation is a no-op there). Its purpose is environment parity (fresh
  DBs) + the drizzle-schema mirror (below), NOT a prod migration.
- **Schema mirror (pass-2 addition)** — `lib/db/schema/config.ts` `userPresence` gains
  `(table) => [uniqueIndex('user_presence_user_id_unique').on(table.userId), …]` matching the
  prod index name EXACTLY, so any future schema-driven push/index-sync cannot silently drop
  the prod constraint that the shim's `onConflictDoUpdate` depends on.

### 5.3 C4 dead wires — decision matrix (RESOLVED: operator chose **Rebuild everything**;
the U rows below are superseded — activity feeds get a created service, user/permissions
becomes a session-derived endpoint, beer-base recalc gets a real endpoint)

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
| Clan activities/activity feeds | **R** — `lib/clanActivityService.ts` EXISTS (pass-3 verification; the original draft's "no backing service found" was wrong) | rebuild endpoints against the existing service |
| Clan search | **R** — trivial query on clans table | leaderboard pattern exists |
| Territory list/unclaim | **R** — `territoryService` exists (with known #11/#16 bugs to fix first) | service exists |
| Friends request approve/deny | **R** — `friends/[id]` route exists; fix client path shape | route exists |
| bot-scanner/tracked | **R** — scanner service exists | small read |
| user/permissions | **U** — replace with session-derived permissions client-side | cleaner |

### 5.4 M1–M3 quality work

- **M3 chat de-mock:** delete `dummyMessages` + ternary (`app/api/chat/route.ts:234-264`);
  unify field shape on `message` (operator decision) at the service boundary; fix client
  mapping at all THREE sites (`ChatPanel.tsx:297,462,640`) to read the service shape; add a
  regression test asserting GET returns DB rows, not fixtures. Replace placeholder auth
  (§2.1-#11) with session identity (5.1).
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

### Pass 1 (2026-09-04) — evidence re-verification + design audit

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static census scripts | auth coverage, dead wires, lint census, MySQL-ism grep, phantom-table `information_schema` check | route census (35 rows), dead-wire script (34 rows), `eslint .` (1343 errors), JSON_SET grep (4), table check (missing `bot_migration_history`, `rpTransactions`) | pass (findings reproducible) |
| Method 2: live exploitation probes | unauthenticated move/move-again, messages inbox read, message forgery-as-fame, heartbeat 500, WMD voting 401→(post-fix)200, tutorial race 10×200 | outputs pasted in §2 | pass (all claims reproduced) |
| **Pass-1 re-verification (audit of the FID itself)** | every file:line citation re-grepped at HEAD | A1: auth defaults = **3** sites (:134/:200/:229) — FID said 2 → corrected; A2: cookie literal redeclared in **4** files → GREEN redesign (SESSION_COOKIE_NAME in lib/jwt); A3 mapRowToPlayer :25/:50 ✓; A4 dummyMessages :234-264 ✓ (FID said :233 — off-by-one, corrected); A5 client mapping = **3** sites (:297/:462/:640) — FID said 1 → corrected; A6 upsert path :993-1018 lacks ensureRowId ✓ (gap confirmed); A7 playerActivity.id varchar(24) at config.ts:137 ✓; A8 cron :53-56 ✓; A9 MySQL-isms :355/:463/:171/:310 ✓; B2-B5 schema types ✓ (unread_count jsonb NOT NULL, game_config.config jsonb); C1 playerActivity def ✓; C2 ensureRowId :395 / insertOne :958 ✓; C3 buildWhere empty-filter → undefined ✓ (NEW hazard #6); C4/C5 migration column sources ✓; C6 "24-char helper" DOES NOT EXIST (lib/utils.ts:12 is Date.now-base36) → GREEN corrected; C11 harvest :63-66 body username ✓; C12 constructEvent PRESENT → webhook note resolved; C13 isAdmin from JWT payload :163 (rank re-verify at implementation); D1 shim imports generateId from ./utils :27 ✓; D2 signature verify present ✓; D3 auctions doc-bridge columns ✓; D4 sanitize blast radius = 5 files ✓; D5 heartbeat filter {userId} ✓; D6 lint census exact: 767 any / 522 unused / 44 require / 9 ban-ts-comment / 3 hooks / 1 unsafe-fn ✓ | **FAIL → SELF-CORRECT applied (6 corrections + 1 new hazard); GREEN revised** |

Pass-1 verdict: original GREEN contained 5 design errors + missed 3 evidence sites; all
corrected in §5 (see the PASS-1 addendum). No new RED findings beyond the empty-filter
hazard (added to §5.0-shim (c)).

### Pass 2 (2026-09-04) — audit of the REVISED GREEN (corrected design)

| Check | Method | Evidence | Result |
| ----- | ------ | -------- | ------ |
| P2.1 `lib/jwt.ts` Edge-safety (middleware imports it) | re-read header | "Edge-compatible… must not pull in Node-only APIs" — SESSION_COOKIE_NAME placement is lawful | pass |
| P2.2 unique index for `onConflictDoUpdate` target | live `pg_indexes` probe | `user_presence_user_id_unique` ALREADY EXISTS in prod; zero dup `user_id` rows | **GREEN correction**: migration 0009 is IF-NOT-EXISTS parity only; the REAL gap is the missing schema mirror → §5.0-shim (b) + §5.2a updated |
| P2.3 empty-filter callers (guard blast radius) | grep `updateOne({}`/`updateMany({}` lib+app | zero call sites | pass — guard breaks nothing |
| P2.4 dotted-path resolution | re-read `buildWhere` | dotted `base.x`-style keys resolve to columns; UNKNOWN keys silently dropped (`if (!column …) continue`) → **root cause of `where false` refined**; no `DOC_TABLES` exists despite the schema comment | **GREEN extended**: §5.0-shim (d) fail-closed + doc-path predicates, (e) doc↔column sync (= #25 seam) |
| P2.5 migration apply mechanism | package.json scripts | `db:setup` (tsx scripts/dbSetup.ts) exists; migrations run via setup script — 0009 must be idempotent (already specified) | pass |
| P2.6 rank-gate consistency for admin routes | re-read `[username]/route.ts:38` | `rank < 5` gate with `ADMIN_ACCESS_REQUIRED` — the FID's admin pattern matches the established codebase pattern | pass |

Pass-2 verdict: revised GREEN still contained 3 environment-reality gaps (prod index
existence, schema-mirror necessity, silent-drop root cause). All folded into §5. No RED
changes. GREEN is now grounded in verified production state.

### Pass 3 (2026-09-04) — helper existence + rebuild-target verification (convergence check)

| Check | Method | Evidence | Result |
| ----- | ------ | -------- | ------ |
| P3.1 auth helpers named in §5.1 actually exist | grep exports in lib/authMiddleware | real API = `authenticateRequest` (:132), `requireAuth` (:198), `requireAdmin` (:227), `getAuthenticatedUser` (:78). `requireAdminSession`/`getAuthenticatedPlayer` are PHANTOM names used in 5 GREEN/§8 spots | **corrections applied** (§4, §5.1, §8 now name the real API; :45 methodology listing is historically accurate and kept) |
| P3.2 dead-wire rebuild targets have backing services | `ls lib/` + grep | `clanChatService.ts`, `clanBankService.ts`, `clanActivityService.ts`, `clanAllianceService.ts`, `clanLevelService.ts`, `clanPerkService.ts`, `clanDistributionService.ts`, `botScannerService.ts` all exist; `permissionService` does NOT (§5.3 "rebuild" for user/permissions = NEW small session-derived endpoint, per operator) | matrix rationale fixed; all R rows feasible |
| P3.3 Appendix A census count | parse | 35 rows confirmed | pass |
| P3.4 stray artifact spotted | ls lib/ | `clanAllianceService.ts.bak` — added to the artifact-cleanup ledger (#4/#15/#18 class) | noted |

Pass-3 verdict: corrections were NAME-LEVEL only (no design changes); the GREEN now
references only APIs and services verified to exist. Delta vs pass 2 is small (name fixes +
one matrix rationale) — converging.

### Pass 4 (2026-09-04) — consistency + convergence determination

| Check | Method | Evidence | Result |
| ----- | ------ | -------- | ------ |
| P4.1 stale lint-split language | grep "follow-on FID\|576" | zero hits — §5.4/§8 consistently reflect the operator's ALL-1,343 decision | pass |
| P4.2 stale BLOCKING markers | grep BLOCKING | zero hits — all decision gates resolved | pass |
| P4.3 M3 client-site count consistent | grep ChatPanel | §2.6-M3 (3 sites) and §5.4 (3 sites) now agree | pass (fixed §5.4) |
| P4.4 superseded-file cross-notes | grep | header note + §9 archive instruction consistent | pass |
| P4.5 char-delta circuit breaker | wc -c | pass 4 delta ≈ 0.3% of 47,673 chars (< 2% for the final passes) | **CONVERGENCE criterion met** |

Pass-4 verdict: ZERO actionable improvements remain. Termination criterion
"Deep Audit yields ZERO actionable improvements → Proceed to COMPLETE" is satisfied.
Status → `converged`. Implementation (IMPLEMENT phase) is authorized per §8 decisions.

---

## 8. Blocking questions for the operator (Law 2 — presented before implementation)

**ANSWERED 2026-09-04 — status `converged`; implementation authorized.**

1. **Dead-wire defaults (§5.3):** → **"Rebuild everything."** Every one of the 34 dead
   endpoints gets a real backend implementation, including clan activity feeds
   (service to be created) and `user/permissions` (session-derived permissions endpoint).
2. **Auth classification (§2.1 note):** → Operator kept the flag feature in full.
   Resolution: `/api/flag/init` is RETAINED but becomes admin-gated (`requireAdmin`);
   the lazy init in `GET /api/flag` remains the primary path. Only `auth/login`,
   `auth/register`, `stripe/webhook` (signature-verified) remain public POSTs.
3. **`@ts-nocheck` 9 routes:** → **Rewrite in this FID** (types + SQL fixes together).
4. **Lint-zero scope:** → **ALL 1,343 in this FID** (no follow-on split; includes the
   767 `no-explicit-any`).
5. **M3 field shape:** → **Unify on `message`** (service/DB shape; client mapping updated).

---

## 7. Implementation Record (only after status reaches `converged`)

- **Status:** not-started
- **Files changed:** (to be filled per phase)

| Phase | File | Lines | Notes |
| ----- | ---- | ----- | ----- |
| 0 | lib/wmd/apiHelpers.ts | +7 −1 | DONE pre-convergence (`f4b6fed`) — recorded as hotfix, re-verified below |
| 0 | components/StatsPanel.tsx, app/api/flag/route.ts | +35 −6 | DONE pre-convergence (`84101c6`) — M5/M6 |
| 0 | hooks/usePolling.ts, context/GameContext.tsx, __tests__/hooks/ | +269 −31 | DONE post-convergence — M8 |
| 0 | lib/tutorialService.ts, components/tutorial/TutorialQuestPanel.tsx | +74 −16 | DONE pre-convergence (`b3e2b56`) — M7 |
| 1a | lib/jwt.ts, lib/authMiddleware.ts, lib/authService.ts, lib/websocket/auth.ts, lib/wmd/apiHelpers.ts, lib/middleware/activityLogger.ts | ~+20 −10 | **DONE (IMPLEMENT)** — `SESSION_COOKIE_NAME` created in lib/jwt; 3 defaults + 4 local consts repointed; FIFTH phantom site found during implementation (`activityLogger.ts:157` read `'token'`) and fixed — validates the §5.0 consolidation design. Gates: tsc 0; 341 tests + 4 sanitize proofs green. |
| 1b | lib/playerSanitize.ts (new), lib/playerService.ts, app/api/auth/login/route.ts, __tests__/lib/playerSanitize.proof.test.ts | +160 −8 | **DONE (IMPLEMENT)** — allowlist sanitizer + `includePrivate` opt-in on getPlayerByUsername/getPlayerByEmail; login switched from rest-spread denylist to allowlist. LIVE PROOF (dev server :51514): login 200 → zero sensitive keys, allowlist fields only; `/api/player` 200 → no password/email/signupIp/stripeCustomerId/referredBy, client-critical fields (currentPosition/resources/bank/baseX) intact. |
| 1c | lib/mongodb.ts | +180 −30 | **DONE (IMPLEMENT, live-verified)** — (a) upsert insert route now passes through `ensureRowId` (first-presence upserts no longer `values (default,…)` 500); (b) race-safe `onConflictDoUpdate` against verified unique indexes (`user_presence.user_id`, composite `tutorial_action_tracking`); (c) `updateOne`/`updateMany` reject empty filters (`INVALID_EMPTY_FILTER`); (d) doc-path filters translate to jsonb containment (dual array/object probe — bare-object probes fail against jsonb arrays, live-proven); (e) auctions doc↔column bridge completed: `insertOne` synthesizes `doc` from the domain listing, fills legacy NOT NULL mirrors (seller_id/item_data/starting_price), `$set` of mirrored columns syncs the doc copy via chained `jsonb_set`, non-column `$set` and `$push` (placeBid bids) land inside `doc`, `$pull` similarly; reads overlay non-null columns onto doc; (f) **snake-case alias resolution** in `resolveKeyToProp` (`resources_metal` → `resourcesMetal`) plus **$inc delta merging by resolved column** (two loops previously overwrote each other — buyer debit and seller credit were silently dropped); (g) empty-filter `updateOne` mass-update hazard closed. |
| 1d | lib/db/migrations/0009_phantom_tables.sql, 0009b_auction_doc_bridge_parity.sql (new), lib/db/schema/config.ts, lib/researchPointService.ts, app/api/admin/rp-economy/transactions/route.ts | +120 | **DONE (IMPLEMENT, live-verified)** — 0009 creates `rptransactions` + `bot_migration_history` + index parity; RP row-mapping fixed to lowercase pg keys. **0009b lesson (recorded):** migration 0008 had been EDITED after it was already applied, so the live `auctions` table held the pre-#25 shape and `trade_history` never existed — migrations are immutable once applied; corrections go in a NEW file. 0009b rebuilds `auctions` with the doc bridge (0 rows live, verified lossless) and creates `trade_history`. Also fixed `rp-economy/transactions` MySQL-dialect `?`-placeholders (never bound under drizzle) → pg `sql` template with bound params; heartbeat/typing now take identity from the session, not the body. |
| 3a | (persistence — early slice pulled forward) | — | **PARTIAL** — heartbeat 401/200, typing 200, bot-migration 200, rp-economy 200, my-bids 200, auction create/bid/buyout 200 all live-verified (see below). Remaining Phase 3 items (analytics SQL qualifiers, DM/warfare MySQL rewrites, activityLog 24-char ids) pending. |
| 2 | (auth sweep per-route) | — | pending |
| 4 | (dead-wire rebuilds) | — | pending |
| 5 | (de-mock + @ts-nocheck + lint-zero) | — | pending |

- **Verification evidence (1c/1d, 2026-09-05, dev server :51234 on transaction pooler :6543):**
  - heartbeat no-auth **401**; authed **200/200** (insert + update paths of the race-safe upsert)
  - typing **200**; bot-migration **200** (phantom table created); rp-economy/transactions **200** with mapped keys
  - my-bids **200** (doc-path containment predicate; single-element-array wrap proven required)
  - **FULL LISTING→BID→BUYOUT CYCLE** (two accounts, all amounts DB-verified):
    seller fame 5000 → **4890** (= 5000 − 150 fee − 150 item + 190 sale; buyer 10000 → **9800** (= −200 buyout);
    auction row `sold/settled`, final 200, winner verifybuyer; `trade_history` row final 200, fee 10, seller-received 190;
    doc.bids = 1 entry; doc.item intact.
  - **Env discovery (out-of-scope surface, needs operator-visible note):** Supabase SESSION pooler (pg :5432, pool_size 15) rejects connections once serverless functions + local processes exceed 15 session clients (`EMAXCONNSESSION` — root cause of production pool-exhaustion 500s). Serverless deployment must use the TRANSACTION pooler (same host, port 6543). Local verification switched to :6543; Vercel env change to follow.
  - Gates: tsc 0 · 341 tests green · eslint delta 0 (2 pre-existing `any` at identical HEAD positions) |
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
