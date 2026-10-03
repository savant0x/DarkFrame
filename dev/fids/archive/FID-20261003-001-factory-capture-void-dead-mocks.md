# FID-20261003-001: factoryCaptureVoid flake — dead relative vi.mock paths let the real xpService run

**Filename:** `FID-20261003-001-factory-capture-void-dead-mocks.md`
**ID:** FID-20261003-001
**Severity:** MEDIUM
**Status:** closed (2026-10-03, commit 815c0d1)
**Created:** 2026-10-03

---

## 1. Summary

`__tests__/lib/factoryCaptureVoid.test.ts` (the FID-20260916-008 protection-seam suite) flakes at
~11–20% of standalone runs with `Error: Player not found: attacker` thrown from the REAL
`lib/xpService.ts` `awardXP` → `lockPlayerRow`. Batches 11–12 of the 2026-10-02 remediation order
recorded this as a "pre-existing disposable-PG parallel-worker flake" — that diagnosis is wrong:
the suite contains no PostgreSQL at all. The root cause is that all three of its `vi.mock` calls
use paths **relative to the test file** (`'./xpService'` → `__tests__/lib/xpService`, which does
not exist), so none of them intercept anything. The production code's real `lib/xpService` runs,
and whenever the capture power roll succeeds (~11% probability under the suite's mocks) it hits
the suite's mocked `db.transaction`, whose locked select resolves `[]` → `lockPlayerRow` throws.
The fix re-points the three mocks to the same module ids production resolves (`@/lib/...`, the
house idiom used by every other suite) and gives the `awardXP` stub the return shape the success
path reads. Test-only change; zero production delta.

## 2. Evidence (RED)

All findings cataloged before any fix was designed. Every claim is reproducible.

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | Flake reproduces standalone: 2 of 10 sequential runs failed, each exactly `pin 1` with 1 failed / 4 passed | `__tests__/lib/factoryCaptureVoid.test.ts` | `for i in 1..10; npx vitest run __tests__/lib/factoryCaptureVoid.test.ts; done` → `run 1 exit=1 … run 10 exit=1` (8× exit=0) |
| 2 | The failure is `Error: Player not found: attacker` from the REAL `lockPlayerRow` inside the REAL `awardXP` — the test's xpService mock never intercepts | `lib/db/treasuryLock.ts:136`, `lib/xpService.ts:320` | flake-run-1.log: `FAIL … pin 1 … Error: Player not found: attacker ❯ lockPlayerRow lib/db/treasuryLock.ts:136:22 ❯ run lib/xpService.ts:320:20` |
| 3 | All three relative mock paths are dead: they resolve against the TEST file's directory, where no such modules exist. Production imports resolve to `lib/*` | `__tests__/lib/factoryCaptureVoid.test.ts:102-104`; `lib/factoryService.ts:20-22` | `ls __tests__/lib/ \| grep -iE "xp\|specialization"` → only `specializationDoctrine.test.ts`; repo sweep `grep -rnE "vi\.mock\('\./"` → exactly these 3 lines (+2 in spySabotageProtection, finding 6; +1 valid same-dir case, finding 7) |
| 4 | Failure trigger is the capture power roll: mocked select always returns `rows[0]` (no row consumption — the `attackerRow` fixture at index 1 is never read), so `calculatePlayerPower` reads the protection row → power = 100 + (rank‖1)×10 = 110 → `successChance = min(0.9, 110/1000) = 0.11` → on a winning roll the success path reaches the un-mocked `awardXP` (factoryService.ts:525) | `lib/factoryService.ts:489-491,525`; test mock lines 43-60 | predicted ≈11% per capturable pin vs observed 2/10 runs (small-sample consistent); suite is green on roll losses because pins 4/5 refuse before the roll and pins 1-3 assert roll-outcome-agnostic facts |
| 5 | When the real `awardXP` runs, the suite's mocked `db.transaction` handle returns `[]` for the locked-row select chain (`limit().for('update')` → `Promise.resolve([])`), so `lockPlayerRow` throws — deterministic *per call* | `__tests__/lib/factoryCaptureVoid.test.ts:77-92`; `lib/xpService.ts:407-409` | mock chain: `for: vi.fn(() => Promise.resolve([]))`; `if (!locked) throw new Error(\`Player not found: ${username}\`)` |
| 6 | Same defect class, currently latent (suite green with REAL modules running): `spySabotageProtection.test.ts` mocks `'./clanTreasuryWMDService'` and `'./researchService'` relative to `__tests__/lib/` while `lib/wmd/spyService.ts` imports them from `lib/wmd/` — both real files exist, both mocks are dead | `__tests__/lib/spySabotageProtection.test.ts:119,124`; `lib/wmd/spyService.ts:101-102` | `ls lib/wmd/researchService.ts lib/wmd/clanTreasuryWMDService.ts` → both exist; suite green 6/6 with real modules. **Not fixed here** — outside the reported flake; stubbing live-reached modules changes that suite's runtime behavior and needs its own verified pass. Presented as [OPEN-OUT-OF-SCOPE]. |
| 7 | Control case (mock is VALID — not part of the class): `components/TileRenderer.protection.test.tsx` mocks `'./SafeHtmlRenderer'` relative to `components/`, where the module exists | `components/TileRenderer.protection.test.tsx:28` | `ls components/SafeHtmlRenderer.tsx` → exists |
| 8 | House idiom for these exact services already exists and is aliased: e.g. `build-unit-units-shape.test.ts:87` uses `vi.mock('@/lib/xpService', … awardXP: vi.fn(async () => ({ xpAwarded: 5, levelUp: false, newLevel: 16 }))…)` | `__tests__/api/factory/build-unit-units-shape.test.ts:87-89` | grep `vi\.mock\('@/(lib/)?(xpService\|specializationService\|factoryUpgradeService)'` → 14 hits across 12 suites, all `@/lib/...` |

Call-graph notes (Law 4): production chain is `app/api/factory/*` routes → `attackFactory`
(lib/factoryService.ts) → `awardXP` (lib/xpService.ts). No production code is changed by this
FID; the defect is entirely in the test's module-mock wiring.

## 3. Impact Analysis

- **Who/what is affected:** gate runs only. The flake forces full-suite re-runs (it aborted two
  batch verification cycles in the 2026-10-02 order) and — worse — its recorded root cause
  ("disposable-PG parallel-worker flake") is wrong in the batch-11/12 ledger records, which
  misdirects any future reader (Law 16's exact concern: a disposition written from a wrong
  premise).
- **Failure modes if unfixed:** ~11% of standalone runs and ~any full `test:ci` run has ≥1 of 3
  capturable pins win its roll → red gate with a misleading error surface (`Player not found:
  attacker` through `treasuryLock`), inviting DB-flake chases.
- **Blast radius of the fix:** one test file. Production zero. With the mocks live, the success
  path completes through the stubbed `awardXP` and the (previously never-reached-on-green-runs)
  war-scoring block, whose dynamic imports are already wrapped non-fatally
  (factoryService.ts:529-543 try/catch + `.catch(() => null)`).

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — both roll outcomes are now green by construction (stubbed XP on success; refusal/pins unaffected on loss). The three dead mocks are all re-pointed, not just the one that currently throws. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes — matches the aliased-mock idiom already used by 12+ suites; nothing bespoke. |
| Survives a hostile attacker, not just an honest user? | Yes — no behavior change; the suite still pins the refusal/void seams against the real `playerProtection` module. |
| Maintainable in 2 years? | Yes — the header comment now documents the vitest relative-path resolution trap so the class does not regrow. |
| Sets the standard for the industry? | Yes — the FID records the mechanism (relative vi.mock resolves against the test file) as a reusable lesson. |

## 5. Proposed Fix (GREEN)

Minimal changes that answer all Five Questions. Most robust defaults chosen.

- **Approach:** re-point the three `vi.mock` factory paths to the module ids production actually
  resolves (`@/lib/xpService`, `@/lib/specializationService`, `@/lib/factoryUpgradeService`) and
  give `awardXP` the shaped resolved value the success path reads (`xpAwarded`/`totalXP`/
  `oldLevel`/`newLevel`/`levelUp` — factoryService.ts:551-553), following the established house
  idiom (finding 8). `XPAction` stays a literal stub (`FACTORY_CAPTURE` is the only member
  attackFactory uses). Everything else in the file — the projection-aware `@/lib/db` mock, the
  transaction handle, all five pins' assertions — is untouched; the suite was already designed to
  tolerate both roll outcomes (pin 2 asserts `typeof result.success === 'boolean'`).
- **Alternatives considered:** (a) seeding `Math.random` to make the roll deterministic — rejected:
  pins explicitly accommodate both outcomes and the suite's subject is the void/refusal seams, not
  the roll; (b) making the db mock's transaction handle return a player row so the REAL awardXP
  succeeds — rejected: the suite's intent (per its own header) is that xpService is mocked, and
  letting real XP logic run inside a seam-pin suite widens the surface it depends on; (c) fixing
  spySabotageProtection's two dead mocks in the same pass — rejected here (finding 6): same class
  but a different suite whose live-reached real modules would swap to unexercised stubs; recorded
  as [OPEN-OUT-OF-SCOPE] for a separate verified pass.
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `__tests__/lib/factoryCaptureVoid.test.ts` | modify | Lines 102-104: `vi.mock('./xpService')` → `vi.mock('@/lib/xpService')` with `awardXP: vi.fn(async () => ({ xpAwarded: 200, totalXP: 200, oldLevel: 1, newLevel: 1, levelUp: false }))`; `./specializationService` → `@/lib/specializationService`; `./factoryUpgradeService` → `@/lib/factoryUpgradeService`. Header comment: document the relative-path trap and the corrected wiring. |

- **Verification plan:** `npx vitest run __tests__/lib/factoryCaptureVoid.test.ts` × 10
  consecutive standalone runs → 10/10 exit 0 (the previous baseline was 8/10); then the full
  configured gates (`npx tsc --noEmit` 0; `npx eslint .` 0/0; `npm run test:ci` green). The
  deterministic claim rests on the mechanism: the only nondeterministic inputs to the pins were
  the roll (accommodated) and the real-awardXP side effect (now stubbed).
- **Call-graph reachability plan:** n/a for the fix (test-only); the pinned seams' reachability is
  unchanged and re-asserted by the pins themselves (`attackFactory` remains the production entry;
  the mock ids now match its actual import specifiers' resolution).

## 6. Audit Record

Double audit — two independent methods, evidence pasted, no self-reporting.

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis (typecheck/lint/tests) | repo tsc, eslint, 10× standalone suite loop, full test:ci | see §7 verification evidence | pass |
| Method 2: manual re-read against this FID | edited file re-read 0-EOF against §5's change table; mock ids grep-verified to match production resolution; no assertion changed | grep of the three mock lines post-edit + diff review | pass |

- Audit outcome: PASS → status `loop-complete` (then §7 implementation per operator go-ahead).
- Circuit breakers: single-plan pass; no revisions required (loop 1, delta well under caps).

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** done
- **Files changed:**

| File | Lines | Notes |
| ---- | ----- | ----- |
| `__tests__/lib/factoryCaptureVoid.test.ts` | +4/−3 (mock block) + header note | The three vi.mock factories re-pointed to `@/lib/...`; awardXP stub shaped; header comment documents the trap. Zero assertion/production changes. |

- **Verification evidence:** 10/10 consecutive standalone runs exit 0 (`dev/tmp/flake-fixed-loop.log`);
  `npx tsc --noEmit` exit 0; `npx eslint .` exit 0 (0/0); full `npm run test:ci` green — outputs
  pasted in the session record and SCOPE ledger row.
- **Call-graph reachability evidence:** unchanged production surface — `grep -n "awardXP\|getPlayerDoctrineBonuses\|getFactoryDefense" lib/factoryService.ts` still shows the same import sites; the test's mock ids now resolve to those exact modules.
- **Post-implementation addendum — the finding-6 instance fixed on operator go-ahead (2026-10-03, "fix it"):** `spySabotageProtection.test.ts`'s two dead relative mocks (`'./clanTreasuryWMDService'`, `'./researchService'` — finding 6) re-pointed to `@/lib/wmd/clanTreasuryWMDService` and `@/lib/wmd/researchService`, the exact module ids `lib/wmd/spyService.ts:95-102` imports resolve to; the stub factories already covered every imported name (`validateClanWMDFunds`, `deductWMDCost`, `WMDPurchaseType`, `getPlayerResearch` — the latter now pinned to the real module's no-row shape, `mockResolvedValue(null)`). The suite's six pins exercise the MISSILE path, which never calls these modules (clan-funds calls are recruitment-path, spyService:178-185; `getPlayerResearch` is research-target resolution, spyService:944-974) — so the previously-dead mocks were import-graph hygiene, and making them live changes what LOADS, not what RUNS. **Verification: 10/10 consecutive standalone runs exit 0, 6/6 tests** (`dev/tmp/spy-fixed-loop.log`); tsc 0 · lint 0/0 on the final tree. SCOPE row 158 closed by this record.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass · [x] call-graph proven
- **Commit hash (G2 — required for `closed`):** `815c0d1` (agent-run under the operator's explicit 2026-10-03 push directive)
- **Staging plan (path-scoped, G3/G4):** `git add __tests__/lib/factoryCaptureVoid.test.ts dev/fids/FID-20261003-001-factory-capture-void-dead-mocks.md` — one concern: the flake's root-cause fix + its FID.
- **Commit message (G8):** `test(factory): re-point dead relative vi.mocks — real xpService ran on capture-roll success (FID-20261003-001)`
- **Archive:** moved to `dev/fids/archive/` on close; CHANGELOG entry appended; archival logged in session summary. Closed FIDs must not remain in `dev/fids/`.

---

**Final status:** closed (2026-10-03, G2 commit `815c0d1`)
