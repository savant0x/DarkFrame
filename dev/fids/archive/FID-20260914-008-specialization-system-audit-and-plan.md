# FID-20260914-008: Specialization system audit — built but inert; Phase 0 fix + converged system plan

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID per templates/FID-TEMPLATE.md.
  Attribution rule honored: no author field, no signatures.
-->

**Filename:** `FID-20260914-008-specialization-system-audit-and-plan.md`
**ID:** FID-20260914-008
**Severity:** HIGH (choose-flow 500 with partial apply; core promise non-functional)
**Status:** converged (Phase 0 implemented + live-verified; Phases 1–3 gated)
**Created:** 2026-09-14

---

## 1. Summary

Operator directive: audit whether the Specialization system is built; if not, review the
docs, re-run the Perfection Loop on the idea, and produce an improved plan.

**Verdict: the skeleton is built and mostly solid — the system is INERT.** The service
(591 lines), column, three route pairs, and panel all exist; the choose-flow even gates
correctly (L15+, 25 RP, no double-choose, atomic conditional deduction). But:

- The doctrine bonuses (`strengthMultiplier`/`defenseMultiplier`/cost multipliers) have
  **ZERO consumers** — choosing a doctrine changes no combat math and no costs.
- `chooseSpecialization` **500'd AFTER deducting RP and applying the doctrine** — a MySQL
  `JSON_ARRAY_APPEND` remnant cannot execute on Postgres (live-probed; the ban-player
  partial-apply class). **Fixed this session (Phase 0), live-verified 200.**
- Mastery XP is **client-granted with no cap** (`xpAmount: positive int`) — an open
  exploit; no legitimate server caller exists.
- No nav entry points to `/game/specialization`; `docs/ARCHITECTURE.md` lists a
  `/api/specialization/upgrade` endpoint that doesn't exist (drift); the route header
  promises "5 specialized units per doctrine" that were never built.

## 2. Audit table (RED evidence, this session)

| # | Area | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | choose flow | **500 post-deduction** (MySQL `JSON_ARRAY_APPEND` on `rp_history`) → RP gone, doctrine applied, request failed, ledger entry lost | Live probe: 500 + `research_points: 0` + specialization row written. **FIXED (Phase 0): pg jsonb append per referralService precedent; re-probed 200** |
| 2 | bonuses | Zero consumers of any doctrine multiplier (repo census); only hits are the unrelated `BotSpecialization` bot enum | grep census |
| 3 | mastery XP | `AwardMasteryXPSchema` accepts unbounded positive int from the client; no server-side grantor exists | schema + caller census |
| 4 | mastery economy | `awardMasteryXP` + milestones have no gameplay effect (nothing amplifies) | consumer census |
| 5 | discoverability | No nav/link to `/game/specialization` anywhere | grep |
| 6 | doc drift | ARCHITECTURE.md lists `POST /api/specialization/upgrade` (real: `/mastery`); no dedicated design doc exists | doc read |
| 7 | contract drift | Route header + config promise "5 offensive/defensive/hybrid specialized units" — no doctrine-tagged blueprint exists | types/units.types.ts census |
| 8 | respec ledger | Respec deducts RP (atomic, conditional — good) but writes **no rpHistory entry** — ledger hole | source read |
| 9 | comment bug | "keep mastery progress, reset to 0 for new spec" — self-contradictory; behavior resets | source read |
| 10 | admin remnant | `app/api/admin/rp-economy/milestone-stats/route.ts` uses MySQL `JSON_EXTRACT` — same dead-SQL class, likely 500s | grep (not probed) |
| 11 | panel wiring | Panel GETs/POSTs all resolve (choose GET/POST, switch GET/POST, mastery GET/POST exist) | route exports census |
| 12 | persistence | `players.specialization` jsonb column + service shape are sound; choose/respec deductions are conditional and atomic | source read + live probe |

Cleared: level gate works (page + service); the panel's fetch contracts match the routes;
`Specialization` doc shape persists correctly (live-verified).

## 3. Doc review

No dedicated specialization design document exists — the "docs" are: the route headers
(the 3-doctrine bonus contract + the unbuilt specialized-units promise),
`docs/ARCHITECTURE.md` (progression endpoint list, drifted), and
`docs/RP_ECONOMY_GUIDE.md` (RP as the unlock currency — consistent with the service).
The Perfection Loop below therefore treats the service's own config as the design source
of truth and corrects the drift.

## 4. Perfection Loop on the system idea → converged plan

**Loop 1 — design audit of the idea as-shipped:**
- A doctrine that changes nothing is not a feature; the bonus multipliers must apply at
  exactly two seams: **unit cost calculation** (build time) and **army power computation**
  (battle time). Baking multipliers into stored unit stats is rejected: respec would
  invalidate every existing unit (correctness trap).
- Mastery must be **earned, never client-granted**: wire the service's own counters
  (`totalUnitsBuilt`, `totalBattlesWon`) as the XP source and lock the POST to admin.
- Mastery must **matter**: milestones/levels amplify the doctrine bonus — otherwise
  mastery is cosmetic.
- The "5 specialized units per doctrine" promise is **cut from the v1 contract**
  (deferred to its own future FID): doctrines already map onto existing unit categories
  (Offensive→strength, Defensive→defense, Tactical→balanced) — the honest, cheap v1.
- Discoverability + doc drift are part of the feature, not afterthoughts.

**Loop 2 — deep audit of the plan:** double-apply risk identified (existing
flag/shrine/achievement bonus stacks) → doctrine multiplier must join the existing
central power computation, not add a parallel one; `produceUnit` (factoryService) and
BOTH build-unit routes have independent cost math → all three sites consume one helper;
mastery XP values are economy knobs → pinned small (+10 matching build, +25 battle won,
100/level) and tunable; respec resets mastery (kept) with the comment fixed; jsonb
counter increments use the shim's verified dot-path `$inc`. Four other probes cleared
with evidence. No further actionable improvements — **converged in 2 of 10 iterations.**

### GREEN — updated plan (phased; Phases 1–3 gated on operator go-ahead)

| Phase | Scope | Files |
| --- | --- | --- |
| **0 (DONE)** | Dead-SQL fix in `chooseSpecialization` (pg jsonb append) — live-verified 200 | `lib/specializationService.ts` |
| **1 — make bonuses real** | `getDoctrineBonuses(player)` pure helper (doctrine → {strMul, defMul, metalCostMul, energyCostMul}); consume at the central army-power computation (audit for double-apply vs existing bonus stacks) + cost math in BOTH build-unit routes and `produceUnit` | `lib/specializationService.ts`, `lib/battleService.ts` (+ beerBase power path), both build routes, `lib/factoryService.ts` |
| **2 — earnable mastery** | Server-side `awardMasteryXP` hooks: matching-category unit builds (+10) and battles won (+25); counters via dot-path `$inc`; milestones amplify doctrine bonuses (+1%/milestone, capped); lock the mastery POST to admin (or delete the route and call the service internally) | `lib/specializationService.ts`, build/combat hooks, `app/api/specialization/mastery/route.ts` |
| **3 — finish the seams** | Nav entry to `/game/specialization`; fix ARCHITECTURE.md endpoint drift; respec writes its rpHistory ledger entry (dead-SQL class check); fix the self-contradictory respec comment; probe/fix the admin `JSON_EXTRACT` remnant | nav, docs, respec path, admin route |
| Deferred | "5 specialized units per doctrine" — own FID, own balance pass | — |

## 5. Verification (this session's work)

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test:ci` | **769 passed / 1 skipped / 0 failures** (Phase 0 is the only code delta; full-suite zero drift) |
| Live probe (before) | choose → **500**, RP deducted, doctrine applied, history lost (partial apply) |
| Live probe (after Phase 0) | choose → **200** `Successfully specialized in Offensive Doctrine!`, RP 25→0, doctrine + history persisted; scratch account cleaned up |

## 6. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] Phase 0 live-verified both directions · [x] Phases 1–3 implemented + live-verified 2026-09-15
- **Commit hash (G2):** `4237f51` (umbrella multi-stream commit, 2026-09-15; pre-merge hash — canonical: PR #41)
- **Staging plan:** `lib/specializationService.ts`, `lib/factoryService.ts`, `lib/battleService.ts` (doctrine-seam hunk), both build routes, `lib/statTrackingService.ts`, mastery route, milestone-stats route, `components/TopNavBar.tsx`, `docs/ARCHITECTURE.md`, `__tests__/lib/specializationDoctrine.test.ts`, `scripts/probeDoctrineSeams.ts`, `scripts/cleanupDoctrineProbe.ts`, this FID, `SCOPE.md`, `dev/session-summaries/SESSION-2026-09-14-009.md`

---

**Addendum 2026-09-15 (Phases 1–3 implemented, operator-directed):** the doctrine helper
(`getDoctrineBonuses` + fail-soft DB reads) is consumed at the power seam (`calculatePlayerPower`),
the combat seam (`resolveBattle`, inside the existing flag-bearer bonus stack — no parallel path),
and all three cost sites; mastery is earned server-side (+10 matching build, +25 battle won via
`statTrackingService` hooks; Tactical counts every build) and the client-grant exploit is closed
(POST → admin-only, live-probed 403). Respec writes its rpHistory ledger entry; nav entry added;
ARCHITECTURE.md `/upgrade` drift fixed; admin milestone-stats JSON_EXTRACT remnant migrated.
Live probe (production routes, guarded cleanup): baseline build 400/400 vs doctrine build 360/400
exact; power delta identity exact (P1−P0 = floor(400×1.15)−200); mastery XP 20 after 2 builds;
choose ledger balance exact; respec ledger −50 with mastery reset. **Verification finding (recorded,
not silently changed):** the 48h respec cooldown anchors only to `spec.lastRespecAt` — the initial
choose never sets it, so the first respec is always immediately available (the docs' letter says
"since last respec" and the code matches; economically harmless at 50 RP + 100k resources).
Recommendation: anchor the cooldown at choose (`lastRespecAt = selectedAt`) in a follow-up.
**Final status:** closed (commit `4237f51`, pre-merge hash; canonical: PR #41)
