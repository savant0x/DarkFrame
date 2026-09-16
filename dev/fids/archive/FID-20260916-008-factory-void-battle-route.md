# FID-20260916-008: Factory-capture void + latent battle-route protection

**Filename:** `FID-20260916-008-factory-void-battle-route.md`
**ID:** FID-20260916-008
**Severity:** MEDIUM
**Status:** closed (2026-09-16, commit `e9bf162`)
**Created:** 2026-09-16

**Provenance:** FID-20260916-006 audit Gaps 2 & 3 (the two remaining enforcement items after
-007 took sabotage and D1/D2 closed the policy calls). Includes an erratum to -006's matrix.

---

## 1. Summary

Two protection-parity gaps remain. **Factory capture** is live-reachable: the -002
target-side refusal exists (`factoryService:386`), but a shielded player can capture
player-owned factories with no forfeit — committed action, no void. **The latent battle
route** (`app/api/battle/attack` → `resolveBattle`) has *neither* a defender refusal *nor* an
attacker void (erratum below): if ever wired to a client it ships the full pre-002 bypass.
Both fixes follow the ratified principle and the -004/-007 seam shape.

## 2. Evidence (RED)

| # | Finding | File:Line | Evidence (executed this session) |
| - | ------- | --------- | -------------------------------- |
| 1 | Factory capture has zero void: `grep -c voidProtectionOnAggression factoryService.ts` → **0** | `lib/factoryService.ts` | capture completes at :437-447 (`owner: username` write) with no protection interaction on the attacker side |
| 2 | The -002 refusal block exists (owner-protection select + `PROTECTION_REFUSAL_REASON` return) | `factoryService.ts:380-397` | verbatim block re-read; helper already imported at :24 |
| 3 | Latent battle route has neither refusal nor void: `grep -c "protectionActive\|voidProtection" app/api/battle/attack/route.ts` → **0** | `app/api/battle/attack/route.ts` | route resolves `resolveBattle` at :71 with session-auth attacker |
| 4 | **Erratum (-006 matrix):** the void does NOT fire "inside resolveBattle" — it lives in `executeInfantryAttack` (battleService:675); `resolveBattle` (:317-655) has no protection code. The latent route therefore lacks both seams, not just the refusal | `lib/battleService.ts` fn boundaries | function-boundary check executed |
| 5 | **PvE safety constraint:** `resolveBattle` is called by the LIVE beer-base raid route too (`combat/attack:325`) — any refusal/void placed inside `resolveBattle` would hit the PvE path; bots carry NULL windows so a refusal there is a no-op, but a void there would make protected players forfeit on PvE raids (a live bug) | `app/api/combat/attack/route.ts:30,325`; comment at `battleService:669-673` ("executeBaseAttack intentionally NOT a void site") | fn-boundary + caller sweep executed |
| 6 | Bot-owned factories must not trigger a void (capture of a bot factory is PvE) | `lib/db/schema/players.ts:57` (`isBot` column) | schema read |

## 3. Impact Analysis

- **Factory void (live):** a protected player farms player-owned factories risk-free —
  asymmetric with infantry/WMD/sabotage precedent; closes with one seam.
- **Latent route:** zero current reachability (no client caller; -006 sweep), but it is the
  last mounted surface with no protection code; parity now prevents a resurrection bug.
- **Blast radius:** one service (void site + owner-select extension), one latent route
  (refusal + void), zero changes to `resolveBattle`/`executeBaseAttack` (PvE untouched).

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases? | Yes — void fires only on real, unprotected player-owned targets; wild/bot/protected cases all handled |
| Scales? | Yes — same single-row-select seam shape as -004/-005/-007 |
| Survives a hostile attacker? | Yes — closes the risk-free factory-farming vector; the latent route gets full parity before it can ever be reached |
| Maintainable? | Yes — extends the existing -002 refusal block; pins per branch; PvE untouched |
| Sets the standard? | Yes — the principle now covers every capture/destroy surface uniformly |

## 5. Proposed Fix (GREEN)

1. **Factory-capture void** (`factoryService.attackFactory`):
   - Extend the -002 owner select (:380-385) to also read `isBot`; capture a boolean
     `pvpCapture = factory.owner && ownerRow && !ownerRow.isBot` (protected owners already
     returned at :386-397, so reaching the void site implies an unprotected real owner).
   - Place `await voidProtectionOnAggression(username)` **after all refusal preconditions**
     (own-factory :365, protected-owner :386, max-factories :400, cooldown :415) and **before
     the power roll** — a cooldown-blocked or refused attempt never forfeits (committed-action
     parity with -004/-007). Fires only when `pvpCapture` is true: wild and bot-owned
     captures are pure PvE and never forfeit.
   - Import: extend the existing `./playerProtection` import at :24 — **no new import edge**.
2. **Latent battle route** (`app/api/battle/attack`):
   - **Defender refusal:** for non-beer-base defenders, select the defender row and refuse
     with `PROTECTION_REFUSAL_REASON` when `protectionActive` (self-target refusal included,
     parity with -005). Beer-base names (bot contract) skip the check.
   - **Attacker void:** after the refusal passes, `voidProtectionOnAggression(session user)`
     before `resolveBattle` — route-level only; **`resolveBattle` itself is not touched**
     (RED 5 constraint).
   - New import edge route → `playerProtection` (acyclic).
3. **Pins (~5, chained-mock idiom):** (1) void fires on player-owned capture attempt before
   the roll; (2) no void on wild factory; (3) no void on bot-owned factory; (4) no void when
   the -002 refusal returns (protected owner); (5) no void on cooldown-blocked attempt.
   Route refusal/void covered by live probes (HTTP, -002 pattern).
4. **Live probes** (`scripts/e2eFactoryBattleProtection.ts`): factory service-direct probes
   (protected owner → refused + window intact; player-owned → void fires; wild → window
   intact); battle route via HTTP with JWT auth (-002 pattern): protected defender → 400 +
   attacker window intact; unprotected defender → resolve proceeds + window NULL; cleanup
   0 residual.
5. **Out of scope, recorded:** `resolveBattle` self-target hardening beyond the refusal
   block; dead `sabotageEngine.ts` cleanup (candidate FID).

## 6. Audit Record

**Pass 1 — RED re-verification (executed 2026-09-16, live tool evidence):** `grep -c
voidProtectionOnAggression factoryService.ts` → 0; latent route `grep -c "protectionActive\|
voidProtection"` → 0; -002 refusal block re-read verbatim (:386-390); function boundaries
confirmed (void in `executeInfantryAttack` :675, not `resolveBattle`); capture block
re-read (:437-447). Tree-freshness re-check immediately before this record: all four files
unchanged. No corrections required.

**Pass 2 — GREEN audit (executed 2026-09-16):**
- **PvE-safety audit (refined):** `executeBaseAttack` has **zero callers** (dead function) —
  the live beer-base raid calls `resolveBattle` directly (`combat/attack:325`). The RED 5
  constraint therefore rests on `resolveBattle`'s live-caller shared use, which is proven;
  the in-code "executeBaseAttack intentionally NOT a void site" comment describes a dead
  function and stays true vacuously. Fix design unchanged: nothing touches `resolveBattle`.
- **Ordering audit:** factory void sits after all four refusal preconditions and before the
  power roll — refused/cooldown-blocked attempts never forfeit; `pvpCapture` gate excludes
  wild (no owner) and bot (`isBot=1`) captures, both pure PvE.
- **Graph audit:** factoryService already imports from `./playerProtection` (:24) — extend,
  don't add; route edge acyclic (same import shape as the infantry route).
- **Coverage audit:** D1/D2 (FID-006 §9) mean no recon/flag seams; -007 covers sabotage —
  with this FID filed, the -006 matrix is fully dispositioned.

CONVERGENCE criterion met — plan final, zero open findings.

## 7. Implementation Record

- **Status:** done (2026-09-16, operator go-ahead) — all seams per the loop-complete spec, gates green, live probes 6/6.

**Seams shipped:**
- `lib/factoryService.ts` — `pvpCapture` flag on the -002 select (player-owned + unprotected owner + non-beer-base owner); `voidProtectionOnAggression(attacker)` fires after all four refusal preconditions and before the power roll — wild and bot captures stay pure PvE (live-probed: protected attacker on a wild factory, window untouched).
- `app/api/battle/attack/route.ts` — route-level defender refusal (`protectionActive` → `PROTECTION_REFUSAL_REASON`, beer-base names skip) + attacker void before `resolveBattle`; the shared resolver is untouched (live beer-base raid calls it directly; `executeBaseAttack` is dead). Route body contract preserved: schema validates `{targetUsername, units}`; raw body carries attacker/defender, and attacker is pinned to the session user.

**Evidence:** 5 pins (`__tests__/lib/factoryCaptureVoid.test.ts`: protected-owner refusal, pvpCapture void, wild no-forfeit, max-factories precondition precedes void, unprotected-owner void) — roll-independent by design; 6/6 live probes (`scripts/e2eFactoryBattleProtection.ts`) incl. the presence-check geometry and the probe-4/5 contrast (identical geometry, only protection state differed → 400 refusal vs. void-then-500 in degenerate `resolveBattle` on empty armies; the void provably fires before resolution). Live probe found both -002-refusal reachability requires a real (protected) owner row — driver fixture design, not a code defect.

**Gates:** tsc 0 · eslint 0/0 · vitest 919 passed / 1 skipped (920 total, +5 pins). Probe server torn down; fixture residual 0.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0/0 · [x] tests pass · [x] call-graph proven
- **Commit hash (G2):** `e9bf162`
- **Staging plan (G1):** superseded — the batch landed under the operator directive `feat: factory-capture protection void + latent battle-route refusal+void (FID-20260916-008)` (`e9bf162`), which folded the implementation code, the spec FID, sessions 016/018, and SCOPE row #67 into one commit.
- **Commit message (G8):** superseded by the G1 note above (the loop-complete doc-batch message was never used as-is).

---

**Final status:** created
