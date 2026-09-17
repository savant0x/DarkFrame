# FID-20260917-007 — Inverted route census: called-but-never-built sweep + two rewires

**Status:** `closed (commit `9d75ae4`)`
**Session:** 2026-09-17 (045)
**Origin:** Operator directive after FID-20260917-006: "Run the inverted route census:
every client fetch's URL must resolve to an existing app/api route — file the FID for
any other called-but-never-built endpoints."

## 1. Goal

Close the *inverse* of the session-037 dead-route sweep. That census found
existing-but-uncalled routes; this one finds **called-but-never-built** endpoints —
the class behind "Failed to load clan data" (FID-006). Deliverables: a standing
census tool, any true findings fixed, false positives documented.

## 2. Evidence (RED)

- Census tooling built: `scripts/invertedRouteCensus.cjs` — harvests every
  `fetch(`/`apiFetch(` string/template URL across components/, app/ (minus api),
  lib/, hooks/, utils/, context/; strips block + full-line-`//` comments first
  (doc-comment examples are not call sites); `${…}` interpolations become sentinel
  segments (one each — a trailing interpolation still yields a dynamic segment);
  query strings cut on the joined path only (per-chunk `?` cuts leak `&k=` bogus
  segments — first-run defect); literal segments matched against the 238-route set
  with `[param]` wildcards.
- First full run: 326 call sites → 41 raw MISSING. After matcher fixes (segment
  alignment + sentinel model): **4 candidates**.

## 3. Findings (each verified in context)

| Candidate | Verdict | Action |
|---|---|---|
| `GET /api/clan?clanId=` — StatsPanel.tsx:188 (clan tag) + TopNavBar.tsx:132 (nav clan badge) | **REAL — never built.** No `app/api/clan/route.ts` exists; both callers degrade silently (`if (response.ok)` skip on 404), which is why the stats clan tag and nav clan badge never rendered for anyone | **Rewired** both to the canonical `GET /api/clan/[id]` (FID-006 route) with `{ success, clan }` envelope unwrapping; StatsPanel pin updated (URL + envelope, ×2) |
| `POST /api/admin/vip/${action}` — PlayerDetailModal | **False positive** — action domain is exactly `{grant, revoke}`; literal child routes `app/api/admin/vip/grant` + `/revoke` exist; Next resolves them at runtime; static analysis cannot see through the interpolation | Documented **waiver** in the census script with reason |
| `fetch('/api/battle')` — toast.ts | **False positive** — inside a line-commented JSDoc usage example; no runtime call | Comments stripped pre-harvest (structural fix, not a waiver) |

## 4. Implementation (GREEN)

- `components/StatsPanel.tsx` — fetch → `/api/clan/${player.clanId}`, read
  `data.clan?.tag` (FID-007 comment cites the census + FID-006 route).
- `components/TopNavBar.tsx` — same rewiring, `{ success, clan: { name, tag } }`
  typed envelope, guarded set.
- `components/StatsPanel.test.tsx` — both clan-tag pins updated to the new URL +
  envelope (the old pin asserted the dead URL).
- `scripts/invertedRouteCensus.cjs` — standing gate-usable tool: waivers list with
  reasons, exit 1 on any MISSING (0 today), UNPARSED section for future
  concatenated forms.

## 5. Verification

- **Census re-run: exit 0** — 302 call sites vs 238 routes, MISSING 0, UNPARSED 0,
  WAIVED 1 (documented).
- **Gates:** tsc 0 · eslint 0 (all touched files) · vitest **999+1skip** (unchanged
  count: pins updated in place, none added/removed).
- Tooling-iteration disclosures (all mine, caught by probes): (1) first matcher
  compared whole URLs as single segments → 154 false MISSING (fixed by true
  segmentation); (2) per-chunk query cut leaked `&k=` fragments as bogus segments
  (fixed: sentinel pass, then cut, then split); (3) a partial str_replace left a
  stray brace — `node --check` caught it before any run; (4) comment-stripping
  needed both block AND full-line-`//` filters (the toast example is line-commented);
  (5) one dead `ESTATE` const flagged by eslint.

## 6. Loop record

Pass 1: verified all 4 raw candidates in context (route trees read; caller code
read; the two rewires' UI consumers traced — `clanTag` renders in StatsPanel header,
`clanData` in TopNavBar badge). Pass 2: second-pass near-miss check — every MISSING
candidate's URL family compared against similar routes (`/api/clan` vs `/api/clans`
etc.) — no additional matches. Pass 3: not-to-change check — the waiver (not a code
fix) is correct for VIP: adding a catch-all `/api/admin/vip/[action]` route would
bypass the explicit two-route design; the census tool must stay waiver-based.
No open findings.

## 7. Notes

- FID-006's route now has **four** client callers (ClanManagementView, ClanPanel,
  StatsPanel, TopNavBar) — the canonical-detail pattern is consolidating.
- The census is repeatable: `node scripts/invertedRouteCensus.cjs` (exit 1 = new
  called-but-never-built endpoint or a stale waiver — both demand eyes).
- Batch uncommitted per convention; footer-free plan in session 045.

## 8. Closure

- **Gates:** [x] census exit 0 (MISSING 0 · UNPARSED 0 · WAIVED 1 documented) ·
  [x] tsc 0 · [x] eslint 0 · [x] vitest 999+1skip (pins updated in place)
- **Commit hash (G2):** `9d75ae4` — committed 2026-09-17 on operator go-ahead;
  7 files, +310/−8; staged set owner-checked (7 paths, SCOPE row 81 only).
- **Post-commit:** FID archived; SCOPE row 81 → Closed (in-place substitution);
  CHANGELOG [0.0.8]; VERSION 0.0.8.
