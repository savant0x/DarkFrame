# FID-20260916-013: War scoring unification + capture-flow repair + capture UI

**Filename:** `FID-20260916-013-territory-capture-ui.md`
**ID:** FID-20260916-013
**Severity:** HIGH
**Status:** closed (commit `32464f0`)
**Created:** 2026-09-16

> **Design-history note (audit trail, condensed).** Original scope (dead-route UI wiring +
> strength-0 fix) was amended with A1–A3 (session 034), then expanded through six loop
> passes into a Siege Warfare redesign, then **discarded by operator ruling (pass 7)**:
> "a war is declared, player A from clan A attacks player B in clan B, battle results are
> logged as points. Whoever has the most points wins" — which probes showed War Engine v2
> already ships. Pass 8 (operator challenge: "this reads like an overview, not an actual
> FID") restructured this document to the template and pinned the strength design that
> pass 7 had deferred. The final scope is the minimal delta below. The follow-on FID
> (014) was deleted with the siege design; both research files remain on disk as
> direction-only precedent notes (operator rule: research is not law).

---

## 1. Summary

Wars already score real battles: PvP outcomes flow into `attackerScore/defenderScore`
(`battleService.ts:976-1002`), factory captures award +1 (`factoryService.ts:491`), the
panel displays both scores, and hourly settlement pays spoils. Three gaps break the
operator's points-war model: **(1)** territory-capture outcomes never feed points and
settlement ranks capture counts *above* total score (1 capture beats 99 battle wins);
**(2)** the capture route's flow is defective — it corrupts the defender's treasury on
success (A1), reports repels as successes (A2), maps refusals to 500s (A3), and derives
attacker strength from an unverified level curve that guarantees level-10+ wins (S1);
**(3)** the capture action has zero UI and its target enumeration is wrong for
multi-war clans. Fix all three against the existing schema — no migrations, no new
tables, no new jobs.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | Zero UI callers of the capture route | app/api/clan/warfare/capture/route.ts | grep `warfare/capture` across components/app/lib — only the route itself (sessions 034/035) |
| 2 | A1: success tx corrupts defender treasury | lib/clanWarfareService.ts:507-516 | defender `.set()` carries `bankTreasuryMetal/Energy: treasury.metal − cost` where `treasury` = **attacker's** row read at pre-check; attacker update has no treasury keys |
| 3 | A2: repel surfaces as success | lib/clanWarfareService.ts:487-492; route.ts:114-122 | repel returns `{ success: true, captured: false }`; route forwards `success` verbatim — contradicts the route's own docstring ("Failed Capture (success: false)") |
| 4 | A3: refusals → HTTP 500 | app/api/clan/warfare/capture/route.ts:132-141 | business-rule branch matches only `'No active war'`/`'not owned by target'`; `Daily capture limit reached…` and `Capture costs 25000…` fall to the generic 500 |
| 5 | S1: strength from unverified level curve | lib/clanWarfareService.ts:368-374 (scaffolding) | `deriveAttackerStrength`: level 10 → 8500 ≥ max wall 7500 → deterministic wins for all war-declaration-eligible clans; function is uncommitted, untested, lint-flagged |
| 6 | Capture outcomes score nothing; settlement ranks captures above points | lib/clanWarfareService.ts:630-638 | `settleDueWars`: `if (war.attackerCaptures > war.defenderCaptures) → ATTACKER_WIN` **before** any score comparison; `attemptTerritoryCapture` never touches `attackerScore/defenderScore` |
| 7 | Multi-war enumeration broken | lib/clanWarfareService.ts:927-934 (scaffolding `getCaptureTargets`) | unordered `.limit(1)` on outgoing ACTIVE wars; `declareWar` enforces pair-uniqueness only, so multiple outgoing wars are legal — UI would show one arbitrary war |
| 8 | C1: snapshot-then-write on capture path | lib/clanWarfareService.ts:438-463, 497-533 | treasury/territories/captureDay read before `db.transaction`, written from snapshots; grep `.for('update')` in lib = 0 hits |
| 9 | Scaffolding is unverified working-tree state | ClanTerritoryPanel.tsx:57,67; working tree | `npm run lint` fresh run: **3 errors, all scaffolding** (`'canCapture' is defined but never used`, `'CaptureTargetsResponse' is defined but never used`, +1); gates otherwise clean: tsc exit 0, vitest **951 passed / 1 skipped** |
| 10 | War-points feed exists and is live | battleService.ts:976-1002; factoryService.ts:484-491; ClanWarfarePanel.tsx:416-422 | `recordWarBattleOutcome(winnerClanId, loserClanId, battleId)` on every PvP outcome (+1); factory capture → +1; panel renders `attackerBattlesWon/defenderBattlesWon` |

**Scale probe (drives the S1 fix):** `PlayerUnit` carries `strength/defense/quantity`
(types/game.types.ts:1981-1993); battleService aggregates `totalSTR += strength ×
quantity` (battleService.ts:1193). Live armies measure **10⁵–10⁶ STR** (session 014-007
evidence: power 50,110 vs defense 1,000; raid sweeps in the millions). The old 5,000
wall is 2–3 orders of magnitude below real armies — dropping raw army power into the
old comparison would make every capture trivial. Both sides must be measured on the
same real scale.

**Call-graph notes (Law 4):** production reach of the affected seam is exactly:
`POST /api/clan/warfare/capture` (no UI caller today — finding #1) → `captureTerritory`
→ `attemptTerritoryCapture`. Direct service callers: none in production
(`clanWarfareV2.test.ts` imports only `WAR_CONSTANTS`, `recordWarBattleOutcome`,
`settleDueWars` — exports preserved by this FID). Scaffolding (`deriveAttackerStrength`,
`getCaptureTargets`, targets route, panel imports) has zero production callers — safe to
remove/rewrite.

## 3. Impact Analysis

- **Who/what is affected:** `POST /api/clan/warfare/capture` + its (rewritten) targets
  GET; `ClanTerritoryPanel`; war settlement outcomes for warring clans; clan treasuries
  (A1 currently corrupts the defender's); war-score integrity (points vs captures).
- **Failure modes if unfixed:** every capture success overwrites the defender's treasury
  with attacker-derived numbers (economically destructive, possibly negative); a UI
  built on the route's documented contract toasts victory on repels; cap/treasury
  refusals surface as 500s; wars resolve on capture-count precedence, contradicting the
  operator's points model; the headline war action remains UI-less.
- **Blast radius of the fix:** directly modifies one service (capture flow + settlement
  precedence + new pure helpers), one route's error mapping, one route's response shape,
  one panel section, one test file. Does NOT touch: `resolveBattle`, raid/PvP paths,
  `recordWarBattleOutcome` semantics, war declaration, cooldowns, spoils, income
  collection, territory claims. Transitive: the panel's war-captures section is new UI
  reachable from the existing territories tab.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — multi-war clans (enumeration lists all outgoing wars); defender clans with empty/small armies (power floor = shipped 5,000 wall keeps captures non-trivial); non-officers (read-only section); self-capture impossible (war is pair-unique and direction-gated; `declareWar` blocks self-war). |
| Scales? | Yes — army-power aggregation bounded by members-per-clan scan (≤100 per the existing notification pattern) × per-player unit jsonb; score/counter increments are O(1) SQL (`col + n`); no new tables or jobs. |
| Survives a hostile attacker? | Yes — score increments are server-side SQL; A1's corruption becomes structurally impossible (treasury keys on one row only, debit inside the tx after the sufficiency pre-check); daily cap (3) + 25k cost kept; type validation on body already present; no client-trusted inputs added. |
| Maintainable in 2 years? | Yes — reuses shipped idioms (`sql\`${col} + n\`` increments, route error-mapping structure, panel modal/toast patterns, `totalSTR += strength × quantity` aggregation); one documented constant addition (`CAPTURE_WIN_POINTS`). |
| Sets the standard? | Yes — honest contested odds disclosed verbatim, points-first settlement, no silent scope absorption; the loop record itself is the audit trail. |

## 5. Proposed Fix (GREEN)

- **Approach:** keep War Engine v2 exactly as shipped; make capture outcomes first-class
  point events; settle on total points; repair the capture flow's four defects with the
  minimal, scale-correct strength derivation (both sides' real army power, floored by
  the shipped wall constant); wire the UI through the rewritten multi-war enumeration.
- **Alternatives considered:** Siege Warfare redesign (army commitment, hold windows,
  fortifications, feuds) — discarded by operator ruling (over-built; the points war
  already exists, see §history note); pure-points with capture deferred — rejected by
  operator (capture stays a scoring action); territory as primary settlement objective —
  rejected by operator (points-first); level-based strength curves — rejected (deterministic
  at level ≥ 10, ignores armies); raw army power with no floor — rejected (empty-defender
  captures become free).

### Strength derivation (S1 fix — pinned here, no implementation-time latitude)

`computeClanArmyPower(clanId): Promise<number>` — pure aggregation over the clan's
members' `players.units`: **Σ (unit.strength × unit.quantity)** for all member players
(the battleService.ts:1193 idiom; member scan capped at 100 players, matching the
`notifyBothClans` cap). Capture roll replaces the old defense-wall comparison (S1 fix — pinned here, no implementation-time latitude):

```
defenderWall = max(computeClanArmyPower(defenderClanId), 5000) × (1 + adjacencyBonus/100)
captured := attackerPower × (1 + (Math.random() × 2 − 1) × CAPTURE_JITTER) ≥ defenderWall
```

- Both sides measured on the same real scale (10⁵–10⁶); `CAPTURE_JITTER` (±15%) and the
  5,000 floor are shipped constants (`WAR_CONSTANTS`, current code) — nothing new invented;
  adjacencyBonus is the existing `clanDefenseBonus` (0–50%).
- Equal-power clans ≈ 50%; a 2× attacker wins within jitter; a paperclip-clan defender
  holds the shipped 5,000 wall (old behavior). Contested by construction.

**Completeness audit (pass 9, operator challenge: "does this cover the complete system?").**
The full player journey, beat by beat: declare war (ships) → fight and score (ships:
battleService/factoryService feeds) → see the score (ships: panel) → capture territory for
points (this FID: fixed roll + A1–A3 + UI) → see capture outcomes (this FID: TERRITORY_
CLAIMED/LOST activity events + notifications, already wired via notifyBothClans) → settle
by points with spoils (ships; precedence fix in this FID) → cooldown and rematch (ships).
Every beat is either already live or in the changes table — **no phase-2 remnants**.
Deliberate non-goals (excluded by operator ruling or concern class, not deferred phases):
siege mechanics (discarded), snapshot-writer hardening for claims/distributions (separate
FID class, recorded), auto income collection (unrelated to war scoring).

### Changes

| File | Action | Description |
| ---- | ------ | ----------- |
| lib/clanWarfareService.ts | modify | Remove scaffolding `deriveAttackerStrength` + `getCaptureTargets` (and the session-034 docstring blocks); add exported pure `computeClanArmyPower`; in `captureTerritory` pass `attackerPower` (was strength); in `attemptTerritoryCapture`: `defenderWall` per the formula above (replaces the 5000-only wall), **A1** (success tx: attacker update carries the treasury debit; defender update touches only `territories` + `statsTotalTerritories−1`), **scoring** (success: `attackerScore += CAPTURE_WIN_POINTS(2)`; repel: `defenderScore += 1` — both as `sql\`+n\`` inside the existing transactions, same idiom as `recordWarBattleOutcome`), capture/repel counters unchanged; **activity feed** (completeness gap, pass 9): success → `logClanActivity(attackerClanId, TERRITORY_CLAIMED, playerId, { warId, tileX, tileY, targetClanId })` + `logClanActivity(defenderClanId, TERRITORY_LOST, …)` (existing enum members, territoryService precedent); repel → `logClanActivity(defenderClanId, WAR_REPELLED…)` — no such member exists, so repel logs nothing (disclosed: not silently invented; the verbatim toast + notification already cover it) |
| lib/clanWarfareService.ts | modify | `captureTerritory` wrapper: `success := result.captured` (**A2** — restores the route contract; low-level `{ success, captured }` shape unchanged) |
| lib/clanWarfareService.ts | modify | `settleDueWars`: outcome decided by `attackerScore vs defenderScore` **first**; `attackerCaptures/defenderCaptures` remain displayed stats; TRUCE fallback unchanged (**finding #6**) |
| lib/clanWarfareService.ts | modify | `getCaptureTargets` rewritten: all outgoing ACTIVE wars → `{ activeWars: [{ warId, defenderClanId, defenderTag, capturesToday, capturesCap, targets: [{ tileX, tileY, defenseBonus }] }] }` (no `limit(1)`; **finding #7**) |
| app/api/clan/warfare/capture/route.ts | modify | **A3:** extend the 400 business-rule branch with exact prefixes `Daily capture limit reached` and `Capture costs`; update the docstring to the restored contract (`success ≡ captured`; repel = HTTP 200 `success:false` + verbatim message) |
| app/api/clan/warfare/capture/targets/route.ts | rewrite | Return the multi-war shape above (`wars` array; empty → UI guidance state); `requireClanMembership` gate kept |
| components/clan/ClanTerritoryPanel.tsx | modify | Revert session-034 scaffolding imports (fixes lint finding #9); **fetch `GET /api/clan/warfare/capture/targets` on mount** (the rewritten route IS this section's data source — the panel currently fetches no war state, FID §R7 lineage); add "War captures" section: per outgoing war — defender tag, `capturesToday/cap`, enemy tile list (coords + defense bonus), capture button per tile (officer+ gate mirroring server `requireRole`); confirm-then-fire POST `{ targetClanId, tileX, tileY }`; captured → success toast + refresh; repel (200, `success:false`) → verbatim server message via toast; 4xx → verbatim; non-officers read-only with the standard note; no-wars → guidance pointing at the Warfare tab |
| __tests__/lib/clanWarfareV2.test.ts | modify | Pins: settlement score-first precedence (1 capture vs 99 battle wins → score wins); capture success → `attackerScore +2` in-tx; repel → `defenderScore +1`; `computeClanArmyPower` (empty clan → 0, multi-member sum); capture resolution boundaries (floor wall; equal powers ≈ coin-flip band; 2× wins); wrapper `success ≡ captured` |
| components/clan/ClanTerritoryPanel.test.tsx (or nearest existing convention) | create/modify | Render pins for the war-captures section: multi-war listing, officer-gated buttons, repel toast shows verbatim message |

**C1 (scoped, not absorbed):** capture-path writes move fully inside their transactions;
sibling snapshot-based writers (claims, distributions) remain their own future FID —
recorded, not silently taken.

### Verification plan (protocol.config.yaml gates)

- `npx tsc --noEmit` → 0 errors (current: 0 — held through implementation)
- `npm run lint` → 0 errors / 0 warnings (current: 3, all scaffolding — must drop to 0
  after the revert; 0 is the pass condition)
- `npm run test:ci` → all suites pass (current baseline: 951 passed / 1 skipped; new pins
  add to the count, nothing turns red)
- Double audit: Method 1 = the gates above (output pasted in §7); Method 2 = manual
  re-read of every changed file against §5's table (line-by-line, 0-EOF).

### Call-graph reachability plan (Law 4)

Post-implementation greps that must each return ≥1 production hit:
1. `grep -rn "warfare/capture" components/` → the panel's POST fetch (UI wired)
2. `grep -rn "capture/targets" components/` → the panel's enumeration fetch
3. `grep -n "computeClanArmyPower" lib/clanWarfareService.ts` → called from `captureTerritory`
4. `grep -n "getCaptureTargets" app/api/clan/warfare/capture/targets/route.ts` → route imports the rewritten service function
5. `grep -n "attackerScore" lib/clanWarfareService.ts` → scoring increments present in the capture path

## 6. Audit Record

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis (pre-implementation baseline) | Gates on the current tree (scaffolding present) | `npx tsc --noEmit` → `TSC_EXIT=0`; `npm run lint` → `3 problems (3 errors, 0 warnings)` — all three in session-034 scaffolding; `npm run test:ci` → `951 passed / 1 skipped (952)` | baseline recorded; lint=0 is the implementation pass condition |
| Method 2: manual re-read against this FID | Every section re-read against the template + codebase; strength-scale probe executed (armies 10⁵–10⁶ vs 5,000 wall); changes table traced file-by-file to RED findings #1–#9; Five Questions answered with mechanism, not assertion | read_files (template 0-EOF, service 0-EOF, routes 0-EOF, panel) + grep outputs in §2 | pass |

- Audit outcome: **PASS → status `loop-complete`** (the document converged; implementation
  is a separate, operator-gated step). Circuit-breaker log: 9 loop passes total (under
  the 10 cap); passes 2/5/6 superseded by operator rulings (recorded, not silent); pass 8
  = template restructuring + strength pinning (operator challenge); pass 9 = completeness
  audit (operator challenge) — activity-feed gap added to the changes table, data-source
  row pinned, full journey walked beat-by-beat in §5; no oscillation.

## 7. Implementation Record (only after operator go-ahead)

- **Status:** complete (2026-09-17)
- **Files changed (9):** lib/clanWarfareService.ts (scoring +2/+1, A1/A2, army-power formula,
  `computeClanArmyPower`, feed events, settle precedence, multi-war `getCaptureTargets`,
  scaffolding `deriveAttackerStrength` removed); app/api/clan/warfare/capture/route.ts (A3 map +
  contract docstring); app/api/clan/warfare/capture/targets/route.ts (multi-war shape);
  components/clan/ClanTerritoryPanel.tsx (scaffolding revert + War Captures section);
  __tests__/lib/clanWarfareV2.test.ts (+9 pins); __tests__/clan/ClanTerritoryPanel.warfare.test.tsx
  (new, 6 pins); SCOPE.md (session record). Session-034 scaffolding: **reverted** (disposition closed)
- **Verification evidence (fresh, post-final-edit):** `npx tsc --noEmit` → `TSC_EXIT=0` ·
  `npm run lint` → `LINT_EXIT=0` (the 3 scaffolding errors gone with the revert) ·
  `npm run test:ci` → `966 passed / 1 skipped (967)` (baseline 951/1 → +16 new pins, 0 red)
- **Call-graph reachability evidence (Law 4):** `captureTerritory` → capture route:104 (sole caller);
  `getCaptureTargets` → targets route:42 (sole caller); `settleDueWars` → clanWarSettlementManager:52;
  `recordWarBattleOutcome` → battleService (score feed); `computeClanArmyPower` → captureTerritory:872
  + attemptTerritoryCapture:483. All ≥1 production hit
- **Mid-flight finding (pass-fail honesty):** the first suite run surfaced that `logClanActivity`/
  `notifySystem` mocks returned `undefined` where the code awaits `.catch(...)` — test-suite defect,
  fixed in mocks; production code unchanged. The §5 "confirm-then-fire POST" row was under-built
  (fired immediately); aligned to the FID (window.confirm guard) and pinned in tests
- **C1 scope note:** capture-path writes sit inside their transactions; sibling snapshot writers
  (claims/distributions) remain a separate future FID per §5

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass · [x] call-graph proven
- **Commit hash (G2):** `32464f0365d6d74d70446926cf5bd7777ae31a9d` — committed 2026-09-17 on operator
  go-ahead ("run it yourself"); `fix(clan): unify war scoring, repair capture flow, wire capture UI (FID-20260916-013)`;
  12 files, +1866/−251; pre-commit hook clean. Follow-up commit closes the FID (this file, archived), SCOPE row,
  VERSION 0.0.1→0.0.2, CHANGELOG entry
- **Staging plan (path-scoped, G3/G4):** single logical-atomic commit —
  `git add lib/clanWarfareService.ts app/api/clan/warfare/capture/route.ts app/api/clan/warfare/capture/targets/route.ts components/clan/ClanTerritoryPanel.tsx __tests__/lib/clanWarfareV2.test.ts` (+ the panel test file)
- **Commit message (G8):** `fix(clan): unify war scoring, repair capture flow, wire capture UI (FID-20260916-013)`
- **Archive:** DONE 2026-09-17 → `dev/fids/archive/` + CHANGELOG entry (0.0.2) + session-summary log
  (SESSION-2026-09-17-035.md)

---

**Final status:** loop-complete → implemented → **closed 2026-09-17 (commit `32464f0`)**
