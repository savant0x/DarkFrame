# FID-20260515-ENTERPRISE-QUALITY-AUDIT-FIX

| Field | Value |
|-------|-------|
| **Document ID** | FID-20260515-ENTERPRISE-QUALITY-AUDIT-FIX |
| **Date Created** | 2026-05-15 |
| **Status** | OPEN |
| **Priority** | CRITICAL |
| **Phase** | Analysis Complete — Awaiting Approval |

## Context

A comprehensive enterprise-quality audit of the entire DarkFrame codebase was performed covering 137+ API routes, 85+ services, 137+ components, 18 test files, security posture, admin panel, game logic, WebSocket, and database layer. The audit found **100+ issues** across all severity levels (Critical, High, Medium, Low). This FID tracks the remediation of EVERY issue found. No pseudo-code, placeholders, or broken logic is permitted.

## Audit Scope

| Category | Files Audited | Issues Found |
|----------|--------------|--------------|
| Admin Panel | 39 files (3 pages, 30 API routes, 9 components) | 36 |
| Game Logic | 95 files (32 services, 39 API routes, 24 components) | 34 |
| Security | 40 files (auth, payments, rate limiting, validation) | 30 |
| Test Suite | 18 files | 10 |
| Chat/Messaging | 15 files (previously fixed) | 20 |
| **TOTAL** | **227+** | **130+** |

---

## CRITICAL Issues (Must Fix — Security/Data Integrity/Functional Failure)

### Auth Bypasses — Username Accepted From Request Body Instead Of Session

| # | File:Line | Description | Impact |
|---|-----------|-------------|--------|
| C1 | `app/api/auction/bid/route.ts:68` | `rawBody.username` used for identity | Account takeover via auction — steal resources |
| C2 | `app/api/auction/buyout/route.ts:65` | `rawBody.username` used for identity | Double-spend, resource theft |
| C3 | `app/api/auction/create/route.ts:57` | `rawBody.username` used for identity | Fraudulent listings as any user |
| C4 | `app/api/friends/route.ts:42` | POST uses `body.username` not session | Send requests/block as any user |
| C5 | `app/api/factory/attack/route.ts:10-39` | No auth, username from body | Attack any factory as any user |
| C6 | `app/api/player/upgrade-unit/route.ts:27-103` | No auth, username from body | Upgrade any player's stats |
| C7 | `app/api/factory/release/route.ts:11-121` | No auth, username from body | Release any player's factories |
| C8 | `app/api/factory/abandon/route.ts:48-163` | No auth, username from body | Abandon any player's factory |

### Admin Auth Self-Bypass — Client-Supplied `?username=` Trusted As Auth

| # | File:Line | Description | Impact |
|---|-----------|-------------|--------|
| C9 | `app/api/admin/players/route.ts` | No auth at all | All player data exposed |
| C10 | `app/api/admin/factories/route.ts:7-15` | No auth at all | All factory data exposed |
| C11 | `app/api/admin/tiles/route.ts` | Auth via `?username=` query param | Self-auth bypass |
| C12 | `app/api/admin/players/[username]/route.ts:41` | Trusts client username | Access any player data |
| C13 | `app/api/admin/ban-player/route.ts:45` | Trusts client username | Ban/unban anyone |
| C14 | `app/api/admin/give-resources/route.ts:15` | Trusts client username | Give resources to anyone |
| C15 | `app/api/admin/anti-cheat/ban/route.ts:16` | Trusts client username | Ban anyone from anti-cheat |
| C16 | `app/api/admin/anti-cheat/unban/route.ts:15` | Trusts client username | Unban anyone |
| C17 | `app/api/admin/rp-economy/stats/route.ts:36` | Trusts client username | Access RP economy data |
| C18 | `app/api/admin/rp-economy/transactions/route.ts:36` | Trusts client username | Access RP transactions |
| C19 | `app/api/admin/rp-economy/bulk-adjust/route.ts:40` | Checks target user, not actor | If target is admin, check passes |
| C20 | `app/api/admin/wmd/route.ts:58` | Trusts client username | Access WMD admin data |
| C21 | `app/api/admin/player-activity/route.ts:32` | Trusts client username | Access player activity |
| C22 | `app/api/admin/player-sessions/route.ts:32` | Trusts client username | Access player sessions |
| C23 | `app/api/admin/vip/grant/route.ts` | Zero auth checks | Free VIP for anyone |
| C24 | `app/api/admin/vip/revoke/route.ts` | Zero auth checks | Revoke anyone's VIP |
| C25 | `app/api/admin/bot-config/route.ts:20-29` | No auth, no persistence | No-op endpoint |
| C26 | `app/api/beer-bases/route.ts:27-146` | No admin auth | Trigger respawns as anyone |

### Race Conditions — Non-Atomic Read-Modify-Write

| # | File:Line | Description | Impact |
|---|-----------|-------------|--------|
| C27 | `lib/battleService.ts:768-773` | Two separate UPDATEs for resource transfer | Resources lost on failure |
| C28 | `lib/auctionService.ts:275-388` | Bid reads current_bid, checks, updates separately | Double-spend on concurrent bids |
| C29 | `lib/auctionService.ts:397-533` | Buyout reads status, checks, updates separately | Double purchase of same item |
| C30 | `lib/clanBankService.ts:96-147` | Withdraw reads balance, updates separately | Double-spend drains treasury |
| C31 | `lib/clanBankService.ts:58-89` | Deposit reads player, updates clan, deducts player | Resource duplication on failure |
| C32 | `lib/clanWarfareService.ts:233-258` | War spoils reads/writes balances separately | Treasury corruption |
| C33 | `app/api/factory/build-unit/route.ts:220-278` | Resources deducted, units inserted, slots updated — non-atomic | Slot accounting drift |
| C34 | `lib/harvestService.ts:203-326` | canHarvest check then separate UPDATE — TOCTOU | Concurrent harvests double resources |

### Functional Failures

| # | File:Line | Description | Impact |
|---|-----------|-------------|--------|
| C35 | `lib/battleService.ts:347` | Division by zero: `0/0 = NaN` in damage calc | NaN propagates, corrupts all results |
| C36 | `app/api/achievements/progress/route.ts:57` | Hardcoded `0` for currentValue | Achievements always show 0% |
| C37 | `lib/bountyBoardService.ts:44-53,64` | claimBounty removes bounty but awards nothing | Resource sink, no reward |
| C38 | `app/api/admin/warfare/config/route.ts:28` | Hardcoded password fallback `'admin123'` | Default credential exposure |
| C39 | `components/admin/AchievementStatsModal.tsx:168-169` | `formatAchievementDate` calls itself | Infinite recursion — browser crash |
| C40 | `app/api/admin/ban-player/route.ts:80-108` | Ban only inserts admin_logs, never updates player | Ban doesn't actually ban |
| C41 | `app/api/admin/anti-cheat/ban/route.ts:22-28` | Anti-cheat ban only logs | Ban doesn't actually ban |
| C42 | `app/api/admin/system-reset/route.ts:67-74` | `clear-activity-logs` deletes admin_logs | Destroys audit trail |
| C43 | `lib/harvestService.ts:316-326` + `app/api/harvest/route.ts:88-99` | Service writes harvest record, API writes second | Double-write breaks cooldown |
| C44 | `app/api/admin/vip/list/route.ts:29-30` | Requires username param, frontend doesn't send | VIP list always returns 400 |

---

## HIGH Issues (Should Fix — Broken Features/Performance/Quality)

### Broken/Non-Functional Features

| # | File:Line | Description | Impact |
|---|-----------|-------------|--------|
| H1 | `app/api/admin/rp-economy/transactions/route.ts:51` | Always returns `{ transactions: [] }` | RP transaction history non-functional |
| H2 | `app/api/admin/player-sessions/route.ts:46-68` | Returns stub data with duration:0 | Session history non-functional |
| H3 | `app/api/admin/system-reset/route.ts:88-94` | `clear-sessions` is no-op | Sessions never cleared |
| H4 | `components/admin/ModerationPanel.tsx` | Calls 8 non-existent endpoints | Entire moderation panel broken |
| H5 | `components/admin/PlayerDetailModal.tsx:103-106` | Calls 3 non-existent endpoints | Activity/Sessions/Flags tabs fail |
| H6 | `components/admin/PlayerDetailModal.tsx:493-498` | Reset progress button has no onClick | Button is dead UI |
| H7 | `lib/battleLogService.ts:278` | `getBattlesAtLocation` ignores x,y params | Location queries return all battles |
| H8 | `lib/battleLogService.ts:65-66` | `parseRounds` always returns `[]` | Round data lost |
| H9 | `lib/battleTrackingService.ts:55-59` | Malformed OR query in win stats | Win/loss stats incorrect |
| H10 | `lib/battleService.ts:687-856` | Battle log insert errors silently swallowed | Battle history incomplete |
| H11 | `app/api/admin/bot-config/route.ts:20-29` | PATCH returns `{updated:true}` without persisting | Config never saved |
| H12 | `lib/sanitizeHtml.ts:44-48` | Server-side sanitization is no-op | Stored XSS risk |
| H13 | `lib/moderationService.ts:282-293` | `unbanFromChannel` missing permission check | Anyone can unban anyone |
| H14 | `app/api/admin/give-resources/route.ts:28-29` | No validation on amounts | Negative/astronomical values allowed |
| H15 | `lib/auctionService.ts:220-266` | TODO: Unit/tradeable item ownership not validated | Fraudulent listings |
| H16 | `lib/auctionService.ts:585-649` | Cancel auction — seller from body, not session | Anyone can cancel any auction |
| H17 | `lib/battleService.ts:927-929` | Factory battle uses wrong XP actions | Wrong XP awarded |
| H18 | `lib/factory/release/route.ts:58-70` | Release resets level without cleaning units | Units orphaned from factory |
| H19 | `app/api/admin/warfare/config/route.ts:38-40` | Discards auth middleware response | Wrong error returned on auth failure |

### Performance Issues

| # | File:Line | Description | Impact |
|---|-----------|-------------|--------|
| H20 | `app/api/admin/factories/route.ts:18` | LIMIT 10,000 — unbounded | Memory issues at scale |
| H21 | `app/api/admin/tiles/route.ts:44` | LIMIT 10,000 — unbounded | Memory issues at scale |
| H22 | `lib/factoryService.ts:77-92` | N+1 — one UPDATE per factory | Linear performance degradation |
| H23 | `components/MovementControls.tsx:14-21` | Stale closure — re-subscribes on every state change | Missed movement inputs |

### Security Gaps

| # | File:Line | Description | Impact |
|---|-----------|-------------|--------|
| H24 | `app/api/stripe/create-checkout-session/route.ts:13` | No rate limiting | Stripe API abuse |
| H25 | `app/api/stripe/verify-session/route.ts:55` | No rate limiting | Replay attack risk |
| H26 | `app/api/stripe/webhook/route.ts` | No event deduplication | Double VIP grants on retry |
| H27 | `types/stripe.types.ts:378-472` | Hardcoded fallback price IDs (invalid) | Silent checkout failures |
| H28 | `lib/validation/schemas.ts:54-57` | Password min 6 (authService requires 8) | Weak passwords on some paths |
| H29 | `app/api/auth/register/route.ts:62` | Error reveals Supabase internals | Information disclosure |
| H30 | `app/api/player/profile/route.ts:18` | No rate limiting on profile read | User enumeration |
| H31 | `app/api/user/permissions/route.ts:7` | No auth, no rate limit on permissions | Admin status enumeration |
| H32 | `app/api/friends/route.ts` | No rate limiting on friend requests | Friend spam/harassment |

### Type Safety & Code Quality

| # | File:Line | Description | Impact |
|---|-----------|-------------|--------|
| H33 | `app/admin/page.tsx:56-148` | `useState<any>` throughout | Zero type safety on admin dashboard |
| H34 | `components/admin/ClanInspectorModal.tsx:78-80` | `any` types exclusively | Zero type safety on clan inspector |
| H35 | `components/admin/ClanInspectorModal.tsx:708-712` | CSV export only exports top-level keys | Malformed CSV output |
| H36 | `app/api/admin/warfare/config/route.ts:96` | Plaintext password comparison | Timing attack vector |
| H37 | `lib/factoryUpgradeService.ts:195-198` | `Math.random()` in pure function | Untestable, non-idempotent |
| H38 | `lib/dailyLoginService.ts:52-53` | `>= 24` should be `> 24` | Streak resets incorrectly at exactly 24h |
| H39 | `lib/researchPointService.ts:78-83` | Failed RP spend not logged | No audit trail for failed spends |
| H40 | `app/admin/page.tsx:288-292` | `loadVipUsers` not in dependency array | Stale closure risk |
| H41 | `app/api/admin/warfare/config/route.ts:36,81` | `supabase` created but never used | Dead code |
| H42 | `app/api/admin/warfare/config/route.ts:10` | `requireAuth` imported but not used for auth check | Dead import |

---

## MEDIUM Issues (Nice To Fix — Code Quality/Maintainability)

| # | File/Scope | Description | Impact |
|---|-----------|-------------|--------|
| M1 | Entire codebase | 1,463 `console.log` statements in production | Performance, log pollution, info leakage |
| M2 | Admin API routes | Auth pattern duplicated 15+ times | Maintenance burden, inconsistency |
| M3 | Admin API routes | 3 different auth approaches used | Confusion, security gaps |
| M4 | All API routes | Error response shapes inconsistent (`error` vs `message` vs `ErrorCode`) | Client parsing complexity |
| M5 | Admin UI | `any` types throughout state | Defeats TypeScript |
| M6 | All APIs | Mixed `username` vs `userId` vs `playerId` naming | Confusion, bugs |
| M7 | 6+ services | `Math.random()` for session/ID generation | Predictable IDs |
| M8 | Next.js config | No security headers (CSP, X-Frame-Options, etc.) | Clickjacking, MIME sniffing |
| M9 | All state-changing endpoints | No CSRF protection verified | CSRF attacks possible |
| M10 | Redis fallback | In-memory rate limiter not shared across instances | Rate limits multiplied by instance count |
| M11 | `lib/battleService.ts:566-993` | 3 battle execute functions 80% identical | Maintenance burden |
| M12 | `lib/battleService.ts:36` | Misspelled constant `UNIT_TYPE_ARCHETTE` | Confusion |
| M13 | 2+ services | Hardcoded map size in multiple places | Inconsistency |
| M14 | `lib/harvestService.ts` + `app/api/harvest/preview/route.ts` | Shrine bonus calculation duplicated | Maintenance burden |
| M15 | Multiple files | Unused imports | Dead code |
| M16 | 3+ services | Missing JSDoc on critical services | Maintainability |
| M17 | `lib/slotRegenService.ts:64` | Mutable Date handling | Potential bugs |
| M18 | `lib/antiCheatDetector.ts:167` | `createFlag` throws instead of failing gracefully | Cascading errors |
| M19 | `lib/clanService.ts:921-979` | Mass assignment risk in `updateClanSettings` | Privilege escalation if new fields added |
| M20 | Multiple services | Console logging of PII (user IDs, session IDs) | PII exposure in logs |
| M21 | `app/api/admin/vip/grant/route.ts`, `revoke/route.ts` | No audit log entries for VIP changes | No audit trail |
| M22 | `components/admin/ModerationPanel.tsx` | 6+ TODO comments for non-existent APIs | Incomplete feature |
| M23 | `lib/messagingService.ts:605` | TODO: server-side search with player name index | Search limitation |
| M24 | `components/chat/ChatMessage.tsx` | 6+ TODO comments for report/block/delete APIs | Incomplete moderation features |
| M25 | `lib/upkeepService.ts:44` | TODO: Add tech tree bonuses, clan perks | Incomplete upkeep calculation |
| M26 | `lib/auctionService.ts:549,571` | TODO: Implement unit/item transfer | Incomplete auction flow |
| M27 | `components/CreateListingModal.tsx:105` | TODO: Get from actual unit data | Hardcoded values |
| M28 | `components/tutorial/TutorialOverlay.tsx:234,247` | TODO: Collect validation data, show toast | Incomplete tutorial |
| M29 | `components/ReputationPanel.tsx:123` | TODO: Replace with actual API call | Stub data |
| M30 | `components/admin/charts/BotPopulationTrends.tsx:48` | TODO: Enhance with historical tracking | Limited analytics |
| M31 | `app/api/stripe/webhook/route.ts:403-404` | TODO: Send email, schedule VIP revocation | Incomplete subscription lifecycle |
| M32 | `app/map/page.tsx:215,219,231` | TODO: Get from player stats, add markers, integrate WS | Incomplete map features |
| M33 | `types/index.ts:101` | TODO Phase 4: Consolidate messaging types | Type inconsistency |
| M34 | `lib/wmd/jobs/defenseRepairCompleter.ts:88` | TODO: Add broadcast when implemented | Incomplete notification |
| M35 | `app/api/logs/stats/route.ts:53` | TODO: Add proper admin role check | Auth gap |
| M36 | `app/api/logs/player/[id]/route.ts:79,204` | TODO: Add admin role check | Auth gap |
| M37 | `app/api/beer-bases/route.ts:171` | TODO: Add proper admin role verification | Auth gap |
| M38 | `app/api/cache/stats/route.ts:23,194,229-230` | TODO: Add admin authentication (3 instances) | Auth gap |
| M39 | `app/api/chat/ask-veterans/route.ts:246` | TODO: Move to Redis for rate limiting | Rate limit persistence |
| M40 | `app/api/dm/route.ts:13,190` | Placeholder authentication | Auth gap |
| M41 | `app/api/dm/[id]/route.ts:15` | Placeholder authentication | Auth gap |
| M42 | `app/api/dm/[id]/read/route.ts:15` | Placeholder authentication | Auth gap |

---

## LOW Issues (Cosmetic/Style/Documentation)

| # | File/Scope | Description | Impact |
|---|-----------|-------------|--------|
| L1 | Multiple files | Mixed naming conventions (camelCase vs snake_case) | Readability |
| L2 | Multiple files | Missing documentation on exported functions | Maintainability |
| L3 | `lib/combatPowerService.ts`, `lib/pvpBurnService.ts`, `lib/territoryDecayService.ts` | No JSDoc at all | Maintainability |
| L4 | `lib/battleService.ts` | Magic numbers for damage formulas | Configurability |
| L5 | `lib/harvestService.ts` | Magic numbers for harvest amounts | Configurability |
| L6 | Multiple components | Inconsistent component prop naming | Readability |
| L7 | `lib/designTokens.ts` | Design tokens not used consistently across all components | Visual inconsistency |
| L8 | `app/api/health/route.ts`, `app/api/health/check/route.ts` | Duplicate health check endpoints | Confusion |
| L9 | `lib/mongodb.ts` | MongoDB client still imported but Supabase is primary | Dead dependency |
| L10 | `scripts/db/fix-admin.ts:22`, `scripts/db/verify-login.ts:23`, `scripts/admin/create-admin.ts:20` | Real password `Sthcnh4525!` hardcoded in scripts | Security risk if scripts committed |
| L11 | `lib/playerService.ts:15,85` | `SUPABASE_PASSWORD_PLACEHOLDER` | Confusion |
| L12 | `lib/beerBaseService.ts:187` | `beerbase_bot_auth_placeholder` | Confusion |
| L13 | `lib/flagBotService.ts:131` | `bot_auth_placeholder` | Confusion |
| L14 | `lib/botService.ts:230,277` | `BOT_ACCOUNT`, `BOSS_ACCOUNT` as passwords | Confusion |
| L15 | `app/api/auth/register/route.ts:80` | `password: 'supabase_auth'` | Confusion |
| L16 | `app/api/admin/bot-spawn/route.ts:48` | `password: 'supabase_auth'` | Confusion |
| L17 | `app/api/admin/bot-regen/route.ts:52` | `password: 'supabase_auth'` | Confusion |
| L18 | `app/admin/vip/page.tsx:104-118` | Revenue analytics hardcoded to 0, no API calls | Stub page |
| L19 | `lib/websocket/server.ts:145` | TODO: Implement tile info request | Incomplete WS handler |
| L20 | `components/messaging/MessageThread.tsx:515` | TODO comment block for real-time features | Documentation debt |

---

## Test Suite Issues

| # | File | Description | Impact |
|---|------|-------------|--------|
| T1 | `lib/battleService.test.ts` | 23 tests — tests JS arithmetic, never calls battleService | False confidence |
| T2 | `lib/beerBaseService.test.ts` | 27 tests — only 2 call actual service functions | False confidence |
| T3 | `lib/websocket/__tests__/chat.test.ts` | Defines mock handlers inline, never imports real chatHandlers | False confidence |
| T4 | `package.json` | Missing `@vitest/coverage-v8` in devDependencies | `test:coverage` fails |
| T5 | All admin routes | 0% coverage (0 of 55) | Untested admin functionality |
| T6 | All WMD | 0% coverage | Untested WMD subsystem |
| T7 | All clan | 0% coverage (0 of 42+) | Untested clan system |
| T8 | All auction | 0% coverage | Untested auction system |
| T9 | All Stripe | 0% coverage | Untested payment flow |
| T10 | All anti-cheat | 0% coverage | Untested security system |

---

## Impact Matrix — Fix Plan

| # | File(s) | Change | Blast Radius | Risk |
|---|---------|--------|--------------|------|
| 1 | `lib/authMiddleware.ts` | Create `requireAdminAuth()` reusable middleware | All admin routes | HIGH |
| 2 | 26 admin/game API routes | Replace body-supplied username with `requireAuth()` | All affected endpoints | HIGH |
| 3 | `app/api/admin/vip/grant/route.ts`, `revoke/route.ts` | Add `requireAuth` + admin check + audit logging | VIP management | HIGH |
| 4 | `app/api/admin/ban-player/route.ts`, `anti-cheat/ban/route.ts` | Actually update player `is_banned` field | Ban system | HIGH |
| 5 | `lib/battleService.ts:768-773` | Wrap resource transfer in transaction | Battle resource theft | HIGH |
| 6 | `lib/auctionService.ts` | Atomic bid/buyout with conditional updates | Auction integrity | HIGH |
| 7 | `lib/clanBankService.ts` | Atomic withdraw/deposit with transactions | Clan treasury | HIGH |
| 8 | `lib/clanWarfareService.ts:233-258` | Atomic war spoils distribution | Clan treasury | HIGH |
| 9 | `app/api/factory/build-unit/route.ts` | Wrap in transaction | Factory slot integrity | HIGH |
| 10 | `lib/harvestService.ts` + `app/api/harvest/route.ts` | Remove duplicate insert, add UNIQUE constraint | Harvest system | HIGH |
| 11 | `lib/battleService.ts:347` | Guard against 0/0 division | Battle damage | HIGH |
| 12 | `app/api/achievements/progress/route.ts:57` | Fetch actual player stats | Achievement system | HIGH |
| 13 | `lib/bountyBoardService.ts:44-53` | Award resources on claim | Bounty system | HIGH |
| 14 | `app/api/admin/warfare/config/route.ts:28` | Remove hardcoded password fallback | Admin security | HIGH |
| 15 | `components/admin/AchievementStatsModal.tsx:168-169` | Fix infinite recursion | Browser crash | HIGH |
| 16 | `app/api/admin/system-reset/route.ts:67-74` | Exclude admin_logs from deletion | Audit trail | HIGH |
| 17 | `app/api/admin/vip/list/route.ts:29-30` | Remove required username param, use session auth | VIP list | HIGH |
| 18 | `app/api/admin/rp-economy/transactions/route.ts:51` | Implement actual DB query | RP economy | HIGH |
| 19 | `app/api/admin/player-sessions/route.ts:46-68` | Implement actual session retrieval | Player sessions | HIGH |
| 20 | `app/api/admin/system-reset/route.ts:88-94` | Implement clear-sessions | System reset | HIGH |
| 21 | `components/admin/ModerationPanel.tsx` | Implement missing endpoints OR remove broken UI | Moderation | HIGH |
| 22 | `components/admin/PlayerDetailModal.tsx` | Implement missing endpoints OR mark tabs unavailable | Player detail | HIGH |
| 23 | `components/admin/PlayerDetailModal.tsx:493-498` | Implement reset progress handler | Player detail | MEDIUM |
| 24 | `lib/battleLogService.ts:278` | Add `.eq()` for x,y params | Battle logs | HIGH |
| 25 | `lib/battleLogService.ts:65-66` | Implement parseRounds | Battle replay | HIGH |
| 26 | `lib/battleTrackingService.ts:55-59` | Fix OR query syntax | Battle stats | HIGH |
| 27 | `lib/battleService.ts:687-856` | Throw or queue on log failure | Battle history | MEDIUM |
| 28 | `app/api/admin/bot-config/route.ts:20-29` | Implement actual persistence | Bot config | HIGH |
| 29 | `lib/sanitizeHtml.ts:44-48` | Use server-compatible sanitizer | XSS prevention | HIGH |
| 30 | `lib/moderationService.ts:282-293` | Add permission check to unban | Moderation | HIGH |
| 31 | `app/api/admin/give-resources/route.ts:28-29` | Add input validation | Economy | HIGH |
| 32 | `lib/auctionService.ts:220-266` | Implement ownership validation | Auction integrity | HIGH |
| 33 | `lib/auctionService.ts:585-649` | Derive seller from session | Auction security | HIGH |
| 34 | `lib/battleService.ts:927-929` | Use correct XP actions | XP tracking | MEDIUM |
| 35 | `lib/factory/release/route.ts:58-70` | Clean up orphaned units | Factory integrity | MEDIUM |
| 36 | `app/api/admin/warfare/config/route.ts:38-40` | Return auth middleware response directly | Error handling | MEDIUM |
| 37 | `app/api/admin/factories/route.ts:18` | Add pagination | Performance | MEDIUM |
| 38 | `app/api/admin/tiles/route.ts:44` | Add pagination | Performance | MEDIUM |
| 39 | `lib/factoryService.ts:77-92` | Batch update factories | Performance | MEDIUM |
| 40 | `components/MovementControls.tsx:14-21` | Use refs to avoid re-subscription | UX | MEDIUM |
| 41 | `app/api/stripe/create-checkout-session/route.ts:13` | Add rate limiter | Payment security | HIGH |
| 42 | `app/api/stripe/verify-session/route.ts:55` | Add rate limiter + idempotency | Payment security | HIGH |
| 43 | `app/api/stripe/webhook/route.ts` | Add event deduplication | Payment security | HIGH |
| 44 | `types/stripe.types.ts:378-472` | Throw if price IDs not configured | Payment reliability | MEDIUM |
| 45 | `lib/validation/schemas.ts:54-57` | Align password min to 8, add complexity | Auth security | HIGH |
| 46 | `app/api/auth/register/route.ts:62` | Return generic error message | Info disclosure | MEDIUM |
| 47 | `app/api/player/profile/route.ts:18` | Add rate limiting | Enumeration | MEDIUM |
| 48 | `app/api/user/permissions/route.ts:7` | Add auth + rate limiting | Info disclosure | HIGH |
| 49 | `app/api/friends/route.ts` | Add rate limiting | Spam prevention | MEDIUM |
| 50 | `app/admin/page.tsx:56-148` | Define proper interfaces for all state | Type safety | MEDIUM |
| 51 | `components/admin/ClanInspectorModal.tsx` | Define TypeScript interfaces | Type safety | MEDIUM |
| 52 | `components/admin/ClanInspectorModal.tsx:708-712` | Fix CSV export for nested data | Admin exports | MEDIUM |
| 53 | `app/api/admin/warfare/config/route.ts:96` | Use `crypto.timingSafeEqual` | Timing attack | MEDIUM |
| 54 | `lib/factoryUpgradeService.ts:195-198` | Return probability only, caller rolls | Testability | MEDIUM |
| 55 | `lib/dailyLoginService.ts:52-53` | Change `>=` to `>` | Streak accuracy | MEDIUM |
| 56 | `lib/researchPointService.ts:78-83` | Log failed spend attempts | Audit trail | MEDIUM |
| 57 | `app/admin/page.tsx:288-292` | Add `loadVipUsers` to deps or useCallback | Stale closure | LOW |
| 58 | `app/api/admin/warfare/config/route.ts` | Remove unused supabase variable, requireAuth import | Dead code | LOW |
| 59 | Entire codebase | Replace console.log with structured logger | Production quality | MEDIUM |
| 60 | All admin routes | Standardize on `requireAuth` pattern | Consistency | MEDIUM |
| 61 | All API routes | Standardize error response format | Consistency | MEDIUM |
| 62 | All APIs | Standardize on `userId` naming | Consistency | LOW |
| 63 | 6+ services | Replace `Math.random()` with `crypto.randomUUID()` | Security | MEDIUM |
| 64 | Next.js config | Add security headers | Security | MEDIUM |
| 65 | All state-changing endpoints | Verify CSRF protection | Security | MEDIUM |
| 66 | `lib/battleService.ts:566-993` | Extract common battle flow | Maintainability | LOW |
| 67 | `lib/battleService.ts:36` | Rename `UNIT_TYPE_ARCHETTE` to `UNIT_TYPE_ARCHER` | Consistency | LOW |
| 68 | 2+ services | Centralize map size constant | Consistency | LOW |
| 69 | `lib/harvestService.ts` + preview route | Extract shrine bonus to shared function | Maintainability | LOW |
| 70 | Multiple files | Remove unused imports | Cleanliness | LOW |
| 71 | 3+ services | Add JSDoc | Maintainability | LOW |
| 72 | `lib/slotRegenService.ts:64` | Ensure immutable Date handling | Correctness | LOW |
| 73 | `lib/antiCheatDetector.ts:167` | Catch and return failure indicator | Robustness | MEDIUM |
| 74 | `lib/clanService.ts:921-979` | Use explicit allowlist for settings | Security | MEDIUM |
| 75 | Multiple services | Redact PII from logs | Privacy | MEDIUM |
| 76 | `app/api/admin/vip/grant/route.ts`, `revoke/route.ts` | Add admin_logs entries | Audit trail | MEDIUM |
| 77 | `lib/battleService.test.ts` | Rewrite to test actual battleService | Test quality | HIGH |
| 78 | `lib/beerBaseService.test.ts` | Rewrite to test actual service | Test quality | HIGH |
| 79 | `lib/websocket/__tests__/chat.test.ts` | Import and test real chatHandlers | Test quality | HIGH |
| 80 | `package.json` | Add `@vitest/coverage-v8` | Test infrastructure | MEDIUM |
| 81 | `scripts/db/*.ts`, `scripts/admin/*.ts` | Remove hardcoded real passwords | Security | HIGH |
| 82 | `app/admin/vip/page.tsx` | Implement actual data loading or remove stub | Admin UX | MEDIUM |
| 83 | `lib/websocket/server.ts:145` | Implement tile info request handler | WS completeness | LOW |
| 84 | All TODO comments | Implement or remove | Code quality | MEDIUM |

---

## Implementation Plan

### Phase 1: Authentication & Authorization (P0 — Security Critical)
1. Create `requireAdminAuth()` reusable middleware in `lib/authMiddleware.ts`
2. Fix all 26 auth bypass routes — replace body-supplied username with `requireAuth()`
3. Add auth to VIP grant/revoke with audit logging
4. Fix admin self-bypass pattern on 15+ routes
5. Remove hardcoded password `admin123` from warfare config
6. Add rate limiting to all unauthenticated and payment endpoints
7. Fix password schema mismatch (align to 8 chars + complexity)
8. Add auth + rate limiting to permissions endpoint
9. Remove hardcoded real passwords from scripts

### Phase 2: Data Integrity & Race Conditions (P0 — Data Critical)
1. Wrap battle resource transfer in transaction
2. Implement atomic auction bid/buyout with conditional updates
3. Implement atomic clan bank withdraw/deposit with transactions
4. Implement atomic war spoils distribution
5. Wrap factory build-unit in transaction
6. Fix harvest double-write + add UNIQUE constraint for TOCTOU
7. Fix give-resources race condition (atomic increment)
8. Add input validation to give-resources

### Phase 3: Functional Failures (P0 — User-Facing Broken)
1. Fix division by zero in battle damage calculation
2. Fix achievement progress endpoint to fetch actual stats
3. Fix bounty claims to award resources
4. Fix infinite recursion in AchievementStatsModal
5. Fix ban endpoints to actually update player state
6. Fix system reset to exclude admin_logs from deletion
7. Fix VIP list endpoint (remove required username param)
8. Fix RP transactions endpoint (implement DB query)
9. Fix player sessions endpoint (implement actual retrieval)
10. Fix system reset clear-sessions (implement)
11. Fix bot-config PATCH (implement persistence)
12. Fix getBattlesAtLocation (add x,y filters)
13. Fix parseRounds (implement JSON parsing)
14. Fix battle tracking OR query
15. Fix factory release to clean orphaned units
16. Fix factory battle XP actions

### Phase 4: Security Hardening (P1)
1. Fix server-side HTML sanitization
2. Add permission check to unbanFromChannel
3. Implement auction ownership validation
4. Fix cancel auction to derive seller from session
5. Add Stripe rate limiting + event deduplication + idempotency
6. Fix Stripe price ID fallback (throw if not configured)
7. Add security headers to Next.js config
8. Verify/implement CSRF protection
9. Replace Math.random() with crypto.randomUUID() for IDs
10. Add timing-safe comparison for warfare config password
11. Fix auth register error to return generic message
12. Add rate limiting to profile endpoint
13. Fix clan settings mass assignment risk

### Phase 5: Performance & Quality (P2)
1. Add pagination to factories/tiles endpoints
2. Batch factory income updates (fix N+1)
3. Fix MovementControls stale closure
4. Extract shrine bonus calculation to shared function
5. Extract common battle flow to reduce duplication
6. Define proper TypeScript interfaces for admin state
7. Fix CSV export for nested data
8. Standardize error response format across all routes
9. Standardize on `requireAuth` pattern for all admin routes
10. Standardize naming (`userId` across all APIs)

### Phase 6: Code Cleanup (P3)
1. Replace console.log with structured logger (or remove debug logs)
2. Remove unused imports and dead code
3. Add JSDoc to undocumented services
4. Centralize map size constant
5. Fix mutable Date handling in slotRegenService
6. Fix antiCheatDetector to fail gracefully
7. Redact PII from logs
8. Rename UNIT_TYPE_ARCHETTE typo
9. Fix daily login streak edge case
10. Log failed RP spend attempts
11. Add audit logs for VIP changes
12. Fix stale closure in admin page VIP filter

### Phase 7: Test Suite (P2)
1. Rewrite battleService.test.ts to test actual service
2. Rewrite beerBaseService.test.ts to test actual service
3. Rewrite chat.test.ts to import real chatHandlers
4. Add @vitest/coverage-v8 to devDependencies
5. Add tests for critical auth bypass fixes
6. Add tests for race condition fixes
7. Add tests for Stripe webhook deduplication
8. Add tests for admin auth middleware

### Phase 8: TODO Resolution (P3)
1. Implement or remove all 40+ TODO comments
2. Implement missing moderation panel endpoints OR remove broken UI
3. Implement missing player detail modal endpoints OR mark unavailable
4. Implement missing tutorial features OR mark incomplete
5. Implement reputation panel API call OR remove stub
6. Implement VIP page data loading OR mark as stub
7. Implement WebSocket tile info handler
8. Implement messaging real-time features (or document as future)

---

## Verification Checklist

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx eslint . --ext .ts,.tsx` — 0 errors (warnings acceptable for pre-existing hook deps)
- [ ] `npm test` — all tests pass, no fake tests
- [ ] `npm run build` — production build succeeds
- [ ] All 26 auth bypass routes use `requireAuth()`
- [ ] All 15+ admin self-bypass routes use `requireAdminAuth()`
- [ ] VIP grant/revoke requires admin auth + logs to admin_logs
- [ ] Ban endpoints actually update player `is_banned` field
- [ ] System reset cannot delete admin_logs
- [ ] No hardcoded passwords in code
- [ ] No hardcoded real passwords in scripts
- [ ] All race conditions fixed with atomic operations or transactions
- [ ] Battle damage handles 0/0 gracefully
- [ ] Achievements show actual progress
- [ ] Bounty claims award resources
- [ ] No infinite recursion in any component
- [ ] Server-side HTML sanitization works
- [ ] Stripe webhook has event deduplication
- [ ] Stripe endpoints have rate limiting
- [ ] Password schema requires 8+ chars with complexity
- [ ] All admin routes use consistent auth pattern
- [ ] All error responses use consistent format
- [ ] No `any` types in new code
- [ ] No TODO/FIXME/placeholder comments remain
- [ ] Test coverage > 50% on critical paths
- [ ] Security headers configured in Next.js
- [ ] CSRF protection verified
- [ ] PII redacted from production logs
- [ ] Pagination on all unbounded endpoints
- [ ] Rate limiting on all sensitive endpoints

---

## Notes

- This is the largest single FID in the project history. It addresses 130+ issues across 100+ files.
- The FID is organized by priority: P0 (security/data integrity/functional) → P1 (security hardening) → P2 (performance/quality) → P3 (cleanup/TODOs).
- Each phase must pass `tsc --noEmit` and `eslint` before proceeding to the next.
- The Push Gate applies: all work committed locally, no push without explicit approval.
- Three Laws apply: Read 0-EOF, Present before act, Verify before proceed.
- No stubs, no placeholders, no `as any`, no `TODO` comments in final code.
- Test suite must be fixed — fake tests rewritten, coverage added for critical paths.
- Hardcoded passwords in scripts must be removed immediately (security risk).
- Admin panel is the highest-risk area — 60% of routes have broken auth.