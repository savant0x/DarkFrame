# FID-20260917-006 — Clan detail GET: the 404 behind "Failed to load clan data"

**Status:** `closed (commit `22f5889`)`
**Session:** 2026-09-17 (043)
**Origin:** Operator bug report with screenshot: created a clan ("Savant"), clicking it
from the sidebar spins forever and toasts "Failed to load clan data".

## 1. Goal

Restore the clan detail endpoint the UI has called since 2025-10-19:
`GET /api/clan/[id]` → `{ success: true, clan: Clan }`.

## 2. Evidence (RED, probed this session)

| # | Fact | Evidence |
|---|---|---|
| R1 | The toast fires from two failure paths in the sidebar view | `components/clan/ClanManagementView.tsx:78,82` |
| R2 | The view fetches `/api/clan/${player.clanId}` and requires `data.success` | `ClanManagementView.tsx:72-77` |
| R3 | **The route does not exist** — 42 routes under `app/api/clan/`, zero named `[id]`; `find app/api/clan -type d -name '*id*'` empty | filesystem census |
| R4 | **It never existed in history** — `git log --all -- 'app/api/clan/[id]/route.ts'` is empty | git census |
| R5 | The modal fetches the same missing route (second broken surface) | `components/clan/ClanPanel.tsx:87` |
| R6 | The service layer survived: `getClanById` returns the full `rowToClan` shape (members inline, level, settings, stats) | `lib/clanService.ts:355`, `:49-90` |
| R7 | Class note: the 237-route dead-route census swept existing-but-uncalled routes; this is the inverse — called-but-never-built | session 037 vs 043 |

## 3. Implementation (GREEN)

- **`app/api/clan/[id]/route.ts`** (new): `requireAuth` → `getClanById(id)` →
  `{ success: true, clan }`; null → `createErrorResponse(ErrorCode.CLAN_NOT_FOUND)`
  (status 404 via the codes map); throw → `createErrorFromException`. House dynamic
  shape (`context.params` Promise per Next 16); runs bare (no `withRequestLogging`
  wrapper — its `Record<string,string>` params typing conflicts with Next 16's
  `{ id: string }`, and the newest dynamic sibling `logs/player/[id]` runs bare).
  Auth model: any signed-in player may read clan detail (join previews need it);
  `Clan` carries no privileged fields (members = usernames, roles, join dates).
- **`__tests__/api/clanDetail.test.ts`** (new, 4 pins): success contract incl. the
  exact consumer reads (`members[0].username`, `level.currentLevel` — the member
  gate at view:720 and the header at :742), CLAN_NOT_FOUND 404 envelope, 401
  pass-through, service-throw 500. Real error-envelope helpers; only `requireAuth`
  and `getClanById` mocked.
- **`scripts/e2eClanDetail.ts`** (new): live driver — binds to an existing player
  (read-only; `players` has NOT NULL columns the app seeds via createPlayer),
  seeds/deletes only a probe clan, mints a real JWT, drives the handler directly.

## 4. Verification

- Pins 4/4 · gates **tsc 0 · eslint 0 · vitest 999+1skip** (baseline 995+1).
- **Live probe 4/4, exit 0** against the dev DB: CONTRACT (200 with
  members/level/settings/stats) · 404 (`CLAN_NOT_FOUND`) · 401 (requireAuth
  pass-through) · CLEANUP (probe clan removed). DIAG line in the log proves
  sign→verify integrity in-process.
- Driver iterations disclosed: (1) minimal player INSERT impossible (NOT NULL
  walls) → bind to existing player; (2) post-construction `headers.set` does not
  refresh NextRequest's parsed cookies → pass cookie at construction; (3) missing
  `await` on `SignJWT.sign()` put `[object Promise]` in the cookie (caught via
  in-process DIAG verify, `ERR_JWS_INVALID`); (4) removed dead `closeConnection`
  import after the explicit-exit pattern made it unused.

## 5. Alternatives rejected (loop, pass 1)

- Extend a sibling route (rejected: none owns this shape; `/search` is a listing).
- Sanitize/filter `members` for non-members (rejected: data is already public-class;
  join preview requires it; no privilege elevation exists in the payload).
- Client-side fallback to a listing endpoint (rejected: papers over a missing
  server contract; two consumers, one truth).

## 6. Loop record

Pass 1: contract audit against both consumers' reads (line-level: 156, 720, 733-796)
— no gaps. Pass 2: error-path audit (null id, unknown id, service throw, unauth) —
all pinned. No open findings; header set at filing time (no lag defect).

## 7. Notes

- The **immediate operator unblock**: the dev server was down at report time; after
  restart, the sidebar clan view loads (probe-verified contract).
- Batch uncommitted per convention; footer-free plan in session 043.

## 8. Closure

- **Gates:** [x] tsc 0 · [x] eslint 0 · [x] vitest 999+1skip (baseline 995+1, +4 pins) ·
  [x] live probe 4/4 exit 0 (CONTRACT / 404 / 401 / CLEANUP, DIAG sign-verify line recorded)
- **Commit hash (G2):** `22f5889` — committed 2026-09-17 on operator go-ahead;
  6 files, +486; staged set owner-checked before commit (6 paths, SCOPE row 80 only).
- **Post-commit:** FID archived; SCOPE row 80 → Closed; CHANGELOG [0.0.7]; VERSION 0.0.7.
- **Operator follow-up:** restart the dev server to serve the fixed route (server was
  down at report time); clan sidebar + modal then load with no client change needed.
