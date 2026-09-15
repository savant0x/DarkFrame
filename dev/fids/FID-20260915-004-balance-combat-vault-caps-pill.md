# FID-20260915-004: deep audit — balance-in-combat, real-garrison weight floor, bot vault caps, factory owned-pill

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID per templates/FID-TEMPLATE.md.
  Attribution rule honored: no author field, no signatures.
-->

**Filename:** `FID-20260915-004-balance-combat-vault-caps-pill.md`
**ID:** FID-20260915-004
**Severity:** HIGH (economy + combat honesty; operator-reported with live evidence BATTLE-17894/12:56)
**Status:** closed (commit `049459b`, canonical: PR #47)
**Created:** 2026-09-15

---

## 1. Evidence (operator's live raid, Zulu_Nightmares_333, tier-2 "massive" bot)

- fame: 9,787 infantry, STR 978,700, DEF 0 (CRITICAL ×0.50 per StatsPanel).
- Result: VICTORY, **1 round, 0 attacker losses**, garrison (184,090 DEF real regrown
  units) dealt **0** counter-damage, loot **452,319,097 energy** (= vault ×3).
- Registry: T1/T2 bots hold up to **1.53B metal / 594M energy** (Devil_Agent, level 5).

## 2. Root causes (audit-confirmed)

1. **Balance penalties never execute in combat.** The full tier suite exists
   (`lib/balanceService.ts`: CRITICAL → power ×0.5, dealt −20%, taken +30%, gathering
   −25%, slots −15%) but consumers are display/leaderboard only
   (`combatPowerService`→stats route, `rankingService`, `harvestEstimate`). Battle proof:
   the raid's R1 strike = 978,700 − 184,090/2 = 886,655 EXACTLY — full STR, no ×0.8
   dealt, no ×1.3 taken. The UI threatens; the engine ignores. (`slotRegenMultiplier`
   has zero consumers anywhere; noted as dead knob.)
2. **Real regrown garrisons have no weight-class treatment.** The FID-20260915-002/-003
   floor+ladder applies only when `units: []`. Against a real garrison, sequential
   resolution lets an overmatched attacker kill the garrison inside its own strike phase
   (886,655 vs 460,350 pool) — dead defenders never counter (FID-20260915-001 rule), so
   the counter is structurally 0. Flag 2 of the tier-sim, now proven live.
3. **Bot vaults grow unbounded.** `botGrowthEngine.applyGrowthPattern` = +5–15% on 70%
   of ticks, no ceiling; spawner ranges (`getResourceRange`: Hoarder T1 37.5k–112.5k)
   are only spawn-time. Months of growth → billions. Loot = `vault × 3` (beer multiplier,
   FID-006a), uncapped → 452M from one R1 raid.
4. **Unit Factory cards show no owned counts** (operator request: pill, top-right).

## 3. Fixes

**A. Balance enters combat (engine seam, both PvP + raids automatically).**
`resolveBattle` computes `calculateBalanceEffects(rawSTR, rawDEF)` per side from the
stats it already assembles (pre-flag/pre-doctrine = true army balance) and applies
`damageDealtMultiplier` to that side's strike and `damageTakenMultiplier` to the damage
it receives. CRITICAL raider now strikes at ×0.8 and takes ×1.3. Zero persistence
dependency; options override for tests (`attackerBalance?/defenderBalance?`).

**B. Real-garrison reinforcement floor (closes Flag 2).** In the raid route, after the
real garrison is read: target DEF = `attackerSTR × GARRISON_DEF_RATIO × tierMult`, STR
pad = `attackerSTR × GARRISON_STR_RATIO × tierMult` (same knobs/ladder as synthesis).
Deficits are reinforced with folded T1_BARRICADE (DEF 100) / T1_MILITIA (STR 90)
"reinforcement" units so the garrison survives to counter — the ladder now governs ALL
bases, not just fresh ones. Reinforcements are ephemeral (battle-scoped, never written).

**C. Vault caps + loot cap + one-time resync.**
- `botGrowthEngine`: clamp regenerated+grown resources to `getResourceRange(spec, tier).max × 2`.
- Raid loot: cap at the same ceiling × beer multiplier (bot bases only).
- Resync script (`scripts/resyncBotVaults.ts`, idempotent): clamps existing bot rows to
  the cap. Player balances are NOT touched (operator's earned loot stays).

**D. Unit Factory owned-pill.** Per unit card (offensive + defensive maps): absolute
top-right pill `×N` from `player.units` totals for that `unitType`.

## 4. Verification plan

- Unit: balance applied to strikes (CRITICAL ×0.8/×1.3 numbers pinned); reinforcement
  floor math; vault cap clamp; loot cap.
- Sim matrix rerun: real-garrison column now shows the ladder gradient (no 0%-loss cells
  at overmatch).
- Live E2E (extension of `scripts/e2eEndgamePacing.ts` semantics): out-of-balance
  CRITICAL raider vs real regrown garrison → multi-round, real losses, balance-bearing
  strike; loot ≤ cap.
- Gates: tsc 0 · lint 0 · vitest full.

## 5. Files

`lib/battleService.ts` · `app/api/combat/attack/route.ts` · `lib/botGrowthEngine.ts` ·
`scripts/resyncBotVaults.ts` · `components/UnitBuildPanelEnhanced.tsx` · tests ·
`docs/design/BASE_RAID_BALANCE.md` · bookkeeping.
