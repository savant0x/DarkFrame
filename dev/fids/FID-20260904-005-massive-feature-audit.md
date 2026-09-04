# FID-20260904-005: Massive Feature Audit (Zero-Tolerance)

**Filename:** `FID-20260904-005-massive-feature-audit.md`
**ID:** FID-20260904-005
**Severity:** CRITICAL (multiple CRITICAL findings inside)
**Status:** created
**Created:** 2026-09-04

---

## 1. Summary

Full-game audit ordered by the operator: every system explored, every problem flagged regardless
of origin (ECHO requires zero problems), with FIDs and a perfection loop to follow. Game was
never released and sat dormant ~1 year; rot confirmed extensive.

Audit method: static (route census, dead-wire scan, auth-coverage scan, lint census) + live
(probe every one of the 192 API routes on production with an authenticated session, exercise
combat validation paths, DB-state inspection).

---

## 2. Findings

### CRITICAL — live security/functional holes

| # | Finding | Evidence | Status |
|---|---|---|---|
| C1 | **41 mutating routes have no auth middleware.** Any unauthenticated request can act. 9 take `username` from the request body (harvest, research, factory/build-unit, factory/produce, player/build-unit, player/upgrade-unit, clan/invite, clan/research/*). | Auth-coverage scan; `/api/move` moved `fame` with NO cookie, returned the bcrypt hash + email in the response | OPEN |
| C2 | **`/api/move` returns password hash + email** (full unsanitized player row) — and accepts arbitrary `username` in body (no session check) | Live probe: `moved? true | hash leaked? true` unauthenticated | OPEN |
| C3 | **WMD unreachable in production:** `lib/wmd/apiHelpers.ts` read cookie `auth-token`; login sets `darkframe_session`. All 6 WMD endpoints 401'd for logged-in users. This is why the operator never saw WMD in action. | Live probe + code read | **FIXED** `f4b6fed` |
| C4 | **35 dead client wires** — UI calls endpoints that don't exist. Entire admin modules: moderation (7 endpoints), referrals (4), VIP subscriptions, bot admin actions. Clan system: bank deposit/withdraw, member promote/demote/kick, chat send/delete, alliances create/break, wars declare/list, territory list/unclaim, search. Friends: request-by-id. Misc: `/api/battle` (toast.ts), `/api/discoveries`, `/api/user/permissions`, `bot-scanner/tracked`. | Wiring audit script (fetch() call sites vs routes on disk) | OPEN |

### HIGH — broken endpoints (live-verified 500s)

| # | Endpoint | Error | Status |
|---|---|---|---|
| H1 | `bot-migration` GET | `Failed query: SELECT * FROM bot_migration_history` — **table missing from migrations** | OPEN |
| H2 | `/api/auction/my-bids` | INTERNAL_ERROR (auction persistence rebuild #25 still pending — schema half-landed) | OPEN (tracks #25) |
| H3 | `/api/admin/analytics/activity-trends`, `resource-trends` | INTERNAL_ERROR | OPEN |
| H4 | `/api/admin/rp-economy/generation-by-source`, `milestone-stats`, `transactions` | INTERNAL_ERROR | OPEN |
| H5 | `/api/cron/flag-bot-movement` without cron secret | 500 "Server configuration error" (should be 401/403 — leaking config state) | OPEN |

### MEDIUM — correctness/quality

| # | Finding | Status |
|---|---|---|
| M1 | **1,343 ESLint errors project-wide** (767 `no-explicit-any`, 522 unused vars, 44 require-imports, 9 ban-ts-comment, 3 hook-deps, 1 unsafe-function-type). Zero-tolerance standard flags all. | OPEN |
| M2 | 9 admin routes hide DB seams behind `@ts-nocheck` (achievement-stats, active-sessions, analytics/session-trends, bot-config, bot-leaderboard, bot-stats, player-sessions, player-tracking, stats). | OPEN |
| M3 | Chat messages/online-count are **mock seed data** (TileHunter42, NovaDrift etc.) — world looks populated when it isn't; online count shows fake numbers. | OPEN |
| M4 | NaN% military ratios (0/0 for new players) + flag module never rendered on serverless (init only at server.ts boot). | **FIXED** `84101c6` |
| M5 | Tutorial 500 bursts (insert race) + 1s unconditional poller. | **FIXED** `b3e2b56` |
| M6 | Request flood: usePolling restarted per render; 70k requests/2min on prod. | **FIXED** `8cc6587` |

### Audit observations (verified GOOD)

- Beer Base attack (`/api/combat/attack`): session auth, presence enforcement (403 live-verified from wrong tile), proper 404/validation paths.
- `flag/attack`, `factory/attack`: session-hardened (earlier work held).
- `combat/infantry`: session-based attacker, self-attack blocked.
- WMD status works (post-fix all WMD endpoints should).
- Dynamic `[param]` routes: all return proper 401/403/405.
- Beer bases list: organic intel respected (`scanned: false`, powerTier only).

---

## 3. Implementation plan (perfection loop order)

1. **C1+C2 (auth sweep):** every mutating route gets `getAuthenticatedUser` + session-identity attacker; a shared `sanitizePlayer()` strips password/email/internal fields from ALL API responses.
2. **C4 (dead wires):** rebuild missing endpoints (moderation, referrals, clan bank/manage, wars) or remove dead UI per feature intent; decide module-by-module.
3. **H1:** add `bot_migration_history` table migration.
4. **H2:** finish auction #25 (fixes my-bids + full persistence).
5. **H3/H4:** fix analytics/RP-economy SQL (likely Mongo-era columns in select).
6. **H5:** cron routes return 401 without `CRON_SECRET`.
7. **M1–M3:** lint-zero campaign, un-@ts-nocheck the 9 admin routes, replace mock chat data with real persistence.
8. Combat feel/balance pass + live battle verification (beer base kill, flag fight, infantry battle) once C1 hardening lands.

---

## 4. Verification log (evidence captured during audit)

- Route sweep: 192 routes GET-swept on prod; results in §2.
- Live move exploit: unauthenticated POST /api/move succeeded (position changed 122,92→122,93; hash present).
- WMD voting 401 pre-fix, code path named; fix pushed and deployed (`f4b6fed`).
- 10-concurrent tutorial first-polls: 10×200 post-fix (`b3e2b56`).
- Poller flood: bounded-rate + breaker tests green (`8cc6587`).
