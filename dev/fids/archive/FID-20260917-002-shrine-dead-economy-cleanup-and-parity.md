# FID-20260917-002: Shrine dead-economy cleanup — delete orphaned sacrifice/extend, wire live-route parity

**Filename:** `FID-20260917-002-shrine-dead-economy-cleanup-and-parity.md`
**ID:** FID-20260917-002
**Severity:** MEDIUM
**Status:** closed
**Created:** 2026-09-17

---

## 1. Summary

The feature survey (row 69/73) flagged `POST /api/shrine/extend` as a missing-UI gap. Grounding
dissolved that premise: the live `ShrinePanel` already extends boosts through `POST /api/shrine/activate`
("Replace / Extend" → remaining time + new duration, 8h cap). What actually exists is a **dead second
economy**: two uncalled routes (`sacrifice`, `extend`) — one carrying a phantom tier and a divergent
rarity table, the other the sole writer of `shrineTradeCount`/shrine XP — plus two parity holes in the
LIVE routes: the SHRINE_DEVOTEE achievement is unreachable through the live UI, and shrine presence is
enforced only by the client. Resolution (operator-ratified Option B, 2026-09-17): delete both dead
routes and their schema, wire `trackShrineTrade` + `awardXP` + server-side presence into the live pair.

## 2. Evidence (RED)

All findings cataloged before any fix is designed. Every claim below is backed by this session's
fresh tool output (read_files 0-EOF + ripgrep censuses, 2026-09-17).

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | `POST /api/shrine/extend` has ZERO client callers | app/api/shrine/extend/route.ts (whole file) | `grep -rn "shrine/(extend\|activate\|boost-all\|sacrifice\|status)" components/` → only `ShrinePanel.tsx:252` (activate) and `:294` (boost-all) |
| 2 | extend accepts phantom tier `'speed'` — not a `ShrineBoostTier`, can never match an active boost | app/api/shrine/extend/route.ts:107 | `if (!tier \|\| !['speed', 'heart', 'diamond', 'club'].includes(tier))` — schema `ShrineBoostTier` = spade/heart/diamond/club |
| 3 | extend's rarity table diverges from the canonical one | app/api/shrine/extend/route.ts:27-33 vs utils/shrineHelpers.ts:24-30 | extend: Rare=30min, Epic=60min · shrineHelpers (`RARITY_DURATION_MINUTES`): Rare=60, Epic=90 — items under-valued 2×/1.5× vs every other shrine surface |
| 4 | `POST /api/shrine/sacrifice` has ZERO client callers; its fixed-cost model (3/10/30/60 items) is superseded by direct time purchase | app/api/shrine/sacrifice/route.ts:23-52 | caller grep (above) returns no sacrifice hit; BOOST_TIERS fixed `itemCost` vs activate's rarity-priced `itemCount` |
| 5 | sacrifice is the SOLE writer of `shrineTradeCount` + shrine XP → SHRINE_DEVOTEE achievement unreachable via the live UI | app/api/shrine/sacrifice/route.ts:181-184; lib/achievementService.ts:155-162,286-287; lib/xpService.ts:94 | `grep trackShrineTrade\|awardXP lib/xpService app/api/shrine/` → sacrifice only; achievement needs `shrineTradeCount >= 100`, fed only by the dead route |
| 6 | LIVE `activate`/`boost-all` lack the server-side shrine-presence check that sacrifice (101-115) and extend (104-115) enforce | app/api/shrine/activate/route.ts (absent between player fetch and inventory read); app/api/shrine/boost-all/route.ts (same) | reads 0-EOF: no `tilesCollection`/`TerrainType.Shrine` check in either — off-shrine API use is client-gated only (same class as FID-20260916-002/-009 enforcement findings) |
| 7 | sacrifice's already-active error text directs players to the dead route | app/api/shrine/sacrifice/route.ts:143 | `"…Use /api/shrine/extend to extend its duration."` |
| 8 | `ShrineSacrificeSchema` embeds the same phantom `'speed'` tier; its sole consumer is the dead sacrifice route | lib/validation/schemas.ts:446-451 | `grep ShrineSacrificeSchema` → definition + sacrifice route import only |
| 9 | DISCOVERED, NOT ABSORBED: `GET /api/shrine/status` also has zero client callers; `activityLogger` maps two nonexistent routes (`/api/shrine/visit`, `/api/shrine/boost`) | app/api/shrine/status/route.ts; lib/middleware/activityLogger.ts:88-90 | components census → 0 hits for status; no route file exists at visit/boost → recorded as `[OPEN-OUT-OF-SCOPE]` for operator decision |

**Call-graph notes (Law 4):** Production reachability today: `ShrinePanel` → `POST /api/shrine/activate`
and `POST /api/shrine/boost-all` (the only wired shrine writes). `sacrifice`/`extend`/`status` are
reachable by nothing in the client; their only "callers" are each other's error text and history docs.

## 3. Impact Analysis

- **Who/what is affected:** shrine write surface (2 routes deleted, 2 modified), validation schema
  block, shrine test harness. Players gain: working achievement path, server-enforced presence,
  one rarity table. No DB/schema changes; `shrineBoosts` shape untouched.
- **Failure modes if unfixed:** SHRINE_DEVOTEE permanently unearnable; off-shrine boost activation
  possible for anyone with a session (client gate only); future contributors misled by two competing
  rarity tables and a schema advertising a tier that cannot exist.
- **Blast radius of the fix:** direct — the four shrine route files, one schema block, two test files.
  Transitively — nothing imports the deleted routes or schema (censused); `trackShrineTrade`/`awardXP`
  gain callers (no signature change); `calculateDuration` already canonical.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | YES — parity wiring covers both live routes; presence enforced server-side regardless of client; XP once-per-transaction for both single and boost-all |
| Scales (design tolerates growth; harness reference is 1000 agents)? | YES — two `await`ed service calls per transaction, same cost profile as every other XP-awarding route |
| Survives a hostile attacker, not just an honest user? | YES — the off-shrine exploit closes server-side; XP farming via boost-all capped at one award per call (operator ruling 2026-09-17); secondary bookkeeping failures cannot corrupt the primary transaction (independent error handling) |
| Maintainable in 2 years? | YES — one shrine economy, one rarity table (`shrineHelpers`), phantom schema gone; error text no longer points at deleted routes |
| Sets the standard for the industry? | YES — dead-economy deletion with census-proven zero callers, parity enforced at the seam, achievement loop closed by evidence |

## 5. Proposed Fix (GREEN)

Minimal changes that answer all Five Questions. Most robust defaults chosen.

- **Approach:** delete the dead economy outright (Option B, operator-ratified) rather than repair or
  wire it — it is redundant with the live model and carries the only two corrupted artifacts (phantom
  tier, divergent table). Wire the live pair to the parity contract the dead route used to own.
- **Alternatives considered:** (A) keep sacrifice in place — rejected: retains an uncalled second
  economy and the misleading "Use /api/shrine/extend" pointer; (C) repair extend + add UI — rejected:
  two extension paths and two rarity tables violate one-truth; the live activate already extends.
- **XP/count policy (operator ruling, 2026-09-17):** once per transaction — activate = 40 XP +
  1 `shrineTradeCount`; boost-all = same ONCE per call (one trade, four suits). Matches sacrifice's
  contract; keeps the 100× achievement meaningful.

**Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| app/api/shrine/extend/route.ts | delete | dead orphan: zero callers, phantom 'speed' tier, divergent rarity table |
| app/api/shrine/sacrifice/route.ts | delete | uncalled legacy fixed-cost economy; its parity duties transfer to the live pair |
| lib/validation/schemas.ts | modify | remove `ShrineSacrificeSchema` + `ShrineSacrificeRequest` (sole consumer deleted) |
| lib/shrineServer.ts | create | shared server-side presence helper `assertAtShrine(player): Promise<boolean>` — the tiles findOne check that sacrifice/extend inlined (Law 13: with the dead routes deleted the pattern still appears in TWO live routes → one truth); helper does the `getCollection<Tile>('tiles').findOne({ x: player.currentPosition.x, y: player.currentPosition.y })` query and terrain comparison; routes own their refusal responses |
| app/api/shrine/activate/route.ts | modify | (1) server-side presence check after player fetch via `assertAtShrine` — refuse non-Shrine with sacrifice's message shape (`ErrorCode.VALIDATION_FAILED`, "You must be at the Shrine of Remembrance (1,1) to activate boosts"); (2) after the DB write, `trackShrineTrade(username)` + `awardXP(username, XPAction.SHRINE_SACRIFICE)` once, each in its own try/catch (log.warn on failure — primary transaction already committed must not be reported as failed); (3) response gains `xpAwarded`/`levelUp`/`newLevel` when available |
| app/api/shrine/boost-all/route.ts | modify | identical parity: presence refusal via `assertAtShrine` + ONE `trackShrineTrade` + ONE `awardXP` per call (operator ruling: one transaction = one trade) after the DB write, same independent error handling and response enrichment |
| __tests__/api/shrine/activate.test.ts | modify | mock `getCollection` distinguishes 'players' (player fixture) from 'tiles' (Shrine tile); add pins: presence refusal (400, zero updateOne), off-shrine refusal, XP+count wired on success (mocked `lib/xpService`/`lib/statTrackingService`), bookkeeping failure does not fail the transaction |
| __tests__/api/shrine/boost-all.test.ts | create | harness mirrors activate.test.ts; pins: all-four activation parity, once-per-transaction XP/count (awardXP called exactly once), presence refusal |

- **Verification plan:** `npx tsc --noEmit` → 0; `npm run lint` → 0; `npm run test:ci` → all pass,
  count grows from the 975 baseline by the new pins; deletion greps: `shrine/(sacrifice|extend)` →
  zero hits outside dev/ archives/docs. Optional live probe (FID-010/011 driver pattern, PORT=3002):
  off-shrine activate → 400 with the presence message + zero DB mutation; on-shrine activate → 200
  with `xpAwarded: 40` + `stats.shrineTradeCount` incremented.
- **Call-graph reachability plan:** (1) `grep -n "api/shrine/activate\|api/shrine/boost-all" components/`
  → ShrinePanel lines 252/294 (unchanged, live); (2) `grep -n "trackShrineTrade\|awardXP" app/api/shrine/`
  → present in BOTH live routes; (3) `grep -rn "ShrineSacrificeSchema" lib/ app/` → 0; (4) `grep -rn "assertAtShrine" lib/ app/`
  → helper definition + ≥2 production call sites; (5) presence-check execution proven by the new pins
  (400 + zero updateOne on off-shrine fixture).

## 6. Audit Record

Double audit — two independent methods, evidence pasted, no self-reporting.

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis (typecheck/lint/tests) | document-only session; gates must show zero code drift at loop-complete | `npx tsc --noEmit` → `TSC_EXIT=0` · `npm run lint` → `LINT_EXIT=0` · `npm run test:ci` → `975 passed \| 1 skipped (976)`, exit 0 (2026-09-17, post-final-edit) | pass |
| Method 2: manual re-read against this FID | every RED claim re-traced to a pasted grep/0-EOF read from this session; GREEN symbols verified to exist (`trackShrineTrade` statTrackingService:166, `awardXP`/`XPAction.SHRINE_SACRIFICE` xpService:94, `calculateDuration` shrineHelpers:41, `ShrineSacrificeSchema` sole-consumer census 4 matches); Law-7 name check: `lib/shrineServer.ts` does not exist; no boost-all test file exists | read_files + grep outputs in §2 | pass |

- Audit outcome: **PASS → `loop-complete`** (loop 2; 1 GREEN refinement — shared `assertAtShrine`
  helper per Law 13; delta well under the 10% circuit-breaker cap; no oscillation). |
- Circuit breakers: track change % per pass (10% cap), convergence (<2% delta across 2 passes),
  oscillation (same issue 3×), hard stop (10 iterations).

## 7. Implementation Record (only after status reaches `loop-complete`, with operator go-ahead)

- **Status:** done

- **Files changed:**

| File | Action | Notes |
| ---- | ------ | ----- |
| app/api/shrine/extend/route.ts | delete | dead orphan removed (`rm`; zero callers, phantom 'speed' tier, divergent rarity table) |
| app/api/shrine/sacrifice/route.ts | delete | uncalled legacy fixed-cost economy removed (`rm`); parity duties transferred to the live pair |
| lib/validation/schemas.ts | modify | `ShrineSacrificeSchema` + `ShrineSacrificeRequest` + the SHRINE schema banner removed (sole consumer deleted) |
| lib/shrineServer.ts | create | `assertAtShrine(player)` — shared fail-closed tiles check; one truth for both live write routes |
| app/api/shrine/activate/route.ts | modify | presence refusal after player fetch; `trackShrineTrade` + `awardXP(SHRINE_SACRIFICE)` once per transaction after the primary write, each guarded independently (log.warn, never a failure response); response enrichment `xpAwarded/levelUp/newLevel` |
| app/api/shrine/boost-all/route.ts | modify | identical parity; ONE trade + ONE XP award per call (operator ruling: four suits = one transaction) |
| __tests__/api/shrine/activate.test.ts | modify | collection-aware mock (players vs tiles) + mocked bookkeeping modules; 5 FID-028 pins preserved, 4 new parity pins (off-shrine refusal w/ zero mutation, fail-closed null tile, once-per-transaction wiring, bookkeeping-outage resilience) |
| __tests__/api/shrine/boost-all.test.ts | create | 4 pins: all-four parity + single $set write, off-shrine refusal, once-per-call XP/count, bookkeeping resilience |

- **Implementation disclosures (Law 3 self-corrections, both repaired in-flight):**
  1. A mid-flight edit briefly corrupted boost-all's `$set` payload (`existingBoosts 4/4`) —
     caught on the next read of the edit output, repaired, and swept: `grep "existingBoosts 4/4\|Fcatch" app/ lib/ components/` → `CORRUPTION_RESIDUE=0`.
  2. Post-deletion tsc surfaced 6 errors **entirely inside stale `.next/types/` generated
     artifacts** referencing the deleted routes (the ledger's known tsbuildinfo-class hazard);
     stale artifacts removed, cold `npx tsc --noEmit` → 0. No source error existed.

- **Verification evidence (fresh, post-final-edit):**

```
npx tsc --noEmit → TSC_EXIT=0  (cold, after stale .next/types cleanup)
npm run lint     → LINT_EXIT=0
npm run test:ci  → Test Files 100 passed | 1 skipped (101) · Tests 983 passed | 1 skipped (984)
                   (baseline 975+1 → +8 new pins; the only ⚠️ lines are the pre-existing
                   MovementControls /api/research environment warning, present pre-session)
```

- **Call-graph reachability evidence (Law 4 greps, pasted):**

```
1. live panel → routes: components/ShrinePanel.tsx:252 (activate), :294 (boost-all) — unchanged, live
2. parity writers in BOTH live routes: activate/route.ts:189-190, boost-all/route.ts:200-201
3. ShrineSacrificeSchema census lib/ app/ __tests__/ → SHRINE_SCHEMA_HITS=0
4. assertAtShrine: lib/shrineServer.ts:29 (def) + activate:90 + boost-all:89 (production calls)
5. dead-route refs app/ lib/ components/ __tests__/ → DEAD_ROUTE_HITS=0
6. corruption residue → CORRUPTION_RESIDUE=0
```

## 8. Closure

- **Gates:** [x] typecheck 0 errors · [x] lint 0 errors/0 warnings · [x] tests pass (983+1) · [x] call-graph proven
- **Commit hash (G2 — required for `closed`):** `b11c370` (fix commit, 8 files +366/−476; related follow-on `16a7fcb` deletes the third shrine orphan + dead logger mappings per SCOPE #75). The optional live E2E driver is staged at `scripts/e2eShrine.ts` pending a dev-server boot (operator-side; BACKGROUND process execution unavailable to the agent this session) — the implementation gates stand on the unit-pin suite.
- **Staging plan (path-scoped, G3/G4):** `git add app/api/shrine lib/validation/schemas.ts __tests__/api/shrine dev/fids/FID-20260917-002* SCOPE.md dev/session-summaries CHANGELOG.md VERSION` — logical-atomic, one concern
- **Commit message (G8):** `fix(shrine): delete dead sacrifice/extend economy, wire trade parity + presence enforcement (FID-20260917-002)`
- **Archive:** moved to `dev/fids/archive/` on close; CHANGELOG entry appended; archival logged in session summary.

---

**Final status:** closed (G2: `b11c370`)
