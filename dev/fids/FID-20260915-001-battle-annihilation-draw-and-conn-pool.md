# FID-20260915-001: degenerate battle "DRAW" annihilates both armies; conn-pool exhaustion floods the game

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID per templates/FID-TEMPLATE.md.
  Attribution rule honored: no author field, no signatures.
-->

**ID:** FID-20260915-001
**Severity:** CRITICAL
**Status:** converged
**Created:** 2026-09-15

---

## 1. Summary

Two defects shipped in one live incident (operator report, 2026-09-15 ~01:42 local):

1. **Battle resolution is simultaneous and all-or-nothing.** A BASE_RAID
   (`BATTLE-1789450926316-w6eb25`) resolved in one round with BOTH HP pools
   reaching 0 → outcome `DRAW` → `applyBattleResults` applied **full
   casualties to both sides**. The attacker (fame) lost 10,725/10,725 units
   (army wiped in `players.units`, totals zeroed); the defender lost
   6,673/6,673. Every recent raid on record is 1-round: HP is 10–15 per unit
   while per-round damage is in the tens of thousands to millions, so the
   multi-round loop is effectively dead code and the simultaneous strike
   makes mutual annihilation the NORM whenever damage > both HP pools.
2. **Pg connection exhaustion.** All subsequent requests failed with
   `EMAXCONNSESSION max clients reached in session mode - pool_size: 15`
   (Supavisor session pooler). The Next dev server's module-scope pg Pool is
   not hot-reload-safe: recompiled modules instantiate a fresh pool while the
   old pool's idle clients stay connected (observed: 8 idle + repeated
   `DISCARD ALL` churn) until the provider ceiling trips. Login then failed
   ("User not found or account disabled" surfaced from a swallowed query
   error) and the client WebSocket retried in a storm — the "MASSIVE amount
   of errors".

Remediation requirement: fame's wiped army is recoverable **exactly** — the
battle row preserves the full pre-battle `attacker_units` snapshot.

## 2. RED evidence (all live-probed, 2026-09-15)

| # | Evidence | Data |
| --- | --- | --- |
| 1 | Battle row (`battle_logs`) | `BATTLE-1789450926316-w6eb25`, BASE_RAID, DRAW, 1 round |
| 2 | Attacker | 1,072,500 STR / 0 DEF; HP 107,250 → 0; lost **10,725/10,725** |
| 3 | Defender (Hex_Lord_655) | 1,837,715 STR / 788,450 DEF; HP 76,110 → 0; lost **6,673/6,673** |
| 4 | Damage formula reverse-engineered | attackerDamage 678,275 = STR − DEF/2 = 1,072,500 − 788,450/2 ✓; defenderDamage 252,200 = DEF − STR/2 = 788,450 − 1,072,500/2 ✓ |
| 5 | Overkill | attacker dealt 678,275 into 76,110 HP (×8.9); defender dealt 252,200 into 107,250 HP (×2.4) — both pools zeroed same round |
| 6 | Loss model | `calculateUnitLosses(dmg, units)`: kills = ⌊dmg / avgHP⌉ per unit, capped at unit count — overkill → 100% |
| 7 | Draw application | `applyBattleResults` decrements both sides by `unitsLost` regardless of outcome — the wipe is faithful to a broken resolution |
| 8 | HP scale | `HP_PER_STR_UNIT = 10`, `HP_PER_DEF_UNIT = 15` vs damage in the 10⁵–10⁶ range → every stored recent raid is `rounds: 1` |
| 9 | Account state | fame `players.units` = 0 entries, `total_strength/defense` = 0; resources/RP/level intact; army snapshot recoverable from row #1 |
| 10 | Conn flood | server log: `error: (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15` at `getPlayerByEmail` (login), 117 `Failed query` hits in the dev log |
| 11 | Live pg state post-incident | 8 idle Supavisor clients (two pool generations), 0 ungranted locks — exhaustion, not deadlock |
| 12 | Pool code | `lib/db/connection.ts` module-scope `_pool` singleton; comment documents Supavisor 15-client cap; `DATABASE_POOL_MAX` default 5 — safe per-process, unsafe across hot-reload generations |

## 3. Root causes

- **RC1 (simultaneous strike):** the round loop applies `defenderHP -= attackerDamage`
  and `attackerHP -= defenderDamage` in the same iteration, then determines the
  outcome. Both-zero → `Draw`. Casualties for the round are computed from each
  side's full round damage, so both armies annihilate.
- **RC2 (loss proportionality uses raw damage):** `calculateUnitLosses` receives
  the round's raw damage, not the HP actually deducted (clamped at the pool),
  so any lethal round kills 100% of the target's remaining units — consistent
  with pool-death but it also means partial-destruction is impossible for the
  side that dies; combined with RC1 the loser class becomes "both lose".
- **RC3 (100-round cap → forced Draw):** stalemates also end in the
  casualty-applying Draw branch.
- **RC4 (pool not hot-reload-safe):** `_pool` is module-scoped; Next dev
  recompilation creates new module instances with new Pools; orphaned pools'
  clients are never ended → provider session cap (15) tripped under dev churn.

## 4. Converged plan (Perfection Loop: 2 loops, no oscillation)

### Phase 1 — deterministic correctness (this FID's GREEN, implemented)

1. **Sequential resolution:** the attacker strikes first each round; if the
   defender's HP reaches 0 the battle ends immediately — a dead defender
   never counter-attacks. The defender counter-strikes only when alive.
   Rationale: standard wargame semantics; eliminates the both-zero class at
   the root instead of papering over the outcome.
2. **Casualties from HP actually lost:** `calculateUnitLosses` receives the
   clamped HP deduction (min(damage, current pool)), never raw overkill.
3. **Round cap → `DefenderWin`:** a battle that exceeds 100 rounds is a
   repelled raid — attacker loses its accrued casualties, defender holds the
   base. The forced-Draw-with-full-casualties path disappears; `Draw` remains
   only as the degenerate-input guard (empty armies).
4. Round records and the battle message generator follow the new semantics
   (per-round: attacker strike → defender counter if alive).

### Phase 2 — conn-pool hot-reload hardening (this FID's GREEN, implemented)

- Cache the pg Pool on `globalThis` (the standard Next.js dev pattern): every
  module re-instantiation reuses the ONE process-wide pool instead of leaking
  a new pool per recompile. Production behavior is unchanged (one pool per
  process); dev stops orphaning idle clients into the 15-client session cap.

### Phase 3 — rebalance proposal (operator-approved numbers, follow-up)

- HP scale makes unit quality matter: proposed per-unit HP
  `0.1×STR + 0.15×DEF` (today: flat 10/15 by category), so tanky garrisons
  produce multi-round battles and pure-glass raids stay risky. Sim table to
  be produced with the implementation (same-strategy close matchups → 2–5
  rounds; the incident matchup still resolves R1 — correctly).
- Flagged balance shift from Phase 1: attacker-first makes BASE_RAID strictly
  stronger; DEF counter-damage (STR/2 armor-break rule) is retained as the
  doc'd design and tuned in this phase, not silently in Phase 1.

### Phase 4 — remediation + regression guard (this FID's GREEN, implemented)

1. **Restore fame's army** from `BATTLE-1789450926316-w6eb25.attacker_units`
   (10,725 per-unit entries), folded to the canonical quantity-folded
   PlayerUnit shape, totals verified `1,072,500 STR / 0 DEF / 10,725 units`,
   resources/RP untouched, script re-runnable and guarded.
2. **Regression tests** pinning: no casualties after a side's death round;
   the incident matchup resolves `AttackerWin` (not DRAW); capped battle →
   `DefenderWin` without mutual wipe; losses ≤ HP actually lost.

## 5. Verification plan

- Unit tests for resolveBattle semantics (above matrix) green.
- tsc 0 · eslint 0 · full vitest green.
- Live re-run of the incident matchup shape through the production route with
  scratch accounts: outcome `ATTACKER_WIN`, attacker survives with proportional
  losses, defender garrison destroyed, no DRAW-mutual-wipe class.
- Restoration verified in DB (folded shape, exact totals) + report.

## 6. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] live route re-verified
- **Commit hash (G2):** _pending commit_
- **Staging plan:** `lib/battleService.ts`, the new tests, the restore script, this FID, `SCOPE.md`, session record

---

**Loop 1 (falsify):** rejected "tiebreak on overkill margin" (arbitrary) and
"draw = no casualties" (economically incoherent, leaves the degenerate class
alive); sequential resolution falsified the draft's own outcome-only patch by
showing the root is the round semantics, not the outcome mapping.
**Loop 2 (deep audit):** verified capture path (`selectCapturedUnits`) and PvE
opt-out unaffected; verified loss-clamp change is internal to resolveBattle;
verified the 100-round-cap DefenderWin leaves partial attacker casualties
(sensible repelled-raid economics); verified empty-army input still hits the
Draw guard harmlessly; verified restore folding is canonical per the
build-unit write shape (FID-20260914-004 note); flagged and deferred the
attacker-first balance shift to the rebalance phase rather than smuggling a
rebalance into a correctness fix. Loop 2 also caught the FID's own omission —
the diagnosed conn-pool defect had no fix phase — and added Phase 2
(globalThis pool caching) rather than letting the flood ship unfixed.
