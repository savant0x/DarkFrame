# FID-20260915-008: PvP Counter-Suppression Softening (Infantry-Scoped)

**Filename:** `FID-20260915-008-pvp-counter-suppression-softening.md`
**ID:** FID-20260915-008
**Severity:** HIGH
**Status:** closed
**Created:** 2026-09-15

---

## 1. Summary

Equal-pool PvP is a glass-cannon farm: a mono-STR attacker takes **0.0% losses** against every defender up to 50% DEF share because the shared `STR − other/2` algebra gives defenders with DEF ≤ attackerSTR/2 a ~5-damage/round counter against 200k pools. The fix softens ONLY the defender counter, ONLY for PvP infantry (`COUNTER_DIVISOR 2 → 3`, knee 50% → 33%), leaving the attacker strike and all PvE paths (FID-002/003-tuned garrison math, incident replay pins) byte-identical.

## 2. Evidence (RED)

Baseline: `npx tsx scripts/simulatePvpBalance.ts 3` (tier 3, 200k pools, seam ON), 2026-09-15.

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | 0-loss farm to 50% DEF share | `lib/battleService.ts:198-215` (`calculateDamage`: `max(5, DEF − STR/2)`) | suppression sweep: `0.0%…50.0% → ATTACKER_WIN 2r, A-pool-lost 0.0%, counter-R1 0k` (7 of 11 cells) |
| 2 | League gap ~30pts | `scripts/simulatePvpBalance.ts:200-218` | `monoStr 42.6%` avg lost vs `skew55 68.7 / even 70.3 / nearOpt 72.2`; seam ON≡OFF wins (7 vs 7) — balance is a tax, never a flip |
| 3 | STALL band live | `lib/battleService.ts:446-451` (100-round cap) | `monoDef→monoStr [ON] STALL (DEFENDER_WIN, 100r)` |
| 4 | Dead-zone algebra | `lib/battleService.ts:406-411` | counter `max(5, DEF − STR/2)`: DEF ≤ STR/2 ⇒ 5 dmg/round vs 10⁵–10⁶ pools (effective zero) |
| 5 | PvE pins must survive | `__tests__/lib/battleResolution.test.ts:117-123` | incident replay `7836/6673` + `2889` survivors; all `BASE_RAID` battle types |
| 6 | Only one Infantry-pinned test, and it is shape-robust | `__tests__/lib/baseRaidFidelity.test.ts:138-150` | asserts outcome + `0 < captured ≤ lost` on a R1 rout (defender dies in the attacker strike under either divisor) |

Call-graph notes (Law 4): `executeInfantryAttack` (`lib/battleService.ts:616`) is the production PvP entry → `resolveBattle` (`:292`) → `calculateDamage` (`:198`) twice (strike `:396`, counter `:406`). PvE entries (`executeBaseAttack` `:767`, raid/factory routes via `applyAttackerCasualties`) share `resolveBattle` with different `battleType` — the scoping condition keys on exactly this parameter.

## 3. Impact Analysis

- **Who/what is affected:** PvP infantry duels only (players + the PvP sim). Raid, factory, beer-base, and PvE paths keep divisor 2.
- **Failure modes if unfixed:** mono-STR remains the strictly dominant ladder strategy (free wins to 50% DEF share); mixed armies stay display-only viability.
- **Blast radius of the fix:** one constant + one call-site branch in `calculateDamage`/`resolveBattle`; zero signature changes for existing callers; PvE suites must pass UNMODIFIED (acceptance 4). DEF-heavy mirrors get worse (stronger counters both ways) — recorded tradeoff, matches the audit's "suicidal" note.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | yes — defender-only divisor applies to every Infantry pairing symmetrically (both sides counter harder when defending); tiers 1/3/5 simmed |
| Scales (design tolerates growth; harness reference is 1000 agents)? | yes — O(1) arithmetic, no state, no new queries |
| Survives a hostile attacker, not just an honest user? | yes — no input surface (constant + battleType branch); formula change cannot be gamed beyond playing balanced armies (the intent) |
| Maintainable in 2 years? | yes — named constant + comment citing this FID; battle header documents the split |
| Sets the standard for the industry? | yes — PvP and PvE pacing tuned independently with the seam documented, not entangled |

## 5. Proposed Fix (GREEN)

- **Approach:** defender-counter-only divisor for `BattleType.Infantry`: counter = `max(5, DEF − attackerSTR/3)`; attacker strike unchanged (`STR − DEF/2`); all non-Infantry types unchanged. Smallest integer divisor that revives counters at 40% DEF share (80k − 200k/3 = 13.3k > 0; divisor 2.5 gives exactly 0 — rejected by arithmetic).
- **Alternatives considered:** global divisor change (rejected — retunes FID-002's `0.15×STR` counter premise and FID-003's pacing ladder, invalidating live-verified PvE); floor-share counter with pool arg (rejected — signature change across callers for the same effect); do nothing (rejected — SCOPE row 43 directive + sim proof of dominance).
- **Changes:**

| File | Action (create/modify/delete) | Description |
| ---- | ----------------------------- | ----------- |
| `lib/battleService.ts` | modify | `COUNTER_DIVISOR` split: strike divisor 2 always; counter divisor 3 iff `battleType === BattleType.Infantry`, else 2; header + impl-notes document the split |
| `scripts/simulatePvpBalance.ts` | modify (comments only) | suppression-sweep comment records the new knee (33%) — no logic change |
| `dev/audits/PVP-BALANCE-SIM-2026-09-15.md` | modify (append) | post-fix re-measurement addendum (tiers 1/3/5) |

- **Verification plan:** `npx tsx scripts/simulatePvpBalance.ts {1,3,5}` + acceptance: (1) no 0.0%-loss attacker win at DEF-share ≥ 40%; (2) counter-R1 > 0 for all cells ≥ 40% (knee between 33–40% by construction); (3) STALL outcome unchanged (DefenderWin/repelled) with no NEW stall cells — SELF-CORRECTION loop 2: the original "< 100 rounds" criterion was misconceived (a 0-STR attacker strikes max(5,·)/round and can never resolve any pool; the stall is structural, pre-existing, and already scores DefenderWin); (4) `battleResolution`/`baseRaidFidelity`/`battleReportParser` green UNMODIFIED + full `vitest run` green + `tsc` 0 + `lint` 0; (5) neutral control still bit-identical.
- **Call-graph reachability plan:** grep `BattleType.Infantry` production passers (`executeInfantryAttack`, sim, any route passing Infantry) to prove the branch is live; grep `COUNTER_DIVISOR` definition + both use sites.

## 6. Audit Record

Loop 1 (self-audit, 2026-09-15): re-read §2 against tool output — sweep lines match the pasted sim run verbatim; file:line refs verified (`calculateDamage` 198-215, counter call 406-411, incident pins 117-123, Infantry test 138-150); divisor-2.5 rejection arithmetic rechecked (80,000 − 200,000/2.5 = 0 exactly — correct); blast-radius claim verified by battleType census (all PvE suites use `BASE_RAID`/`BaseRaid`). No changes required (delta 0% — content complete on first pass).

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis (typecheck/lint/tests) | n/a at convergence (no code yet — gates run at implementation) | — | pass (deferred to §7) |
| Method 2: manual re-read against this FID | every RED number ↔ sim output; every file:line ↔ code; GREEN scoping ↔ battleType census | loop-1 notes above | pass |

- Audit outcome: PASS → status `converged` (loop 1/10).
- Circuit breakers: 1 iteration, 0% change, no oscillation.

## 7. Implementation Record (only after status reaches `converged`)

- **Status:** done
- **Files changed:**

| File | Lines | Notes |
| ---- | ----- | ----- |
| `lib/battleService.ts` | +26/−5 | `divisor` param on `calculateDamage`; `counterDivisor` (Infantry 3, else 2); header + impl-notes document the split |
| `scripts/simulatePvpBalance.ts` | +4/−2 | suppression comment records the new 1/3 knee |
| `dev/audits/PVP-BALANCE-SIM-2026-09-15.md` | +12 | FID-008 re-measurement addendum (tiers 1/3/5) |

- **Verification evidence:** sim T3 — 40% share 6.9% losses (was 0.0%), 50% 22.7%, 70% 38.1%; control PASS; STALL outcome unchanged; tiers 1/5 identical. Gates: `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npx vitest run` 85 files 856 passed / 1 skipped (PvE suites unmodified).
- **Call-graph reachability evidence:** `executeInfantryAttack` passes `BattleType.Infantry` (`lib/battleService.ts:684`); branch at `:408`, use at `:436`; grep `BattleType.Infantry` shows the production passer + sim + display-only readers.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass · [x] call-graph proven
- **Commit hash (G2 — required for `closed`):** `f9a5a53` *(operator standing directive this session: direct local commits + direct push to main, no PR flow)*
- **Staging plan (path-scoped, G3/G4):** `git add lib/battleService.ts scripts/simulatePvpBalance.ts dev/audits/PVP-BALANCE-SIM-2026-09-15.md`
- **Commit message (G8):** `fix(combat): soften PvP counter-suppression knee, infantry-scoped (FID-20260915-008)`
- **Archive:** moved to `dev/fids/archive/` on close; CHANGELOG entry appended; archival logged in session summary.
  Closed FIDs must not remain in `dev/fids/`.

---

**Final status:** closed
