# Changelog

DarkFrame uses Savant Versioning — see `docs/SAVANT-VERSIONING.md`
(base-10 iteration counter; current: `VERSION` file). Every entry below
shipped on `main` — there is no Unreleased section; merged means released.
Older sessions predate versioning adoption and are kept as dated history.

## [0.0.31] — 2026-09-19 session

### Added — FID-20260919-018: clan WMD consequences are live — post-attack cooldowns and retaliation rights (closed, commit `6ee7e79`)

- **Missile launches are no longer consequence-free.** A clan that bombs another now takes the documented post-attack consequences (`dev/architecture.md`: "24-72hr cooldowns, retaliation windows"), and the victim clan can retaliate.
- **The mechanic had to be fixed before it could be wired.** `applyClanWMDCooldown` computed `cooldownUntil` and then wrote `bankTreasuryMetal = bankTreasuryMetal` — a self-assignment that never set the cooldown column; `isClanOnWMDCooldown` unconditionally returned `false`; and nothing in the launch path consulted either. Wiring the module as-is would have enforced nothing.
- **Cooldowns are enforced at launch** (`launchMissile`), scaled by warhead: TACTICAL 24h · STRATEGIC 36h · NEUTRON 48h · CLUSTER 60h · CLAN_BUSTER 72h. A clan on cooldown is refused — **unless** the launcher holds a live retaliation right against the target's clan, which is then consumed. That is the consumer retaliation rights never had.
- **Retaliation rights** are granted to every member of the victim clan on detonation (30-day window) and are now readable and consumable; `clan_relations` (ENEMY, canonical sorted pair) and `wmd_retaliation_rights` gained real consumers instead of hanging off dead code.
- **The reputation penalty was re-targeted** from per-member `players.researchPoints` — the tech-tree currency, which the coded magnitudes (2,000–25,000) drove deeply negative — to the **clan research pool**, floored with `GREATEST(0, …)`.
- **Migration 0039 (timestamptz):** the cooldown and retaliation timestamps were `timestamp without time zone` while being compared against `now()`, so a 24h cooldown read back as **28h** under the process UTC offset and retaliation rights expired early — the same class FID-20260916-009 D2 fixed for `protection_until`. Converted with `AT TIME ZONE 'UTC'`; all four columns verified in the dev DB.
- **Lint hazard fixed by rename, not suppression:** `useRetaliationRight` → `consumeRetaliationRight` (the `use*` prefix collides with React's hook namespace and tripped `react-hooks/rules-of-hooks` in this non-React service module).
- **Correction recorded honestly:** an in-flight claim that this module's `rr_` id overflowed a `varchar(24)` PK was wrong — the column is `varchar(50)` and the id fit. No overflow existed here; the `generateId()` normalization is convention only, and the misleading comment and probe label were corrected.
- Evidence: 11 pins + **16/16** live probes (two throwaway clans; the real `launchMissile` refuses a cooldown-clan launch, then a retaliation right lets the victim's launch through and is consumed). Suite 1285/1285, tsc 0, eslint clean; census 57 tables — 57 live, 0 ticketed, 0 violations.
- **Still open (deliberate, not an omission):** the retaliation *window* duration (currently 30 days) and whether retaliation rights should surface in the UI are product calls.

## [0.0.30] — 2026-09-19 session

### Changed — FID-20260919-017: the Law-17 ticket queue is cleared (5 tables removed, 3 disused writers repaired and surfaced; closed, commit `da29f5b`)

- **The schema-consumer census is now clean: 57 tables — 57 live, 0 ticketed, 0 violations.** The 8 tables the Law-17 gate had ticketed were triaged (evidence in `dev/LAW17-TICKET-TRIAGE-2026-09-19.md`) and dispositioned by the operator.
- **Removed** (migration 0038): `achievements` (read-only — it had no writer; the live store is `players.achievements`, and the admin stats route now rolls up that jsonb), `wmd_votes` (zero references; superseded by `wmd_clan_votes`), `wmd_consequence_events` (its only writer sat behind `applyClanWMDConsequences`, which has zero callers), `wmd_resource_pools` and `wmd_defense_grids` (reachable writers but no reader and no UI concept).
- **Wired — and three real bugs fixed:** `wmd_intelligence_reports`, `wmd_counter_intel_operations`, and `wmd_interceptions` each had a *reachable* writer whose generated PK overflowed `varchar(24)`, so the inserts failed — every successful spy mission threw during completion, counter-intel sweeps silently recorded nothing (caught by a swallow), and a successful interception returned 500. All three now use `generateId()` (23 chars).
- **Readers added** — the logs were write-only until now: an intel **Reports** view in `WMDIntelligencePanel` (reports + counter-intel sweeps) and an **Interception Log** in `WMDDefensePanel`, served by `/api/wmd/intelligence?type=reports|counter-intel` and `/api/wmd/defense?history=1`.
- Gates: suite **1274/1274** (131 files, 12 pins), tsc 0, eslint clean; live driver **11/11**; census 57 tables — 57 live, 0 ticketed, 0 violations. Recorded for a separate disposition: the entire `clanConsequencesService` module is unwired.

## [0.0.29] — 2026-09-19 session

### Changed — FID-20260919-016: the WMD alert tables consolidated onto `wmd_alerts` (closed, commit `21b2d34`)

- **Two alert tables for one event class became one.** `wmd_alerts` and `wmd_admin_alerts` were near-twins. `wmd_admin_alerts` was the live one (both writers, both readers); `wmd_alerts` was the richer original design — incident references (`missileId`/`voteId`/`operationId`), a channel/delivery model, an acknowledge/resolve lifecycle — that had never been written to once. The ticketed orphan is now the canonical table; the slim twin is retired.
- **Grounding overturned the directive's premise.** The earlier report claimed `wmd_alerts` had a live reader (the admin health surface). It did not — that endpoint read `wmd_admin_alerts`. FID-20260919-011's removal migration had kept `wmd_alerts` on the same false claim. Adding a writer would have created a second parallel alert log; consolidation removes the duplication instead.
- **Writers → `wmd_alerts`:** `createAdminAlert` (status `ACTIVE`, payload in `data`) and `missileTracker.recordAdminAlert` (status `ACTIVE`, and it now populates the `missileId` reference column the slim table lacked). **Readers → `wmd_alerts`:** the admin health endpoint counts/selects `WHERE status = ACTIVE`, so RESOLVED/ARCHIVED alerts stop counting as unacknowledged; `getWMDSystemStatus` maps `data → details`.
- **Migration 0037** (idempotent: guarded source, `ON CONFLICT (id) DO NOTHING`, `DROP IF EXISTS`) moved the 8 live rows (`details → data`, `OPEN → ACTIVE`) and dropped `wmd_admin_alerts`.
- Gates: suite **1262/1262** (130 files, 12 pins), tsc 0, eslint clean; live driver **8/8**; Law-17 census 62 tables — **54 live, 8 ticketed (was 9)**, 0 violations.

## [0.0.28] — 2026-09-19 session

### Added — FID-20260919-015: all four Law-17 ticketed tables gain live consumers (closed, commit `32c6f85`)

- **`chat_read_status` — channel unread badges that survive refresh.** They were socket/session-only memory (lost on every reload) and PATCH `/api/chat` was a documented no-op. Now: migration `0036` adds the unique `(channel_id, user_id)` pair; `lib/chatReadStatusService` upserts mark-read state and serves a per-user map; GET `/api/chat/read-state` (new) plus a real PATCH `/api/chat`; ChatPanel seeds unread-since-last-visit on mount and persists on channel switch and inbound messages.
- **`shrine_blessings` — persistent boost-grant history.** `lib/shrineBlessingService` records one row per grant (yield bonus as integer percent at the DB boundary, matching the column type) and serves the ledger; non-fatal inserts in `/api/shrine/activate` and `/api/shrine/boost-all`; GET `/api/shrine/blessings` (new); ShrinePanel gains a "Recent Blessings" summary — something the current-expiry-only jsonb can never provide.
- **`wmd_config` — real alert configuration.** `lib/wmd/admin/alertConfigService` reads table-first with the hardcoded default as fallback and upserts on write; the enabled/minSeverity gate is now consulted by **both** alert writers (`createAdminAlert` and `missileTracker.recordAdminAlert`); GET/PUT `/api/admin/wmd-config`; AdminView shows the active config.
- **`wmd_suspicious_activity` — reachable at last.** The writer `flagSuspiciousActivity` had existed since FID-20260903-002 with zero callers and no reader. `lib/wmd/suspiciousActivityService.flagExcessiveLaunches` counts 24h launches, flags at the threshold exactly once per window (dedupe read), fires non-fatally from the missiles launch-success path, and the admin route + AdminView surface the rows.
- **Latent defect caught en route:** `flagSuspiciousActivity` / `createAdminAlert` built 28- and 29-char ids into `varchar(24)` columns — invisible while the writers were unreachable, a guaranteed insert failure the moment they gained callers. Both now use the 23-char `generateId()`.
- Gates: suite **1254/1254** (129 files, 23 new pins), tsc 0, eslint clean; live probe **15/15**; Law-17 census 63 tables — **54 live (was 50)**, 9 ticketed, 0 violations.

## [0.0.27] — 2026-09-19 session

### Added — FID-20260919-014: Law 17, the schema-consumer law, enforced as pre-push Gate 4 (closed, commit `3ec3752`)

- **The standing law:** every drizzle table in `lib/db/schema/` must be LIVE — a writer path and a reader path exist outside its defining file — or carry a removal ticket (a filed, dated FID dispositioning it). No pointer, no ticket, no schema. This outlaws the class that produced `wmd_alerts` (never written), `wmd_notifications` (never read), and the phantom `clan_chat`.
- **Mechanical enforcement:** `scripts/schemaConsumerCensus.cjs` classifies every exported pgTable (live / write-only / read-only / no-consumer), recognizes removal tickets from `dev/fids/` content, and fails closed — a synthetic ghost table was verified to refuse with exit 1. Wired as pre-push Gate 4 beside the inverted-route census.
- **The law caught four ghosts on its first run** — `chatReadStatus`, `shrineBlessings`, `wmdConfig` (zero code references anywhere) and `wmdSuspiciousActivity` (write-only via an unreachable writer) — none of which had appeared on any prior survey. All four are ticketed in the FID's §4; SCOPE row 112 carries their wire-or-remove follow-ups. Prior FID-dispositioned ghosts (achievements, the wmd family from FID-011/-013) are recognized as ticketed.
- **Protocol amended:** Law 17 added to `dev/echo-v0.1.2-single-agent.md` (summary table + full section with the probe procedure) and `extended_laws` in `protocol.config.yaml`. Pre-existing corruption in the summary table (truncated row 14, duplicated row 15) repaired in passing.
- Gates: suite 1231/1231, tsc 0, eslint clean; census state: 63 tables — 50 live, 13 ticketed, 0 violations.

## [0.0.26] — 2026-09-19 session

### Added — FID-20260919-013: live player-notification delivery (closed, commit `746b920`)

- **One seam for every player-directed event** (`lib/playerNotification`): persist to the System DM inbox (the badged, real-time surface from FID-20260919-004) and push the exact FID-004 wire payloads (`message:receive`, `conversation:updated`) plus a new typed `notification:push` event to the player's socket room. 60s dedupe window keeps sweep reprocessing from double-notifying; scheduled-job contexts degrade to DB-only delivery when no socket server exists.
- **Auction outcomes now push live.** They previously wrote inbox rows directly, bypassing `messagingService`, so a player online at sale time learned of the sale only on next page load. All six event types (outbid, sold seller/winner, expired, refund, settlement) flow through the seam.
- **WMD events reach humans, not just tables.** Missile interception now notifies the target *and* the launcher (previously only the audit row); impact notifies the target; research completion is seam-delivered and the orphaned `wmd:research_complete` emitter finally fires — the WMDHub toasts that have been mounted and waiting since 2025-10 now receive their event.
- **Evidence:** 7 pins on the seam (persist shape, wire contracts via the production payload mappers — now exported, dedupe, inboxless guard, lazy conversation creation, io-null degradation, non-fatal failure); live probe 12/12 against the running server: a real listing → buyout produced the persisted System DM with unread bump, all three socket events on the seller's live connection, and a dedupe drop on re-delivery. Suite 1231/1231, tsc 0, eslint clean.

## [0.0.25] — 2026-09-19 session

### Fixed — FID-20260919-012: the census found real defects under rot-shaped TODOs (closed, commit `1ca470a`)

- **DELETE /api/chat lied.** The moderator endpoint returned `success: true, "Message deleted"` without deleting — its body was a commented-out TODO. It now performs the admin-gated (`moderationService.isAdmin`) soft-delete via `chatService.deleteGlobalChatMessage` (which already existed, unused) and returns honest 404s for missing/already-deleted messages. Owner self-delete on `/api/chat/delete` was already live and untouched.
- **Every clan disband crashed.** `disbandClan` ran raw `DELETE FROM clan_chat` — a table that never existed (the live DB carries `clan_chat_messages`) — throwing mid-transaction after members were already cleared. Corrected and pinned against the committed migration set.
- **Dead false-advertising UI removed:** the unmounted `app/admin/vip` page (465 lines, including a fake-success cancellation toast), the game page's unreachable "Battle Log View / Inventory View - Coming Soon" blocks (zero `setCurrentView` callers; live equivalents exist), and the `game:request_tile_info` socket stub with no emitter.
- **Doc truth sweep:** "placeholder authentication" claims rewritten on routes that have had real session auth all along (chat route header + IMPLEMENTATION NOTES, chat/delete docblock, chat/edit's stale double docblock); MessageThread's commented real-time sketch (the wiring shipped in FID-20260919-004); ChatPanel's shipped ask-veterans TODO (FID-20260919-005); the help page's "PvP combat is coming soon!" (PvP has been live since the protection arc).
- Recorded (not built): auction `clanOnly` is a silent API-only lie (fee differential live, enforcement commented, no UI can set it — product call needed), channel mark-as-read, chat channel-ban wiring, moderator undelete + `message:deleted` fan-out, `BattleLog` type duplication.
- Gates: suite 1224/1224 (9 new pins), tsc 0, eslint clean.

## [0.0.24] — 2026-09-19 session

### Changed — FID-20260919-011: ChatPanel docs tell the truth; the never-wired notification stack is gone (closed, commit `6f08696`)

- ChatPanel's two IMPLEMENTATION NOTES blocks still advertised Task-10-era "WebSocket placeholders" and pointed at the archived ChatMessage corpse — the false-premise generator behind three stale survey findings this week. Both blocks are rewritten to shipped reality with FID pointers (live socket subscriptions, item links, edit/delete paths, server-side rate limiting where it actually lives); the single remaining honest TODO is virtual scrolling (react-window was never installed).
- The notifications stack's survey premise was overturned on the way to disposition: the three tables (player_notifications, admin_dashboard_notifications, email_queue) were not "unwritten" — lib/wmd/admin/alertService wrote them — but the writer was unreachable (zero trigger callers anywhere, no email sender consumed the queue, no reader surfaced) and every table held 0 rows: the stack never fired once. Removed the schema definitions, re-exports, barrel line, and alertService (6f08696 deletes ~790 dead lines); migration 0035 (idempotent) drops the tables. The wmd_alerts SOURCE table stays — it has a live reader in the admin health endpoint.
- Gates: suite 1215/1215, tsc 0, eslint clean; post-migration DB verified (only wmd_alerts remains of the four).

## [0.0.23] — 2026-09-19 session

### Added — FID-20260919-010: RP packages checkout — the shop's dead button takes real money (closed, commit `89cc34b`)

- Every Purchase button on /shop/rp-packages now creates a real Stripe Checkout session (mode=payment, test-mode session created live through the real route) and redirects to Stripe's hosted page — the "🚧 Stripe integration pending" placeholder is gone. The client sends only a packageId: price and RP come from a single-source server map (lib/stripe/rpPackages) that the page's display list mirrors at compile time, so no client-owned number exists anywhere in the purchase surface.
- The webhook's RP branch rides the FID-20260917-009 law: idempotency probe on stripeSessionId (a redelivered event never double-credits), RP resolved from the server map (session metadata's rp value is informational — proven by a probe where metadata lied), username-keyed grant, ledger row only after a confirmed grant (tier rp:<packageId>), and throw-on-false so Stripe retries failed grants.
- Evidence: 15 pins (behavioral + keying), 11/11 live probes — signed webhook events with real signature verification, exact-once grant, failed-grant 500 with no ledger row, VIP path untouched and dispatch-guarded. Suite 1215/1215, tsc 0, eslint clean. Going live needs only live-mode Stripe keys.

## [0.0.22] — 2026-09-19 session

### Added — FID-20260919-009: tradeable listings complete — escrowed instance trading with real names (closed, commit `08410d6`)

- The auction's blocked front door is open: tradeable listings are genuinely escrowed, replacing the TRADEABLE_NOT_TRADEABLE_YET prohibition (FID-20260914-003's transfer branch was an empty TODO — buyers paid and received nothing, so creation was gated). Sellers now pick inventory instances by id; a pure planner (lib/tradeableEscrow) removes whole instances server-side, the listing freezes a per-instance snapshot (name/rarity/type/bonus/foundAt/foundDate), delivery mints fresh buyer-side instances preserving identity, and cancel/expire refund the originals with their ids intact.
- Real names end to end: the listing card, notifications, name-search, and chat item links all carry procedural names — the "Tradeable Item" placeholder is retired from the live surface. Chat links resolve verified tradeable names to market deep-links with tab preselection (catalog OR live-listing check in the game-page opener).
- Two defects the live probe caught before landing: escrow snapshots dropped type/bonusPercent/foundAt (delivered rows were typeless — every type-filtering consumer broken) and refunds spread itemId verbatim, minting id-less inventory rows. Both fixed at the source and pinned.
- Evidence: 9 pins (+1 rewritten honestly — the old pin codified the prohibition; its rejection-before-fee invariant is preserved under the new gate), 14/14 live probes (escrow → search → buyout → delivery → cancel → residue), suite 1200/1200, tsc 0, eslint clean.

## [0.0.21] — 2026-09-19 session

### Added — FID-20260919-008: chat item links land on a searchable market (closed, commit `ba16ab4`)

- Typing `[T1_SCOUT]` or `[metal]` in any chat channel now renders a market link; clicking it opens the auction house on `/game?market=<name>` pre-filtered to the item, with the category tab preselected. Invalid bracketed names stay literal text — only the real catalog (every unit type plus metal/energy) becomes a link.
- Foundation honesty: `validateItem` was a stub returning false for every name (its "items table not in schema" TODO was still pending), and no items table exists — the catalog is UNIT_CONFIGS + ResourceType. `lib/catalogService` is that truth; the item-link route now reports existence accurately through it. `lib/chatItemLinks` carries the parse/resolve semantics as a pinned pure module.
- The auction list API and panel gained a name search (ILIKE over the listing doc's item identity, LIKE wildcards stripped from user input) — the deep-link destination that makes chat links useful.
- Evidence: 14 pins, 8/8 live probes (including a self-validating filter check against a live listing), suite 119/1191, tsc 0, eslint clean. Tradeable-item naming (needs an items table) recorded as out of scope.

## [0.0.20] — 2026-09-19 session

### Added — FID-20260919-007: factory owners can jump to the unit factory from their tile (closed, commit `a266d5f`)

- The map-tile "Manage Factory" button — commented out since the original build with a TODO for a management page that never shipped — is live for factory owners, navigating to `/game/unit-factory` per the operator decision. The guard mirrors the live ownership comparison (`Factory.owner` holds the username; ownerless factories never match).
- Repair honesty: the commented block referenced a `router` binding that never existed (the component's real binding was the unused `_router`), and the components barrel still re-exported the chat barrel deleted in FID-006 — a latent tsc break the test suite cannot catch. Both fixed; barrel now re-exports ChatPanel directly.

## [0.0.19] — 2026-09-19 session

### Changed — FID-20260919-006: chat profile navigation is live; the ChatMessage corpse archived (closed, commit `73754dc`)

- Message sender usernames in the chat panel are now real navigation: clicking one routes to `/profile/<username>` (the profile page has existed since the pg era — the click was the only missing piece).
- Grounding correction: the survey's "two tiny polish gaps" (ChatMessage's `onProfileClick` and item-click TODOs) cited a dead component — zero importers, superseded by ChatPanel's own inline renderer; the chat barrel itself was imported by nothing. Both move to `dev/archives/2026-09-19-dead-ui/` (annex + manifest refreshed; the FID-003 census missed them behind the barrel re-export).
- Recorded as the feature call it actually is, not silently dropped: chat item linking (live-renderer `[ItemName]` parsing plus AuctionHousePanel name-search/deep-link — the panel has no name search and the house is a game-page modal, not a route).

## [0.0.18] — 2026-09-19 session

### Fixed — FID-20260919-005: ask-veterans was a false-success feature; now delivers (closed, commit `cdfaee7`)

- The full newbie-help chain was dead at every hop while the UI reported success: the client POSTs `/api/chat/ask-veterans` (the socket path with a working broadcast handler was never emitted by anything), the route broadcast nothing (its own "Task 3" TODO), `sendVeteranNotification` built a notification object and returned it — no persist, no emit — and the success toast read `notifiedCount`, a field only the unreachable socket path ever produced. Live players saw "Notified undefined veteran players (Level 50+)" over a silent void; the census made it sting (54 of 78 players are level ≤10, the exact cohort the feature serves).
- `lib/veteranBroadcast.ts` (new): the single broadcast seam — maps the service notification onto the declared `ChatVeteranNotificationPayload` (UUID id, `help` channel, 5-minute TTL matching the ask cooldown), fans out over connected sockets filtered by `isVeteran`, returns the honest count. Both the HTTP route (via the `getIO()` globalThis bridge) and the socket handler ride it.
- The route now returns `notifiedCount`; the client gates on `res.ok`/`success` — 403 level caps and 429 cooldowns surface the server's message instead of a false success toast — and toasts the real count.
- Veterans receive `chat:veteran_notification` (previously subscribed by nobody) as a 30-second toast: "Help request — <username> (Lv N) asks: <question>".
- Evidence: 7 pins; live probe 8/8 over real HTTP + two authenticated sockets (response count, exact payload truth with TTL, non-veteran exclusion, real-429 twin). Suite 118/1177, tsc 0, eslint clean.

## [0.0.17] — 2026-09-19 session

### Added — FID-20260919-004: DM real-time, end to end (closed, commit `4362e82`)

- Grounding refined the directive's premise: the messages page already had full subscriptions for `message:receive`, `conversation:updated`, `message:read`, and `typing:*` — the gap was that **no live path emitted any of them**. The HTTP send path (`sendDirectMessage`) persisted silently; the socket send path emitted to `user_${id}` rooms while clients join `user:<id>` (colon — `WebSocketRooms.user`); typing emits in the thread were commented-out TODOs; read receipts never broadcast.
- `lib/messagingBroadcast.ts` (new): the single source of truth for DM wire emission — payload mappers plus a personal-room fan-out where one participant's emit failure never suppresses the others'. Both service seams (`sendDirectMessage`, `markMessagesAsRead`) ride it; `getIO()` null (bare `next dev`, no custom server) degrades gracefully to polling.
- Room addressing fixed at 5 sites in `messagingHandlers` — the dead `user_${id}` form could never have delivered to any client.
- `MessageThread` is live now: real typing emits with auto-stop, incoming-message append (own echoes skipped, id-deduped), typing indicator display, and read receipts flipping the sender's ticks in real time. Conversation/actor ids ride refs so listeners register once per socket identity.
- Gates: suite 117/1170 (+7 pins), tsc 0, eslint clean; live probe 11/11 over real HTTP + authenticated sockets with residue zero.
## [0.0.16] — 2026-09-19 session

### Removed — FID-20260919-003: the dead-UI generation archived (closed, commit `9a46891`)

- Thirteen superseded components (~3,151 lines) left `components/` for `dev/archives/2026-09-19-dead-ui/`: AutoFarmStatsDisplay, BalanceIndicator, BattleLogModal, BattleLogViewer, BattleStatsPanel, CombatAttackModal, FactoryButton, FundDistributionPanel, HarvestButton (+ its orphaned test), HarvestStatus, LevelUpModal, PassiveIncomeDisplay, XPProgressBar. Census re-probed fresh before the move (barrel-only references; dynamic-import swept; the "live" HarvestStatus hits were the `getHarvestStatus` service function and the separate live `TileHarvestStatus`).
- `components/index.ts` dropped 9 export lines + 2 stale comments; `StatsPanel.test.tsx` lost two vestigial `vi.mock` blocks mocking modules StatsPanel never imported.
- The batch corrected a reachability pin that had been green for the wrong reason: the slice-2 "harvest route has a live client caller" test read the archived dead `HarvestButton.tsx` as its evidence — it now cites the real live callers (`HarvestModal`, `app/game/page.tsx`).
- BalanceIndicator's archive README carries the survey-P1 caveat: the STR/DEF balance mechanic (`balanceService`) is live and load-bearing; if the mount-or-delete decision lands "mount", design against current shapes rather than resurrect the stale file.
- Gates: suite 116/1163, tsc 0, eslint clean, census zero outside the archive.

## [0.0.15] — 2026-09-19 session

### Added — FID-20260919-002: chat is real-time on the client (closed, commit `d1b390b`)

- ChatPanel now subscribes to the live socket emissions instead of riding three HTTP polls: `chat:message`, `chat:typing_start/stop`, `chat:online_count`, and `chat:message_deleted`, via `lib/chatSocketWiring` — pure, pinned transitions with poll-identical semantics (id-dedupe so sender echo and poll copies never duplicate, self-filtered typing, per-channel maps, unread increments only for non-active channels). Polls remain as reduced-cadence gap-fillers.
- Typing indicators are real signals now: emits go socket-first (`chat:start_typing`/`chat:stop_typing`) with the HTTP endpoint as pre-connection fallback; the previous stop path was a no-op comment.
- Live probe (12/12, `scripts/e2eChatSocketLive.ts`, two authenticated sockets + real HTTP against `tsx server.ts`) exposed and fixed four server-side defects: the connection handler registered every event listener only after awaiting three DB-bound setup calls — **any client emit in that window was silently dropped** (reordered: listeners first, setup after); `/api/chat/delete`'s deletion broadcast was a dead path (`notifyMessageDeleted` had zero callers and the route carried a TODO — wired via `getIO()`, plus a globalThis bridge because webpack route bundles each got their own module copy with `io === null`); the declared S2C type map advertised events nothing emits while the real ones were untyped (corrected to server truth); the dead parallel chat layer (`handlers/chatHandler.ts` + two broadcast functions, zero external consumers) deleted.
- Gates: suite 116/1163 (+16 pins), tsc 0, eslint clean; live probe green end-to-end with residue zero.
## [0.0.14] — 2026-09-19 session

### Fixed — FID-20260919-001: auction unit-listing honesty + the listing-insert 500 (closed, commit `123d5e2`)

- Unit listings now derive stored stats from the escrowed unit server-side — client-supplied `unitStrength`/`unitDefense`/`unitType` are overwritten from the FID-20260914-003 snapshot and can no longer fabricate what buyers see. The listing card prefers snapshot stats (`lib/auctionDisplay`), healing pre-fix listings whose snapshots were real but whose scalars were lies.
- `CreateListingModal`'s unit flow was broken end-to-end (no `unitId` — every UI attempt rejected since unit escrow shipped): replaced with a real picker over the seller's actual units, with a post-escrow player refresh so the army view stays truthful.
- Out-of-scope defect found by the live probe and fixed: `syncAuctionDocFields` leaked raw booleans past its flat-key-wins guard into pg smallint mirrors — **every auction listing INSERT failed with `invalid input syntax for type smallint: "false"` since the batch-4 auction rewrite**. Booleans now coerce unconditionally (update paths were already safe via `auctionSet`).
- Gates: suite 115/1147 (+6 pins), tsc 0, eslint clean; live probe 15/15 over real HTTP + dev DB with residue zero.

## [0.0.13] — 2026-09-19 session

### Removed — the Mongo shim is deleted: lib/mongodb.ts gone, packages uninstalled, eradication gate wired (chain `f827655` → `1f66c5a`)

- The shim that had served as quarantined compat layer since the pg pivot is gone — 13 files, −2,786 lines (`1f66c5a`). Zero runtime importers since FID-20260917-017; every route, service, script, and server.ts entry point rides drizzle/pg directly.
- Retired with the shim: the collection census (script + liveness pins), the shim-semantics pins (`shimUpdateSemantics`, `pushOperandAndPower`), `verifyShimSemanticsLive`, the opt-in friends live-DB integration suite (the suite's lone skip — it pinned the dead stack), and vitest setup's in-memory MongoDB block (`TEST_MONGO_MEMORY` opt-in removed with the package).
- Two real conversions closed the gap: `spawnBots` (bot count + insert via `mapDomainPlayerToRow`; phantom isBot cooldown dropped) and `archiveOldLogs` (archive/preview/cleanup on drizzle; admin-tier retention mirrored to the live single-window semantic — `player_activity` has no category column).
- `mongodb` + `mongodb-memory-server` uninstalled. Provenance comments naming the shim remain (accurate history); two stale dependency headers corrected to name `lib/db/connection`.
- Pre-push Gate 3 rewritten as a total-eradication census: any mongodb module/package/env reference outside `__tests__` (which keeps its legitimate negative-assertion pins) refuses the push — verified live with a planted violation. Gates at deletion: suite 114/1141, tsc 0, eslint clean, census zero.

## [0.0.12] — 2026-09-19 session

### Changed — FID-20260917-017 closed: complete Mongo-shim decomposition, lib + app/api at zero runtime importers (chain `fb5b702` → `bcffa73`)

- Batch 4 finished the 17 relative-import lib services + 2 trivia + the barrel re-export (`c9c3189`…`bcffa73`), completing the slice chain that had already taken every app/api route off the shim. All data access now rides drizzle/pg directly; the shim survives only as a quarantined module behind test `vi.mock` sites. Notable conversions: tierUnlockService's atomic `$inc`+`$addToSet` compound became a guarded `UPDATE … RETURNING`; auctionService rides the shared doc-bridge so `auctions.doc` stays synced with column writes (Law 13).
- Defects the conversion surfaced and fixed: botScannerService's phantom `lastBotScan` write (500ing every scan — no column, no readers), beerBaseService's three schedule writers that had been silent no-ops since the pg pivot, leaderboard's computed-then-discarded out-of-top-100 profile, and cacheWarming deleted outright (zero callers, unread keys, phantom sort columns).
- Pre-push Gate 3 wired: the Mongo-shim runtime census runs fail-closed on every push — any runtime importer under lib/ or app/ refuses the merge, so the decomposition cannot silently regress. Test-file mock sites are documented-exempt.
- Pin suites rebased onto the new drizzle seams preserve every behavioral assertion (settlement suite now a stateful simulation with detached-row read semantics); suite 1166 green, tsc 0, eslint clean at closure.
- Test-mock sweep: all 9 `vi.mock('@/lib/mongodb')` sites in test files were empirically verified vestigial (each file green with the mock deleted — the drizzle seams replaced them) and dropped; what remains referencing the shim in tests is intentional — negative-assertion quarantine pins, the shim's own semantics pins, and the opt-in live-DB integration suite.

## [0.0.11] — 2026-09-17 session

### Added — FID-20260917-014: referral validation on login (closed, commit `1bd818b`)

- pg referrals can now actually validate: `processLoginReferralEvents(username)` hooks `POST /api/auth/login` with an indexed early return for the no-referral common case, maintaining `referrals.loginCount`/`lastLogin` — previously written only at referral creation, which made the 4-login criterion **unreachable by construction** — then running the existing `checkReferralValidation → validateReferral` reward chain when 7d + 4 logins are met. Exclusions per the loop: invalidated and abuse-flagged referrals never auto-validate (admin manual path intact); `validateReferral`'s validated flip is now a conditional claim (`UPDATE … WHERE validated = 0 RETURNING`) so multi-device logins or a racing admin validation cannot double-pay. The hook replaced the login route's dead Mongo-era `lastActive` block (silent no-op since the pg pivot). 8 pins; live probe 10/10 against the real dev DB.

### Changed — FID-20260917-015: Cluster B batch 1 — stats, check-name, tutorial ×2 off the Mongo shim (closed, commit `81a4d02`)

- The census's "trivial" slice rewritten contract-pinned: `/api/stats` gets the SQL `orderBy(...).limit(10)` leaderboard (the census's noted perf win) + one aggregate + COUNT probes, with power **derived** as `totalStrength + totalDefense` (D1: `total_power` is not a pg column — matches `rankingService`); `/api/clan/check-name` uses `lower()` equality, killing the user-input `RegExp` seam; tutorial eligibility read + restart delete on pg `tutorial_progress`; the decline route's connection theater removed. 8 pins; live HTTP probe 16/16. Fresh census re-size: 73 `lib/mongodb` importers, 15 direct `clientPromise` users (the audit's 13 was stale).

### Changed — FID-20260917-016: Cluster B batch 2 — friends/DM family + ban-player, clear-flags, logs-cleanup, build-unit off the shim (closed, commit `5496fbf`)

- All nine in-scope files cut from `clientPromise`: six were pure connection theater (friends ×2, dm ×3 — the shim client was assigned and never used); four were real rewrites carrying schema-truth fixes — bans insert generates its no-default 24-char id + NOT NULL `createdAt` with smallint flags; unban clears the five real ban columns (D4: `unbannedAt`/`unbannedBy` never existed — the Mongo `$set` mapped to nothing); `autoResolveFlags` sets `resolved = 1` with resolver evidence in `metadata` (D5); audit rows land in `mod_log` (D1: `adminLogs` matched no table); the cleanup dry-run mirrors the real deleter's single cutoff over `player_activity` (D2); build-unit preserves shim-parity resource charges as SQL deltas on the flat columns, keeps the jsonb unit-append shape, and lands the schema-contracted `investedMetal`/`investedEnergy` deltas the Mongo path never wrote (D3). 20 pins; live probe 26/26 including a build through a fresh register-route session on its own factory. Live `clientPromise` usage under `app/api` is now zero.

## [0.0.10] — 2026-09-17 session

### Added — FID-20260917-012: chat honesty — report persistence + GLOBAL block (closed, commit `d89ac93`)

- The survey P0: report/block buttons showed success toasts while doing nothing. New `chat_reports` table + `POST /api/chat/report` (reason validation, self-report refusal), surfaced to admins via `GET /api/admin/moderation?type=reports`; new `blocked_users` table + `blockService` (idempotent, self-block refused) enforced **server-side** in `chatService` (blocked sender's rows filtered via the route-supplied `viewerId`) and `messagingService` (conversations with a blocked other participant vanish) — a block applies to global chat AND DMs immediately, no client cooperation needed. Honest Report/Block buttons on live ChatPanel rows; the orphan `ChatMessage` component's stubs rewired to the real endpoints. 12 pins; block-route auth retagged to an ok-discriminant pair so handlers cannot infer an undefined fall-through under `exactOptionalPropertyTypes`.

### Removed — FID-20260917-013: dead `/api/tutorial/complete` route deleted (closed, commit `d51992f`)

- Evidence-complete deletion: zero client callers re-verified at execution across every client surface; inverted route census exit 0 post-deletion.

### Changed — FID-20260917-011: seven-item work order executed end-to-end (closed, commit `1214c3b`)

- All seven approved items landed with per-item gates: work-order filing (`233bbca`), FID-010 alliance batch + SCOPE mojibake repair (`296b48c`), triple closure 008/009/010 + CHANGELOG 0.0.9 (`85a03b4`), chat honesty (`d89ac93`), tutorial deletion (`d51992f`), row 11 closed as already-healed by the treasury-lock rework (`af7afae`), referral cron decoy deleted + guide truthed + rows 22/23 re-probed + row 92 follow-up candidate filed (`7de2230`), session record + row 89 closure (`1214c3b`). Two scope corrections by evidence: the row-11 dedupe repair had already shipped inside FID-20260917-001, and rows 22/23 were already Closed. Only new open item: row 92 (wire pg referral validation on login — candidate awaiting approval).

## [0.0.9] — 2026-09-17 session

### Fixed — FID-20260917-008: /api/player/inventory migrated to pg (closed, commit `90f7f5f`)

- The route InventoryPanel fetches every game load had survived the pg pivot on the Mongo stack — dead `playerId`-cookie auth + `clientPromise` query, 401 for every player since the pivot, silently collapsed to an empty inventory by the panel's `response.ok` guard. Rewritten on `requireAuth` (darkframe_session) + drizzle: the exact unwrapped InventoryData contract (numerics parsed, `expiresAt` ISO string). 5 pins; live probe 3/3 against a real player row (47 items).

### Fixed — FID-20260917-009: Stripe VIP money path re-keyed to username + webhook false-success killed (closed, commit `70e6b2d`)

- All four money functions (`grantVIP`/`revokeVIP`/`extendVIP`/`checkVIPStatus`) looked up `players.mongoId` — NULL for 100% of players — while checkout embeds username: the grant path was dead for everyone, and the webhook logged "VIP granted successfully" on failure while recording the payment (Stripe got 200, never retried; money captured, no VIP, no error). Lookups now key on `players.username`; a failed grant throws (→ 500 → Stripe retries) at three sites (checkout + the two previously-swallowed renewal/cancellation paths) and never records the payment; handlers moved to `lib/stripe/webhookHandlers.ts` (route = transport + signature verification). Evidence includes the double-run oracle — real handlers → real service → real drizzle expressions evaluated in-memory — proving the grant lands in state on delivery and redelivery, bystander untouched; live probe 5/5 on a mongoId-NULL clone.

### Added — FID-20260917-010: unreachable clan UI mounted (closed, commit `296b48c`)

- AlliancePanel (complete diplomacy UI + five live `/api/clan/alliance/*` routes) had zero importers — mounted as ClanPanel's Alliances tab with the full five-prop contract (`treasuryMetal` rides the sanctioned `/api/clan/[id]` payload). Mount-surface probe also found FID-20260916-012's ClanResearchPanel mounted behind a disabled tab since it shipped — unblocked. First mount-level render pins (real ClanPanel under jsdom).

### Added — pre-push census gate (commit `79293ac`)

- The inverted route census (FID-20260917-007 tool) now runs as Gate 1 of pre-push: called-but-never-built endpoints can no longer merge silently, and the gate also catches route deletions that orphan existing callers. Fail-closed on MISSING and UNPARSED; drilled end-to-end on a hermetic local bare remote (clean push accepted, poisoned push refused exit 1).

## [0.0.8] — 2026-09-17 session

### Fixed — FID-20260917-007: inverted route census + two more never-built caller rewires (closed, commit `9d75ae4`)

- The inverse of the 237-route dead-route census: every client fetch URL must resolve to an existing app/api route. New standing tool `scripts/invertedRouteCensus.cjs` (302 call sites vs 238 routes; comment-stripped, interpolation sentinels for template-literals, documented waivers, exit-1 gate).
- Found the FID-006 class twice more: `GET /api/clan?clanId=` called by StatsPanel (clan tag) and TopNavBar (nav clan badge) never existed, and both callers' silent `response.ok` guards hid the 404s — those UI elements never rendered for anyone. Both rewired to the canonical `GET /api/clan/[id]` from FID-006 (that route now serves 4 callers); no twin endpoint minted.
- Two candidates verified as waived false positives (VIP `${action}` resolves to real literal child routes `grant`/`revoke`; a commented JSDoc example) — structurally handled, not hand-waived. Census exit 0; gates tsc 0 / eslint 0 / vitest 999+1skip.

## [0.0.7] — 2026-09-17 session

### Fixed — FID-20260917-006: clan detail GET rebuilt (closed, commit `22f5889`)

- The clan sidebar view and the clan modal have both called `GET /api/clan/[id]` since 2025-10-19, but the route never existed (no deletion in history — the client was written against a planned endpoint that never shipped), so every clan-page load 404'd into "Failed to load clan data".
- The route now exists: `requireAuth` → `getClanById` → `{ success, clan }` with the full clan shape the UI consumes (inline members for the role gate, level for the header, settings, stats), house error envelopes (`CLAN_NOT_FOUND` 404), any-signed-in-player authorization (join previews need it; payload is public-class).
- 4 pins including the exact consumer reads; live probe 4/4 exit 0 against the dev DB (contract 200 / 404 envelope / 401 pass-through / cleanup). Class note recorded: the 237-route dead-route census covered existing-but-uncalled routes — this was called-but-never-built, the inverse class.

## [0.0.6] — 2026-09-17 session

### Fixed — FID-20260917-004: abandon rewire + player-log view (closed, commit `ef64421`)

- The repo-wide dead-route census (237 routes) left two true orphans, both operator-ratified Keep-and-wire: `handleAbandon` now calls the canonical `POST /api/factory/abandon` (was the superset twin `/release` in single mode), with `productionRate: 1` reset parity added; both false "DELETE ALL UNITS" strings corrected to FID-20260914-009 truth (units are unaffected by abandon).
- New `PlayerLogPanel` (all/activity/battle tabs, plain-JSON contract, combat-stats wells, outcome coloring, empty/loading/error states) hosted on the own-profile page — `GET /api/logs/player/[id]` has its first caller; both census orphans now live, zero dead routes remain.
- 6 component pins; gates tsc 0 / eslint 0 / vitest 995+1skip (baseline 989 + 6). Filing artifact: SCOPE rows 76–77; finding record FID-20260917-005 (shrine-extend premise dissolved) rode the same session.

## [0.0.5] — 2026-09-17 session

### Fixed — base indicator pill: level surfaced, legibility on bright artwork (FID-20260917-003 follow-on, commit `b8910eb`)

- The own-base corner pill now shows the level (`Base · LV n`), closing the asymmetry with enemy bases (which already displayed `· LV n`).
- Both pill variants sit on the bottom status strip's void-backing method — new shared tokens `nn-viewport__badge--green/--magenta` (dark `--nn-void` fill + matching border/glow) — so raw neon text no longer vanishes over bright base artwork; fill opacity tuned on operator review.

## [0.0.4] — 2026-09-17 session

### Fixed — FID-20260917-002: shrine dead-economy cleanup + trade parity + presence enforcement (closed, commit `b11c370`)

- The shrine feature survey flagged `POST /api/shrine/extend` as a missing-UI gap; grounding dissolved the premise — the live ShrinePanel already extends via `activate` ("Replace / Extend"). What actually existed was a dead second economy: two zero-caller routes (`sacrifice`, `extend`), one carrying a phantom `'speed'` tier and a rarity table that under-valued Rare/Epic items 2×/1.5× vs the canonical `shrineHelpers` table.
- Both dead routes deleted along with the `ShrineSacrificeSchema` block (its sole consumer). The legacy economy's two live duties transfer to the wired pair: `activate`/`boost-all` now call `trackShrineTrade` + `awardXP(SHRINE_SACRIFICE)` once per transaction (operator ruling: boost-all's four suits are ONE trade, not four) — the SHRINE_DEVOTEE achievement (100 trades) is earnable through the live UI for the first time.
- Server-side shrine presence restored on both live routes via the shared fail-closed `assertAtShrine` helper (`lib/shrineServer.ts`): off-shrine API calls now refuse 400 before any write — previously only the client's keyboard gate stood between a session and remote boost activation.
- Bookkeeping failures after the committed primary write are logged, never reported as transaction failures; responses surface `xpAwarded/levelUp/newLevel`. 8 new pins (collection-aware activate harness rewritten, boost-all suite created); tsc 0 · eslint 0 · vitest 989+1skip (baseline 975+1).

### Fixed — FID-20260917-003: own-base artwork wired to level, not rank (closed, commit `57dbfef`)

- The operator's level-19 base rendered tier-1 art: the own-base selector called `getBaseImage(player.rank)` — `rank` is the admin-gating column (default 1) — and `getBaseImage` searched for `rank{N}` filenames that never existed, falling back to the first manifest entry (`1.jpg`) on every call.
- Own-base art now buckets `player.level` through the shared `levelToBaseTier` formula (10 levels per tier, clamp 1..10) — the same bucketing the enemy-base branch has shipped since FID-20260910-037 R2, extracted so both branches consume one truth. A level-19 own base and a level-19 enemy base now render the same tier art (`bases/2.jpg`). Corrupt/out-of-range levels clamp into the asset set. 6 pins in `__tests__/lib/baseTier.test.ts`.

### Removed — SCOPE #75: third shrine orphan + dead activity-logger mappings (commit `16a7fcb`)

- `GET /api/shrine/status` deleted (zero client callers — the panel renders boosts from the player payload), and `activityLogger`'s mappings for `/api/shrine/visit` + `/api/shrine/boost` removed (the routes never existed; `SHRINE_VISIT`/`SHRINE_BOOST` enum members deleted with them — zero writes ever carried those action types).

## [0.0.3] — 2026-09-17 session

### Fixed — FID-20260917-001: clan-treasury snapshot-writer hardening (closed, commit `6577707`)

- Every clan-treasury writer now runs inside `withClanTreasuryLock` — SELECT … FOR UPDATE on the clan row inside a transaction — and moves funds via relative SQL deltas instead of snapshot-computed numbers. Closes the C1 sibling-writer class FID-20260916-013 explicitly carved out: double-collection of daily income (two leaders double-clicking), mid-flight bank mint/vaporize (clan and player updates in separate statements), and lost-update races across claims, bank, perks, WMD purchases, alliance, distribution, and warfare spoils.
- 13 writer sites across 8 services hardened, including `collectTax` — a dynamically-keyed treasury write the original census greps could not see, discovered during implementation. The two already-relative writers (alliance, distribution) gain the shared lock with in-lock sufficiency re-checks so their deltas race nothing.
- First-ever test coverage for the bank/perk/distribution services: 9 concurrency pins, including an in-lock re-check proof (a withdrawal that passes the pre-lock preview but fails the locked row) and a 2-updates-in-1-transaction atomicity pin. tsc 0 · eslint 0 · vitest 975+1skip (baseline 966+1).

## [0.0.2] — 2026-09-17 session

### Fixed — FID-20260916-013: war scoring unification + capture-flow repair + capture UI (closed, commit `32464f0`)

- Wars are pure points now: capture success awards +2 attacker war points and a repel awards +1 to the defender (in-transaction increments); hourly settlement compares total score FIRST — capture counts are a tiebreak, fixing the old precedence where 1 capture outranked 99 battle wins.
- Capture flow repaired: the defender's treasury is never touched on a successful capture (the attacker pays from their own row, A1); a repelled attempt no longer surfaces as a success (A2); treasury refusals and daily-cap hits return 400/403 with verbatim messages instead of 500 (A3).
- Capture strength is the clan's real army power — Σ(strength × quantity) over member units vs the defender's army floored at the shipped 5,000 wall, scaled by the existing adjacency bonus (+10%/tile, max +50%) and ±15% jitter. The clan-level strength curve is deleted; equal armies ≈ coin flip, 2× advantage reliably wins.
- The territory panel gains a War Captures section: enumerates ALL outgoing ACTIVE wars (no limit(1) hiding multi-wars), per-tile capture buttons gated Officer+ (mirroring the server role check), confirm-then-fire (the 25k M/E fee is paid win or lose), verbatim server toasts, daily-cap-aware disabling. Captures emit TERRITORY_CLAIMED/TERRITORY_LOST to both clans' activity feeds.
- 16 new pins (10 service + 6 component); tsc 0 · eslint 0 · vitest 966+1skip (baseline 951+1). Session-034 capture scaffolding reverted (disposition closed).

## [0.0.1] — 2026-09-16 session

### Fixed — daily-login streak bonus

- Streak bonus is now +10 RP per consecutive day beyond day 1, hard-capped at +70 RP (reached at streak day 8+). Day 7 pays 160 RP base-streak (previously 170 at day 7 under the off-by-one cap); day 8+ pays the 170 max as documented.
- Curve extracted as a pure function (`calculateStreakBonus`) pinned by unit tests (day 1 zero, +10/day ramp, cap binding at day 8, non-finite inputs pay zero).

### Added — FID-20260916-012: clan research panel — contribute/unlock UI (closed, commit `afcb92e`)

- The research tab's ComingSoonTab placeholder is replaced by the real panel: a thin `GET /api/clan/research/state` (`requireClanMembership` → `getResearchTree`, tree verbatim, no role data exposed), a fund header over the shared `researchResearchPoints` balance, a single MILITARY-honest node list (the FID-20260912-058 C1 cut preserved — 4 nodes, no fake branch tabs over empty arrays), contribute spending personal `researchPoints` into the clan fund, and unlock buttons gated presentationally for officers while the server remains the sole authority (`Insufficient permissions` surfaced verbatim).
- 9 pins (3 route + 6 component); tsc 0 · eslint 0/0 · vitest 951+1skip. Live round-trip probe 4/4: C1 shape verified live, contribute math exact (member 800→300, fund 0→500), unlock drains the fund by exactly the node cost and records the tech, member refusal verbatim.

### Added — FID-20260916-011: sabotage UI — target → victim preview → fire (closed, commit `0446629`)

- Sabotage finally reaches players: a shared `sabotageMath` module (difficulty/detection tables + formulas — the service delegates, the route and panel import), a `type=sabotage-targets` enumeration GET whose victim derivation mirrors `resolveSabotageTarget` exactly (owner username / clan leader per asset, `protectionActive` per row), and a third Sabotage tab in WMDIntelligencePanel driving operator → target → preview (victim, shield state, computed success/detection, void warning) → fire, with server refusals surfaced verbatim and no client-side pre-filtering.
- 11 pins; tsc 0 · eslint 0/0 · vitest 942+1skip. Live probe 3/3: seeded shielded victim flagged in enumeration, preview math matched the fire path bit-for-bit, protected-target fire refused with the parity constant verbatim, spy left AVAILABLE.

### Added — FID-20260916-010: three missing player-side endpoints rebuilt (closed, commit `2d9e05f`)

- The feature-survey census (SCOPE #69) found three player-facing panels calling endpoints that did not exist: DiscoveryLogPanel (`/api/discoveries`), FriendsList's online section (`/api/friends/online`), and FriendActionsMenu's block action (`/api/friends/block`). All three rebuilt as thin adapters over existing services — domain→client shape-mapping for discoveries (enum case, epoch ms, by-category totals), presence via `user_presence` (60s chat-heartbeat TTL), session-caller-only block with the sibling typed-error mapping.
- 12 pins; tsc 0 · eslint 0/0 · vitest 931+1skip. FID archived to `dev/fids/archive/`.

### Fixed — FID-20260916-009: protection window expiry shifted by the host UTC offset (live defect; D1/D2/D3)

- The `protection_until` column was timezone-naive: node-pg parses naive literals as local time, so on non-UTC hosts every window read back inflated (+4h on EDT) and expired late. Migration `0032` converts it to `timestamptz` (`USING (col AT TIME ZONE 'UTC')` — no stored instant shifts); the round-trip probe proved +14,400,000 ms → 0 ms.
- Predicate-drift refactor: `movementService` and `wmd/targetingValidator` now use the canonical `protectionActive` (refusal message parity included); the dead no-auth `createPlayer` (silent unprotected-account minter) is deleted.
- Gates: tsc 0 · eslint 0/0 · vitest 919+1skip. SCOPE ledger truth-sweep: rows #22/#23/#24/#36/#44/#51 re-verified closed with evidence; FID-003 closed (Option B implemented via -004).

### Added — FID-20260916-006/-007/-008: protection parity completed across all PvP surfaces (closed, commits `cf7437a`/`e9bf162`)

- FID-20260916-006 audit dispositioned every surface that touches another player; D1 (recon intel) and D2 (flag steal) ratified as intentionally open — information and proximity-contest surfaces never void the shield. (Ratified FINAL 2026-09-16, session 027; audit closed on `99ba521` and archived.)
- FID-20260916-007: repaired the broken sabotage pipeline (route call was transposed and the ownership assertion was unsatisfiable — live sabotage always refused), added operator binding, owner-derived target resolution, protection refusal, and the 4th void site at commit in `executeSabotage`; disclosed in-scope fix of a pre-existing `wmd_sabotage_operations.id varchar(24)` overflow the repair exposed.
- FID-20260916-008: factory capture now voids the attacker's window on player-owned targets only (`pvpCapture` — wild/bot stays pure PvE); the latent `/api/battle/attack` route gained both seams (beer-base defenders skip, shared `resolveBattle` untouched).
- Verification: 11 seam pins (6 -007 + 5 -008, roll-independent), live probes 4/4 + 6/6 against the real DB, tsc 0 · eslint 0/0 · vitest 919+1skip.

### Added — FID-20260916-004/-005: protection forfeit on WMD launch + war-clan join; WMD launch target validation (closed, commits `2cf2f8a`/`d3c5cd2`)

- FID-20260916-004 (Option B per FID-20260916-003): `launchMissile` voids the launcher's protection window after the missile's exists+READY preconditions, before effects; `joinClan` voids the joiner's window only when the target clan is at ACTIVE war (fail-open on war-lookup outage — onboarding never blocks). Infantry-route comment corrected: `validateTargeting` had zero production callers.
- FID-20260916-005: launch accepted any username with no target validation — nonexistent targets consumed built warheads for zero damage (impact no-op, weapon still terminal), and no production code ever consulted target-side protection, so the 72h shield did not stop incoming WMD strikes. The dormant `validateTargeting` is revived at the launch seam (self-target, existence, protection, level ≥ 10 floor kept by operator decision, own-clan), between the READY check and the FID-004 void: refusals leave the missile READY and never forfeit; valid targets commit and void as before.
- Verification: 11 seam pins (6 -004 + 5 -005, refusal classes assert no flip + no void); tsc 0 / eslint 0-0 / vitest 908+1skip; live probes 5/5 (-005 driver) + 4/4 (-004 driver, patched with a real target fixture since -005 now correctly refuses its historical dummy).

### Added — FID-20260916-002: new-player 72h protection window (closed, commit `0d18a93`)

- Registration stamps `protection_until` = now+72h (`createPlayerWithAuth`; new `lib/playerProtection.ts`: window constant, pure `protectionActive` predicate, `voidProtectionOnAggression` helper). Infantry route refuses protected targets with a server reason; `executeInfantryAttack` voids the attacker's own window on initiation (service-level, bots-only `executeBaseAttack` untouched); `attackFactory` refuses capture of protected owners' factories. `protectionUntil` typed on the domain `Player` and allowlisted in the sanitizer (client surfacing shipped separately).
- Verification: 14 unit pins; gates tsc 0 / eslint 0-0 / vitest 883+1skip at implementation; **live probes 7/7** on PORT=3002 (window Δ=71.999h, infantry 400 refusal, WMD target-side refusal with zero WMD code change, aggression void persisted NULL, factory refusal, bots-only base-raid negative control, zero fixture residual).
- Follow-up FID-20260916-003 (`analyzed`): forfeit edges debated — operator chose Option B (WMD launch voids; clan join voids only into ACTIVE-war clans); enforcement spec pending.

## [0.0.1] — 2026-09-15 session

### Fixed — FID-20260912-060 B1/B2/B4 + FID-20260912-061 R2/R4 (battle-RP pacing closed)

- B1 daily battle envelope (`applyBattleEnvelope`, inside `awardRP` so no battle site bypasses it): first 10 victorious battle awards/player/day pay full, then 20% (25 base floor), fail-open. B2 saturating level term (`saturatingBattleRP`: L1→110, L5→144, L14→201, L65→292, asymptote 300) wired at the raid site — max-level bots stop being a lottery. B4 `defenseRpEligible`: defense RP only vs higher-or-equal attackers, both PvP branches. Contract suite (9 tests); B3 suite intact; gates green.
- R2 doctrine stated on the growth engine (levels are spawn-time brackets, never regrown); R4 Beer Base display levels normalized to the tier ladder (rank→L5/15/25/35/45/55, deterministic).
- Docs: `RP_ECONOMY_GUIDE.md` re-audited to shipped v2 truth (5-rung milestones, 4,300/day envelope, catalog prices, unit tiers, battle rules, VIP math); `ARCHITECTURE.md` stack rewritten (Next 16/React 19/TW4/Postgres); tutorial/messaging stale-backend banners + worst falsehoods fixed; 14 dead progress notes relocated to `dev/archives/2026-09-15-docs-cleanup/`, 10MB scraped llms docs + empty ideas file removed; `dev/QUICK_START.md` refreshed; README rewritten to current state.

### Docs — open-FID audit close-out: 33 completed + 1 superseded archived (operator-accepted audit)

- Verified each file 0-EOF against live code (seams, routes, tests, token penetration, gates): FID-20260906-004, FID-20260906-012, FID-20260908-001–021 (001 closed as implemented-then-superseded — its tracking contract was replaced by the JSON quest architecture; 002 XP curve, 003 power sanitize, 004 factory count, 005 reconnect backoff, 006 umbrella + Waves A/B/C surfaces, 007 register, 008 tech-tree, 009 WMD, 010 clans, 011 game shell, 012 help, 013 dead-kit, 014 referrals, 015 profile/messages, 016 import guard, 017 admin, 018 map, 019 leaderboard/shop, 020 long tail with fresh 0-site census, 021 lint program), FID-20260909-022–024/027–032.
- Remaining open: FID-20260912-060 B1/B2/B4 + FID-20260912-061 R2/R4 (confirmed still pending — no envelope/saturating-curve/defense-gate/bracket-doc in code) and FID-20260906-005 (`fixed`, T5 gated).

### Docs — FID compliance audit: 62 stale-closed archived with ground-truth checks (SCOPE-55)

- Full `dev/fids/` audit (97 active): filename format ratified to repo practice (`FID-YYYYMMDD-NNN`, template + `protocol.config.yaml` corrected — the `YYYY-MMDD` sketch matched zero filed FIDs); uppercase statuses normalized (`CONVERGED`→`converged` ×4); `DRAFT`/`in_progress`/unparseable statuses resolved; missing required metadata (Filename/ID/Severity/Status/Created) restored on every touched file; zero attribution fields repo-wide.
- Archived with per-file code-anchor verification (routes/services/tests/migrations confirmed live): FID-20260902-001 (pg pivot), FID-20260904-005 (audit umbrella), FID-20260906-001/-002/-003/-006/-009/-010/-006a, FID-20260909-025/-034/-035, FID-20260910-037–040, FID-20260911-041–055, FID-20260912-056–059, FID-20260912-062–064/071–094, FID-20260915-001. Two rename-drift notes recorded in-file (063 `extractNewPosition`→`extractMovePosition`).
- Still active (35): 32 `converged` plans (09-08 neon waves, 09-09 batches — compliant, awaiting implementation) + 3 `fixed` with operator-open remainders (FID-20260906-005 menu T5 gated; FID-20260912-060 B1/B2/B4; FID-20260912-061 R2/R4).

### Docs — bulk archival of 10 stale-closed FIDs (dev/audit, no code)

- Archived to `dev/fids/archive/` with ground-truth cross-checks (code/SCOPE/CHANGELOG all confirm the work shipped): FID-20260403-001 (historical code review), FID-20260903-001 (mongodb seam typing — `lib/mongodb.ts` live, tsc 0), FID-20260903-002 (WMD schema — `lib/db/schema/wmd.ts` + migrations live), FID-20260904-004 (hotkey invariant — registry live), FID-20260909-026 (bank race/canvas — atomicity test live), FID-20260909-033 (catalog unification — canonical roster + test live), FID-20260913-001 (vitest jsdom — suite green since), FID-20260914-001/-002 (transport toggle + raid audit — both implemented per session records), FID-20260915-004 (balance-in-combat — SCOPE row 42, commit 049459b). Plus relocated misfiled `AUDIT-20260908-PHASE6` from `dev/fids/` to `dev/audits/`.

### Fixed — FID-20260915-008 (PvP counter-suppression softening, infantry-scoped)

- Defender counter is now `max(5, DEF − attackerSTR/3)` for PvP infantry (was `/2`); the 0-loss glass-cannon farm ends at 30% DEF share (40% counters 14k R1, 50% 45k), wins flip toward balanced armies, the pre-existing stall keeps its repelled outcome. Attacker strike and every PvE path (garrison tuning, incident replay) are byte-identical; PvE suites pass unmodified.

### Changed — ladder-truth gate extended to every documented game-math table (FID-20260915-007)

- **Four new ladders** (10 new documented sites, 65 new cells): regeneration-rate (4 sites — the rate table + three range summaries, actuals **engine-derived** as tick(0) ÷ spawner-max), unit-cost curve (game.types roster counts, BALANCING PHILOSOPHY table ↔ `TIER_UNLOCK_REQUIREMENTS`, slot ladder 1/3/7/15/30), build-rate (header intervals ↔ `BUILD_RATES`, Ghost pinned at the docs' one-decimal precision — 0.67 is a rounded 1/1.5), army composition (header bullets + table comments ↔ `ARMY_COMPOSITION`, bare `50/50` rows parsed as str-first).
- **Two live falsehoods corrected** (the new gate's first catch, before it even shipped): both regen summaries said "5-20% per hour" while Boss regenerates at 2% — now "2-20%" in all four sites; UNIT_CONFIGS' "all 40 units (5 tiers × 8)" now scoped truthfully to 65 units (40-unit blueprint-derived core + 25 SPEC/PRESTIGE).
- `BUILD_RATES`/`ARMY_COMPOSITION` exported from botGrowthEngine (pure data; botArmyCaps.test.ts already behavior-pins caps/age — scope respected).
- Drill-proven: comment-only edits to the regen table (drill E), the botService range summary (drill F), and the philosophy table (drill G) each fail the gate (2/2/2 tests), restored green after each. Coverage arithmetic asserted in-test (a parser silently skipping the bare 50/50 row shape is itself caught).

### Added — property-based regen-engine regression suite

- 14 property tests sweeping all 42 spec×tier configs (`__tests__/lib/regenEngineProperties.test.ts`) pinning the four regen semantics: never-below-current (plus over-cap clamp-down), revival from zero with the linear identity **derived from the engine itself** (`regen := tick(0)` — no mirrored rate table to drift), cap clamping through regen / growth-write / composed path (mocked 70/20/10 rolls), and NaN-free lookups incl. the Boss 120,000/h anchor. Mutation-drilled: absorbing-zero / clamp-removal / Boss-entry-deletion / negative-regen each fail the suite (4/4/1/8 tests); engine pristine after restore. Guards FID-20260915-005/-006/-006a semantics.

### Added — ladder-truth CI gate (FID-20260915-006a follow-through)

- New test (`__tests__/lib/ladderTruth.test.ts` + scanner
  `scripts/ladderTruth.ts`) parses the documented bot tier tables out of
  `lib/botService.ts` source comments — resource multipliers (2 sites),
  base defense (2 sites), player level brackets — and asserts each documented
  value equals the live function output (`getResourceRange`,
  `getBotDefenseForTier`, `getPlayerLevelBonus`). A comment-only edit that
  drifts from code now fails CI; a formula change without a doc update fails
  too. Site-count guards make a deleted table fail loudly; truth spot-pins
  keep the scanner honest. Drill-verified: a corrupted comment value fails
  2 tests and restores clean. `getBotDefenseForTier` exported for the gate.

### Docs — FID-20260915-006a: bot tier-ladder comment drift corrected

- Comments in `botService.ts` (file header + `getResourceRange`) claimed the
  tier-multiplier ladder ran 0.75→3.0×; the formula has always computed
  0.5 + tier × 0.25 = **0.75→2.25×** (T5–T7 were overstated as 2.0/2.5/3.0).
- The defense ladder quotes (150→9600) were pre-scale values; the
  `(100+50t)·2^(t−1)·0.1` function has always produced **15→2880**. The boss
  block's "192,000 total" inherits the 10× error (real: 2,880 × 20 = 57,600).
- Same corrections in the attack-route garrison comment and a historical-note
  banner on `BASE_RAID_BALANCE.md`'s worked example (its totalDefense column
  predates both the ladder and the ×0.1 rescale). Code behavior unchanged —
  comments and docs now equal code truth, verified by executing the formulas.

### Changed — FID-20260915-006: linear bot-vault regen + hoarder capacity tier

- Bot vault regen is now LINEAR (`rate × spawner max` per hour) instead of a
  percentage of current. The old curve made 0 absorbing — the raid win path
  zeroes a defeated bot's vault, so raided bots stayed dead forever (live
  census: 7/54 bots at 0/0, all raid-killed; map loot collapsed to zero within
  a month of modest raid pressure). Linear regen revives them on the next
  tick with no migration and makes raid income sustainable (~15× per audit).
- New shared `getVaultCap()` (botService): 2× spawner max for all specializations,
  3× for Hoarders (jackpot identity). Consumed by the regen clamp, the growth
  write clamp, the raid loot cap, and the resync tooling — they can no longer
  drift. At-cap loot values are unchanged for non-hoarders.
- Live acceptance gate PASSED: 7 dead bots → one growth cycle → 0 dead.
- Player-path jackpot verified live on three hoarders: declared-metal raids
  paid 323,739 / 352,804 / 411,713 (each above the old 300,000 2× cap; 3× cap
  = 450,000), the bots' energy survived (FID-005), and growth cycles regrew
  metal from 0 with a constant +7,500 linear step.

### Fixed — FID-20260915-005 (defeat bookkeeping precision + growth clamp)

- Raid defeat bookkeeping now zeroes ONLY the stockpile(s) the raid actually
  looted, mirroring the declared-resource loot rule: a declared-metal raid
  preserves the bot's energy (and vice versa); undeclared raids still wipe
  both. Previously both vaults were zeroed regardless.
- The growth cycle's 70/20/10 pattern write is clamped to the vault cap (the
  same clamp the regen step applies). Previously growth (up to ×1.15) wrote
  above cap and stored vaults idled 1–15% over cap until the next tick.

### Added — combat balance surfaced on the StatsPanel

- New "Dealt / Taken" row under the Military Power panel's Balance status shows
  the exact per-strike multipliers the engine applies to your army
  (`damageDealtMultiplier` / `damageTakenMultiplier` — e.g. CRITICAL ×0.80 / ×1.30).
  The numbers are computed from the same raw STR/DEF the engine uses, so the
  panel is a truthful preview of the next fight, not the display-only ×0.50
  power figure that previously carried all the signaling.

### Fixed — FID-20260915-004 (deep audit: balance-in-combat, garrison floor, economy caps, factory pill)

- Army balance finally executes in combat: every strike in `resolveBattle` is
  multiplied by the attacker's damage-dealt and the defender's damage-taken
  balance multipliers (CRITICAL 0.8/1.3 … OPTIMAL 1.05/0.95). Previously the
  whole suite fed display surfaces only — a CRITICAL ×0.50 raider's strike was
  provably raw STR − DEF/2. Mono-axis armies (pure offense or pure defense)
  are punished on both sides — the designed anti-glass-cannon tax.
- The weight-class floor now covers REAL regrown garrisons (previously only
  synthesized fresh ones): supplemental ephemeral reinforcement units raise a
  base's DEF to the tier-ladder target, so overmatched raiders can no longer
  kill the garrison inside their own strike phase and take a zero-loss free
  win (live-proven hole: 0 losses + 452M loot from a tier-2 bot).
- Economy caps: bot vault growth clamps at 2× the spawner's per-tier maximum;
  raid loot is capped the same way; one-time resync drained 8.8B from 45
  bloated vaults (Devil_Agent 2.12B → 0.2M). Player balances untouched.
- Unit Factory cards now show an owned-count pill (×N, top-right) per unit.

### Changed — FID-20260915-003 (endgame raid pacing)

- Tier-multiplier ladder on the synthesized-garrison weight floor
  (`GARRISON_TIER_MULT` 1.0→1.5): top-tier bases now force multi-round endgame
  raids with real proportional losses (measured 3 rounds / 80–95% for the
  biggest raiders) while low tiers stay near-flat. The operator-proposed
  `GARRISON_SIZE_CAP` raise was swept and **falsified as a difficulty knob**
  (identical outcomes at 60/150/300/600 — the floor distributes across any unit
  count). Bot tier now resolves from `bot_config.tier` (canonical spawner
  field); the legacy b[WMSEUL] username marker matched nothing live and
  silently degraded every bot — including tier-scaled XP/RP — to tier 1.
- Live E2E (`scripts/e2eEndgamePacing.ts`): tier-6 base vs 220k raider → 3
  rounds / 95% losses, survivors intact; single-unit raid honestly repelled;
  a real raid as `fame` landed 2 rounds / 8.7% losses with the army fully
  accounted for.

### Fixed — FID-20260915-002 (tier-sim: garrison counter wired to the wrong stat)

- Tier-mismatch simulation (`scripts/simulateCombatTiers.ts`, runs the real engine)
  proved the synthesized-garrison weight-class floor was routed into STR — a stat the
  counter formula never reads (defender damage = DEF − attackerSTR/2). Fresh-base raids
  were free wins at every mismatch (0–9% losses). The floor now lands on DEF
  (`GARRISON_DEF_RATIO = 0.65` → 0.15×attackerSTR counter per round) with a small STR HP
  pad (0.2). Post-fix: 13–15% attacker losses at every mismatch, rounds scale with
  defender tier. Findings + remaining open flags (real-garrison floor, stall band, doc
  drift) in `dev/audits/COMBAT-TIER-SIM-2026-09-15.md`.

### Fixed — FID-20260915-001 Phase 3 (combat rebalance converged + two army-wipe bugs)

- Battle HP scale is now power-proportional (`strength + defense` per unit;
  zero-power floor 10), replacing the flat 10/15 scale under which every battle
  resolved in round 1 (army pools of hundreds vs per-round damage of
  hundreds–thousands — the BATTLE-17894 annihilation-DRAW class was the norm).
  Mirror matches fight ~2 rounds at any tier; tanky garrisons fight
  multi-round; overreached raids die fast. The incident's exact matchup now
  resolves as a 4-round Pyrrhic victory (~70% proportional losses) instead of a
  mutual-annihilation DRAW — the pinned regression suite covers the full matrix.
- Live raid verification surfaced and fixed a second annihilation class: the
  type-tally write-back subtracted each type's TOTAL casualties from EVERY
  entry of that type, so any multi-entry army (the canonical per-unit build
  shape) lost entryCount × killed units — a 400-unit infantry army wiped by
  225 casualties. Both write-back paths (raid `applyAttackerCasualties` and PvP
  `applyBattleResults`) now drain the tally across the type's entries.
- Live E2E (`scripts/e2eBattleRebalance.ts`): competitive raid = ATTACKER_WIN
  in exactly the projected 10 rounds with exactly the projected 225/400
  proportional losses and 175 survivors intact in the DB; overreached raid =
  clean DefenderWin with the garrison unscratched. Never a DRAW.
- Rejected the FID's original per-axis coefficient sketch in the perfection
  loop: algebra showed no linear coefficients can produce multi-round close
  matchups while keeping incident-class fights in round 1 (proven live: the
  incident replay's honest outcome is a close-matchup-shaped fight).

### Fixed — FID-20260914-004 (compat-seam hardening)

- The Mongo→pg compat seam counts honestly: `updateOne`/`updateMany`/`deleteOne`/
  `deleteMany`/`bulkWrite` and the upsert insert branches report real affected-row
  counts via `.returning()` — seven integrity branches (ban-player, factory
  abandon/upgrade, build-unit batch slots, greeting) and three analytics reporting
  sites gain live failure paths with zero caller edits.
- `$pull` rewritten to the probe-verified `jsonb_agg` deep-equality form (the old
  `jsonb - jsonb` operator does not exist on this engine — every `$pull` was a
  guaranteed 500); `$addToSet` gains real set semantics via a containment guard
  (duplicate tier unlocks no longer possible).
- Live honest-branch route sweep (23/23) surfaced and fixed two pre-existing defects:
  ban-player + clear-flags audit inserts 500'd AFTER applying their action (legacy
  Mongo doc keys resolve to no `mod_log` column; fixed to column keys with the legacy
  payload preserved in `details`), and player build-unit's `$push` corrupted
  `players.units` (plain-array operand appended as one nested element; now the
  probe-verified `{ $each }` shape with per-unit `quantity: 1`).
- Probe + live seam verification exit 0; regression suite 747 → 760 passed;
  tsc 0, eslint 0. Closed as `f21f6f1` (pre-merge hash; canonical: PR #41).

### Fixed — FID-20260914-003 (auction escrow correctness)

- Buyout no longer forfeits the outbid leader's escrowed bid: claim-first close
  (`findOneAndUpdate` Active→Sold) + fresh-pair leader refund; leader-is-buyer is
  charged only the remainder; concurrent bid/buyout cannot double-pay (lost claims
  refund immediately; delivery failure rolls the close back).
- Unit listings escrow for real: unit snapshot frozen into `item.unitSnapshot` and
  removed from the seller's army at listing; delivery is buyer-side; cancel/expire/
  transfer-failure refunds return the unit (legacy no-snapshot rows keep a fallback).
- Tradeable-item listings rejected before any fee/lock (`TRADEABLE_NOT_TRADEABLE_YET`);
  my-bids now orders by the caller's own latest `bidTime` (stale `bids.timestamp`
  dot-path removed). A read-only probe proved the shim's `$pull` SQL invalid on this
  engine (`jsonb - jsonb` absent) — escrow uses `$set` array rebuilds; the verified
  `jsonb_agg` rewrite is banked for the shim-hardening follow-up (FID-20260914-004).
- Verified live end-to-end over real HTTP + postgres (`scripts/e2eAuctionLedger.ts`):
  every escrow ledger entry balances; conservation ΣΔ = −250 = exactly the two fees.
   Regression suite 736 → 747 passed; tsc 0, eslint 0.

### Changed - FID-20260916-001 (remove dead Mongo index tooling)

- Deleted `scripts/createIndexes.ts` (Mongo-driver index script for a database
  that no longer exists; zero live callers) and removed the `create-indexes`
  npm script. Postgres indexes remain owned by `lib/db/schema/*` + migrations.
  Shim census banked in the FID: ~20 live `lib/` consumers of `lib/mongodb.ts`
  plus 4 scripts + `server.ts` — full shim retirement is a phased epic,
  explicitly deferred, not silently dropped. Gates green (tsc 0, lint 0,
  865 tests).

## History — pre-versioning sessions (kept verbatim)

### May 2026 era (26 commits, Mongo-era game — `git log --since=2026-05-01 --until=2026-09-01`)

Multi-phase archetype battle rewrite; gather→build→battle repair; shrine/chat/flag/auto-farm UI fixes; enterprise quality audit (80+ issues); phased test rewrite, cleanup, performance passes; structured-logger migration across API routes. Dormant late May → September, then the Postgres pivot (below).

### 2026-09-13 session

### Fixed — FID-20260913-001 (vitest jsdom suite dead)

- Every vitest suite using the jsdom environment (75 of 76 files) died at
  collection with `No such built-in module: node:` — vite 8.0.3 externalizes
  node builtins to the bare `__vite-browser-external` stub and vitest 4.1.2's
  `toBuiltin()` reverse-maps it via `slice(24)` → `""` → literal `node:`,
  which Node rejects (ERR_UNKNOWN_BUILTIN_MODULE). Removed the dead
  TextEncoder/TextDecoder polyfill from `vitest.setup.ts` (the trigger —
  Node ≥11 ships both as globals, so the guard could never fire), added
  `// @vitest-environment node` to 25 server-side test files whose import
  chains pull node builtins (pg, drizzle, mongodb, socket.io), and replaced
  the hardcoded ISO week in `beerBaseScheduler.test.ts` with
  `getISOWeek(new Date())` (exported from the manager). Suite went from
  75 failed files / 2 tests to 75 passed / 734 tests / 0 failures; tsc 0,
  eslint 0.

### Removed — root bloat cleanup (operator-approved)

- Deleted ~8.6MB of untracked runtime/lint/test logs, dump files, the
  malformed `D:devDarkFramefix_sub.ps1`, orphaned one-off scripts, and the
  `__temp_patches/` + `.freebuff/` temp dirs from the repo root (`.freebuff/`
  was tracked; the rest were never committed). Two dev-server logs
  (`df-094.log`, `df-094.err.log`) remain file-locked by the running
  process — delete after stopping it.

### 2026-09-05/06 session

### Fixed — FID-20260906-011 (chat delete dead-wire)
- Chat message delete always failed: the client sent `messageId` in a DELETE body
  while the route reads it from query params (its own documented contract), so every
  click 400'd and the confirm dialog never cleared (the reported "hang"). Client now
  sends the query param and reads the `{ error }` envelope; verified live by API probe
  (old transport 400 / new 200 / double-delete guard) and operator-confirmed in the UI.

### Fixed — FID-20260906-010 (AutoFarm move-verification contract)
- AutoFarm skipped every tile (`Position mismatch … got {}`): the engine extracted
  the new position from four nested response shapes, none of which the move API
  guarantees, while flat `currentPositionX/Y` on the row carry the STALE pre-move
  position. The route now guarantees nested `currentPosition` on the way out
  (preserve-don't-overwrite) and the engine reads `data.data.player` first with a
  flat-column fallback. Live UI drive: 4/4 moves verified, 0 mismatches,
  `tilesCompleted` advancing; probe account + claimed tile cleaned from dev DB.

### Fixed — FID-20260906-009 (base position contract drift)
- Sidebar PLAYER INFO showed Base (0,0) for every player: the §5.0 sanitize
  projection kept flat `baseX/baseY` but dropped the nested `base: Position` the
  client contract promises (same class as FID-010). `sanitizePlayer` now composes
  nested `base` with finite-number guards; public profile API returns real base coords.

### Fixed — FID-20260906-008 (Track flow dead-end)
- **Track now works end-to-end:** the Flag Tracker's Track button pushed
  `/profile/<username>`, but the destination had never been built — every click 404'd
  (design doc: "Track button → Click to view Flag Bearer's profile"). Added
  `GET /api/profile/[username]` (public, sanitized §5.0 projection, explicit
  `PublicProfile` shape, 404 for unknown / 400 for hostile segments, no existence
  oracle) and `app/profile/[username]/page.tsx` (glass-language profile with bot
  identity banner: "Autonomous rogue unit — not a player").
- **Shared lookup validator** `isLookupableUsername()` (lib/authService): documented
  superset of the registration charset accepting themed bot names with spaces
  ("Thundering Depot") while rejecting hostile URL segments before any DB access.
- Verified live: Track click → `/profile/Flag-Bearer-4523` rendered with matching
  position (74,150) and rogue-unit banner; bot/unknown/malformed probes 200/404/400;
  zero PII keys in responses; suite 348 passed / 1 skipped.

### Fixed — FID-20260906-007 (bot name generation)
- **Beer Bases no longer spawn as machine slugs:** `spawnBeerBase` overwrote the themed
  name with `b<tier><timestamp><rand>` (e.g. `bS299792251945`) to dodge a historic
  varchar(20) crash. Beer Bases now get place-style themed names ("Thundering Depot",
  "Crimson Bastion") from a curated descriptor/noun lexicon; the dropped tier-letter
  encoding was grep-proven to have zero parsers. Username PK collisions retry with a
  numeric variant ("Crimson Bastion 2").
- **Latent insert-crash class removed (same class as SCOPE #20 flags.id overflow):**
  measured word census showed `generateBotName()` could compose 26 chars
  (`Legionnaire-Nightmares-999`) and boss names 31 — all against a varchar(20)
  **primary key**. All three generators now enforce the 20-char budget
  (re-roll + bounded fallback); contract-tested with 500-sample sweeps.
- **Live data repaired:** the two slug rows renamed to "Rusted Redoubt" and
  "Forsaken Outpost" after a schema-driven reference sweep (28 username-bearing
  columns) confirmed zero rows referencing the slugs; slug census = 0.
- Verified live: `spawnBeerBase` persisted "Thundering Depot" through the full
  service path; suite at 348 passed / 1 skipped (349).

### Added — FID-20260906-006/006a (game-wide balance audit + PvE loop repair)
- **Balance audit:** evidence-first measurement of the implemented economy (census of 61
  cited constants → `dev/audit/`; week-one archetype simulation → `dev/scripts/balance-sim.cjs`),
  then operator-approved implementation: XP curve rebuilt as a power curve (500×L^1.35) to
  L30 then 50k×1.15^n (kills the L29→30 inversion where the hardest level was followed by
  the cheapest); harvest XP scales +2/level; RP milestone tail made monotonic (full map
  2,500 RP); unit rarity efficiency strictly increasing via cost-side repricing (32
  blueprints, STR frozen); WMD research ladder re-anchored to the design doc (T1 50k,
  2.5M/track); per-raid theft capped at 25k.
- **PvE loop (Beer Bases) — was fiction:** the attack route announced loot it never credited
  and fought a 0-HP garrison (bots spawn with `units: []`). Bases now synthesize a real
  garrison from stored defense, wins credit resources × the admin-configurable multiplier,
  defeated bases are removed (drizzle, isBot+isSpecialBase-gated), and win/loss XP uses the
  doc-faithful 400/60 schedule. Live-verified end-to-end (11/11 probe).

### Fixed — FID-20260904-005 (Postgres-pivot systemic audit, phases 1–4)
- **Persistence:** phantom tables created (0010–0014); mysql2-isms repaired across services
  (`affectedRows`, `JSON_ARRAY_APPEND`, `JSON_CONTAINS` → pg jsonb containment, `insertId`,
  raw-result `.rows` access); admin analytics GROUP BY binding; activityLog 24-char id overflow.
- **Security — auth sweep (29 routes):** client-supplied username/position/IDs replaced with
  session identity (`authenticateRequest`); all admin writes behind `requireAdmin`.
  Late finds: `chat/delete` and `chat/edit` resolved identity from a hardcoded `TestUser`
  placeholder (unauthenticated edit/delete of anyone's messages) — now session-authenticated.
- **Dead endpoints (34 rebuilt):** admin referrals/VIP/moderation/tiles/bot-scanner, full clan
  lifecycle (bank, promote, chat, alliances, wars, territory), friends (routes were Mongo-era
  rip-outs), chat de-mocked (`dummyMessages` fixture removed — real round-trip persistence).
- **Notable:** `requireClanMembership` used MySQL `JSON_CONTAINS` — every clan route 500'd;
  9 services looked players up by `mongoId` (NULL on every live row); `declareWar` debited
  clan treasuries without persisting the war (transaction + `target_id` widened, 0014).

### Fixed — FID-20260905-001 (gate unification · admin de-mock · lint convergence)
- **Gates:** all 21 `rank >= 5` gate sites → `requireAdmin(request)`; `requireAdmin` reads
  the JWT `isAdmin` claim — the owner's `rank=1` no longer locks them out of admin actions.
- **De-mock:** flagged-players serves real derived detections (`player_activity` + `referrals`,
  deterministic severity rollup); tiles gained a real admin POST upsert + phantom-column fix;
  VIP grant/revoke write `mod_log` audit rows; clear-flag id overflow removed (schema default).
- **Types:** all 9 `@ts-nocheck` directives removed (real drizzle row types; fixed a hidden
  `isBot` boolean-vs-smallint bug); lint 1,294 → 592 with **app/api at zero**; eslint config:
  `_`-prefixed ignore patterns, CommonJS tooling override for `scripts/` + `dev/scripts/`.
- **Flag feature (was dead end-to-end):** `GET /api/flag` returned `data:null` since the
  Mongo pivot (nested `currentHolder` doc vs flat Postgres row) — holder position/level/HP
  now derive from the `players` row at read time (`lib/flagState.ts`); new `flag_trail`
  table (0015) powers the 8-minute map glimmer, written on bearer movement; tile route sets
  `hasFlagBearer`/`hasTrail`; flag attacks compute real DB distance (were crashing on
  undefined position) and persist HP; `/map` renders the animated gold bearer marker +
  fading trail; legacy dead `POST /api/flag` duplicate removed.
- **Flag cron (data-loss bug):** the 30-min cron deleted the player row of whoever held the
  flag >1h — human accounts could be destroyed. Reset now applies only to bot holders;
  humans keep the flag until defeated. Bot teleportation also repaired (never matched
  Postgres rows). `CRON_SECRET` provisioned on Vercel (was unset → cron 500'd since deploy).
- **Chat:** client read `message.content` but the API returns `message.message` (render crash
  in ErrorBoundary); DM conversations 500 (phantom `participants` column); typing indicator 500
  (MySQL-ism); tutorial 500 race fixed with `onConflictDoNothing`.

### Verification highlights
- Live prod sweep: 135 GET routes → zero 5xx (single failure found+fixed: cron secret).
- Flag lifecycle driven live: 10-hit defeat → transfer → bot HP reset; holder-swap → move →
  trail row → glimmer tile; cron all 5 paths (401/401/moved/human-protected/reset).
- Gates at close: tsc 0 · 341 tests green · app/api lint 0 · censuses zero (nocheck, mocks,
  TestUser, dead-wire).

### 2026-09-04 session
- Initial Postgres migration effort, GitHub repo sanitization (secret scrub + history rewrite),
  README redesign, Vercel deployment pipeline bring-up (lazy DB connection for build-time
  env isolation), production DB connection fixes.
