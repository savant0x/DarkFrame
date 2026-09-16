# FID-20260916-005: WMD launch target validation — any username accepted, shield bypassed

**Filename:** `FID-20260916-005-wmd-launch-target-validation.md`
**ID:** FID-20260916-005
**Severity:** HIGH
**Status:** verified
**Created:** 2026-09-16

**Provenance:** `[OPEN-OUT-OF-SCOPE]` discovery from FID-20260916-004 (RED finding 1), elevated
during impact-path grounding for this FID.

---

## 1. Summary

The WMD launch seam accepts **any username string** as a target with zero validation:
`launchMissile` checks only the missile (exists + READY), persists `targetId` verbatim, and
the HTTP route passes `validated.targetId` straight through. The pre-built
`validateTargeting` validator (existence, protection, level floor) has **no production
callers**, which produces two concrete defects: (a) a clan's built weapon can be wasted on a
nonexistent user (consumed dud), and (b) — more severe — **the new-player protection shield
does not stop incoming WMD strikes**, because no production code ever consults
`protectionActive` on the target side. A protected new account can be WMD-struck during its
72h window, contradicting FID-20260916-002's guarantee ("protected targets refuse all
incoming PvP" — a mass-casualty strike is the least PvP-like attack in the game).

## 2. Evidence (RED)

All claims verified by tool output on 2026-09-16 (pasted in SESSION-2026-09-16-011).

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | Launch route forwards the raw body field with no target checks | `app/api/wmd/missiles/route.ts:239-242` | `const result = await launchMissile(validated.missileId, validated.targetId, auth.username)` — the target select at :226-238 feeds only the broadcast name |
| 2 | `launchMissile` validates the missile, never the target | `lib/wmd/missileService.ts:191-231` | body: not-found / not-READY returns, then status flip with `targetId` persisted verbatim; zero target reads |
| 3 | `validateTargeting` has no production callers (re-confirmed from FID-004 RED 3) | repo grep | definition + tests only; its rules (protection :37-38, level ≥ 10 :41-42) never run in production |
| 4 | Nonexistent target = consumed dud, zero damage | `lib/wmd/jobs/missileTracker.ts:136-140` | `if (!target) { return { unitsDestroyed: 0, … } }` — `applyDamage` no-ops; the missile still resolves to a terminal state |
| 5 | **No protection read exists anywhere on the strike path** | `lib/wmd/jobs/missileTracker.ts` | `grep -n protection` → zero hits; interception is clan-keyed (`target?.clanId ?? null`), damage is username-keyed — `protectionActive` never consulted |
| 6 | By contrast, the infantry path enforces the shield target-side | `app/api/combat/infantry/route.ts` | `protectionActive(defenderRow.protectionUntil)` refusal (FID-002 seam) |

Call-graph notes (Law 4): client panel → `POST /api/wmd/missiles` (action='launch') →
`launchMissile` (status → LAUNCHED, impactAt = now + flightTime) → cron
`processDueMissiles` (missileTracker) → `attemptInterception` + `applyDamage`. The launch
seam is the only gate the target ever faces; it has none.

## 3. Impact Analysis

- **Who/what is affected:** protected new accounts (WMD-struck during their shield — the
  strongest incoming-damage event in the game bypasses the flagship newcomer protection);
  clans whose members waste built warheads on nonexistent users (griefing vector — a member
  with launch access can silently destroy the clan's arsenal: `targetId='x'` → consumed dud);
  notification/broadcast systems fed nonexistent targets.
- **Failure modes if unfixed:** shield bypass (directly undermines FID-002's closed
  guarantee); arsenal-waste griefing; WMD strikes have no level floor or any targeting
  rule the validator was written to enforce.
- **Blast radius of the fix:** one seam (`launchMissile`) gains target reads + honest
  refusals before the committed-action point; no cron changes; no schema changes.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — existence, protection, and level-floor rules all evaluate at the single launch chokepoint, for every caller |
| Scales (design tolerates growth; harness reference is 1000 agents)? | Yes — two indexed single-row selects per launch (rare, high-cost action) |
| Survives a hostile attacker, not just an honest user? | Yes — closes both the shield bypass and the arsenal-waste grief; refusals carry honest reasons |
| Maintainable in 2 years? | Yes — revives the already-written validator contract instead of inventing a new one; one seam, pinned |
| Sets the standard for the industry? | Yes — mass-casualty weapons demand stricter targeting than rifles, not looser |

## 5. Proposed Fix (GREEN — sketch; loop runs before implementation)

- **Approach:** in `launchMissile`, after the missile's exists+READY checks and **before**
  the FID-004 void (order matters: an invalid target must refuse *without* forfeiting the
  launcher's shield — no committed aggression), load the target row and enforce:
  1. target exists → else `{ success: false, message: 'Target not found' }` (missile stays READY — not consumed);
  2. `protectionActive(target.protectionUntil)` → else-refusal with `PROTECTION_REFUSAL_REASON` (parity with infantry);
  3. level-floor rule (validator's level ≥ 10) — **kept** (operator decision 2026-09-16, structured ask: "Keep the floor"); validator revives as written, contract unchanged.
- **Alternatives considered:** validating in the route (rejected — service chokepoint covers all callers, matches FID-002/-004 precedent); validating at impact time in the cron (rejected — too late, weapon already committed and broadcast); deleting the dead validator and documenting WMDs as unvalidated (rejected — leaves the shield bypass).
- **Verification plan (post-loop):** 6–8 seam pins (refusals leave missile READY + no void; valid target commits + voids per FID-004), live probes per the FID-004 driver pattern; gates tsc/lint/vitest + reachability greps.

## 6. Audit Record

**Pass 1 — RED re-verification (executed 2026-09-16, live tool evidence):** all six findings
re-confirmed against the post-FID-004 tree: route :239-242 still forwards `validated.targetId`
after a name-only select; `launchMissile` (:191-235) validates only exists+READY, now with the
FID-004 void between READY check and status flip; `validateTargeting` callers remain definition
+ e2e script only; `applyDamage` no-op-then-terminal on missing target re-read at :136-140;
`grep -c protection missileTracker.ts` → 0. No corrections required.

**Pass 2 — GREEN audit (executed 2026-09-16):**
- **Ordering audit (committed-action principle):** validation must sit between the READY check
  and the FID-004 void — an invalid target refuses with the missile still READY and *no*
  forfeit, since no committed action occurred. A refusal path that voided would let any
  account burn its own shield on an impossible launch (self-grief). Pinned in tests.
- **Contract audit:** the dormant validator's five rules are coherent and complete for the
  seam (self-target, existence, protection, level ≥ 10 — kept by operator decision — own-clan);
  no gaps found, no new policy invented.
- **Failure-mode audit:** validator's `getPlayerData` swallows DB errors as not-found →
  target validation fails **closed** (launch refused on outage — conservative for a weapon).
  The own-clan rule fetches the launcher through the same helper; on outage that single rule
  degrades open while existence/protection/level remain enforced. Accepted and recorded.
- **Graph audit:** new import edge `missileService → targetingValidator` is acyclic (validator
  imports db/schema/types only); `WarheadType` already imported at the seam for the existing
  cast.

CONVERGENCE criterion met — plan final, zero open findings.

## 7. Implementation Record

- **Status:** implemented + verified 2026-09-16 (directive: commit queued batches, then start implementation — loop ran under the same directive).
- **Seam:** `launchMissile` (`lib/wmd/missileService.ts`) — target validation sits between the missile's READY check and the FID-004 aggression void. Invalid targets refuse (`Launch refused: <rule errors>`) with the missile still READY and **no forfeit** (no committed action); valid targets commit and void exactly as before.
- **Validator revived as written** (`lib/wmd/targetingValidator.ts` — first production callers ever): self-target refusal, target existence, protection (`Target is under protection`), level ≥ 10 (floor kept by operator decision), own-clan refusal. Import edge `missileService → targetingValidator` is acyclic.
- **Pins:** 5 new in `__tests__/lib/playerProtection.seams.test.ts` (pins 7–11: ghost, protected, sub-floor, self-target, valid-target ordering; every refusal class asserts no missile flip and no void). All 6 pre-existing -004 pins unchanged and green — pin 1's fixture gained a validator-satisfying target row (validation now precedes the void).
- **Live probes 5/5** (`scripts/e2eWmdTargetValidation.ts`, real DB): protected/nonexistent/sub-floor targets refuse with missile READY + launcher shield intact; valid target launches (status LAUNCHED) + void fires; 0 fixture residual. The committed FID-004 driver was patched first — its probe 1 launched at a never-inserted dummy user, which -005 now (correctly) refuses — and re-ran 4/4 green after the patch.
- **Gates:** tsc 0 · eslint 0/0 (touched files) · vitest **908 passed / 1 skipped** (903 → 908).
- **Residual honesty note:** the validator's `getPlayerData` swallows DB errors as not-found → target validation fails closed (launch refused on outage — conservative for a weapon); the own-clan rule degrades open on the same outage while existence/protection/level stay enforced. Recorded in §6, accepted.

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass · [x] call-graph proven
- **Commit hash (G2 — required for `closed`):** `<hash>`
- **Staging plan (path-scoped, G1 — doc only at this stage):** `git add dev/fids/FID-20260916-005-wmd-launch-target-validation.md dev/session-summaries/SESSION-2026-09-16-011.md SCOPE.md`
- **Commit message (G8):** `docs(fid): WMD launch accepts any username — shield-bypass + dud-waste findings (FID-20260916-005)`

---

**Final status:** created
