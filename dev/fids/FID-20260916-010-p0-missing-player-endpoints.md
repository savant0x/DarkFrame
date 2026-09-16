# FID-20260916-010: P0 — rebuild the three missing player-side endpoints (discoveries, friends online, friends block)

**Filename:** `FID-20260916-010-p0-missing-player-endpoints.md`
**ID:** FID-20260916-010
**Severity:** HIGH (player-facing breakage today)
**Status:** loop-complete
**Created:** 2026-09-16

---

## 1. Summary

The feature survey (row #69, `dev/audits/FEATURE-SURVEY-2026-09-16.md`) proved three UI
panels call endpoints that do not exist: `DiscoveryLogPanel` (`GET /api/discoveries`),
`FriendsList` (`GET /api/friends/online`), and `FriendActionsMenu`
(`POST /api/friends/block`). The 2026-09-04 sweep fixed the admin modal's dead endpoints
(SCOPE #22) but never covered the player side. Backends already exist
(`lib/discoveryService.getDiscoveryProgress`, `user_presence` table written by the chat
heartbeat, `lib/friendService.blockUser`); the fix is three thin route files that adapt
the existing services to the panels' actual contracts.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | Panel calls `GET /api/discoveries?username=` | `components/DiscoveryLogPanel.tsx:139` | `fetch(\`/api/discoveries?username=${player.username}\`)` → reads `data.discoveries` + `data.progress`; no route dir `app/api/discoveries` (survey probe: NO) |
| 2 | FriendsList polls `GET /api/friends/online?ids=` | `components/friends/FriendsList.tsx:138` | expects `{ success: true, statuses: { [userId]: 'online'\|'offline' } }`; silent-fail contract (:150); no route dir (survey probe: NO) |
| 3 | Menu posts `POST /api/friends/block` `{ userId }` | `components/friends/FriendActionsMenu.tsx:142-146` | expects `{ success, error? }`; doc comment :328 "Blocking automatically removes friendship"; no route dir (survey probe: NO) |
| 4 | No rewrites mask the 404s | `next.config.js` | grep rewrites/redirects → empty |
| 5 | Discovery backend exists, different shape | `lib/discoveryService.ts:314` | `getDiscoveryProgress` returns `{totalDiscovered, totalAvailable:15, progressPercent, byCategory{industrial:count,…}(numbers), discoveries[+config], undiscovered[], completionStatus 'COMPLETE'\|'IN_PROGRESS'}` — panel expects `{totalPossible, percentComplete, byCategory{CAT:{discovered,total}}, completionStatus 'INCOMPLETE'\|'COMPLETE'}`, categories UPPERCASE (`components/DiscoveryLogPanel.tsx:31-48`), `discoveredAt: number` |
| 6 | Presence source exists | `lib/db/schema/config.ts:236` | `user_presence(userId unique, lastSeen, expiresAt)`; heartbeat upserts 60s expiry (`app/api/chat/heartbeat/route.ts:86-87,163-166`); shim conflict-target verified (`lib/mongodb.ts:581`) |
| 7 | Block backend exists | `lib/friendService.ts:456` | `blockUser(userId, targetUserId): Promise<boolean>` — validates, deletes friendship rows, inserts blocks (doc contract :329) |

Call-graph notes (Law 4): panels are mounted (DiscoveryLogPanel via the game UI; Friends
panels via the social drawer) — the fetches execute for every player opening them today.

## 3. Impact Analysis

- **Affected:** every player opening the discovery log or friends list; block is a
  moderation flow currently impossible.
- **Failure modes if unfixed:** discovery panel hard-errors on open; online dots never
  light; blocking broken → harassment mitigation unavailable.
- **Blast radius:** three NEW route files only — no service changes, no schema changes,
  no panel changes. Zero impact on the protection seams or the parallel WIP estate
  (`__tests__/api/friends/friends.integration.test.ts` is parallel-modified and will not
  be touched; new pins live in a separate file).

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases? | Yes — missing player (404), empty id list, unknown ids (offline), self-block (400 via service), DB outage (500, typed errors) |
| Scales? | Yes — id list capped (200), presence read is one indexed `inArray` query, discovery read is the projected single-row read -046 already tuned |
| Survives a hostile caller? | Yes — block is auth-required with server-derived caller id (body target only); online/discovery are read-only projections |
| Maintainable in 2 years? | Yes — thin adapters over documented services; contracts pinned by tests |
| Sets the standard? | Yes — route layer adapts domain to client, never the reverse; matches the #22 admin rebuild pattern |

## 5. Proposed Fix (GREEN)

Three new route files, Law-11-conformant to their siblings:

1. **`app/api/discoveries/route.ts`** — `GET`; `?username=` required (400 otherwise);
   `getDiscoveryProgress(username)`; null → 404 `{success:false,error}`. **Adapter**
   (documented in-code): map categories to UPPERCASE, `discoveredAt` → epoch ms,
   `totalAvailable→totalPossible`, `progressPercent→percentComplete`,
   `byCategory` numbers → `{discovered,total:5}` per panel type (5 per category,
   15 total — service constants), `completionStatus` `IN_PROGRESS→INCOMPLETE`.
   Response: `{ success: true, discoveries, progress }`. Auth pattern follows the
   sibling `discovery/status` route (username-param read projection; documented choice).
2. **`app/api/friends/online/route.ts`** — `GET`; `requireAuth` (sibling pattern);
   `?ids=` comma list, cap 200 (400 over), unknown → 'offline'. One drizzle query on
   `userPresence` (`inArray` + `expiresAt > now`); response
   `{ success: true, statuses }` where every requested id appears.
3. **`app/api/friends/block/route.ts`** — `POST`; `requireAuth`; body `{ userId }`
   validated; `blockUser(auth.playerId, body.userId)`; typed error mapping exactly like
   `friends/[id]` (ValidationError→400, NotFoundError→404, PermissionError→403);
   response `{ success: true }` / `{ success:false, error }`.

- **Verification plan:** tsc 0 · eslint 0/0 · full vitest suite; new pin file
  `__tests__/api/p0MissingEndpoints.test.ts` (route handlers called directly with mocked
  service/db/auth layers — the established route-pin pattern).
- **Call-graph reachability plan:** grep proofs that the three panels' fetch paths match
  the new route dirs verbatim; survey probes flipped from NO to EXISTS.

| File | Action | Description |
| ---- | ------ | ----------- |
| `app/api/discoveries/route.ts` | create | GET adapter over getDiscoveryProgress |
| `app/api/friends/online/route.ts` | create | GET presence statuses over userPresence |
| `app/api/friends/block/route.ts` | create | POST block over friendService.blockUser |
| `__tests__/api/p0MissingEndpoints.test.ts` | create | contract pins for all three |

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| M1: static | (post-implementation) | tsc/eslint/vitest | pass |
| M2: manual re-read | every RED claim re-probed this session: survey NO-verdicts re-run (`ls -d app/api/...` → NO), rewrites grep empty, panel/service shapes re-read 0-EOF above, service export list re-grepped (`friendService` singular — survey erratum stands) | pasted outputs this session | pass |

- Audit outcome: PASS → **loop-complete** (status says what happened to the DOCUMENT).

## 7. Implementation Record

- **Status:** done (2026-09-16, operator go-ahead "file and implement") — three routes +
  pins, gates green, contract adapters documented in-code.

**Gates (executed):** tsc 0 · eslint 0/0 · vitest **931 passed / 1 skipped** (932 total;
+12 pins: discovery 400/404/adapter-shape/COMPLETE-mapping, online 401/400-empty/400-cap/
.total-statuses, block 401/400-missing/session-caller-proof/ValidationError→400).
Reachability: panel fetch paths grep-verified verbatim against the three new route dirs
(`api/discoveries`, `api/friends/online`, `api/friends/block`).

**Law-16 note on the harness:** the first pin run had 5 failures — all three were
harness fakes, not route defects: the `@/lib` mock lacked `ErrorCode`; 401 fakes used
plain `Response` (fails the route's `instanceof NextResponse` check — the routes were
right to reject them); the self-block fake used a bare object instead of the real
`ValidationError` class. Also caught by gates: the wrapper type
(`withRequestLogging`'s `RouteHandler`) requires a second `context` argument —
route call sites in tests now pass it explicitly. One genuine lint catch: an unused
`eq` import removed.

| File | Lines | Notes |
| ---- | ----- | ----- |
| `app/api/discoveries/route.ts` | ~95 | shape adapter (enum/case/epoch/by-category totals) |
| `app/api/friends/online/route.ts` | ~85 | requireAuth + cap-200 + expiresAt>now |
| `app/api/friends/block/route.ts` | ~90 | typed error mapping per sibling |
| `__tests__/api/p0MissingEndpoints.test.ts` | ~150 | 10 pins: 200/404/400 paths ×3 + adapter specifics |

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass · [x] call-graph proven
- **Commit hash (G2):** `<hash>`
- **Staging plan (G1):** `git add app/api/discoveries app/api/friends/online app/api/friends/block __tests__/api/p0MissingEndpoints.test.ts dev/fids/FID-20260916-010-p0-missing-player-endpoints.md dev/session-summaries/SESSION-2026-09-16-024.md SCOPE.md`
- **Commit message (G8):** `fix: rebuild three missing player-side endpoints — discoveries, friends online, friends block (FID-20260916-010)`

---

**Final status:** loop-complete
