# FID-20260917-003: Own-base artwork wired to rank instead of level — always renders tier-1 art

**Filename:** `FID-20260917-003-base-art-level-wiring.md`
**ID:** FID-20260917-003
**Severity:** LOW (cosmetic; user-facing correctness defect)
**Status:** closed
**Created:** 2026-09-17

---

## 1. Summary

The operator's level-19 account renders the tier-1 base artwork. The own-base branch of
`TileRenderer` selects art via `getBaseImage(player.rank)` — but `rank` is the admin-gating column
(default 1), not progression. The level→tier artwork system exists, is client-fed, and is consumed
correctly by the ENEMY-base branch (`tile.baseLevel` → `ceil(level/10)` clamp 1..10 →
`bases/{tier}.jpg`); the own-base branch was never wired to it and always collapses to `1.jpg`
via `getBaseImage`'s fallback (it searches for `rank{N}` filenames that do not exist in the asset
set, then returns the first manifest entry).

## 2. Evidence (RED)

All claims probed fresh this session (read_files 0-EOF + greps + `ls`).

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | Own-base artwork input is `player.rank \|\| 1` | components/TileRenderer.tsx:302-305 | `const rank = player.rank \|\| 1; const imgPath = await getBaseImage(rank);` |
| 2 | `rank` is the admin-gating column, default 1 — distinct from progression `level` | lib/db/schema/players.ts:20,38 | `rank: integer('rank').default(1)` vs `level: integer('level').notNull().default(1)` (+ `level_idx` index) |
| 3 | `getBaseImage` searches `rank{N}`/`rank-{N}` filenames, finds none, falls back to `baseImages[0]` = alphabetically first = `1.jpg` | lib/imageService.ts:236-259 | function body read 0-EOF; `ls public/assets/tiles/bases/` → `1.jpg…10.jpg`, zero `rank*` assets |
| 4 | The level IS client-exposed on the sanitized player | lib/playerSanitize.ts:38 | allowlist contains `'level'` |
| 5 | Enemy bases already consume the level→tier system correctly (10 levels per tier, FID-20260910-037 R2) | components/TileRenderer.tsx:337-339 | `const enemyLevel = tile.baseLevel ?? 1; const tierIndex = Math.min(10, Math.max(1, Math.ceil(enemyLevel / 10)));` → `/assets/tiles/bases/${tierIndex}.jpg` |
| 6 | `tile.baseLevel` is stamped from `owner.level` at the enrichment seam | lib/movementService.ts:85 | `(tile as { baseLevel?: number }).baseLevel = owner.level;` |

Net effect: a level-19 ENEMY base renders `2.jpg`; the operator's level-19 OWN base renders `1.jpg`.

**Call-graph notes (Law 4):** `TileRenderer` own-base effect (`[player]` dep) → `getBaseImage` —
the sole production caller. The enemy branch computes its tier inline. No other consumers of
`getBaseImage`; one test mocks it (`TileRenderer.protection.test.tsx:24`).

## 3. Impact Analysis

- **Who/what is affected:** own-base tile render only. No API, schema, or asset changes —
  `player.level` already reaches the client in the sanitized payload.
- **Failure modes if unfixed:** every own base renders tier-1 art regardless of progression;
  the 10-tier asset set is dead weight on the own-base side; visual progression loop broken
  (the artwork reward players see at their own base never advances).
- **Blast radius of the fix:** `lib/imageService.ts` (tier helper + `getBaseImage` semantics),
  `components/TileRenderer.tsx` (two call sites: own-base input + enemy inline formula),
  one test mock updated, one new test file. Nothing else imports `getBaseImage`.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | YES — undefined/0/negative level clamps to tier 1 (corrupt-data safe); 91+ clamps to tier 10; level-up re-renders (effect deps `[player]`) |
| Scales (design tolerates growth; harness reference is 1000 agents)? | YES — pure arithmetic, one shared formula, no I/O |
| Survives a hostile attacker, not just an honest user? | YES — server-authoritative `level` renders the art; nothing attacker-controllable enters the path (cosmetic client render; server refuses regardless of what art shows) |
| Maintainable in 2 years? | YES — one `levelToBaseTier` truth consumed by both branches; the duplicated inline formula is deleted, not paired |
| Sets the standard for the industry? | YES — dead parameter semantics replaced by the domain truth; fix mirrors the already-shipped enemy-side pattern instead of inventing a second scheme |

## 5. Proposed Fix (GREEN)

Minimal changes; the enemy branch's shipped bucketing (10 levels/tier, clamp 1..10) becomes the
single shared formula.

**Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| lib/imageService.ts | modify | export `levelToBaseTier(level: number): number` — `Math.min(10, Math.max(1, Math.ceil(level / 10)))`, the exact FID-20260910-037 R2 formula; rewire `getBaseImage(level: number): Promise<string>` to return `/assets/tiles/bases/${levelToBaseTier(level)}.jpg` (static path — the enemy branch's existing precedent; the `rank{N}` manifest search and first-entry fallback are deleted). Header comment updated to level semantics |
| components/TileRenderer.tsx | modify | own-base effect: `player.level \|\| 1` replaces `player.rank \|\| 1` (debug log field renamed); enemy branch: inline formula replaced by `levelToBaseTier(enemyLevel)` (Law 13) |
| components/TileRenderer.protection.test.tsx | modify | the `getBaseImage` mock returns a resolved tier path instead of `null` (signature alignment) |
| __tests__/lib/baseTier.test.ts | create | pins: 1→1, 10→1, 11→2, 19→2 (the operator's case), 20→2, 91→10, 95→10, 1000→10 (clamp), 0→1, −5→1; `getBaseImage(19)` → `/assets/tiles/bases/2.jpg` |

- **Verification plan:** `npx tsc --noEmit` → 0; `npm run lint` → 0; `npm run test:ci` → all pass
  (983 baseline + ~12 new pins).
- **Call-graph reachability plan:** (1) `grep -n "getBaseImage\|levelToBaseTier" components/ lib/`
  → helper def + both TileRenderer branches + test; (2) visual parity argument: own-base tier =
  enemy tier for the same level (same helper); (3) `grep -n "player.rank" components/TileRenderer.tsx`
  → only the legitimate rank-display use remains (not the artwork path).

## 6. Audit Record

Double audit — two independent methods, evidence pasted, no self-reporting.

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis (typecheck/lint/tests) | document-only session phase; gates must show zero code drift at loop-complete | `npx tsc --noEmit` → `TSC_EXIT=0` · `npm run lint` → `LINT_EXIT=0` · `npm run test:ci` → `983 passed \| 1 skipped (984)`, exit 0 (2026-09-17, post-final-edit) | pass |
| Method 2: manual re-read against this FID | every RED row re-traced to a pasted probe from this session; GREEN symbols verified to exist (`getBaseImage` sole-caller census via grep; `bases/1.jpg…10.jpg` via ls; `level` in sanitizer allowlist via grep) — no drift found | read_files + grep outputs in §2 | pass |

- Audit outcome: **PASS → `loop-complete`** (loop 1; GREEN amendments only tightened evidence —
  call-graph notes added in §2; zero design corrections; delta far under the 10% cap). |
- Circuit breakers: 10% cap per pass, convergence <2% over 2 passes, oscillation 3×, hard stop 10.

## 7. Implementation Record (only after `loop-complete`, with operator go-ahead)

- **Status:** done

- **Files changed:**

| File | Lines | Notes |
| ---- | ----- | ----- |
| lib/imageService.ts | ~40 | `levelToBaseTier` exported (the shared R2 formula); `getBaseImage(level)` returns the static tier path; `rank{N}` manifest search + first-entry fallback deleted; header updated to level semantics |
| components/TileRenderer.tsx | 3 edits | own-base effect passes `player.level \|\| 1` (log field renamed); enemy branch consumes `levelToBaseTier(enemyLevel)` (inline formula deleted — Law 13); import gains the helper |
| components/TileRenderer.protection.test.tsx | 1 block | imageService mock aligned to the level-driven signatures |
| __tests__/lib/baseTier.test.ts | new, 44 lines | 6 pins: band edges (1/10→1, 21→3), the operator case (19→2), top clamp (91/95/1000→10), corrupt clamp (0/−5→1), `getBaseImage(19)` → `bases/2.jpg` |

- **Verification evidence (fresh, post-final-edit):**

```
npx tsc --noEmit → TSC_EXIT=0
npm run lint     → LINT_EXIT=0
npm run test:ci  → Test Files 101 passed | 1 skipped (102) · Tests 989 passed | 1 skipped (990)
                   (983 baseline → +6 new pins; the stderr lines are pre-existing
                   expected-error logging in authService tests + the MovementControls env warning)
```

- **Call-graph reachability evidence (Law 4 greps, pasted):**

```
getBaseImage production caller: components/TileRenderer.tsx:305 — `await getBaseImage(level)`
levelToBaseTier consumers: TileRenderer.tsx:346 (enemy branch) + __tests__/lib/baseTier.test.ts
player.rank artwork path: GONE — only the legitimate rank-display comment/use remains (TileRenderer:348)
```

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass (989+1) · [x] call-graph proven
- **Commit hash (G2):** `57dbfef` (4 files, +85/−31). Live visual confirmation is operator-side: refresh the game page — the level-19 own base now renders `bases/2.jpg`.
- **Staging plan (G3/G4):** `git add lib/imageService.ts components/TileRenderer.tsx components/TileRenderer.protection.test.tsx __tests__/lib/baseTier.test.ts` — one concern
- **Commit message (G8):** `fix(game): wire own-base artwork to player level — shared tier formula (FID-20260917-003)`
- **Archive:** to `dev/fids/archive/` on close + CHANGELOG entry + session log.

---

**Final status:** closed (G2: `57dbfef`)
