# FID-20260909-023: Program-wide audit — Echo violations, quality, performance, security

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260909-023-program-wide-audit.md`
**ID:** FID-20260909-023
**Severity:** MIXED (2 HIGH security defects, several MEDIUM hygiene/performance items, LOW cleanup backlog)
**Status:** converged (all four remediation waves executed and gated — see §9)
**Created:** 2026-09-09

---

## 1. Summary

Full-program scan across five dimensions (Echo-conformance, code quality, performance, security/config hygiene,
dependency health) requested by the operator. Baseline state is strong: all gates green (`tsc` 0, `eslint` 0
errors/3 pre-existing warnings, vitest 362/0/1), FID-016 import guard holding, neon-noir census 0, and the
FID-021 lint program closed with zero regressions. The scan surfaced two HIGH-severity unauthenticated API
defects, a dead Pixi rendering stack with five removable dependencies, ~60 Law-5 TODO violations (several
admitting missing admin authorization), and a small number of real performance liabilities.

---

## 2. Reproduction / Evidence

### §2.1 Echo-conformance state (HEALTHY — no violations found)

| Check | Result |
|---|---|
| FID-016 guard (framer-motion / dead kit imports) | **Clean.** No source imports. `framer-motion` absent from `package.json`. `components/ui/` retains only the two intentionally-kept functional components (`ConfirmDialog`, `RichTextEditor`) recorded in FID-010. |
| Neon-noir banned-class census | **0 real instances** (4 grep hits are all code comments). |
| `any` census (FID-021 regression check) | **1 real site** (§3.6); all other matches are comments. |
| `eslint-disable` suppressions | 16 total, all pre-existing (FID-021 added 0; unchanged). |

### §2.2 Security & config hygiene

| Check | Result |
|---|---|
| Cron routes | ✅ Bearer `CRON_SECRET`, fail-closed when unset. |
| Admin routes (all 15) | ✅ Real `getAuthenticatedUser` + `isAdmin` checks (verified by reading bodies, not greps). |
| Clan money routes | ✅ `requireClanMembership` guard. |
| Stripe webhook | ✅ (signature verification assumed present; not re-verified this scan). |
| Unauthenticated routes | ⚠️ 46 routes match no auth pattern; most are legitimately public (auth/session, health, leaderboards, check-name). **2 are defective** → §3.1. |

### §2.3 Code quality census

| Check | Count | Notes |
|---|---|---|
| `// TODO` markers | ~60 | §3.2; several admit missing auth/admin enforcement. |
| "coming soon" placeholders | 10 | Admin VIP + game page panels + VIP upgrade page (Law 5). |
| `console.log` in prod code | ~374 | §3.4; unguarded in server services; no repo-wide `productionLogger` adoption. |
| God files (>1200 lines) | 9 | Top: `AdminView.tsx` 3550, `game.types.ts` 2424, `ChatPanel.tsx` 2188. |
| Dead code | §3.3 | Pixi stack (973 lines), dead map barrel. |

### §2.4 Performance signals

| Check | Result |
|---|---|
| Unbounded `db.select()` | 2 files (`beerBaseService`, `mongodb` shim internals) — mostly internal/streaming patterns; LOW. |
| N+1 loops | 2 real candidates in money paths → §3.5. |
| Heavy client libs | `pixi.js` dead (§3.3); `recharts` (4 files) is the only chart lib after audit — no chart.js. |
| Polling | ~17 `setInterval` sites across 12 components (2–5s polling alongside an open WebSocket connection). |

---

## 3. Root Cause Analysis (findings, ranked)

### HIGH

**§3.1a `app/api/bot-scanner/route.ts` — unauthenticated, identity-from-query-string.**
`GET /api/bot-scanner?username=X` executes `scanForBots(username)` with no session check. Any caller can
trigger scans (and burn cooldowns) **for any other player**, and read their scanner status/nest intelligence.
Identity must come from the authenticated session, not the query string.

**§3.1b `app/api/tutorial/tracking/route.ts` — unauthenticated player-data read.**
`GET /api/tutorial/tracking?playerId=X&stepId=Y` returns another player's tutorial progress (coords, move
counts) to anyone. Must authenticate and scope `playerId` to the session user.

### MEDIUM

**§3.2 Law-5 TODO violations (~60 sites) — several are auth-shaped.**
Named examples (full census in session log):
- `app/api/logs/player/[id]/route.ts:80` — admin check stubbed (`isAdmin = false`), fails closed but the
  admin feature is dead; self-view works only.
- `app/api/logs/activity/route.ts`, `app/api/logs/stats/route.ts` — "Add admin role check from database".
- `app/api/chat/online/route.ts:135` — clan-membership TODO inside channel-access decision.
- `app/api/beer-bases/route.ts:200` — "Add proper admin role verification" (mutating admin config route).
- `app/api/chat/delete|edit/route.ts` — moderation WebSocket events never wired (Task-3 debt).
- `app/admin/vip/page.tsx` — three `TODO: Save to API` / Stripe connect stubs ("coming soon" toast).
- `app/api/stats/route.ts` — battle/territory tracking stubbed to 0.

**§3.3 Dead rendering stack + dead deps (Law 4 reachability + bundle weight).**
- `components/map/MapContainer.tsx` (704 lines, Pixi `Application`) + `GridRenderer.tsx` + `PlayerMarker.tsx`
  + `components/map/index.ts` barrel: zero importers — the live map is `CanvasMapRenderer` (~269 lines,
  imported by `app/map/page.tsx`). Deleting the stack removes the `pixi.js` dependency.
- Dead deps (zero source imports): `@heroui/react`, `@heroui/styles`, `chart.js`, `react-chartjs-2`,
  `pixi.js` (after stack removal). `@types/react-joyride` may also be redundant with joyride 3's own types.

**§3.4 Logging discipline (Law 12-adjacent).**
~374 `console.log` in production code paths (286 server-lib, 73 client, 15 API). `productionLogger` exists
and is used by only 20 files. Server-side logs should route through the logger (levels/structuring);
client dev-logging should be dev-gated. (No secrets observed in sampled logs.)

**§3.5 Performance — N+1 in money paths.**
- `app/api/player/build-unit/route.ts:380` — factory slot updates run one `updateOne` per factory inside a
  loop after the player update (non-transactional; also a partial-failure consistency risk).
- `lib/clanDistributionService.ts:636` — per-recipient `select` + update loop for RP distribution
  (per-member round-trips; batching candidates).

**§3.6 Last `any` (Law 6).**
`lib/db/schema/config.ts:14` — `jsonb('config').$type<any>()` (pre-existing eslint-disable). Honest fix:
type the beer-base config shape (`gameConfig.config`) and delete the suppression.

**§3.7 Bundle: dual icon systems.** `lucide-react` (80 files) vs one `fontawesome` consumer — retire the
fontawesome dependency + CSS import.

**§3.8 Polling alongside WebSocket.** ~17 client `setInterval` pollers (2–5s) run even while the WebSocket
is connected (e.g., friends 2×, TopNavBar 3×, moderation 2×). Candidates for WS-event-driven refresh or
visibility-gating to cut idle server load.

### LOW / structural (record, no urgency)

**§3.9 God files.** `AdminView.tsx` (3550), `types/game.types.ts` (2424), `ChatPanel.tsx` (2188),
`tutorialService.ts` (1722), `beerBaseService.ts` (1561), `mongodb.ts` (1470), `clan.types.ts` (1435),
`spyService.ts` (1404), `game/page.tsx` (1206). Decomposition is a multi-session refactor; only worth it
per-file when one is next touched for substantive work.

**§3.10 Duplicated tutorial help parsing.** `TutorialOverlay.tsx` and `TutorialQuestPanel.tsx` each carry
section-parsing logic; FID-022 introduced `lib/tutorialHelpParser.ts` — fold both consumers onto it.

---

## 4. Impact Assessment

- §3.1a/§3.1b are live exploitable defects on a public endpoint surface (player-scoped data reads +
  cross-player action triggering). Fix cost is small (session auth + scoping), risk of leaving them is
  the highest in this report.
- §3.3 removes real client-bundle weight (Pixi) and dependency-audit surface (5 packages) for free.
- §3.5 reduces DB round-trips on the two busiest economy actions.
- Everything else is hygiene that compounds: logging discipline and TODO burn-down prevent the next
  "silent no-op write / never-true check" class of bug that FID-021's typing already exposed six of.

---

## 5. Proposed Resolution (requires operator approval — Law 2)

**Wave 1 (recommended immediate):** §3.1a + §3.1b auth fixes (session-scoped identity, 401/403 contracts),
with regression tests for the unauthenticated cases. Small, high-value, low-risk.

**Wave 2:** §3.3 dead-stack removal (Pixi + 5 deps + barrel) with reachability proofs recorded; §3.7
fontawesome retirement; §3.6 last-`any` honest typing.

**Wave 3:** §3.5 N+1 batching; §3.8 polling consolidation (top 5 pollers first); §3.4 logging discipline
(server services → productionLogger; client dev-gate) as a mechanical-but-hand-reviewed pass.

**Wave 4 (optional/deferred):** §3.2 TODO burn-down by family (logs-admin trio first), §3.10 parser fold,
§3.9 god-file decomposition only when files are next touched.

---

## 6. Verification (§Perfection Loop — audit pass)

- Static: greps censused per section (counts recorded in session log); gates re-run at audit time:
  `tsc --noEmit` 0 · `eslint .` 0 errors / 3 pre-existing warnings · tree clean at `9f4abfa`.
- Runtime: not modified — audit is read-only; no test run required.
- Double audit: each "dead" claim is a two-method result (import grep + barrel-consumer grep); each
  "unauthenticated" claim is a full-file read, not a pattern miss.

## 7. Known Limitations & Side Effects

- Scan is pattern + read-based; dynamic re-exports or string-built imports could evade import greps
  (mitigated: tsc reachability + barrel checks for dead-code claims).
- Rate-limit presence was verified only where read (`bot-scanner` has STANDARD limiting; limiting is not
  a substitute for authentication).
- Stripe webhook signature verification noted as assumed from prior FIDs; not re-verified this session.

## 8. Follow-ups / Prevention

- Adopt a lint rule (like FID-016) for `console.log` in `lib/**` to hold logging discipline once Wave 3 lands.
- Consider `no-restricted-syntax` guard against `.get('username')`-style identity in API routes after Wave 1
  fixes establish the session-derived pattern.

## 9. Closure (remediation executed same session, operator-approved "all four waves")

### §9.1 Wave 1 — session identity (§3.1a/§3.1b) ✅
- `app/api/bot-scanner/route.ts`: session-derived username via `getAuthenticatedUser`; query `username`
  ignored; 401 when unauthenticated. Scan + status both scoped to the caller.
- `app/api/tutorial/tracking/route.ts`: rewritten — session identity, `playerId` query ignored, and the
  raw `findOne` (which read the never-populated `row.currentCount`, the FID-20260908-001 contract bug)
  replaced with the canonical `getActionTracking` read. `moveCount` now returns the real target.
- `components/tutorial/TutorialQuestPanel.tsx`: client no longer sends `playerId` on the wire.
- Regression tests: `__tests__/api/security/session-identity.test.ts` (7 tests — 401 paths, identity
  precedence over query params, canonical count read, empty-step and missing-param contracts). All green.

### §9.2 Wave 2 — dead stack + deps + last `any` (§3.3, §3.6) ✅
- **Font Awesome note (operator challenge resolved on evidence):** the operator initially challenged the
  FA retirement ("we use font awesome very heavily"). Investigation proved the menu/player-info/resource
  icons are **lucide-react** (80 files; TopNavBar imports `User, Trophy, BarChart3, Zap, …` from lucide);
  the repo's only FA reference was the `all.min.css` import in `app/layout.tsx` with **zero** `fa-*`
  classes in any source file (verified incl. string-built classes and template prefixes). FA was removed
  as part of the wave; if any external page or stored rich-text relies on FA classes, restoring is a
  one-line `npm i @fortawesome/fontawesome-free` + layout import.
- Deleted dead Pixi stack (Law-4 proven): `components/map/MapContainer.tsx` (704), `GridRenderer.tsx`
  (452), `PlayerMarker.tsx`, `components/map/index.ts` barrel. Live symbol `generateMockMapData` relocated
  verbatim into `lib/mapService.ts` (only live consumer repointed). Direct-file imports were re-checked
  after the barrel scan — catching the `GridRenderer` import in `app/map/page.tsx` before deletion.
- Removed 7 dependencies: `pixi.js`, `chart.js`, `react-chartjs-2`, `@heroui/react`, `@heroui/styles`,
  `@types/react-joyride`, `@fortawesome/fontawesome-free` (+ its render-blocking all.min.css layout import).
- Last `any`: `lib/db/schema/config.ts` `$type<any>` → exported `GameConfigPayload` union
  (`Partial<BeerBaseConfig> | StoredHotkeyConfig | WarfareConfig`); `StoredHotkeyConfig` promoted from the
  hotkeys route to `types/hotkey.types.ts`. The union surfaced the table's real polymorphic design.

### §9.3 Wave 3 — performance + logging (§3.4, §3.5, §3.8) ✅
- **build-unit (`app/api/player/build-unit/route.ts`): the "N+1" was also a silent live bug.** The loop
  filtered on `{ _id }` — no such column on `factories` (composite PK x/y) — so the shim's unmapped-key
  guard matched nothing and `usedSlots` never filled. Fixed to composite-PK filters AND batched into one
  `bulkWrite`, with a `modifiedCount` mismatch warning. (`factoryId`/`slotsUsed` dead fields removed.)
- **clan RP distribution (`lib/clanDistributionService.ts`):** per-recipient select loop → one
  `inArray` username-resolution query; per-grant updates retained (distinct amounts per row).
- **Polling visibility-gating:** 5 server pollers now skip `document.hidden` ticks (TopNavBar activity +
  WMD threat, FriendsList 2s presence, FriendRequestsPanel, ModerationPanel, PassiveIncomeDisplay).
  Client-only timers (clocks/countdowns) untouched.
- **Logging discipline:** all client `console.log` (56 sites, 14 files) → dev-gated `lib/logger`
  `logger.debug/info`; all `console.log` in `app/api/**` routes (17 sites, 7 files) → structured
  productionLogger (`log.info` for operational records, `debug` for dev chatter). Census now **0** outside
  `lib/`. ESLint `no-console` guard added (app/components/context/hooks, warn/error allowed, tests
  excluded) so it cannot regress. **Deferred:** ~286 sites inside `lib/` services (recorded §8).

### §9.4 Wave 4 — TODO burn-down (§3.2) ✅ (partial by design)
- Logs trio: `logs/activity`, `logs/stats`, `logs/player/[id]` — stubbed `isAdmin = false` replaced with
  the session's `isAdmin` claim (`payload.isAdmin === true`), the same trust anchor every other route uses.
- `app/api/beer-bases/route.ts`: GET/POST/PUT now require `user.isAdmin` (was auth-only); TODO retired.
- `app/api/chat/online/route.ts`: clan-channel presence filter is real — one clans roster query per
  request annotates presence rows with `clanIds: Set<string>`; `canAccessChannel` checks membership.
  TODO retired. Remaining chat TODOs (moderation WS events, markMessagesAsRead, rank-change tracking,
  stats battle/territory tracking) are feature work, not violations — recorded as open items.
- §3.10 parser fold: already satisfied by FID-022 (`lib/tutorialHelpParser.ts` is the single source).
- TODO census: ~60 → 43 (the remainder are feature-work markers, not auth/placeholder violations).

### §9.5 Gates (final)
- `tsc --noEmit`: **0 errors**
- `eslint .`: **0 errors**, 3 pre-existing `exhaustive-deps` warnings (untouched, out-of-scope record kept)
- `vitest run`: **369 passed / 1 skipped** (7 new session-identity regression tests)
- `next build --webpack`: **passes** — every route compiles post-deletion
- `no-console` guard: green; suppressions added: **0**

### §9.6 Deliberately deferred (operator decision bank)
- lib/ service `console.log` → productionLogger conversion (~286 sites)
- Remaining 43 TODOs (feature work: chat moderation WS, stats tracking, VIP Stripe save, etc.)
- God-file decomposition (§3.9) — touch-when-touched policy
- Possible deletion of the legacy `/api/player/build-unit` route (fixed in place this session; the live UI
  uses `/api/factory/build-unit`) — verify no external consumers first

### §9.7 Commit staging plan
Single commit: all code changes + this FID + session log update. Message: `fix(security+perf): FID-20260909-023 — session identity on bot-scanner/tutorial tracking, dead Pixi stack + 7 deps removed, factory usedSlots write bug fixed, polling visibility-gated, logging discipline + no-console guard`.
