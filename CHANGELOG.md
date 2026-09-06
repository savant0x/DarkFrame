# Changelog

All notable changes to DarkFrame are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); dates are session dates (America/New_York).

## [Unreleased] — 2026-09-05/06 session

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

## [Unreleased] — 2026-09-04 session
- Initial Postgres migration effort, GitHub repo sanitization (secret scrub + history rewrite),
  README redesign, Vercel deployment pipeline bring-up (lazy DB connection for build-time
  env isolation), production DB connection fixes.
