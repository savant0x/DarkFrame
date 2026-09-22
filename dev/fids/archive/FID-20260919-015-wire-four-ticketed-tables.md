# FID-20260919-015 — SCOPE row 112: wire all four ticketed tables (chatReadStatus, shrineBlessings, wmdConfig, wmdSuspiciousActivity)

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-19 (operator directive: "on the 112, wire everything")
**Origin:** FID-20260919-014's Law-17 census caught four ghost tables and ticketed them
(SCOPE row 112). Operator chose **wire** for all four — no removals.

---

## 1. Evidence chain (ground truth, all probed this session)

| Table | Schema truth | Live-DB reality | Prior state |
|---|---|---|---|
| `chat_read_status` | `lib/db/schema/chat.ts:29` — (channelId, userId, lastReadMessageId, lastReadAt), pair index **non-unique** | exists | zero references; PATCH /api/chat is the FID-012 documented no-op; ChatPanel's unread counts are socket/session-only (lost on refresh); channels route even documents "unread counts" as a *future enhancement* |
| `shrine_blessings` | `lib/db/schema/config.ts:89` — (playerId, tier, expiresAt, yieldBonus) | exists | zero references; live boosts live in `players.shrine_boosts` jsonb (activate + boost-all routes) |
| `wmd_config` | `lib/db/schema/wmd.ts:195` — (key unique, value jsonb `$type<WmdAlertSettingsPayload>`) | exists | zero references; alert config is hardcoded intent in `alert.types.ts` (`AlertConfig`) |
| `wmd_suspicious_activity` | `lib/db/schema/wmd.ts:165` | exists (0 rows) | writer EXISTS (`wmdAdminService.flagSuspiciousActivity`) but has **zero callers**; enum already names the triggers: `RAPID_VOTING \| COOLDOWN_BYPASS_ATTEMPT \| EXCESSIVE_LAUNCHES \| UNUSUAL_PATTERN`; no reader either |

Adjacent truths that shape the wiring:
- `wmdAdminAlerts` has TWO writers (`createAdminAlert`, `missileTracker.recordAdminAlert`) — both insert directly; severity gate must cover both (Law 13).
- `missiles.launchedAt/launchedBy` exist → launch-rate detection is a pure query.
- `wmdClanVotes.votesFor/votesAgainst` carry voter ids → rapid-voting detection is a pure query (double-vote is already refused in `castVote`).
- Channel ids are the `ChannelType` enum (global/newbie/clan/trade/help/vip); clan channel is single shared id `clan`.
- Id convention: `generateId()` from `lib/utils` (24-char budget).
- Admin reader surface exists: `app/api/admin/health` (wmdAlerts block) + AdminView.

## 2. Wiring plan (four tables, one FID)

### W1 — chatReadStatus → persistent channel unread badges
- Migration 0036: dedupe + unique `(channel_id, user_id)` index (0034 pattern).
- `lib/chatReadStatusService.ts`: `markChannelRead(username, channelId, lastReadMessageId)` (upsert) + `getChannelReadState(username)` (map channelId→lastReadAt).
- Real PATCH `/api/chat` (replaces the FID-012 no-op comment): channel validation stays, now persists via the service.
- New GET `/api/chat/read-state`: authenticated per-user map.
- ChatPanel: fetch read-state on mount → seed `unreadCounts` as **unread-since-last-visit** (messages newer than `lastReadAt`, own messages excluded — socket merging already dedupes); persist `markChannelRead` on channel switch + on incoming message while channel active. Badges survive refresh.

### W2 — shrineBlessings → persistent boost grant history
- `lib/shrineBlessingService.ts`: `recordBlessing(username, tier, expiresAt, yieldBonus)` writes per-grant rows (playerId = username, matching the table's FK-less player_id convention); `getBlessingHistory(username, {limit})`.
- Insert one row per boost grant in `app/api/shrine/activate` and `boost-all` (non-fatal: history write failure must not fail the boost — logged + swallowed).
- New GET `/api/shrine/blessings` → last N grants.
- ShrinePanel: "Recent Blessings" summary (tier, granted-at, expiry, yield bonus) — a persistent record the jsonb can never be (jsonb holds only current expiry per tier).

### W3 — wmdConfig → real alert configuration
- `lib/wmd/admin/alertConfigService.ts`: `getAlertConfig()` (select key='alerts' → payload.settings, else the hardcoded `DEFAULT_ALERT_CONFIG` — table-first, fallback-honest) + `setAlertConfig(settings)` (upsert).
- Severity gate: `createAdminAlert` and `recordAdminAlert` consult `getAlertConfig()` — `enabled=false` or below `minSeverity` → insert skipped, return/continue gracefully. Config write path: PUT `/api/admin/wmd-config` (admin-gated).
- AdminView: the WMD tab already renders alert state; add a small config display (enabled, minSeverity) fed by GET `/api/admin/wmd-config`.

### W4 — wmdSuspiciousActivity → reachable triggers + admin reader
- `lib/wmd/suspiciousActivityService.ts`: `flagExcessiveLaunches(username)` — count missiles with `launchedBy=username AND launchedAt > now-24h`; threshold 10 (server-configurable constant); calls the EXISTING `flagSuspiciousActivity` (writer wired at last) + fires once per launch (dedupe: only flag when count crosses threshold exactly — `=== 10`, not `>=`).
- Trigger call site: `app/api/wmd/missiles` POST launch-success path (non-fatal).
- Reader: GET `/api/admin/wmd-config` also returns recent suspicious-activity rows (admin-gated) — one admin route serves both W3 config + W4 rows.
- AdminView: extend the WMD tab's alert block with the suspicious-activity list.

## 3. Non-goals
- No clan-channel-per-clan read states (single `clan` channel id stays).
- No email/delivery channels (the removed FID-011 stack's job stays dead).
- No launch-cooldown bypass detector yet (no cooldown seam exists to bypass) — `COOLDOWN_BYPASS_ATTEMPT` stays unwired by design.

## 4. Gates
Pins per service (upsert/idempotence, threshold-exactly, config fallback + gate, non-fatal history), route pins, live probe: chat badge persistence + shrine blessing row + config gate flip + a 10-launch flag (probe-only helper), full suite/tsc/eslint.

## 8. Closure

Implemented same session on operator directive ("on the 112, wire everything").
Implementation commit: `32c6f85` (22 files, +1437). Closed on `32c6f85`.

All four tables are now **live** under Law 17 — the census reports 63 tables:
**54 live (was 50), 9 ticketed, 0 violations**.

**W1 — chatReadStatus.** Migration `0036_chat_read_status_unique.sql` (dedupe + unique
`(channel_id, user_id)`); `lib/chatReadStatusService` (`markChannelRead` upsert,
`getChannelReadState`, unread summary); the real PATCH `/api/chat` replaces the FID-012
documented no-op; new GET `/api/chat/read-state`; ChatPanel seeds unread-since-last-visit
on mount and persists on channel switch / incoming message — channel badges now survive
refresh.

**W2 — shrineBlessings.** `lib/shrineBlessingService` (`recordBlessing`,
`getBlessingHistory`; yield bonus converted to integer percent at the storage boundary
because the column is `integer`, not a fraction column); non-fatal grant inserts in
`/api/shrine/activate` + `/api/shrine/boost-all`; new GET `/api/shrine/blessings`;
ShrinePanel "Recent Blessings" — a persistent per-grant history the jsonb store can
never be.

**W3 — wmdConfig.** `lib/wmd/admin/alertConfigService` (`getAlertConfig` table-first with
the hardcoded `DEFAULT_ALERT_CONFIG` fallback, `setAlertConfig` upsert); the
enabled/minSeverity gate is now consulted by **both** alert writers (`createAdminAlert`
and `missileTracker.recordAdminAlert`); GET/PUT `/api/admin/wmd-config`; AdminView
config display.

**W4 — wmdSuspiciousActivity.** `lib/wmd/suspiciousActivityService.flagExcessiveLaunches`
(24h launch count from `missiles`, threshold 10, once-per-window crossing via a dedupe
read so a repeated evaluation cannot re-flag); non-fatal trigger on the missiles POST
success path; recent-rows reader on the admin route; AdminView suspicious-activity list.
The previously-unreachable `flagSuspiciousActivity` writer now has a live caller and a
live reader.

**Latent defect caught en route:** `flagSuspiciousActivity` / `createAdminAlert` id
formats (28/29 chars) overflowed their `varchar(24)` id columns — unexposed for as long
as the writers had no callers. Both now use the 23-char `generateId()`.

**Evidence:** 23 pins (chatReadState 6, wmdAlertConfig 10, shrineBlessingLedger,
suspiciousLaunchThreshold); live probe `scripts/e2eWireFourTablesLive.ts` **15/15**
against the real DB + server — chat badge persist/reload, blessing ledger row with the
percent boundary, config gate flipping an insert off, and a 10-launch
`EXCESSIVE_LAUNCHES` flag with once-per-window dedupe. Gates: suite **1254/1254**
(129 files), tsc 0, eslint clean; census 63 tables — 54 live, 9 ticketed, 0 violations.

**Carried forward (§3 non-goals):** `COOLDOWN_BYPASS_ATTEMPT` stays unwired (no cooldown
seam exists to bypass); `RAPID_VOTING` / `UNUSUAL_PATTERN` remain enum-only.
