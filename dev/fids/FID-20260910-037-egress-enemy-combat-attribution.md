# FID-20260910-037 — Egress Remediation, Enemy-Base Combat Surface & Attribution Guard

**Date:** 2026-09-10 · **Trigger:** Supabase over-quota email (21.18 GB egress vs 5 GB free-plan
limit, restriction deadline Sep 12–13) + Beer Base tile misclassification report + codebuff-team
contributor pollution on GitHub.

---

## 1. Egress forensics (root cause, not guesses)

Ground truth came from the user-exported **Supabase Query Performance CSV** for project
`ahzpjdemomuashuxnwve` (DarkFrame — confirmed as the org's only active project; the other
Supabase project has zero calls). Decisive findings:

| Statement | Calls | Problem |
|---|---|---|
| Full-row `players` select by username | **187,781** | Auth middleware shipped all 88 columns (password hash, units jsonb, inventory, discoveries…) on **every authenticated API call**, consuming 6 scalars. 85.6% of total DB time. |
| `tutorial_action_tracking` + `tutorial_progress` selects | 130K + 128K | `TutorialQuestPanel` polled `loadQuestData` **every 3 seconds, forever** — even after the tutorial completed, declined, or was skipped. |
| `flags` full select | 125,982 | Every tile view called `getFlagState()` **twice** (directly + via `getTrailInfoAt`), each doing a flags select + full-row holder select + trail select. |
| `flag_trail` by holder | 66,400 | Same double-fetch path. |

Account/CLI resolution: the email's org ID `ehguufzuggdxzqspdjnl` **is** org "Savant" (the
correct account). The CLI had been logged into a different account ("Savant AI",
`ibnmywtygwdzsvnscprq`) — user re-logged in; `supabase projects list` now shows DarkFrame.

### Fixes shipped
1. **`lib/authMiddleware.ts`** — auth now selects a slim projection (`AUTH_PLAYER_COLUMNS`:
   username + the 6 scalar fields it consumes) instead of the full row. Biggest single lever.
2. **`components/tutorial/TutorialQuestPanel.tsx`** — polling stops once the tutorial reaches a
   terminal state (`complete`/`skipped`/`declined`) and resumes cleanly if a new quest starts.
3. **`lib/flagState.ts`** — single-pass flag state per tile view (holder slim-select + trail
   point-lookup in one flow; no duplicate calls).
4. **`lib/db/migrations/0021_flag_trail_point_idx.sql`** — point-lookup index on
   `flag_trail(x, y, expires_at)`; applied live.

### Residual egress guidance
DarkFrame's honest share of egress is query-result bytes (~1.5–2 GB of the 21.18 GB measured
window); spikes track heavy in-game testing days (Sep 7–10) and the always-on dev/prod servers
with 24/7 schedulers. After these fixes the per-session footprint drops sharply; if the org
still trends over quota with zero sessions, the remaining suspect list is scheduler cadence and
any external scanners — re-check the Supabase egress-per-day chart after 24h of fixes being live.

---

## 2. Enemy-base tile surface (the "looks like MY base" defect)

- **Root cause:** `getTerrainDescription(..., isAnyBase, ...)` passed the any-base flag as
  `isBase`, so every base — including bot bases — rendered "Your command base" copy; the base
  image keyed off the *viewer's* rank; no ATTACK affordance existed outside the Factory deck.
- **`/api/tile`** now enriches every occupied tile with `baseOwner`, `baseLevel`,
  `isBeerBase`/special-base intel.
- **`TileRenderer`** classifies: own base (rank image, command copy) vs enemy base (level→
  `tiles/bases/N.jpg` image, owner/level intel, ATTACK button) vs Beer Base (premium framing).
  Base level→image mapping replaces the rank-keyed loader for enemy bases. Custom art for both
  sets (player bases, beer bases) can be dropped into `tiles/bases/` later.
- **`app/game/page.tsx`** dispatches the ATTACK button to `/api/combat/attack` for any enemy
  base (was Beer-Base-only).

### Combat generalization (bot base types)
Per the existing `BotSpecialization` system (Hoarder/Fortress/Raider/Ghost/Balanced/Boss — the
non-Beer bot base types): regular bot bases follow the **Full Permanence** defeat path already
used by `botCombatService` — resources stripped as loot, base stays on the map, regrows via the
hourly growth cycle. Beer Bases keep their documented premium 3× loot + removal.
`app/api/combat/attack/route.ts` now handles both branches.

**Live verification:** real attack on `Crimson_Eternal` (level-15 bot base at 46,19) —
victory, +53,611 Metal / +47,548 Energy / +400 XP credited exactly, defender alive with
resources stripped to 0 and tile claim intact (Full Permanence confirmed).

---

## 3. Attribution guard + history scrub

- Ported from `savant-code`: `.githooks/commit-msg` (refuses Codebuff watermark trailers),
  `.githooks/pre-push` (fail-closed scan of outgoing commits), `.gitmessage` template,
  `core.hooksPath` + `commit.template` wired. Live-tested: watermarked message refused,
  legitimate co-authors pass, full-history push scan catches all 29.
- **History scrub:** rewritten in a temp clone via `filter-branch --msg-filter` with a sed
  script handling all four watermark variants (trailers, emoji-prefixed/suffixed "Generated
  with Codebuff 🤖", plain). Result: 138 commits, **0 watermark lines, trees byte-identical,
  all authors savant0x**. Local `main` adopted clean history (`6c2b0d9`); backup preserved at
  `backup-main-pre-rewrite` (which is why `git log --all` still shows watermark lines — that's
  the intentional backup branch). **Remote force-push awaiting explicit user go-ahead.**

---

## Gates & records
- `tsc --noEmit` 0 errors · `eslint` clean · vitest **475 passed / 1 skipped** · `next build` exit 0
- Migration **0021** applied live; FID-031→036 arc continues uncommitted on `main` (clean history).
- Scheduler verification (production mode, :3001): all 5 families + WMD sub-jobs running with
  live counters after the FID-036 globalThis cross-runtime fix.

## R2 (2026-09-10, evening): base level → image actually wired everywhere

User screenshot (Titan_Gamma, level-15 fortress bot): badge showed no level and the
viewport rendered the tier-1 shack. Two defects:
1. **Enrichment gap on the move path** — base intel was attached only in /api/tile;
   /api/move's shared `getTileAt` mapper returned the raw tile, so every foot-arrival
   had no `baseLevel` → tier-1 fallback + no level display. Fixed at the seam:
   `getTileAt` enriches occupied tiles (owner level + Beer Base flag, best-effort),
   covering move/tile/login/register/harvest. /api/tile's duplicate lookup removed.
2. **Tier scale miscalibrated** — 5 levels/image collapsed the live bot band (5–65)
   into the bottom 3 images. Re-banded to 10 levels/image: L1–10→1.jpg … L91+→10.jpg
   (L15→2.jpg, L65→7.jpg).

Badge now reads `Hostile Base (Owner) · LV n`; intel copy states the honest fate per
base class (Full Permanence regather vs Beer Base destruction).

Verified live on :3001 (rebuilt): /api/move to Titan_Gamma's tile (145,21) returns
baseLevel 15 → expected 2.jpg; /api/tile consistent. tsc 0 · eslint 0.
