# FID-20260916-009: protection-window mechanics audit — expiry, re-trigger, clock skew, NULL handling

**Filename:** `FID-20260916-009-window-mechanics-audit.md`
**ID:** FID-20260916-009
**Severity:** MEDIUM (aggregate — no enforcement hole; drift + latent schema hazard)
**Status:** closed (2026-09-16, commit `a324cee` — implemented + verified)
**Created:** 2026-09-16

---

## 1. Summary

With every PvP surface now carrying protection seams (-002/-004/-005/-007/-008 closed),
this audit turns the FID-006 question inward: are the window **mechanics** themselves
sound? Scope: expiry comparison semantics, issuance/re-trigger paths, clock-source and
skew behavior, NULL/corrupt handling, and reader-side consistency. Method: full read of
`lib/playerProtection.ts` (the -002 loop-complete artifact), census of every
`protectionUntil` writer/reader, migration DDL, and client display paths.

**Headline: no enforcement hole found.** Every live refusal site degrades safely and
compares consistently. The material findings are *drift* (two hand-rolled predicate
copies that bypass the canonical one) and a *latent schema hazard* (`timestamp`
without timezone) — plus one dead creation path worth removing.

## 2. Ground-truth inventory (verified this session)

| Role | Site | Notes |
| --- | --- | --- |
| Column | `players.protection_until` — `timestamp` (no tz), nullable (`lib/db/schema/players.ts:101`, migration `0004_*.sql:2`) | Drizzle default mode: JS Date |
| Issuance | `playerService.ts:463` (`createPlayerWithAuth`) via `newPlayerProtectionUntil()` | The **only** fresh-window writer |
| Void | `playerProtection.ts:63` `voidProtectionOnAggression` | `isNotNull` predicate → honest no-op when already NULL; failure logged, not rethrown |
| Canonical predicate | `playerProtection.ts:39` `protectionActive` — strict `>`, NaN → false (degrade-open, Law 14) | Explicit `now` injection for testability |
| Enforcement readers (canonical) | infantry route :113, battle route :85, factoryService :391, spyService :522 + owner-resolve :1315 | All pass the raw column |
| **Drifted copies** | `movementService.ts:87` (tile intel), `wmd/targetingValidator.ts:37` (WMD targeting) | Hand-rolled `!= null && new Date(...) > now` — see F1 |
| Display | `lib/protectionDisplay.ts`, `StatsPanel.tsx:207/398` | `ms <= 0 → null`; 30s re-render tick |
| Other insert paths | `createPlayer` (no-auth), botSummoningService, flagBotService, admin bot-spawn | None set `protectionUntil` → born unprotected |

## 3. Findings

### F1 — Predicate drift: two hand-rolled copies of "protected right now?" — MEDIUM

- `targetingValidator:37`: `target.protectionUntil && new Date(target.protectionUntil) > new Date()` —
  behaviorally equivalent **today** (strict `>`; `NaN > x` is false → corrupt values
  degrade open, same as the canonical predicate, but by accident of JS comparison
  semantics, not by design). Its refusal message `'Target is under protection'` also
  diverges from `PROTECTION_REFUSAL_REASON` — user-facing parity drift across surfaces.
- `movementService:87`: same shape; feeds the client `baseProtected` tile flag (intel
  only — refusal authority stays with the five canonical sites; server always re-decides).
- Risk: the -002 spec names `protectionActive` "the single truth". When the semantics
  evolve (time source, tz handling, corruption policy), copies rot silently — the exact
  class the -007 grounding exposed elsewhere (route/service contract drift).
- **Disposition: refactor both call sites to `protectionActive`** (+ use
  `PROTECTION_REFUSAL_REASON` in targetingValidator). Import edges
  (movementService/targetingValidator → playerProtection) are acyclic — playerProtection
  imports only db + schema. Behavior-preserving today except message parity.

### F2 — `timestamp` without timezone — ~~MEDIUM (latent)~~ **HIGH (live defect on non-UTC hosts — corrected by execution probe, see erratum)**

All writers/reads go through node-pg's Date serialization: write = UTC instant rendered
as naive literal; read = literal reinterpreted as UTC. **Round-trip is lossless for every
current code path** — no behavioral defect today. The hazard fires only when a non-pg
writer enters (psql/SQL migration/manual edit with a local-time literal, or a future SQL-side
`now() > protection_until` comparison): windows silently shift by the server's UTC offset.
- **Disposition: recommend a `timestamptz` migration** (safe: existing values
  reinterpret as UTC — exactly how pg wrote them). Schema change = operator policy call,
  not filed unilaterally. Until then: record the invariant "all comparisons JS-side via
  node-pg" in this FID as the load-bearing assumption.
- **ERRATUM (2026-09-16, execution probe):** the "lossless round-trip" claim above is
  **false**. `scripts/e2eProtectionUntilRoundTrip.ts` against the live DB proved node-pg
  parses naive literals back as LOCAL time: wrote `12:34:56.789Z`, read
  `16:34:56.789Z` — **delta +14,400,000 ms** on this EDT host. Every window on a
  non-UTC host is inflated by the server offset (a 72h shield lasts 76h). D2 was
  therefore a live-defect fix, not insurance. Post-migration: `timestamp with time
  zone`, delta **0 ms** — verified both ways in one run each.

### F3 — Clock source & skew — LOW (record-only)

Single host, single clock: every comparison is `new Date()`/`Date.now()` against a
stored absolute deadline. NTP corrections skew windows by ≤ the skew delta; no
cross-host comparison exists. A clock jump cannot resurrect a voided window (void
writes NULL unconditionally — time-independent). Expiry error bounded by skew; no
mitigation needed at current scale. The canonical predicate's injectable `now` keeps
this testable if a logical-clock or DB-time source is ever adopted.

### F4 — NULL handling — CLEAN (verified)

NULL = unprotected at every site: canonical predicate short-circuits; both drifted
copies' `&&`/`!= null` guards match; display helpers return null → no badge; void is an
idempotent no-op on NULL (`.returning()` count 0 — no phantom write, verified in -002
pins). Bots/beer bases are born NULL → always raidable → the base-raid respawn economy
is structurally safe from accidental shielding.

### F5 — Corrupt values (NaN/Invalid Date) — CLEAN (one caveat)

Every implementation degrades **open** (unprotected): canonical by documented design
(Law 14 — a broken clock must never hard-refuse all attacks), copies by JS accident,
display by `Number.isFinite`/`ms <= 0` guards. Caveat folds into F1: only the canonical
degradation is *guaranteed*; the copies' behavior is emergent.

### F6 — Re-trigger & the dead `createPlayer` path — CLEAN by design + cleanup candidate

No re-issuance exists anywhere — a voided or expired window never returns (matches the
-002 principle: the shield protects arrival, not action; re-trigger would re-open the
smurf vector the void closes). One latent landmine: `createPlayer` (playerService:342,
the no-auth variant) issues **no** protection and currently has **zero callers**. If it
ever gains one (OAuth flow, admin tooling), it silently mints unprotected accounts.
- **Disposition: deletion candidate** (same class as the dead `sabotageEngine.ts` twin,
  recorded out-of-scope in -007). Operator call.

### F7 — Expiry boundary — CLEAN

Strict `>` in all three implementations and `ms <= 0 → null` in display: at exactly
T_expiry the account is attackable everywhere, no surface disagreement window, no
boundary flicker between enforcement and UI.

### F8 — UI staleness — INFO (by design)

StatsPanel re-renders the countdown every 30s; displayed remaining time can overstate
by ≤30s and the shield row can linger ≤30s past expiry. Refusal authority is server-side
and always fresh. Accepted in -002's UI design; recorded here for completeness.

### F9 — String-path readiness — INFO

`protectionActive` accepts ISO strings (jsonb payloads); no live caller passes strings
today — all five sites select the raw column (Date). Harmless forward-compat, documented
in-code.

## 4. Errata

1. **Against this FID's own §3 F2 (2026-09-16):** the lossless-round-trip claim was
   wrong — the execution probe measured a +4h read-back shift on a non-UTC host. The
   audit's comparison-semantics reasoning missed that node-pg's *parsing* of naive
   literals is host-timezone-dependent. Lesson recorded: time-zone claims need a
   round-trip probe, not just a write-path inspection.
2. **Against §6's first writing (self-corrected in place):** it claimed the canonical
   predicate's contract had no tests — false; `playerProtection.test.ts` already pins
   boundary/ISO/NULL/corrupt cases.

## 5. Decision asks (operator)

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | Execute F1 refactor (2 call sites → `protectionActive` + message parity) as an enforcement-hygiene FID? | **Yes** — small, behavior-preserving, kills the drift class |
| D2 | Schedule the `timestamptz` migration (F2)? | **Yes, low-urgency** — cheap now, hazardous later |
| D3 | Delete the dead no-auth `createPlayer` (F6)? | **Yes** — or annotate it to fail loudly if ever called |

## 6. Perfection Loop record

**Executed 2026-09-16.** Pass 1 (RED re-verification, live): both drift sites unchanged in tree
(`git diff --stat` empty for movementService/targetingValidator); movement hand-roll re-read at
:87-88; targeting hand-roll + divergent message re-read at :37-38; column type re-confirmed
(`timestamp`, snapshot 0004). Call-graph audit: `playerProtection` imports only drizzle/db/schema
(leaf) → both refactors acyclic (movementService already reaches it transitively via
playerService). Callers of `validateTargeting` re-censused: single live caller
(missileService:221) — message-parity change is one refusal path, covered by -005 pins on
refusal class (not message text). **CONVERGENCE criterion met — plan final, zero open findings.** Execution decisions within the loop: D1 = replace both hand-rolls with `protectionActive`
(+ `PROTECTION_REFUSAL_REASON` in targetingValidator). *(Self-correction on first writing:
the canonical predicate's contract — boundary equality, ISO strings, NULL, corrupt-string
degrade-open — is ALREADY pinned in `__tests__/lib/playerProtection.test.ts`; the §5-F5
caveat was about the copies' emergent behavior, not missing canonical tests. No new
predicate pins owed.)* D3 = delete the dead no-auth `createPlayer` (zero callers,
re-verified) rather than annotate: a landmine you can step on is worse than a missing export.

## 7. Implementation Record

- **Status:** done (2026-09-16, operator go-ahead "fix") — D1 + D2 + D3 executed, gates green.

**D1 — predicate drift refactor:** `movementService.ts` tile intel now calls
`protectionActive`; `wmd/targetingValidator.ts` now calls it and pushes
`PROTECTION_REFUSAL_REASON` (message parity across all six refusal sites). Import edges
to the leaf `playerProtection` module; cycle-free. Behavior-preserving (14/14 predicate
+ targeting pins green).

**D2 — timestamptz migration:** schema column → `{ withTimezone: true }`; migration
`0032_protection_until_timestamptz.sql` applied live via `scripts/applyMigration0032.ts`
(`USING (col AT TIME ZONE 'UTC')` — reinterprets the naive UTC literals without shifting
instants). Round-trip probe: delta +14,400,000 ms before → **0 ms after** (see §3 F2
erratum).

**D3 — dead no-auth `createPlayer` deleted** (playerService, was :342-390): zero callers
re-verified immediately before deletion; the only issuance path is now
`createPlayerWithAuth` (which sets the window). tsc confirms no dangling references.

**Gates:** tsc 0 · eslint 0/0 · vitest 919 passed / 1 skipped. No new pins needed: the
canonical predicate's contract was already pinned, and the refactor is
behavior-preserving by design (message parity is asserted via the shared constant).

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0/0 · [x] tests pass · [x] call-graph proven
- **Commit hash (G2):** `a324cee`
- **Staging plan (G1):** superseded — the implementation commit folded the FID, sessions 020/021, the ledger row, and the code/migration into one (commit `a324cee`, 13 files)
- **Commit message (G8):** `fix: protection window expiry shifted by host UTC offset — timestamptz, canonical predicate everywhere, dead createPlayer removed (FID-20260916-009)`
