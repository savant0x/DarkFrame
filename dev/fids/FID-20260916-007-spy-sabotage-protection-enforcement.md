# FID-20260916-007: Spy sabotage protection enforcement (+ pipeline repair)

**Filename:** `FID-20260916-007-spy-sabotage-protection-enforcement.md`
**ID:** FID-20260916-007
**Severity:** HIGH
**Status:** verified
**Created:** 2026-09-16

**Provenance:** FID-20260916-006 audit, Gap 1 (HIGH). Grounding for this spec found two
additional defects that change the enforcement design — recorded as RED 2/3 below.

---

## 1. Summary

Spy sabotage (`executeSabotage`, `lib/wmd/spyService.ts:476`) can destroy another player's
missile components, delay construction, and waste resources (`applySabotageDamage:1239`)
with **zero protection interaction** (`grep -c protection spyService.ts` → 0) — the -005
shield-bypass shape one layer down. However, grounding revealed the live path is currently
**broken, not merely unprotected**: the route call transposes two arguments, and the
ownership validation demands an identity the route never supplies. Protection enforcement
therefore ships together with a pipeline repair, an operator-binding assertion, and a
void-at-commit site per the ratified principle (the shield protects arrival, not action).

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence |
| - | ------- | --------- | -------- |
| 1 | Route sabotage branch passes the service `(spyId, targetId, targetType, auth.playerId)` — **transposed** against the service signature `(spyId, targetType, targetId, targetPlayerId)` | `app/api/wmd/intelligence/route.ts:218-223` vs `spyService.ts:476-480` | verbatim call extracted; the missile/business id lands in `targetType`, the type string in `targetId` |
| 2 | Consequence 1: `validateSabotageTarget` switches on `targetType` — receiving an asset id, every branch misses → `default → false` | `spyService.ts:1202-1230` | switch cases `'MISSILE'/'DEFENSE_BATTERY'/'RESEARCH'` cannot match a missile id |
| 3 | Consequence 2: even correctly ordered, the `MISSILE`/`BATTERY` branches require the asset's owner `= targetPlayerId` (:1212, :1219) — but the route passes **the caller's** `auth.playerId` (:222), i.e. the operator, who by definition does not own the victim's missile → always refused | `spyService.ts:1212` + route :222 | verbatim `and(eq(missiles.missileId, targetId), eq(missiles.ownerId, targetPlayerId))` |
| 4 | **Net effect today: live sabotage always refuses with "Invalid sabotage target."** The harm is latent (correcting -006's live reachability), the feature broken | route 400 at :225-230 | service returns `{ success: false, message: 'Invalid sabotage target' }` before any damage write |
| 5 | Zero protection interaction: no target-side refusal, no operator void | `grep -c protection lib/wmd/spyService.ts` → 0 | executed this session |
| 6 | The harm `applySabotageDamage` inflicts on the owner: components destroyed, builds delayed, resources wasted | `spyService.ts:1239-1263+` | `SabotageDamage` shape with `componentsDestroyed`, `progressLost`, `resourcesWasted` |
| 7 | Spy hijack hazard: `getSpy(spyId)` performs **no ownership binding** — any authenticated caller can operate another player's spy; a naive void site using the spy's owner would then punish the victim | `spyService.ts:631-645` | `getSpy` selects by `spyId` only; route never compares `spy.ownerId` to `auth.playerId` |
| 8 | Dead twin module (out of scope): second `executeSabotage` with a different contract, zero importers | `lib/wmd/sabotageEngine.ts:41`; `lib/wmd/index.ts:56-57` comment | barrel skips it; importers grep → none |

## 3. Impact Analysis

- **Who is affected:** protected new accounts (would be sabotage-victims once the pipeline
  works); veterans whose warheads the broken pipeline currently "protects" by accident;
  any account whose spy can be hijacked by another caller (RED 7).
- **Failure modes if only protection were added without the repair:** the refusal/void pins
  would exercise a path no client can reach; the first repair elsewhere would silently
  activate an unprotected destruction channel. Both must land together.
- **Blast radius:** one route branch (argument order), one service (validation returns the
  asset owner instead of demanding it; ownership assertion; two protection sites), no
  schema changes, no client changes (panel payloads unchanged).

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases? | Yes — the owner is derived from the selected asset for every target type; protection applies uniformly |
| Scales? | Yes — same single-seam shape as -004/-005, indexed single-row selects |
| Survives a hostile attacker? | Yes — closes hijack (RED 7), refuses protected owners, voids the right account (the spy's owner) |
| Maintainable in 2 years? | Yes — one validator returning ownership, parity messages, pins per branch |
| Sets the standard? | Yes — extends "shield protects arrival, not action" into information warfare |

## 5. Proposed Fix (GREEN — final per loop §6)

1. **Route repair** (`app/api/wmd/intelligence/route.ts`): call `executeSabotage(spyId, targetType, targetId, auth.playerId)` — correct order, operator identity passed.
2. **Service signature unchanged**; inside `executeSabotage`:
   - **Operator binding (new):** after `getSpy`, refuse `success:false, 'Not your spy'` unless `spy.ownerId === operatorId` (the route's 4th arg). Closes RED 7; guarantees the void hits the right account.
   - **Owner-derived validation (repair):** `validateSabotageTarget` resolves the asset by `targetId` (+type branch) **without** requiring the caller to assert ownership, and returns `{ ok: boolean; ownerUsername: string | null }` — owner read from the asset row (`missiles.ownerId` → players), battery via clan → leader/owner, research row's `playerId` → players.
   - **Target-side refusal:** if `protectionActive(owner.protectionUntil)` → refuse with `PROTECTION_REFUSAL_REASON` (parity with infantry/factory/WMD-launch messages).
   - **Void at commit:** after all preconditions and binding pass, before the success roll — `await voidProtectionOnAggression(spy.ownerUsername)` (username-keyed; execution is the committed action regardless of the roll, mirroring -004's after-preconditions placement). `spyService → playerProtection` import edge (acyclic per §6).
3. **Pins (6, new `__tests__/lib/spySabotageProtection.test.ts`**, chained-mock idiom per the seam suite; needs `wmdSpies`/`wmdSabotageOperations`/`wmdDefenseBatteries`/`playerResearch` table symbols):
   1. protected owner → refused, `PROTECTION_REFUSAL_REASON`, no void update, no sabotage record insert;
   2. unprotected owner → roll reached, void fires (players update, window NULL);
   3. spy owned by someone else → refused "Not your spy", no void (hijack closed);
   4. asset not found → refused, no void (no forfeit on impossible op);
   5. sabotage skill < 30 → refused, no void (precondition ordering);
   6. detection/insert path untouched: record still written with derived owner when unprotected.
4. **Live probes** (driver `scripts/e2eSpySabotageProtection.ts`, -005 pattern): fixtures operator + victim players, one spy row (`wmdSpies`, mirroring `recruitSpy`'s insert shape), one READY missile; probe 1 protected victim → refused + operator window intact; probe 2 unprotected victim → operation executes + operator window NULL; probe 3 hijack (spy of another operator) → refused; cleanup 0 residual.
5. **Out of scope, recorded:** dead `sabotageEngine.ts` (cleanup candidate FID); `startMission`/recon policy call (FID-006 disposition row).

## 6. Audit Record

**Pass 1 — RED re-verification (executed 2026-09-16, live tool evidence):** transposed route
call re-extracted verbatim (route :218-223 passes `targetId` in the `targetType` position)
against the service signature (:476-480); `grep -c protection spyService.ts` → 0; dead twin
`sabotageEngine.ts` re-confirmed with zero importers; `validateSabotageTarget`'s
owner-assertion branches re-read (:1212, :1219). No corrections required.

**Pass 2 — GREEN audit (executed 2026-09-16):**
- **Cycle audit:** `playerProtection.ts` imports only drizzle + db + schema — the new
  `spyService → playerProtection` edge is acyclic.
- **Void-source audit:** the spies row carries `ownerUsername` as a stored column
  (`spyService:116`, written by `recruitSpy` at :194) — the void site uses the spy's own
  stored owner identity; operator binding (fix 2, first bullet) is what guarantees a hijacked
  spy can never cause a victim-owned void, because the hijack refuses before the site is
  reached. Username immutability at signup makes the denormalized column safe; no join needed.
- **Ordering audit:** void sits after every refusal precondition (binding, skill, validation,
  protection) and before the success roll — a failed/undetected-but-executed op still
  commits the attempt (mirrors -004's committed-action placement); impossible ops never
  forfeit.
- **Owner-derivation audit:** missile → `missiles.ownerId`; battery → `clans.leaderId` →
  `getPlayerUsername` (helper already in use at :316); research → row `playerId`. No new
  helpers required.
- **Parity audit:** refusal message reuses `PROTECTION_REFUSAL_REASON` exactly (infantry /
  factory / WMD-launch parity).

CONVERGENCE criterion met — plan final, zero open findings.

## 7. Implementation Record

- **Status:** implemented + verified 2026-09-16 (operator go-ahead).
- **Route repair** (`app/api/wmd/intelligence/route.ts:225`): call now signature-ordered `(spyId, targetType, targetId, auth.playerId)` with the transposition documented in-code.
- **Operator binding** (`spyService:499`): `spy.ownerId !== operatorId` refuses `Not your spy` before all other work — hijack closed, void can never hit an innocent owner.
- **Owner-derived validation** (`resolveSabotageTarget`, `spyService:1234+`): victim resolved FROM the asset — missile `ownerId` / battery `clanId → clans.leaderId` / research row `playerId` — returning the owner's protection window; missing asset/owner and DB errors fail **closed** (new `clans` import is the only schema addition).
- **Target refusal** (`spyService:522`): protected victims get `PROTECTION_REFUSAL_REASON` (parity). **Void at commit** (`spyService:532`): `voidProtectionOnAggression(spy.ownerUsername)` after every precondition, before the roll — the codebase's **4th void site** (battleService, clanService, missileService, spyService).
- **Record correction** (`spyService:555+`): the sabotage record now describes the derived victim, not the caller-asserted id.
- **Pins 6/6** (`__tests__/lib/spySabotageProtection.test.ts`): protected refusal (no void, no record), commit+void (roll-independent), hijack refusal, missing-asset no-forfeit, skill-floor ordering, unavailable ordering. Gates: tsc 0 · eslint 0/0 · vitest **914+1skip**.
- **Live probes 4/4** (`scripts/e2eSpySabotageProtection.ts`, real DB): protected victim refused with operator window intact; unprotected victim committed + operator voided (window NULL); hijack refused with zero writes; 0 fixture residual.
- **Disclosed pre-existing fix:** the record insert always overflowed `wmd_sabotage_operations.id varchar(24)` (base-10 `wso_<13-digit>_<9>` = 27 chars) — never reachable while the broken validator refused every op. Base-36 epoch id (22 chars) applied in-scope with an in-code disclosure comment; without it the repaired pipeline could not persist.
- **Reachability honesty:** no production client sends `action: 'sabotage'` (`WMDIntelligencePanel` only sends `action: 'mission'`, RECONNAISSANCE with a username target) — the pipeline is server-mounted but UI-dormant. Enforcement is in place for the day a UI ships; surfacing sabotage in the panel is a separate product decision outside this FID.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0/0 · [x] tests pass · [x] call-graph proven
- **Commit hash (G2):** `<hash>`
- **Staging plan (G1):** `git add dev/fids/FID-20260916-007-spy-sabotage-protection-enforcement.md dev/session-summaries/SESSION-2026-09-16-014.md SCOPE.md`
- **Commit message (G8):** `docs(fid): spy sabotage protection enforcement spec loop-complete — pipeline repair + void/refusal seams (FID-20260916-007)`

---

**Final status:** created
