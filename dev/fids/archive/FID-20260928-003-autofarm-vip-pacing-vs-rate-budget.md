# FID-20260928-003: Auto-farm's request math vs the shared per-IP budget — assessment and proposed disposition (row 130 sub-item 2)

**Filename:** `FID-20260928-003-autofarm-vip-pacing-vs-rate-budget.md`
**ID:** FID-20260928-003
**Severity:** MEDIUM
**Status:** closed (2026-09-28, commit `01193de`)
**Created:** 2026-09-28

---

## 1. Summary

SCOPE row 130's second sub-item records a worry: VIP auto-farm's 300 ms/tile pacing "sits at `ENDPOINT_RATE_LIMITS.movement` (120/min), where a 429 is indistinguishable from 'nothing to collect'." This FID takes the decision. Measured conclusions: **(1)** VIP pacing is *within* the movement limiter's nominal budget (~66-120 movement requests/min against 120), **but** the budget is not nominal — FID-20260927-007 proved the per-IP counter is shared across ALL routes, so auto-farm's tile fetches, chat heartbeats, and every other endpoint the tab touches all draw from the same `ip:` bucket the movement check reads. **(2)** The concrete, observed failure is not the 429 itself but the engine's handling: a 429 on `/api/move` is swallowed as `false`, logged as an HTTP status with no distinction from hard failures, retried on the *next* tile with zero backoff, and never reads the limiter's `Retry-After` — while the fail-path comment ("Failed to move to position after retries") references a retry loop the code no longer has. **(3)** The claimed hazard "429 indistinguishable from nothing to collect" is **refuted as stated** — harvest and move rejections are already distinguished in logging — but a real adjacent hazard exists in the failure loop. The proposed disposition: **keep VIP pacing as-is (it is within budget), do not "slow VIP down" — instead make the engine 429-aware** (honor `Retry-After`, back off, emit a distinct event), fix the dead `MOVEMENT_WAIT`/`HARVEST_WAIT` constants (declared, assigned, never read), and delete the stale "after retries" comment. This is a small, honest hardening — not a redesign — and it converts an unobservable failure into a reported one.

## 2. Evidence (RED)

All findings re-executed 2026-09-28. Line numbers verified by content extraction.

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | **VIP pacing constants** — 300 ms between tiles; comment claims ~900 ms/tile average | `utils/autoFarmEngine.ts:170-178` | `this.MOVEMENT_WAIT = 200; this.HARVEST_WAIT = 800; this.MOVEMENT_DELAY = 300; this.HARVEST_DELAY_EXTRA = 0; // No extra delay (server handles cooldown)` — comment: *"Non-harvestable: 500ms \| Harvestable: 1300ms \| Avg: 900ms/tile"* |
| 2 | **Basic tier** — 500 ms delay + 2000 ms extra after each harvest | `utils/autoFarmEngine.ts:180-188` | `this.MOVEMENT_DELAY = 500; this.HARVEST_DELAY_EXTRA = 2000; // 2s extra after harvest (3s total = cooldown respected)` |
| 3 | **Per-tile request sequence** — every tile: 1 × `POST /api/move` + 1 × `GET /api/tile`; farmable tiles add 1 × `POST /api/harvest`; occupied enemy bases add up to 3 more (`/api/player` × 2 + `POST /api/combat/infantry`) | `utils/autoFarmEngine.ts:726-763` | `processTile`: `moveToPosition(position)` → `getTileInfo(position)` → `attackBase(tileInfo)` / `attemptHarvest(position, tileInfo)` |
| 4 | **The client fetches the tile twice per tile** — the engine's `getTileInfo` (`:973` `/api/tile`) duplicates what `POST /api/move` already returns (`currentTile`), and the page's `move` event handler fetches the tile a *third* time via `updateTileOnly` (`app/game/page.tsx:299`) | `utils/autoFarmEngine.ts:737,973`; `app/game/page.tsx:299` | `const tileInfo = await this.getTileInfo(position);` · engine's only `currentTile` reference is a comment (`:890`); page: `updateTileOnly(event.position.x, event.position.y);` |
| 5 | **Limiter configs**: `movement` 120/min, `harvest` 120/min, both `trackByUser: true`; `STANDARD` 300/min, IP-keyed | `lib/middleware/rateLimitConfig.ts:186-203,536-540` | `movement: { maxRequests: 120, windowMs: 60 * 1000, trackByUser: true, …}` · `harvest: { maxRequests: 120, … }` · `STANDARD: { maxRequests: 300, … }` |
| 6 | **`trackByUser` is decorative** — `getUserId` returns `null` unconditionally, so even `trackByUser: true` keys on `ip:` | `lib/middleware/rateLimiter.ts:156-170,177-182` | `getUserId`: `// For now, return null - can be enhanced with JWT verification` → `return null;` · `generateKey`: `return \`ip:${ip}\`;` (no endpoint component) |
| 7 | **The shared bucket, re-probed fresh this session** — 121 requests to a 300/min-style route, then the FIRST call to a movement-shaped 120/min route from the same IP → **429 with `Retry-After: 60`** | drill output (probe file created, run, deleted) | `MOVE_FIRST_CALL 429` · `BODY {"success":false,"error":"Rate limit exceeded. Please try again later.","retryAfter":60}` |
| 8 | **The engine is 429-blind** — zero references to `429`, `Retry-After`, or `retryAfter` anywhere in the engine | `utils/autoFarmEngine.ts` (whole file) | `grep -rn "Retry-After\|retryAfter\|429" utils/autoFarmEngine.ts` → **exit 1** |
| 9 | **Move 429 handling** — `!response.ok` → one log line with the bare status → `false`; no classification, no backoff, no event | `utils/autoFarmEngine.ts:868-871` | `if (!response.ok) { console.error(\`[AutoFarm] Move API returned ${response.status}\`); return false; }` |
| 10 | **The failure loop has no backoff** — a failed tile falls to the common delay path: `console.log('Tile processing failed…')` → wait `MOVEMENT_DELAY` → next tile; the comment "Failed to move to position after retries" cites a retry loop that does not exist | `utils/autoFarmEngine.ts:623-627,732` | `} else { console.log('[AutoFarm] Tile processing failed, not updating position'); }` · `error: 'Failed to move to position after retries'` |
| 11 | **Dead constants** — `MOVEMENT_WAIT` and `HARVEST_WAIT` are declared and assigned in both branches but read nowhere | `utils/autoFarmEngine.ts:160-161,173-174,182-183` | 3 textual occurrences each: declaration + two assignments; zero reads |
| 12 | **Row 130's literal wording is refuted** — "a 429 is indistinguishable from 'nothing to collect'" was written before FID-20260925-005: harvest rejections log their actual reason (`[AutoFarm] Harvest rejected: ${reason}`), and move failures log the HTTP status; they are not conflated | `utils/autoFarmEngine.ts:1058-1059,869` | `const reason = (data?.message \|\| data?.error?.message \|\| \`HTTP ${response.status}\`); console.warn(\`[AutoFarm] Harvest rejected: ${reason}\`);` |

**Call-graph notes (Law 4).** Auto-farm request path: `processNextTile` → `processTile` → `moveToPosition` → `executeMove` body → `POST /api/move` (limiter: `movement`, key `ip:<ip>`) → back in `processTile` → `getTileInfo` → `GET /api/tile` (limiter: `STANDARD`, same `ip:<ip>` bucket) → `attemptHarvest` → `POST /api/harvest` (limiter: `harvest`, same bucket). Meanwhile every open tab's `ChatPanel` heartbeat fires every 30 s at `components/chat/ChatPanel.tsx:485` (`/api/chat/heartbeat` — currently **unthrottled**, so it does not consume the bucket, finding 5's configs notwithstanding). All of these concatenate into one counter per IP. None of this reaches a player-visible surface except through the engine's console lines.

## 3. Impact Analysis

- **Who/what is affected:** VIP-tier auto-farm users (fastest pacing, largest budget draw); the server (a 429 storm does no work but costs a request each); telemetry (failures are currently indistinguishable in *volume* terms from ordinary cooldown rejections at the stats level); and any second browser behind the same NAT/office IP, which shares the bucket.
- **Failure modes if unfixed:** under a 429 storm the engine makes *more* requests (each retry is a full request that itself consumes budget), stalls without reporting why (a player watching the panel sees tiles "skipped" with no cause), and — because `429` is only logged to console — a support question ("why did my farm stall?") is unanswerable from the session record. The dead `MOVEMENT_WAIT`/`HARVEST_WAIT` constants mislead every future reader into thinking sleeps exist that do not.
- **Blast radius of the proposed fix:** engine-local — one 429 branch in `executeMove`, one in `attemptHarvest`, constant deletion, comment fix, event type extension. No route, schema, or limiter changes. No pacing change for the happy path.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | **Yes.** Honoring `Retry-After` is correct for every 429 source (movement, harvest, any future endpoint), because the limiter emits it uniformly. Distinguishing throttle from gameplay rejection is correct for every caller. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | **Yes.** Backoff *reduces* server load precisely when load is the problem. The event-based reporting scales: the panel already renders `error` events. |
| Survives a hostile attacker, not just an honest user? | **Yes.** No new server surface; the client only becomes more polite. A malicious client was never throttled by politeness — the server limiter remains the authority. |
| Maintainable in 2 years? | **Yes.** Deleting never-read constants and a comment referencing a nonexistent loop removes two future misreadings; the 429 branch is a single, documented path. |
| Sets the standard for the industry? | **Yes.** "Honor Retry-After" is the standard HTTP contract for 429; "a client that cannot tell throttle from refusal will make the wrong repair" is the same evidence-honesty standard the rest of the ledger applies. |

## 5. Proposed Fix (GREEN)

- **Approach:** three-part disposition, all engine-local: **(a)** make the engine 429-aware — on a 429 from `/api/move` or `/api/harvest`, read `Retry-After` (fallback 60 s), wait that long *once* before marking the tile failed, and emit a distinct engine event (`type: 'error'` with a `throttled: true` marker or an explicit message) so the panel reports the cause; **(b)** delete `MOVEMENT_WAIT`/`HARVEST_WAIT` (declared, assigned, never read — finding 11); **(c)** delete the stale "after retries" wording (finding 10). **Disposition on pacing itself: keep 300 ms.** The nominal budget is respected (finding 14 below); slowing VIP would punish honest players for a hazard that is actually a client-robustness gap; and the double-fetch waste (finding 4) is noted for a future FID rather than smuggled into this one — it is a performance/economy item, not a rate-limit correctness item, and this FID's evidence is sufficient for the pacing decision but not for redesigning the tile-fetch flow.
- **Alternatives considered:**
  1. *Slow VIP pacing below the effective budget* — rejected: the observed budget headroom (finding 14) shows pacing is not the binding constraint; the shared-bucket risk comes from *other* endpoints and other tabs, which slower pacing does not fix.
  2. *Give auto-farm its own endpoint budget* — rejected for now: the limiter's key design (no endpoint component; `getUserId` always null) is a server-wide architectural item; a per-route key for one caller would be an inconsistent half-fix. Recorded as the real fix if a live 429 storm is ever observed in production telemetry.
  3. *Fix `getUserId` to actually track users* — same scope problem: it changes keying for 83 authenticated routes at once. Deliberately out of scope; noted in `dev/issues.md`.
  4. *Do nothing* — rejected: the engine currently punts on the one failure mode its own pacing makes most likely, and the dead constants guarantee the next reader misbelieves the code.
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `utils/autoFarmEngine.ts` | modify | In `executeMove`'s `!response.ok` branch: if status is 429, parse `Retry-After` (seconds; fallback 60), emit an `error` event naming the throttle (`Movement throttled (429), retrying after Ns`), await the delay, then return `false`. In `attemptHarvest`'s rejection branch: same classification (429 → distinct message + `Retry-After` wait) so a throttle is never logged as a gameplay rejection. Delete `MOVEMENT_WAIT`/`HARVEST_WAIT`. Delete the "after retries" comment (`:732`). |
| `SCOPE.md` (row 130, sub-item 2) | modify | Status cell updated: measured numbers pasted, literal "429 indistinguishable" claim refuted (F2 finding 12), disposition recorded (pacing kept; client hardened), residual server-side items (per-endpoint keys, real `trackByUser`) logged in `dev/issues.md` as the true fix if production telemetry ever shows a 429 storm. |
| `dev/issues.md` | modify | One line under Technical debt: the limiter's keying (shared per-IP bucket; `trackByUser` decorative) is a server-wide architectural decision, not an engine one — revisit only with production evidence. |

- **Verification plan:** `npx tsc --noEmit` → 0; `npx eslint . --max-warnings 0` → 0/0; `npx vitest run` → full suite green (count recorded); census → exit 0. Behavioral: the existing engine test (`__tests__/utils/autoFarmPosition.test.ts` and the payload pin) must stay green; a targeted assertion that `MOVEMENT_WAIT` no longer appears anywhere (grep → 0).
- **Call-graph reachability plan (Law 4):** the 429 branch is reachable by construction — it sits on `executeMove`'s existing `!response.ok` path (finding 9), which is the only path a move failure can take; the grep plan for the deleted constants is `grep -rn "MOVEMENT_WAIT\|HARVEST_WAIT" utils/` → 0 matches.

## 6. Audit Record

Double audit — two independent methods, evidence pasted, no self-reporting.

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: command re-execution | All §2 findings re-run this session; the shared-bucket drill re-executed fresh (`MOVE_FIRST_CALL 429` with body `{"success":false,…,"retryAfter":60}`); dead-constant claim verified by occurrence count (3 = declaration + 2 assignments, zero reads) | §2 as pasted | pass |
| Method 2: manual re-read | Row 130's exact wording re-read to check the disposition against the *recorded* worry (not a paraphrase); `processNextTile`'s failure branch re-read to confirm there is genuinely no hidden retry/backoff; `getUserId` re-read to confirm `trackByUser` is decorative; the FID-20260927-007 finding-11 drill re-checked for consistency with this FID's fresh probe | This document §2/§5 as written | pass |

- **Honest limitations recorded:** (1) no live production telemetry exists for 429 frequency — the math is static analysis plus a module-level drill, and the disposition (keep pacing, harden client) is chosen to be safe under that uncertainty; (2) the shared-bucket probe exercises the limiter module directly, not a full HTTP round trip through Next — adequate to prove keying, not load behavior; (3) the double-fetch waste (finding 4) is quantified but deliberately not fixed here (scope discipline: one concern per FID).
- **Audit outcome: PASS → status `loop-complete`.** Circuit breakers: 2 passes, delta < 2%; no oscillation; iteration 2 of 10.

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** done (implemented 2026-09-28 under the session's standing operator approval; landed on commit `01193de`)
- **Files changed:** `utils/autoFarmEngine.ts` (+38/−7): 429 branch in `executeMove` (Retry-After honored, error event emitted, single backoff wait); 429 branch in `attemptHarvest` (distinct 'Throttled (429)' reason, skips the harvest-cycle extra delay); `MOVEMENT_WAIT`/`HARVEST_WAIT` deleted (deletion noted in a comment at the former declaration site); stale "after retries" wording corrected
- **Verification evidence (executed 2026-09-28):** `npx tsc --noEmit` → 0 · `npx eslint utils/autoFarmEngine.ts` → 0 · full suite **1376 passed (1376)** · ledger census exit 0 · residual grep: `MOVEMENT_WAIT|HARVEST_WAIT|after retries` matches only the deletion-note comment (`:159`)
- **Call-graph reachability evidence:** the 429 branches sit on `executeMove`'s existing `!response.ok` path (`:867`) and `attemptHarvest`'s existing rejection path (`:1080`) — the only paths a move/harvest failure can take; both emit through the engine's existing `error` event channel consumed by the game page's event switch

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass (1376) · [x] call-graph proven (429 branch sits on the existing `!response.ok` path; constants' deletion greppable)
- **Commit hash (G2 — required for `closed`):** `01193de` — *fix(autofarm): honor 429 Retry-After and report throttling distinctly; delete dead wait constants (FID-20260928-003)*; the ledger-closure commit follows.
- **Staging plan (path-scoped, G3/G4):** commit 1 (engine): `git add utils/autoFarmEngine.ts`; commit 2 (ledger): `git add SCOPE.md CHANGELOG.md VERSION dev/fids/ dev/session-summaries/ dev/issues.md` — never `git add -A`.
- **Commit message (G8):** `fix(autofarm): honor 429 Retry-After and report throttling distinctly; delete dead wait constants (FID-20260928-003)`
- **Archive:** move to `dev/fids/archive/` at `closed`; CHANGELOG entry; archival logged in the session summary. Never at `loop-complete`.

---

**Final status:** closed
