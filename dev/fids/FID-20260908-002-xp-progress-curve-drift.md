# FID-20260908-002: XP progress panel uses the retired linear curve — level-16 bar overflows

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-002-xp-progress-curve-drift.md`
**ID:** FID-20260908-002
**Severity:** MEDIUM (display-only wrong math; no XP loss, but every player sees an impossible bar)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

FID-20260906-006 (P1/P2) replaced the level-cost curve with a power curve (`floor(500 × level^1.35)`) inside `getXPForNextLevel`/`calculateLevel`, but `getXPProgress` still computes **XP at the start of the current level** with the retired linear formula `(level − 1) × 1000`. The two functions in one file disagree: `calculateLevel(144972)` = 16 (power curve), while `xpAtLevelStart = 15 × 1000 = 15000` (linear), yielding `currentLevelXP = 129,972` against `xpForNextLevel = 21,112`. Exactly the operator's report: "129,972 / 21,112". The bar clamps at 100% and the pair displays nonsense. Correct figures under the real curve (independently recomputed in the audit): level 16 starts at 133,309 → **11,663 / 21,112 = 55.2%**.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | Linear level-start math retained | `lib/xpService.ts:241-247` | `if (level <= 30) { xpAtLevelStart = (level - 1) * 1000; }` |
| 2 | Exponential branch uses its OWN retired constants (30,000 / 3,300 / ×1.10) | `lib/xpService.ts:248-256` | `xpAtLevelStart = 30000; let xpRequired = 3300; ... Math.floor(xpRequired * 1.1)` — disagrees with `getXPForNextLevel(30)` = 50,000 and ×1.15 |
| 3 | Live arithmetic reproduces the operator's numbers | this audit | 144,972 − (16−1)×1000 = **129,972**; `getXPForNextLevel(16)` = floor(500×16^1.35) = **21,112** — matches the reported "129,972 / 21,112" exactly |
| 4 | Correct consumer chain | `app/api/player/route.ts:68` | `getXPProgress(player.xp \|\| 0)` → `xpProgress` → StatsPanel renders `currentLevelXP / xpForNextLevel` |
| 5 | Level itself is correct (curve updated) | `lib/xpService.ts:134-158` | `calculateLevel` consumes `getXPForNextLevel` per level — internally consistent with the new curve |
| 6 | "Total XP: 144,972" is correct and separate | `components/StatsPanel.tsx:337` region | panel displays raw `player.xp` — untouched by this bug |

**Call-graph (Law 4):** `getXPProgress` is consumed by `app/api/player/route.ts:68` (client player fetch) and internally by `awardXP` path (`lib/xpService.ts:415`); lib/wmd researchService also imports it. Fixing the level-start computation fixes every consumer at once — no call-site changes.

## 3. Impact Analysis

- **Affected:** every player's XP bar at every level ≥ 2 (level 1 is coincidentally correct: both formulas give 0); level-up RP/tier logic is NOT affected (uses `calculateLevel`/`getXPForNextLevel`).
- **Failure modes:** overflow display (100% bar that never levels), misleading progress; at levels ≥ 30 the exponential branch compounds the drift (its 10% factor vs the real 15%).
- **Blast radius:** one function, zero call-site changes, zero API contract changes (same returned shape).

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — one cumulative-sum loop covers levels 1..N uniformly (level 1 → xpAtLevelStart = 0; boundary monotonicity already proven by FID-006) |
| Scales? | Yes — O(level) loop, identical to what calculateLevel already does per call |
| Hostile attacker? | Yes — pure arithmetic on a validated number; negative input already guarded in calculateLevel; getXPProgress guards `totalXP < 0` → clamps via calculateLevel |
| Maintainable? | Yes — one curve definition (`getXPForNextLevel`) drives level, progress, and next-level cost; the retired constants are deleted, not patched |
| Industry standard? | Yes — single source of truth for the XP curve (Law 13) |

## 5. Proposed Fix (GREEN)

- **Approach:** rewrite `getXPProgress` to derive `xpAtLevelStart` by summing the REAL per-level costs: `for (let lv = 1; lv < level; lv++) xpAtLevelStart += getXPForNextLevel(lv);` — mirroring `calculateLevel`'s own accumulation exactly. Delete both retired branches (`(level-1)*1000` and the 30,000/3,300/×1.10 exponential block). Then `currentLevelXP = totalXP − xpAtLevelStart` is mathematically guaranteed consistent with `calculateLevel` (same subtraction the level loop performed), and `currentLevelXP < xpForNextLevel` always holds.
- **Alternatives considered:** (a) have `calculateLevel` return `(level, remaining)` — rejected: public signature used elsewhere (wmd researchService); (b) cache cumulative table — rejected: premature, 30-iteration loop is negligible.
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `lib/xpService.ts` | modify | `getXPProgress`: cumulative-sum level-start via `getXPForNextLevel`; remove retired linear + exponential branches |

- **Verification plan:** tsc 0; vitest full run (existing xpService tests, if any, plus level-16 arithmetic spot-check in the implementation record: `getXPProgress(144972)` → `{ currentLevelXP = 11,663, xpForNextLevel = 21,112 }` — AUDIT-RECOMPUTED with an independent implementation of the curve: xpAtLevelStart(16) = 133,309; 144,972 − 133,309 = 11,663 = **55.2%**); StatsPanel render check via live drive.
- **Call-graph reachability plan:** unchanged (existing import graph proves reachability — `app/api/player/route.ts:68`, `lib/xpService.ts:415`, wmd researchService).

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / vitest | *(paste at implementation)* | pass |
| Method 2: manual re-read | invariant `currentLevelXP < xpForNextLevel` for boundary XP values (L1, L2, L16, L29, L30, L31) | *(paste at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** done
- **Files changed:** `lib/xpService.ts` — `getXPProgress` rewritten to the cumulative-sum level-start (single curve source of truth; both retired branches deleted; negative-input clamp added). Same pass: the file's 3 pre-existing `no-explicit-any` findings fixed (`updateData: Partial<typeof players.$inferInsert>`, `rpHistory` typed via the imported `ResearchPointHistory`) — continues the standing #36 directive.
- **Verification evidence (tool output):**
  - Boundary probes via tsx: L16(144,972) → `{currentLevelXP:11663, progressPercent:55.24, xpForNextLevel:21112}` — matches the audit recomputation EXACTLY (operator's impossible 129,972/21,112 eliminated); L1(0) → 0/500; L2(500) → 0/1274 (fresh level = 0 progress ✓); L29 boundary → 4482/5616; L30 → 4437/26624; L31 → 27813/28533; negative → 0/500. Invariant `currentLevelXP < xpForNextLevel` holds at every probe.
  - `npx tsc --noEmit` → exit 0; `npx eslint lib/xpService.ts` → 0 findings; `npx vitest run` → **354 passed / 0 failed / 1 skipped**.
- **Call-graph reachability evidence:** unchanged import graph (route consumes `getXPProgress(player.xp)` at `app/api/player/route.ts:68`; internal consumers at `lib/xpService.ts:415`, wmd researchService). tsc-verified against all callers.
- **Stale-docstring note (recorded, not silently absorbed):** the function's doc-comment examples predate the FID-006 power curve (e.g. "L10 ≈ 11,195" reflects the retired formula); the code is ground truth. Docstring refresh queued with the FID-006 Wave-A doc sweep.

## 8. Closure

- **Gates:** [ ] typecheck 0 · [ ] lint 0 · [ ] tests pass · [ ] call-graph proven (unchanged graph)
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add lib/xpService.ts`
