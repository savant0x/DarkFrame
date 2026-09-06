# FID-20260906-008: Track Flow Dead-End — No Public Profile Destination

**Filename:** `FID-20260906-008-track-flow.md`
**ID:** FID-20260906-008
**Severity:** HIGH (flag feature's primary navigation lands on 404; public identity layer missing)
**Status:** closed
**Created:** 2026-09-06

---

## 1. Summary

The Flag Tracker's **Track** button (`components/FlagTrackerPanel.tsx:500` →
`onTrack(bearer)`) is fully broken: `handleFlagTrack` (`app/game/page.tsx:724`) pushes
`/profile/${bearer.username}`, but **no dynamic profile page exists** — the user lands
on a 404. The design doc confirms the intent
(`docs/FLAG_TRACKER_INTEGRATION_COMPLETE.md:100`: *"Track button → Click to view Flag
Bearer's profile"*), so this is a dead-wire, not a design question. The fix requires
the missing destination (page + public API + projection shape), not a rewire to
something else.

---

## 2. RED — Findings with file:line evidence

- **F1 — Dead destination.** `app/profile/` contains only `page.tsx` (own profile) and
  `ProfileView.tsx`. No `app/profile/[username]/` route. Any Track click → 404.
  Only navigation source: `app/game/page.tsx:724`.
- **F2 — No public profile API.** `app/api/player/profile/route.ts` exists but is
  session-only (returns the *authenticated* player's profile). No endpoint serves
  *another* player's public profile by username.
- **F3 — ~~Existing public route is projection-non-compliant~~ CLEARED IN AUDIT.**
  Pass-1 claimed `app/api/player/route.ts` leaked `email`/`signupIp`. Audit round 1
  disproved this with live evidence: `GET /api/player?username=fame` returns
  `has email: false | has signupIp: false | has password: false` — `getPlayer`
  delegates to `getPlayerByUsername`, which applies the §5.0 allowlist by default.
  The claim was stale (pre-§5.0 state). **No fix needed; R4 struck from scope.**
- **F4 — No server-side 404 contract for unknown/bot names.** Track can only target
  real players today (the flag bot cannot hold the flag in the current design), but a
  public profile endpoint must return 404 for unknown usernames — including bot names
  — not leak row existence.

## 3. Impact Analysis

- Flag feature (revived in FID-20260905-001) has a primary action that 404s on every
  click — release-blocking for the flag loop's chase gameplay.
- The same public-profile layer unblocks future needs: leaderboard name clicks,
  battle-log attacker/defender links, clan roster member links.
- ~~Security: F3 PII leak~~ — disproved in audit (see §2, F3); no live leak exists.

## 4. Five Questions

1. **All cases?** Yes — page handles unknown names (404/notFound), bot names
   (bot-identity banner), self (own-profile link), and unauthenticated visitors.
2. **Scale?** Yes — single indexed PK lookup; page renders on demand; no new polling.
3. **Hostile attacker?** Yes — new API returns the §5.0 sanitized projection only
   (allowlist, password/email/signupIp can never ride along); unknown names → 404 with
   no existence signal difference; no behavior differences for bot names.
4. **Maintainable in 2 years?** Yes — one service function (`getPlayerByUsername`)
   already exists as the single read seam; the projection type becomes the shared
   contract for all future public-identity surfaces.
5. **Industry standard?** Yes — public profile pages are table stakes for any
   multiplayer persistence game; allowlist projection is standard practice.

---

## 5. GREEN Design

### R1 — Public profile API: `GET /api/profile/[username]`

- New dynamic route. Resolves identity from the **URL param**, not the session; any
  unauthenticated read is allowed (public identity layer, per design intent).
- Data: `getPlayerByUsername(username)` (lib/playerService.ts:120) — public callers
  get the §5.0 sanitized projection by default; `includePrivate` is never passed.
- Response shape `{ success, profile }` with an **explicit public profile shape**
  (identity, level/rank/XP, base coordinates, reputation if bot, battleStats if
  present, achievements, createdAt) — reusing the §5.0 projection's fields, never
  spreading rows.
- 404 via the shared error helper for unknown names; 400 for malformed names
  (length/charset validation); no existence oracle (same 404 body for bot vs unknown).
- No PII (email/signupIp/stripe ids) can appear: allowlist type enforced at compile
  time (the route builds `PublicProfile` explicitly, field by field).
- Written per the §2.1/§3.1 census conventions (rate-limited, request-logged, error
  codes via `lib/errors`).

### R2 — Public profile page: `app/profile/[username]/page.tsx`

- Client page using the existing dynamic-param convention
  (`useParams` → `username`, as in `app/game/battle-logs/[type]/page.tsx:74`).
- Renders the `PublicProfile` contract: name, level/rank, XP, base coordinates,
  battle stats (if present), achievements count, joined date.
- **Bot identity banner** when `profile.isBot` — in-game fiction: bots are rogue
  autonomous war machines, not players ("⚠ Autonomous rogue unit — not a player").
- Handles: loading, unknown-name 404 state, and a self-view shortcut ("This is you —
  open your profile" linking to `/profile`).
- Back navigation returns to the game (`/game`).

### R3 — Rewire `handleFlagTrack` (no handler logic change)

- `app/game/page.tsx:724` stays as-is — it already pushes the correct URL; the fix is
  the destination existing. Verified live post-implementation.

### R4 — ~~Fix the non-compliant tile feed~~ STRUCK (audit round 1)

- Live probe disproved the F3 claim — the tile feed is already sanitized (§5.0).
  Recorded here so the audit trail shows the self-correction, not a silent drop.

### Out of scope (recorded)

- Leaderboard/battle-log/clan-roster profile links — now trivially addable on top of
  R1/R2, but each is a separate UX change; not silently absorbed.

## 6. Verification Plan

1. **Static:** `tsc --noEmit` = 0; eslint clean on touched files.
2. **Live API probe (dev server):** `GET /api/profile/fame` → 200 + sanitized shape
   (assert no `email`/`signupIp`/`password` keys); unknown name → 404; malformed name
   (e.g. `' OR 1=1--`) → 400; a bot name (e.g. `Thundering Depot`) → 200 with
   `isBot: true` and the same 404-free-but-safe shape.
3. **Live UI probe (preview):** from `/game`, click Track → lands on
   `/profile/<bearer>`; screenshot the profile page (human + bot bearer cases).
4. **Regression:** `/api/player` tile feed no longer contains `email`/`signupIp`
   (grep + live response assertion); full suite green; GameLayout/game page compile.
5. **FID ground truth:** closed status requires commit hash + the above outputs.

## 7. Loop Record

- **Pass 1 (RED→GREEN, this document):** all four findings cataloged with file:line;
  design settled on the allowlist projection + existing service seam (Law 7 — no new
  data path invented). Awaiting audit round before implementation.
- **AUDIT round 1 (self-correct):** F3 disproved by live probe — the tile feed is
  already §5.0-sanitized (no email/signupIp/password in response). R4 struck, impact
  analysis corrected. Remaining scope: R1 (public API), R2 (public page), R3 (verify
  handler). Proceeding to implementation.
- **IMPLEMENT + verification (2026-09-06):**
  - R1: `app/api/profile/[username]/route.ts` — public GET, identity from URL param,
    data via `getPlayerByUsername` default projection; explicit `PublicProfile` shape
    built field-by-field (no spreads); 404/400 contracts. Wrapper typed params as
    `Promise<Record<string, string>>` (tsc caught the narrower type).
  - **Self-correct round 2 (live probe caught a design conflict):** the original
    charset check rejected bot names with spaces — but FID-007's themed Beer Base
    names legitimately contain them ("Thundering Depot" → 400). Added shared
    `isLookupableUsername()` to `lib/authService.ts` (documented superset of the
    registration rule: bots never register; hostile URL segments still rejected
    before any DB access). Re-probe: bot → 200 `isBot:true`, malformed → 400,
    unknown → 404, fame → 200 with **zero PII keys** (email/signupIp/password/
    referredBy asserted absent).
  - R2: `app/profile/[username]/page.tsx` — glass-language profile page
    (useParams convention per battle-logs/[type]), loading/404/bot-banner/self-hint
    states.
  - R3: handler needed no change (destination now exists).
  - **End-to-end (preview, real click):** /game → Flag Tracker (bearer
    Flag-Bearer-4523 at 74,150, OUT OF RANGE) → Track click → landed on
    `/profile/Flag-Bearer-4523` → profile rendered with matching position (74,150),
    Level 65, rogue-unit banner (screenshot evidence).
  - Gates: `tsc --noEmit` 0; eslint clean; suite **348 passed / 1 skipped**.
- **CLOSED** — commit hash recorded in the CHANGELOG entry.
