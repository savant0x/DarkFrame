# Changelog

All notable changes to DarkFrame are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); dates are session dates (America/New_York).

## [Unreleased] — 2026-09-05/06 session

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

## [Unreleased] — 2026-09-04 session
- Initial Postgres migration effort, GitHub repo sanitization (secret scrub + history rewrite),
  README redesign, Vercel deployment pipeline bring-up (lazy DB connection for build-time
  env isolation), production DB connection fixes.
